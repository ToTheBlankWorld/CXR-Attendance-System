from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import AttendanceResponse
from app.services.attendance_service import attendance_service

router = APIRouter(prefix="/attendance", tags=["Attendance"])

@router.post("/{lecture_id}/mark-present/{reg_no}")
async def mark_student_present(
    lecture_id: str,
    reg_no: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Manually mark a student as present
    """
    attendance = await attendance_service.mark_present(db, reg_no, lecture_id)
    return {"success": True, "message": f"Student {reg_no} marked as present"}

@router.post("/{lecture_id}/mark-absent/{reg_no}")
async def mark_student_absent(
    lecture_id: str,
    reg_no: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Manually mark a student as absent
    """
    attendance = await attendance_service.mark_absent(db, reg_no, lecture_id)
    return {"success": True, "message": f"Student {reg_no} marked as absent"}

@router.post("/{lecture_id}/mark-exit/{reg_no}")
async def mark_student_exit(
    lecture_id: str,
    reg_no: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Mark student exit time
    """
    attendance = await attendance_service.mark_exit(db, reg_no, lecture_id)
    return {"success": True, "message": f"Exit recorded for {reg_no}"}

@router.get("/logs")
async def get_attendance_logs(
    lecture_id: Optional[str] = None,
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get attendance logs with optional filters
    """
    from sqlalchemy import select
    from app.models.models import Student
    
    logs = await attendance_service.get_attendance_logs(db, lecture_id, date)
    
    # Get student names from database
    db_result = await db.execute(select(Student.reg_no, Student.name))
    student_map = {row[0]: row[1] for row in db_result.fetchall()}
    
    # Enrich logs with student names
    enriched_logs = []
    for log in logs:
        enriched_logs.append({
            "id": log.id,
            "reg_no": log.reg_no,
            "student_name": student_map.get(log.reg_no, "Unknown"),
            "lecture_id": log.lecture_id,
            "status": log.status,
            "entry_time": log.entry_time.isoformat() if log.entry_time else None,
            "exit_time": log.exit_time.isoformat() if log.exit_time else None,
            "date": log.date
        })
    
    # Group logs by (reg_no, date) and consolidate activities
    from collections import defaultdict
    grouped = defaultdict(list)
    for log in enriched_logs:
        key = (log['reg_no'], log['date'])
        grouped[key].append(log)
    
    # Create consolidated records with activities array
    # Define session order
    session_order = {'LAB_MORNING': 0, 'LAB_LUNCH': 1, 'LAB_AFTER_LUNCH': 2, 'LAB_EXIT': 3}
    
    result = []
    for (reg_no, date), activities in grouped.items():
        # Get first entry for student info
        first = activities[0]
        # Sort activities by lecture_id order (Morning → Lunch → Return → Exit)
        activities_sorted = sorted(
            activities, 
            key=lambda x: (session_order.get(x['lecture_id'], 999), x['entry_time'] or '')
        )
        
        result.append({
            "id": f"{reg_no}_{date}",
            "reg_no": reg_no,
            "student_name": first['student_name'],
            "date": date,
            "activity_count": len(activities),
            "activities": activities_sorted,
            "first_entry": activities_sorted[0]['entry_time'] if activities_sorted else None,
            "last_exit": activities_sorted[-1]['exit_time'] if activities_sorted else None,
        })
    
    # Sort by date descending, then by reg_no
    result.sort(key=lambda x: (x['date'], x['reg_no']), reverse=True)
    
    return result

@router.post("/{lecture_id}/reset")
async def reset_class_attendance(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Reset all attendance for a class (for testing purposes)
    """
    deleted_count = await attendance_service.reset_class_attendance(db, lecture_id)
    return {
        "success": True, 
        "message": f"Reset {deleted_count} attendance records for class {lecture_id}"
    }

@router.get("/unknown-faces")
async def get_unknown_faces(
    lecture_id: Optional[str] = None,
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get unknown faces logs with optional filters
    """
    from sqlalchemy import select, and_
    from app.models.models import UnknownFace
    
    query = select(UnknownFace)
    
    conditions = []
    if lecture_id:
        conditions.append(UnknownFace.lecture_id == lecture_id)
    if date:
        conditions.append(UnknownFace.date == date)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    query = query.order_by(UnknownFace.detected_at.desc())
    
    result = await db.execute(query)
    unknown_faces = result.scalars().all()
    
    # Get lecture info from CSV
    timetable = csv_service.get_timetable()
    lecture_map = {l['lecture_id']: l['subject'] for l in timetable}
    
    return [
        {
            "id": uf.id,
            "lecture_id": uf.lecture_id,
            "subject": lecture_map.get(uf.lecture_id, "Unknown"),
            "image_path": uf.image_path,
            "detected_at": uf.detected_at.isoformat() if uf.detected_at else None,
            "date": uf.date
        }
        for uf in unknown_faces
    ]

@router.delete("/reset-all")
async def reset_all_logs(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Reset all attendance logs and unknown faces (for testing purposes)
    """
    from sqlalchemy import delete
    from app.models.models import Attendance, UnknownFace
    import os
    import shutil
    
    # Delete all attendance records
    attendance_result = await db.execute(delete(Attendance))
    attendance_count = attendance_result.rowcount
    
    # Delete all unknown face records
    unknown_result = await db.execute(delete(UnknownFace))
    unknown_count = unknown_result.rowcount
    
    await db.commit()
    
    # Clear unknown faces folder
    unknown_faces_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "unknown_faces")
    if os.path.exists(unknown_faces_dir):
        for file in os.listdir(unknown_faces_dir):
            filepath = os.path.join(unknown_faces_dir, file)
            if os.path.isfile(filepath):
                os.remove(filepath)
    
    return {
        "success": True, 
        "message": f"Deleted {attendance_count} attendance records and {unknown_count} unknown face records"
    }
