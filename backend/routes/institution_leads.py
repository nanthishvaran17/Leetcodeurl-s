"""
institution_leads.py — API for Multi-College SaaS Onboarding, Institutional Lead Capture & Principal Pitch Outreach
"""

import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, InstitutionLead
from backend.security import get_current_user_optional, require_role
from backend.config import settings
from backend.services.email_service import email_service
from backend.logger import logger

router = APIRouter(prefix="/leads", tags=["Institutional SaaS Leads & Outreach"])


class CollegeLeadRequest(BaseModel):
    college_name: str = Field(..., min_length=3, max_length=250)
    college_code: Optional[str] = Field(None, max_length=50) # TNEA Code
    contact_person: str = Field(..., min_length=2, max_length=150)
    designation: str = Field("Principal", max_length=100) # Principal, TPO, HOD-CSE, Dean
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    district: Optional[str] = Field(None, max_length=100)
    approx_students: int = Field(500, ge=10, le=50000)
    notes: Optional[str] = None


class DispatchPitchRequest(BaseModel):
    recipient_emails: List[EmailStr]
    custom_college_name: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_designation: Optional[str] = "Principal"


def _build_principal_pitch_html(college_name: str = "Your Institution", recipient_name: str = "Respected Principal / Leadership") -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
            .container {{ max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
            .header {{ background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); color: #ffffff; padding: 36px 32px; text-align: left; }}
            .badge {{ display: inline-block; background: rgba(255, 255, 255, 0.15); color: #a5b4fc; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }}
            .header h1 {{ margin: 0; font-size: 22px; font-weight: 800; line-height: 1.3; color: #ffffff; }}
            .content {{ padding: 32px; }}
            .intro {{ font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px; }}
            .feature-box {{ background: #f1f5f9; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; border-left: 4px solid #4f46e5; }}
            .feature-title {{ font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }}
            .feature-desc {{ font-size: 13px; color: #64748b; line-height: 1.5; margin: 0; }}
            .cta-section {{ text-align: center; padding: 28px 0 16px; }}
            .cta-btn {{ display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }}
            .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #94a3b8; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <span class="badge">Institutional Coding Intelligence</span>
                <h1>Empowering Engineering Students with Automated LeetCode & DSA Tracking</h1>
            </div>
            <div class="content">
                <p class="intro">
                    Dear <strong>{recipient_name}</strong>,<br><br>
                    In today's premier campus recruitment landscape (TCS Prime, Cognizant GenC Next, Amazon, Zoho), 
                    <strong>hands-on algorithmic problem-solving on LeetCode</strong> is the #1 selection benchmark.
                </p>
                <p class="intro">
                    We are pleased to introduce <strong>LeetCode Intelligence</strong> — an autonomous, institutional-grade DSA audit and performance platform currently powering top engineering departments with zero manual faculty effort.
                </p>

                <div class="feature-box">
                    <div class="feature-title">⚡ 100% Automated Weekly Contest Audits</div>
                    <p class="feature-desc">Captures Sunday LeetCode Weekly Contests (08:00–09:30 AM IST) in real time. Faculty never need to collect screenshots or spreadsheets again.</p>
                </div>

                <div class="feature-box">
                    <div class="feature-title">🛡️ Forensic Verification & Anti-Plagiarism</div>
                    <p class="feature-desc">Patent-grade solve telemetry verifies question submission timestamps, differentiating genuine live window solves from post-contest practice.</p>
                </div>

                <div class="feature-box">
                    <div class="feature-title">📊 1-Click Executive PDF & NBA/NAAC Reports</div>
                    <p class="feature-desc">Instant department-wise analytics, Tier-1 company cutoffs, student risk bands, and accredited institutional reports ready for academic audits.</p>
                </div>

                <div class="cta-section">
                    <p style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 16px;">
                        We invite <strong>{college_name}</strong> to experience a complimentary 14-day institutional pilot.
                    </p>
                    <a href="http://13.53.231.6/#/for-colleges" class="cta-btn">Schedule Demo / Activate Free Pilot →</a>
                </div>
            </div>
            <div class="footer">
                <p style="margin: 0 0 6px;">LeetCode Institutional Intelligence Platform • Empowering Technical Excellence</p>
                <p style="margin: 0;">For institutional inquiries: nanthishvaran17@gmail.com | WhatsApp: +91-9488358488</p>
            </div>
        </div>
    </body>
    </html>
    """


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_college_lead(
    payload: CollegeLeadRequest,
    db: Session = Depends(get_db)
):
    """
    Public Endpoint: Engineering College Principal / TPO / HOD submits demo or 14-day trial request.
    Stores lead in database and dispatches automated confirmation & notification.
    """
    try:
        # Check if already registered
        existing = db.query(InstitutionLead).filter(InstitutionLead.email.ilike(payload.email)).first()
        if existing:
            existing.college_name = payload.college_name
            existing.contact_person = payload.contact_person
            existing.phone = payload.phone
            existing.approx_students = payload.approx_students
            existing.notes = payload.notes
            db.commit()
            lead = existing
        else:
            lead = InstitutionLead(
                college_name=payload.college_name.strip(),
                college_code=payload.college_code.strip() if payload.college_code else None,
                contact_person=payload.contact_person.strip(),
                designation=payload.designation.strip(),
                email=payload.email.strip().lower(),
                phone=payload.phone.strip(),
                district=payload.district.strip() if payload.district else None,
                approx_students=payload.approx_students,
                notes=payload.notes.strip() if payload.notes else None,
                status="NEW"
            )
            db.add(lead)
            db.commit()
            db.refresh(lead)

        # 1. Send immediate confirmation email to the College Leader
        confirmation_html = f"""
        <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #4f46e5; margin-top: 0;">Welcome to LeetCode Institutional Intelligence!</h2>
            <p>Dear {payload.contact_person} ({payload.designation}, {payload.college_name}),</p>
            <p>Thank you for requesting an institutional demo for <strong>{payload.college_name}</strong>.</p>
            <p>Your 14-Day Free Institutional Trial has been provisioned. Our academic team will assist you in onboarding your students via roll-number roster upload.</p>
            <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <strong>Live Demonstration Portal:</strong> <a href="http://13.53.231.6/#/weekly-contest">Access Live Contest Analytics</a><br>
                <strong>Demo Credentials:</strong> View-only guest access is automatically enabled.
            </div>
            <p>We look forward to partnering with {payload.college_name} to accelerate student placements!</p>
            <p style="font-size: 13px; color: #64748b;">— LeetCode Institutional Intelligence Platform</p>
        </div>
        """
        try:
            email_service.send_email(
                to_email=payload.email,
                subject=f"Institutional Trial Confirmation — {payload.college_name} x LeetCode Intelligence",
                body_html=confirmation_html
            )
        except Exception as e:
            logger.warning(f"[LEAD_REGISTRATION] Confirmation email note: {e}")

        # 2. Alert Admin
        admin_email = getattr(settings, "ADMIN_EMAIL", "nanthishvaran17@gmail.com")
        admin_alert_html = f"""
        <div style="font-family: sans-serif; padding: 20px; border: 2px solid #10b981; border-radius: 10px;">
            <h3 style="color: #10b981; margin-top: 0;">🎉 New College SaaS Lead Registered!</h3>
            <p><strong>College:</strong> {payload.college_name} (Code: {payload.college_code or 'N/A'})</p>
            <p><strong>Contact:</strong> {payload.contact_person} ({payload.designation})</p>
            <p><strong>Email:</strong> {payload.email}</p>
            <p><strong>Phone:</strong> {payload.phone}</p>
            <p><strong>District:</strong> {payload.district or 'Tamil Nadu'}</p>
            <p><strong>Approx Students:</strong> {payload.approx_students}</p>
            <p><strong>Notes:</strong> {payload.notes or 'None'}</p>
        </div>
        """
        try:
            email_service.send_email(
                to_email=admin_email,
                subject=f"🔥 New College Lead: {payload.college_name} ({payload.contact_person})",
                body_html=admin_alert_html
            )
        except Exception as e:
            logger.warning(f"[LEAD_REGISTRATION] Admin alert note: {e}")

        return {
            "success": True,
            "message": f"Successfully registered {payload.college_name} for the 14-day institutional pilot.",
            "lead_id": lead.id,
            "college_name": lead.college_name
        }

    except Exception as err:
        db.rollback()
        logger.error(f"[LEAD_REGISTRATION] Error: {err}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(err)}")


@router.get("/list")
def list_institution_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin"))
):
    """Admin Endpoint: List all registered college leads and trial statuses."""
    leads = db.query(InstitutionLead).order_by(InstitutionLead.id.desc()).all()
    return {
        "total": len(leads),
        "leads": [
            {
                "id": l.id,
                "college_name": l.college_name,
                "college_code": l.college_code,
                "contact_person": l.contact_person,
                "designation": l.designation,
                "email": l.email,
                "phone": l.phone,
                "district": l.district,
                "approx_students": l.approx_students,
                "status": l.status,
                "pitch_sent_at": l.pitch_sent_at.isoformat() if l.pitch_sent_at else None,
                "created_at": l.created_at.isoformat() if l.created_at else None,
                "notes": l.notes
            }
            for l in leads
        ]
    }


@router.post("/dispatch-pitch")
def dispatch_principal_pitch(
    payload: DispatchPitchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin"))
):
    """
    Admin Endpoint: Sends the high-converting Institutional Pitch email
    to a list of Engineering College Principals / TPOs.
    """
    results = []
    college = payload.custom_college_name or "Your Engineering College"
    rec_name = payload.recipient_name or f"Respected {payload.recipient_designation or 'Principal'}"
    
    html_content = _build_principal_pitch_html(college_name=college, recipient_name=rec_name)
    subject = f"Institutional Coding Intelligence & Placement Readiness for {college}"

    for to_email in payload.recipient_emails:
        try:
            success = email_service.send_email(
                to_email=to_email,
                subject=subject,
                body_html=html_content
            )
            results.append({"email": to_email, "status": "SENT" if success else "FAILED"})
            
            # Update lead record if exists
            lead = db.query(InstitutionLead).filter(InstitutionLead.email.ilike(to_email)).first()
            if lead:
                lead.pitch_sent_at = datetime.datetime.now(datetime.timezone.utc)
                lead.status = "CONTACTED"
                db.commit()
        except Exception as e:
            results.append({"email": to_email, "status": "ERROR", "error": str(e)})

    return {
        "success": True,
        "total_dispatched": len(payload.recipient_emails),
        "details": results
    }


@router.get("/pitch-template")
def get_pitch_template_content():
    """
    Returns ready-to-use Cold Email templates in both English & Tamil
    for direct outreach to Engineering Colleges.
    """
    english_pitch = (
        "Subject: Transforming Campus Placement Readiness with Automated LeetCode Intelligence\n\n"
        "Respected Principal / Placement Officer,\n\n"
        "In the ongoing tier-1 recruitment season, companies like TCS Prime, Cognizant GenC Next, Amazon, "
        "and Zoho assess candidates strictly on automated algorithmic coding.\n\n"
        "We have developed LeetCode Institutional Intelligence — an automated real-time analytics platform "
        "that captures every student's Sunday contest performance (08:00–09:30 AM IST) with 0% faculty manual effort.\n\n"
        "Key Benefits for Your Institution:\n"
        "1. Automated Contest Audit & Live Forensic Anti-Plagiarism telemetry.\n"
        "2. 1-Click Executive PDF Reports for NBA/NAAC criteria 2 & 5 accreditation.\n"
        "3. Real-Time Leaderboards & Placement Readiness Risk Banding.\n\n"
        "We are pleased to offer a complimentary 14-day institutional pilot for your college.\n\n"
        "Live Demo: http://13.53.231.6/#/for-colleges\n\n"
        "Warm regards,\n"
        "Institutional Partnerships Team\n"
        "Phone: +91-9488358488 | Email: nanthishvaran17@gmail.com"
    )

    tamil_pitch = (
        "பொருள்: கல்லூரி மாணவர்களின் கேம்பஸ் பிளேஸ்மென்ட் தயார்நிலைக்கான தானியங்கி LeetCode அனலிட்டிக்ஸ் தளம்\n\n"
        "மதிப்பிற்குரிய முதல்வர் / பிளேஸ்மென்ட் அதிகாரி அவர்களுக்கு,\n\n"
        "இன்றைய முன்னணி ஐடி மற்றும் ப்ராடக்ட் நிறுவனங்களின் (TCS Prime, Cognizant, Amazon, Zoho) நேர்முகத் தேர்வில் "
        "LeetCode கோடிங் மிக முக்கியமான தகுதியாக உள்ளது.\n\n"
        "இதற்காக, கல்லூரி பேராசிரியர்களுக்கு எந்தவித கைமுறை வேலையுமின்றி (Zero Manual Work), மாணவர்கள் ஞாயிறு தோறும் "
        "எழுதும் LeetCode Weekly Contest முடிவுகள், அவர்களின் முயற்சி நேரம் மற்றும் ரேட்டிங்கை துல்லியமாக ஆட்டோமேஷன் செய்யும் "
        "LeetCode Institutional Intelligence தளத்தை அறிமுகப்படுத்துகிறோம்.\n\n"
        "முக்கிய பலன்கள்:\n"
        "1. தானியங்கி போட்டி கண்காணிப்பு & ஏமாற்றுதலை தடுக்கும் Forensic Audit.\n"
        "2. NBA / NAAC அக்ரடிடேஷனுக்கான 1-கிளிக் Executive PDF & Excel அறிக்கைகள்.\n"
        "3. மாணவர்கள் எந்த கம்பெனிக்கு தகுதியானவர்கள் என்பதை காட்டும் Placement Readiness Matrix.\n\n"
        "தங்கள் கல்லூரிக்கு 14 நாட்கள் இலவச முன்னோட்ட அனுமதி (Free 14-Day Pilot) வழங்க தயாராக உள்ளோம்.\n\n"
        "நேரடி டெமோ பார்வை: http://13.53.231.6/#/for-colleges\n\n"
        "நன்றியுடன்,\n"
        "LeetCode Intelligence Team\n"
        "தொடர்புக்கு: +91-9488358488 | nanthishvaran17@gmail.com"
    )

    return {
        "english": english_pitch,
        "tamil": tamil_pitch,
        "demo_url": "http://13.53.231.6/#/for-colleges"
    }
