from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select as sa_select
from typing import List
import cv2
import numpy as np
import base64
import os
import logging
from datetime import datetime
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_user
from app.services.face_recognition import face_service
from app.services.attendance_service import attendance_service
from app.services.unknown_tracking_service import unknown_tracking_service
from app.models.models import Student, UnknownFace

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recognition", tags=["Face Recognition"])

UNKNOWN_FACES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "unknown_faces")
os.makedirs(UNKNOWN_FACES_DIR, exist_ok=True)

class RecognizeRequest(BaseModel):
    lecture_id: str
    image: str
    mode: str = "attendance"

class RecognizeResponse(BaseModel):
    faces_detected: int
    recognitions: List[dict]
    unknown_count: int = 0
    unknown_left: List[dict] = []

@router.post("/clear-embeddings")
async def clear_embeddings(
    current_user: dict = Depends(get_current_user)
):
    face_service._class_embeddings = {}
    return {"status": "embeddings cleared"}

@router.post("/load-class/{lecture_id}")
async def load_class_embeddings(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.core.config import settings

    embeddings_path = settings.EMBEDDINGS_PATH
    all_names = []
    if os.path.exists(embeddings_path):
        all_names = [f.replace('.npy', '') for f in os.listdir(embeddings_path) if f.endswith('.npy')]

    loaded = face_service.load_class_embeddings(all_names, clear_first=False)
    return {
        "lecture_id": lecture_id,
        "students_in_class": len(all_names),
        "embeddings_loaded": len(loaded),
        "loaded_ids": list(loaded.keys())
    }

@router.post("/recognize", response_model=RecognizeResponse)
async def recognize_faces(
    request: RecognizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        logger.info(f"Recognize request: lecture_id={request.lecture_id}, image_size={len(request.image)}, mode={request.mode}")
        
        if ',' in request.image:
            image_data = request.image.split(',')[1]
        else:
            image_data = request.image
        
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image data - could not decode")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"Image decode error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Error decoding image: {str(e)}")
    
    results = face_service.process_frame_for_recognition(frame)
    
    recognitions = []
    unknown_count = 0
    
    for result in results:
        recognition = {
            "bbox": result["bbox"],
            "recognized": result["recognized"]
        }
        
        if result["recognized"]:
            name = result["name"]
            
            recognition["name"] = name
            recognition["confidence"] = result["confidence"]
            
            if not face_service.check_cooldown(name):
                await attendance_service.mark_by_session(db, name, request.lecture_id)
                recognition["attendance_marked"] = True
                
                from app.services.attendance_service import LECTURE_STATUS_MAP
                status = LECTURE_STATUS_MAP.get(request.lecture_id, "ENTERED")
                recognition["status"] = status
                logger.info(f"Marked {status}: {name} for session {request.lecture_id}")
                
                face_service.set_cooldown(name)
            else:
                recognition["attendance_marked"] = False
                recognition["in_cooldown"] = True
        else:
            recognition["is_unknown"] = True
            
            face_embedding = result.get("embedding")
            
            if face_embedding is not None:
                try:
                    bbox = result["bbox"]
                    x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
                    h, w = frame.shape[:2]
                    pad = 20
                    x1 = max(0, x1 - pad)
                    y1 = max(0, y1 - pad)
                    x2 = min(w, x2 + pad)
                    y2 = min(h, y2 + pad)
                    
                    face_crop = frame[y1:y2, x1:x2]
                    
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                    filename = f"unknown_{request.lecture_id}_{timestamp}.jpg"
                    filepath = os.path.join(UNKNOWN_FACES_DIR, filename)
                    
                    tracking, is_new = await unknown_tracking_service.track_unknown_face(
                        db, 
                        request.lecture_id, 
                        face_embedding,
                        None
                    )
                    
                    if is_new:
                        cv2.imwrite(filepath, face_crop)
                        
                        tracking.image_path = filename
                        await db.commit()
                        await db.refresh(tracking)
                        
                        recognition["unknown_face_saved"] = filename
                        recognition["tracking_id"] = tracking.tracking_id
                        recognition["is_new_unknown"] = True
                        unknown_count += 1
                        
                        unknown_record = UnknownFace(
                            lecture_id=request.lecture_id,
                            image_path=filename,
                            detected_at=datetime.now(),
                            date=datetime.now().strftime("%Y-%m-%d")
                        )
                        db.add(unknown_record)
                        await db.commit()
                    else:
                        recognition["tracking_id"] = tracking.tracking_id
                        recognition["is_new_unknown"] = False
                        recognition["time_in_class"] = str(datetime.now() - tracking.entry_time).split('.')[0]
                    
                except Exception as e:
                    import traceback
                    print(f"Unknown face tracking error: {e}")
                    traceback.print_exc()
                    recognition["unknown_face_error"] = str(e)
        
        recognitions.append(recognition)
    
    left_faces = await unknown_tracking_service.check_and_mark_left(db, request.lecture_id)
    unknown_left = []
    for face in left_faces:
        unknown_left.append({
            "tracking_id": face.tracking_id,
            "entry_time": face.entry_time.strftime("%H:%M:%S") if face.entry_time else None,
            "exit_time": face.exit_time.strftime("%H:%M:%S") if face.exit_time else None,
            "duration": unknown_tracking_service.format_duration(face.duration_seconds) if face.duration_seconds else "0s",
            "image_path": face.image_path
        })
    
    return RecognizeResponse(
        faces_detected=len(results),
        recognitions=recognitions,
        unknown_count=unknown_count,
        unknown_left=unknown_left
    )

@router.post("/clear-cooldowns")
async def clear_cooldowns(
    current_user: dict = Depends(get_current_user)
):
    face_service.clear_cooldowns()
    return {"message": "Cooldowns cleared"}

@router.post("/stop-attendance/{lecture_id}")
async def stop_attendance(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    left_faces = await unknown_tracking_service.check_and_mark_left(db, lecture_id)
    
    unknown_tracking_service.clear_lecture_tracking(lecture_id)
    face_service.clear_cooldowns()
    
    return {
        "message": f"Attendance stopped for lecture {lecture_id}",
        "unknown_faces_marked_left": len(left_faces)
    }

@router.get("/unknown-tracking")
async def get_unknown_tracking_logs(
    lecture_id: str = None,
    date: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    logs = await unknown_tracking_service.get_unknown_tracking_logs(db, lecture_id, date)
    
    return [{
        "id": log.id,
        "tracking_id": log.tracking_id,
        "lecture_id": log.lecture_id,
        "image_path": log.image_path,
        "entry_time": log.entry_time.strftime("%H:%M:%S") if log.entry_time else None,
        "exit_time": log.exit_time.strftime("%H:%M:%S") if log.exit_time else None,
        "duration_seconds": log.duration_seconds,
        "duration_formatted": unknown_tracking_service.format_duration(log.duration_seconds) if log.duration_seconds else None,
        "status": log.status,
        "date": log.date
    } for log in logs]

@router.get("/active-unknown-count/{lecture_id}")
async def get_active_unknown_count(
    lecture_id: str,
    current_user: dict = Depends(get_current_user)
):
    count = await unknown_tracking_service.get_active_unknown_count(lecture_id)
    return {"lecture_id": lecture_id, "active_unknown_count": count}

@router.get("/enrolled-students")
async def get_enrolled_students(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.core.config import settings

    db_result = await db.execute(sa_select(Student.name))
    name_set = {row[0] for row in db_result.fetchall()}

    embeddings_path = settings.EMBEDDINGS_PATH
    enrolled = []

    if os.path.exists(embeddings_path):
        for filename in os.listdir(embeddings_path):
            if filename.endswith('.npy'):
                student_name = filename.replace('.npy', '')
                enrolled.append({'student_name': student_name})

    enrolled.sort(key=lambda x: str(x['student_name']))

    return {
        'total': len(enrolled),
        'students': enrolled
    }
