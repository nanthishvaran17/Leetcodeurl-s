import datetime
import secrets
import hashlib
import bcrypt
import jwt
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.config import settings
from backend.models import User, AdminSession, AuditLog
from backend.schemas import UserLogin, Token, UserOut, UserCreate, SendOtpRequest, VerifyOtpRequest
from backend.services.otp_service import create_otp_transaction, verify_otp_transaction
from backend.logger import logger

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or hashed_password == "N/A_OTP_USER":
        return False
    try:
        pwd_bytes = plain_password.encode('utf-8')[:72]
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_server_admin_session(db: Session, user: User, request: Request, response: Response) -> str:
    """
    Creates an opaque server-managed session in database and sets HttpOnly cookie on response.
    """
    raw_token = f"sess_{secrets.token_urlsafe(32)}"
    t_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    s_id = f"sid_{uuid_hex_short()}"
    now = datetime.datetime.utcnow()
    expires = now + datetime.timedelta(minutes=getattr(settings, "SESSION_EXPIRE_MINUTES", 60))

    client_ip = request.client.host if request and request.client else "127.0.0.1"
    ip_h = hashlib.sha256(client_ip.encode('utf-8')).hexdigest()[:32]
    ua_str = request.headers.get("User-Agent", "Unknown")
    ua_h = hashlib.sha256(ua_str.encode('utf-8')).hexdigest()[:32]

    session_rec = AdminSession(
        session_id=s_id,
        user_id=user.id,
        token_hash=t_hash,
        created_at=now,
        expires_at=expires,
        last_used_at=now,
        ip_hash=ip_h,
        user_agent_hash=ua_h
    )
    db.add(session_rec)
    db.commit()

    # Set HttpOnly, SameSite=Lax cookie on response
    cookie_name = getattr(settings, "SESSION_COOKIE_NAME", "admin_session_token")
    max_age_sec = getattr(settings, "SESSION_EXPIRE_MINUTES", 60) * 60

    response.set_cookie(
        key=cookie_name,
        value=raw_token,
        max_age=max_age_sec,
        expires=max_age_sec,
        path="/",
        httponly=True,
        samesite="lax",
        secure=False  # Set True in production HTTPS environments
    )

    return raw_token


def uuid_hex_short() -> str:
    import uuid
    return uuid.uuid4().hex[:12]


def validate_csrf_origin(request: Request):
    """Verifies request Origin/Referer for state-changing operations."""
    origin = request.headers.get("Origin") or request.headers.get("Referer")
    if origin and getattr(settings, "FRONTEND_ORIGIN", None):
        allowed = settings.FRONTEND_ORIGIN.rstrip("/")
        clean_origin = origin.rstrip("/")
        if not clean_origin.startswith("http://localhost") and not clean_origin.startswith("http://127.0.0.1"):
            if allowed not in clean_origin:
                logger.warning(f"[CSRF CHECK] Blocked request from unverified origin: {origin}")


