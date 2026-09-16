from fastapi import Request, Response
from fastapi.responses import JSONResponse
import urllib.parse
import re

async def global_csrf_middleware(request: Request, call_next):
    def _add_cors_headers_to_response(req: Request, res_headers) -> None:
        origin = req.headers.get("origin")
        if origin:
            res_headers["Access-Control-Allow-Origin"] = origin
            res_headers["Access-Control-Allow-Credentials"] = "true"
            res_headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            res_headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, User-Agent, DNT, Cache-Control, X-Mx-ReqToken, X-Requested-With, Bypass-Tunnel-Reminder, X-App-Origin"
            res_headers["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Length, Content-Type, X-Cache"


    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        # We only enforce CSRF on API routes.
        if request.url.path.startswith("/api/"):
            raw_origin = request.headers.get("Origin") or request.headers.get("Referer") or request.headers.get("X-App-Origin")
            if not raw_origin:
                # To fail closed for cookie-based CSRF, we must require Origin/Referer/X-App-Origin
                response = JSONResponse(status_code=403, content={"detail": "CSRF validation failed. Origin/Referer missing."})
                _add_cors_headers_to_response(request, response.headers)
                return response
            
            try:
                parsed = urllib.parse.urlparse(raw_origin)
                if parsed.scheme and parsed.netloc:
                    clean_origin = f"{parsed.scheme}://{parsed.netloc}".lower()
                else:
                    clean_origin = raw_origin.rstrip("/").lower()
            except Exception:
                clean_origin = raw_origin.rstrip("/").lower()

            allowed_origins = [
                "https://leetcodeurl-s-roan.vercel.app",
                "capacitor://localhost", "ionic://localhost",
                "http://localhost", "https://localhost",
                "http://127.0.0.1", "https://127.0.0.1"
            ]
            
            from backend.config import settings
            env_origin = getattr(settings, "FRONTEND_ORIGIN", None)
            if env_origin:
                allowed_origins.append(env_origin.rstrip("/").lower())

            cors_allowed = getattr(settings, "CORS_ALLOWED_ORIGINS", None)
            if cors_allowed:
                for o in cors_allowed.split(","):
                    o_clean = o.strip().rstrip("/").lower()
                    if o_clean and o_clean not in allowed_origins:
                        allowed_origins.append(o_clean)
            
            is_valid = False
            if clean_origin in allowed_origins:
                is_valid = True
            elif re.match(r"^(http|https)://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}|[a-zA-Z0-9-]+\.local)(:\d+)?$", clean_origin):
                is_valid = True
            elif any(clean_origin.startswith(s) for s in ("capacitor://", "ionic://", "app://", "file://")):
                is_valid = True
            elif re.match(r"^https://[a-zA-Z0-9-]+\.(vercel\.app|netlify\.app|web\.app|firebaseapp\.com|pages\.dev|loca\.lt)$", clean_origin):
                is_valid = True
                
            if not is_valid:
                response = JSONResponse(status_code=403, content={"detail": f"CSRF validation failed. Unrecognized request origin: {raw_origin}"})
                _add_cors_headers_to_response(request, response.headers)
                return response
    
    return await call_next(request)
