import os
import cv2
import numpy as np
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Student, Embedding
from app.services.face_recognition import face_service
from app.core.config import settings
import logging
import base64

logger = logging.getLogger(__name__)

class EnrollmentService:
    
    async def enroll_student_from_images(
        self,
        db: AsyncSession,
        reg_no: str,
        name: str,
        images: List[np.ndarray]
    ) -> Tuple[bool, str]:
        """
        Enroll a student from captured images
        Saves embedding with reg_no and stores name in database
        """
        if len(images) < 1:
            return False, "At least 1 image is required"
        
        # Compute average embedding
        avg_embedding = face_service.compute_average_embedding(images)
        
        if avg_embedding is None:
            return False, "Could not detect face in images"
        
        # Check if student already exists
        result = await db.execute(
            select(Student).where(Student.reg_no == reg_no)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update name and embedding
            existing.name = name
            emb_result = await db.execute(
                select(Embedding).where(Embedding.reg_no == reg_no)
            )
            existing_emb = emb_result.scalar_one_or_none()
            
            if existing_emb:
                existing_emb.vector = avg_embedding.tobytes()
            else:
                new_embedding = Embedding(
                    reg_no=reg_no,
                    vector=avg_embedding.tobytes()
                )
                db.add(new_embedding)
        else:
            # Create new student and embedding
            new_student = Student(reg_no=reg_no, name=name)
            db.add(new_student)
            
            new_embedding = Embedding(
                reg_no=reg_no,
                vector=avg_embedding.tobytes()
            )
            db.add(new_embedding)
        
        await db.commit()
        
        # Save .npy embedding file with reg_no as filename
        face_service.save_embedding(reg_no, avg_embedding)
        
        return True, "Student enrolled successfully"
    
    def process_base64_image(self, base64_str: str) -> Optional[np.ndarray]:
        """Convert base64 image to numpy array"""
        try:
            # Remove data URL prefix if present
            if ',' in base64_str:
                base64_str = base64_str.split(',')[1]
            
            img_bytes = base64.b64decode(base64_str)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            logger.error(f"Error processing base64 image: {e}")
            return None

enrollment_service = EnrollmentService()