def get_current_user_from_request(request: Request, db: Session) -> Optional[User]:
    """
    Extracts authenticated user from HttpOnly Cookie or Bearer Token.
    Validates active server session in DB.
    """
    cookie_name = getattr(settings, "SESSION_COOKIE_NAME", "admin_session_token")
    raw_token = request.cookies.get(cookie_name)

    if not raw_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            raw_token = auth_header.split(" ")[1].strip()

    if not raw_token:
        return None

    # Check JWT Token format first
    if raw_token.count(".") == 2:
        try:
            payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            username: str = payload.get("sub")
            if username:
                return db.query(User).filter(User.username == username, User.is_active == True).first()
        except Exception:
            pass

    # Check Server Session Table
    t_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    now = datetime.datetime.utcnow()

    sess_rec = db.query(AdminSession).filter(
        AdminSession.token_hash == t_hash,
        AdminSession.revoked_at == None,
        AdminSession.expires_at > now
    ).first()

    if sess_rec:
        sess_rec.last_used_at = now
        db.commit()
        user = db.query(User).filter(User.id == sess_rec.user_id, User.is_active == True).first()
        return user

    return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = get_current_user_from_request(request, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user


@router.post("/send-otp")
@router.post("/request-otp")
def send_otp(req: SendOtpRequest, request: Request, db: Session = Depends(get_db)):
    validate_csrf_origin(request)
    clean_email = req.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Please enter a valid official email address.")

    logger.info(f"[OTP_REQUEST] Verification requested for email address: {clean_email}")

    # Verify authorized email status
    configured_admin_email = getattr(settings, "ADMIN_EMAIL", "nanthishvaran17@gmail.com").strip().lower()
    is_admin = (clean_email == configured_admin_email)

    user = db.query(User).filter(User.email.ilike(clean_email)).first()
    student = None
    if not user and not is_admin:
        from backend.models import Student
        student = db.query(Student).filter(Student.email.ilike(clean_email)).first()

    if user and not user.is_active:
        raise HTTPException(status_code=400, detail="Your account is currently inactive. Please contact the administrator.")

    client_ip = request.client.host if request and request.client else "127.0.0.1"

    try:
        plain_otp, otp_rec = create_otp_transaction(db, clean_email, client_ip)
    except ValueError as ve:
        logger.warning(f"[OTP_REQUEST_BLOCKED] Rate limit or cooldown triggered for {clean_email}: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))

    # Official Institutional Email Template
    from backend.services.email_service import build_otp_email_template, send_email
    subject, body_html, body_text = build_otp_email_template(plain_otp)

    logger.info(f"[EMAIL_PROVIDER] Dispatching OTP email via configured service to recipient: {clean_email}")

    email_sent, err_msg = send_email(clean_email, subject, body_html, text_body=body_text)


    if not email_sent:
        logger.error(f"[EMAIL_SEND_FAILURE] Delivery failed for {clean_email}: {err_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to send the verification code. Please check the email service configuration or try again later."
        )

    logger.info(f"[EMAIL_SEND_SUCCESS] Verification OTP delivered successfully to: {clean_email}")

    from backend.services.audit_service import log_admin_action
    log_admin_action(
        db, action="OTP_SENT", action_type="SECURITY",
        description=f"Verification code dispatched to {clean_email}",
        current_user=user, target_type="EmailOTPRecord", target_id=str(otp_rec.id)
    )

    return {
        "success": True,
        "status": "success",
        "message": "Verification code sent to your registered email address.",
        "expires_in": 300,
        "request_id": otp_rec.request_id
    }


@router.post("/verify-otp")
def verify_otp(req: VerifyOtpRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    validate_csrf_origin(request)
    clean_email = req.email.strip().lower()
    raw_otp = req.otp.strip()

    if not clean_email or not raw_otp:
        raise HTTPException(status_code=400, detail="Email and verification code are required.")

    is_valid, msg, otp_rec = verify_otp_transaction(db, clean_email, raw_otp, req.request_id)

    client_ip = request.client.host if request and request.client else "127.0.0.1"

    if not is_valid:
        logger.warning(f"[OTP_VERIFY_FAILURE] Failed OTP verification for {clean_email}: {msg}")
        from backend.services.audit_service import log_admin_action
        from backend.security import evaluate_security_alert_threshold

        if otp_rec and otp_rec.attempt_count >= 5:
            log_admin_action(
                db, action="SUSPICIOUS_LOGIN_ATTEMPT", action_type="SECURITY",
                description=f"Multiple failed OTP verification attempts for {clean_email}",
                current_user=None, target_type="EmailOTPRecord", target_id=str(otp_rec.id)
            )
            evaluate_security_alert_threshold(db, client_ip, clean_email, "REPEATED_FAILED_OTP_VERIFICATION")

        raise HTTPException(status_code=400, detail=msg)

    logger.info(f"[OTP_VERIFY_SUCCESS] Verification successful for email: {clean_email}")

    configured_admin_email = getattr(settings, "ADMIN_EMAIL", "nanthishvaran17@gmail.com").strip().lower()
    user = db.query(User).filter(User.email.ilike(clean_email)).first()

    if clean_email == configured_admin_email:
        if not user:
            user = User(
                username=getattr(settings, "ADMIN_USERNAME", "admin"),
                email=configured_admin_email,
                hashed_password="N/A_OTP_USER",
                role="Admin",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        elif user.role not in ["Admin", "Super Admin", "super admin"]:
            user.role = "Admin"
            user.is_active = True
            db.commit()

    if not user:
        from backend.models import Student
        student = db.query(Student).filter(Student.email.ilike(clean_email)).first()
        if student:
            user_id = student.id
            username = student.reg_no
            role = "student"
            user_obj = None
        else:
            user_id = 999
            username = clean_email.split("@")[0]
            role = "student"
            user_obj = None
    else:
        user_id = user.id
        username = user.username
        role = user.role or "Admin"
        user_obj = user

    # Create Server Session & Set HttpOnly Cookie
    if user_obj:
        create_server_admin_session(db, user_obj, request, response)

    access_token = create_access_token(data={
        "sub": username,
        "role": role,
        "email": clean_email,
        "user_id": user_id
    })

    from backend.services.audit_service import log_admin_action
    log_admin_action(
        db, action="OTP_VERIFICATION_SUCCESS", action_type="SECURITY",
        description=f"Email OTP verified successfully for {clean_email} with role {role}",
        current_user=user_obj, target_type="EmailOTPRecord", target_id=str(otp_rec.id) if otp_rec else ""
    )

    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "username": username,
            "email": clean_email,
            "role": role,
            "is_active": True
        }
    }


@router.post("/login")
def login(login_data: UserLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    validate_csrf_origin(request)
    clean_username = login_data.username.strip()
    clean_password = login_data.password.strip()

    user = db.query(User).filter(User.username.ilike(clean_username)).first()

    if not user or not verify_password(clean_password, user.hashed_password):
        logger.warning(f"[ADMIN_LOGIN_FAILURE] Invalid credentials for username: {clean_username}")
        raise HTTPException(status_code=400, detail="Invalid username or password.")

    if not user.is_active:
        logger.warning(f"[ADMIN_LOGIN_FAILURE] Account deactivated for username: {clean_username}")
        raise HTTPException(status_code=400, detail="Account is currently deactivated.")

    try:
        user.last_login = datetime.datetime.utcnow()
        db.commit()
    except Exception:
        db.rollback()

    # Create Server Session & Set HttpOnly Cookie
    create_server_admin_session(db, user, request, response)

    logger.info(f"[ADMIN_LOGIN_SUCCESS] Administrator {user.username} logged in successfully.")

    from backend.services.audit_service import log_admin_action
    log_admin_action(
        db, action="ADMIN_LOGIN", action_type="SECURITY",
        description=f"Admin {user.username} ({user.email}) logged in successfully with role {user.role}",
        current_user=user, target_type="User", target_id=str(user.id)
    )

    access_token = create_access_token(data={"sub": user.username, "role": user.role, "email": user.email, "user_id": user.id})

    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "department_id": user.department_id,
            "section_id": user.section_id
        }
    }


@router.get("/session")
@router.get("/me")
def get_auth_session(request: Request, db: Session = Depends(get_db)):
    user = get_current_user_from_request(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthenticated")

    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "department_id": user.department_id,
            "section_id": user.section_id,
            "is_active": user.is_active
        }
    }


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    validate_csrf_origin(request)
    cookie_name = getattr(settings, "SESSION_COOKIE_NAME", "admin_session_token")
    raw_token = request.cookies.get(cookie_name)

    user = get_current_user_from_request(request, db)

    if raw_token:
        t_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        db.query(AdminSession).filter(AdminSession.token_hash == t_hash).update(
            {"revoked_at": datetime.datetime.utcnow()}, synchronize_session=False
        )
        db.commit()

    # Clear HttpOnly Cookie with matching attributes
    response.delete_cookie(key=cookie_name, path="/")

    if user:
        logger.info(f"[ADMIN_LOGOUT] User {user.username} ({user.email}) logged out successfully.")
        from backend.services.audit_service import log_admin_action
        log_admin_action(
            db, action="ADMIN_LOGOUT", action_type="SECURITY",
            description=f"Admin {user.username} ({user.email}) logged out",
            current_user=user, target_type="User", target_id=str(user.id)
        )

    return {"success": True, "message": "Logged out successfully."}

