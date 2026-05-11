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

# Path for saving unknown faces
UNKNOWN_FACES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "unknown_faces")
os.makedirs(UNKNOWN_FACES_DIR, exist_ok=True)

class RecognizeRequest(BaseModel):
    lecture_id: str
    image: str  # base64 encoded frame
    mode: str = "attendance"  # "attendance" or "monitoring"

class RecognizeResponse(BaseModel):
    faces_detected: int
    recognitions: List[dict]
    unknown_count: int = 0
    unknown_left: List[dict] = []  # Unknown faces that just left

@router.post("/clear-embeddings")
async def clear_embeddings(
    current_user: dict = Depends(get_current_user)
):
    """
    Clear all loaded embeddings - call this before starting attendance
    """
    face_service._class_embeddings = {}
    return {"status": "embeddings cleared"}

@router.post("/load-class/{lecture_id}")
async def load_class_embeddings(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Load embeddings for a lab/class session from the database.
    For lab sessions loads ALL enrolled students' embeddings.
    """
    from app.core.config import settings

    LAB_SESSIONS = {"LAB_MORNING", "LAB_LUNCH", "LAB_AFTER_LUNCH", "LAB_EXIT", "all"}

    # Get all reg_nos from DB (students table)
    result = await db.execute(sa_select(Student.reg_no))
    all_reg_nos = [row[0] for row in result.fetchall()]

    if lecture_id in LAB_SESSIONS:
        # Load ALL enrolled students
        loaded = face_service.load_class_embeddings(all_reg_nos, clear_first=False)
        return {
            "lecture_id": lecture_id,
            "students_in_class": len(all_reg_nos),
            "embeddings_loaded": len(loaded),
            "loaded_ids": list(loaded.keys())
        }
    else:
        # For non-lab classes, still load all (can scope by class later if needed)
        loaded = face_service.load_class_embeddings(all_reg_nos, clear_first=False)
        return {
            "lecture_id": lecture_id,
            "students_in_class": len(all_reg_nos),
            "embeddings_loaded": len(loaded),
            "loaded_ids": list(loaded.keys())
        }

@router.post("/recognize", response_model=RecognizeResponse)
async def recognize_faces(
    request: RecognizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Recognize faces in a frame and return matches
    mode: "attendance" - mark present, "monitoring" - mark absent if present student seen
    """
    # Decode base64 image
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
    
    # Build name_map from DB — no CSV needed
    db_students_result = await db.execute(sa_select(Student.reg_no, Student.name))
    db_students = db_students_result.fetchall()
    
    # name_map: reg_no -> name  (also name -> name for safety)
    name_map = {row[0]: row[1] for row in db_students}
    name_map.update({row[1]: row[1] for row in db_students})
    # reg_no_map: name -> reg_no
    reg_no_map = {row[1]: row[0] for row in db_students}
    
    logger.info(f"DB name_map: loaded {len(db_students)} students for {request.lecture_id}")
    
    # Process frame
    results = face_service.process_frame_for_recognition(frame)
    
    recognitions = []
    unknown_count = 0
    
    for result in results:
        recognition = {
            "bbox": result["bbox"],
            "recognized": result["recognized"]
        }
        
        if result["recognized"]:
            matched_id = result["reg_no"]
            
            # Map name to reg_no if needed
            actual_reg_no = reg_no_map.get(matched_id, matched_id)
            name = name_map.get(matched_id, name_map.get(actual_reg_no, "Unknown"))
            
            recognition["reg_no"] = actual_reg_no
            recognition["name"] = name
            recognition["confidence"] = result["confidence"]
            
            # Check cooldown
            if not face_service.check_cooldown(actual_reg_no):
                # Mark status based on current session (lecture_id determines the action)
                await attendance_service.mark_by_session(db, actual_reg_no, request.lecture_id)
                recognition["attendance_marked"] = True
                
                # Determine status label for response
                from app.services.attendance_service import LECTURE_STATUS_MAP
                status = LECTURE_STATUS_MAP.get(request.lecture_id, "ENTERED")
                recognition["status"] = status
                logger.info(f"✅ Marked {status}: {name} ({actual_reg_no}) for session {request.lecture_id}")
                
                face_service.set_cooldown(actual_reg_no)
            else:
                recognition["attendance_marked"] = False
                recognition["in_cooldown"] = True
        else:
            # Unknown face detected
            recognition["is_unknown"] = True
            
            # Get embedding from the result
            face_embedding = result.get("embedding")
            
            if face_embedding is not None:
                # Track this unknown face with entry/exit tracking
                try:
                    # Crop face from frame first
                    bbox = result["bbox"]
                    x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
                    # Add padding
                    h, w = frame.shape[:2]
                    pad = 20
                    x1 = max(0, x1 - pad)
                    y1 = max(0, y1 - pad)
                    x2 = min(w, x2 + pad)
                    y2 = min(h, y2 + pad)
                    
                    face_crop = frame[y1:y2, x1:x2]
                    
                    # Generate filename for potential saving
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                    filename = f"unknown_{request.lecture_id}_{timestamp}.jpg"
                    filepath = os.path.join(UNKNOWN_FACES_DIR, filename)
                    
                    # Track unknown face - pass None first, we'll update later if new
                    tracking, is_new = await unknown_tracking_service.track_unknown_face(
                        db, 
                        request.lecture_id, 
                        face_embedding,
                        None  # Don't pass filename yet
                    )
                    
                    if is_new:
                        # Save image only for new unknown faces
                        cv2.imwrite(filepath, face_crop)
                        
                        # Update tracking record with image path
                        tracking.image_path = filename
                        await db.commit()
                        await db.refresh(tracking)
                        
                        recognition["unknown_face_saved"] = filename
                        recognition["tracking_id"] = tracking.tracking_id
                        recognition["is_new_unknown"] = True
                        unknown_count += 1
                        
                        # Also save to legacy UnknownFace table
                        unknown_record = UnknownFace(
                            lecture_id=request.lecture_id,
                            image_path=filename,
                            detected_at=datetime.now(),
                            date=datetime.now().strftime("%Y-%m-%d")
                        )
                        db.add(unknown_record)
                        await db.commit()
                    else:
                        # Known unknown face still present
                        recognition["tracking_id"] = tracking.tracking_id
                        recognition["is_new_unknown"] = False
                        recognition["time_in_class"] = str(datetime.now() - tracking.entry_time).split('.')[0]
                    
                except Exception as e:
                    import traceback
                    print(f"Unknown face tracking error: {e}")
                    traceback.print_exc()
                    recognition["unknown_face_error"] = str(e)
        
        recognitions.append(recognition)
    
    # Check for unknown faces that have left (not seen recently)
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
    """
    Clear all recognition cooldowns
    """
    face_service.clear_cooldowns()
    return {"message": "Cooldowns cleared"}

@router.post("/stop-attendance/{lecture_id}")
async def stop_attendance(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Stop attendance for a lecture. 
    Marks all active unknown faces as left and clears tracking.
    """
    # Mark all remaining unknown faces as left
    left_faces = await unknown_tracking_service.check_and_mark_left(db, lecture_id)
    
    # Clear in-memory tracking
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
    """
    Get unknown face tracking logs with entry/exit times
    """
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
    """
    Get count of currently active unknown faces in a lecture
    """
    count = await unknown_tracking_service.get_active_unknown_count(lecture_id)
    return {"lecture_id": lecture_id, "active_unknown_count": count}

@router.get("/enrolled-students")
async def get_enrolled_students(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of all enrolled students.
    Source of truth = .npy embedding files.
    Names come from the Student DB table (upserted on enrollment).
    Falls back to reg_no as name for any legacy .npy with no DB record.
    """
    from app.core.config import settings

    # Build reg_no -> name map from DB
    db_result = await db.execute(sa_select(Student.reg_no, Student.name))
    name_lookup = {row[0]: row[1] for row in db_result.fetchall()}

    # List all .npy files — these are the ground truth of who is enrolled
    embeddings_path = settings.EMBEDDINGS_PATH
    enrolled = []

    if os.path.exists(embeddings_path):
        for filename in os.listdir(embeddings_path):
            if filename.endswith('.npy'):
                reg_no = filename.replace('.npy', '')
                # Use DB name if found; show reg_no as name for legacy entries
                student_name = name_lookup.get(reg_no, reg_no)
                enrolled.append({'reg_no': reg_no, 'student_name': student_name})

    enrolled.sort(key=lambda x: str(x['reg_no']))

    return {
        'total': len(enrolled),
        'students': enrolled
    }
