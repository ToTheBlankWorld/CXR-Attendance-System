from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import cv2
import numpy as np
import base64
import os
from app.schemas.schemas import EnrollmentResponse, EnrollBase64Request
from app.services.enrollment_service import enrollment_service
from app.services.face_recognition import face_service
from app.core.database import get_db
from app.models.models import Student, Embedding

router = APIRouter(prefix="/enrollment", tags=["Enrollment"])

@router.post("/enroll", response_model=EnrollmentResponse)
async def enroll_student(
    name: str = Form(...),
    images: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db)
):
    if len(images) < 1:
        raise HTTPException(status_code=400, detail="At least 1 image is required")
    
    processed_images = []
    for image_file in images:
        contents = await image_file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            processed_images.append(img)
    
    if len(processed_images) == 0:
        raise HTTPException(status_code=400, detail="No valid images provided")
    
    avg_embedding = face_service.compute_average_embedding(processed_images)
    if avg_embedding is None:
        raise HTTPException(status_code=400, detail="Could not detect face in images")
    
    success = face_service.save_embedding(name, avg_embedding)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save embedding")
    
    result = await db.execute(select(Student).where(Student.name == name))
    existing = result.scalar_one_or_none()
    if existing:
        existing.name = name
    else:
        db.add(Student(name=name))
    await db.commit()
    
    return EnrollmentResponse(
        success=True,
        message=f"Student {name} enrolled successfully",
        name=name
    )

@router.post("/enroll-base64", response_model=EnrollmentResponse)
async def enroll_student_base64(
    request: EnrollBase64Request,
    db: AsyncSession = Depends(get_db)
):
    name = request.name
    images = request.images

    if len(images) < 1:
        raise HTTPException(status_code=400, detail="At least 1 image is required")
    
    processed_images = []
    for base64_img in images:
        img = enrollment_service.process_base64_image(base64_img)
        if img is not None:
            processed_images.append(img)
    
    if len(processed_images) == 0:
        raise HTTPException(status_code=400, detail="No valid images provided")
    
    avg_embedding = face_service.compute_average_embedding(processed_images)
    if avg_embedding is None:
        raise HTTPException(status_code=400, detail="Could not detect face in images")
    
    success = face_service.save_embedding(name, avg_embedding)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save embedding")
    
    result = await db.execute(select(Student).where(Student.name == name))
    existing = result.scalar_one_or_none()
    if existing:
        existing.name = name
    else:
        db.add(Student(name=name))
    await db.commit()
    
    return EnrollmentResponse(
        success=True,
        message=f"Member {name} enrolled successfully",
        name=name
    )

@router.get("/check/{name}")
async def check_enrollment(name: str):
    embedding = face_service.load_embedding(name)
    return {
        "name": name,
        "enrolled": embedding is not None
    }
