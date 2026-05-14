from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import AttendanceResponse
from app.services.attendance_service import attendance_service

router = APIRouter(prefix="/attendance", tags=["Attendance"])

@router.post("/{lecture_id}/mark-present/{name}")
async def mark_student_present(
    lecture_id: str,
    name: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    attendance = await attendance_service.mark_present(db, name, lecture_id)
    return {"success": True, "message": f"Student {name} marked as present"}

@router.post("/{lecture_id}/mark-absent/{name}")
async def mark_student_absent(
    lecture_id: str,
    name: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    attendance = await attendance_service.mark_absent(db, name, lecture_id)
    return {"success": True, "message": f"Student {name} marked as absent"}

@router.post("/{lecture_id}/mark-exit/{name}")
async def mark_student_exit(
    lecture_id: str,
    name: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    attendance = await attendance_service.mark_exit(db, name, lecture_id)
    return {"success": True, "message": f"Exit recorded for {name}"}

@router.get("/logs")
async def get_attendance_logs(
    lecture_id: Optional[str] = None,
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from sqlalchemy import select
    from app.models.models import Student
    
    logs = await attendance_service.get_attendance_logs(db, lecture_id, date)
    
    db_result = await db.execute(select(Student))
    student_map = {s.id: s.name for s in db_result.scalars().all()}
    
    enriched_logs = []
    for log in logs:
        enriched_logs.append({
            "id": log.id,
            "student_name": student_map.get(log.student_id, "Unknown"),
            "lecture_id": log.lecture_id,
            "status": log.status,
            "entry_time": log.entry_time.isoformat() if log.entry_time else None,
            "exit_time": log.exit_time.isoformat() if log.exit_time else None,
            "date": log.date
        })
    
    from collections import defaultdict
    grouped = defaultdict(list)
    for log in enriched_logs:
        key = (log['student_name'], log['date'])
        grouped[key].append(log)
    
    session_order = {'LAB_MORNING': 0, 'LAB_LUNCH': 1, 'LAB_AFTER_LUNCH': 2, 'LAB_EXIT': 3}
    
    result = []
    for (student_name, date), activities in grouped.items():
        first = activities[0]
        activities_sorted = sorted(
            activities, 
            key=lambda x: (session_order.get(x['lecture_id'], 999), x['entry_time'] or '')
        )
        
        result.append({
            "id": f"{student_name}_{date}",
            "student_name": student_name,
            "date": date,
            "activity_count": len(activities),
            "activities": activities_sorted,
            "first_entry": activities_sorted[0]['entry_time'] if activities_sorted else None,
            "last_exit": activities_sorted[-1]['exit_time'] if activities_sorted else None,
        })
    
    result.sort(key=lambda x: (x['date'], x['student_name']), reverse=True)
    
    return result

@router.post("/{lecture_id}/reset")
async def reset_class_attendance(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
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
    
    from app.services.csv_service import csv_service
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
    from sqlalchemy import delete
    from app.models.models import Attendance, UnknownFace
    import os
    import shutil
    
    attendance_result = await db.execute(delete(Attendance))
    attendance_count = attendance_result.rowcount
    
    unknown_result = await db.execute(delete(UnknownFace))
    unknown_count = unknown_result.rowcount
    
    await db.commit()
    
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
