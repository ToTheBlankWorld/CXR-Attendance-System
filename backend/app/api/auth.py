from fastapi import APIRouter, HTTPException, status
from datetime import timedelta
from app.schemas.schemas import Token, LoginRequest
from app.core.security import create_access_token, verify_password, get_password_hash
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Store hashed password for admin
ADMIN_PASSWORD_HASH = get_password_hash(settings.ADMIN_PASSWORD)

@router.post("/login", response_model=Token)
async def login(request: LoginRequest):
    """
    Login endpoint - returns JWT token
    """
    if request.username != settings.ADMIN_USERNAME:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if not verify_password(request.password, ADMIN_PASSWORD_HASH):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    access_token = create_access_token(
        data={"sub": request.username},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return Token(access_token=access_token, token_type="bearer")

@router.get("/verify")
async def verify_token_endpoint():
    """
    Verify if token is valid (called with Authorization header)
    """
    return {"valid": True}
