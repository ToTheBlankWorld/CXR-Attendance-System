from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import LectureResponse, ClassDetailResponse, StudentAttendanceInfo
from app.services.csv_service import csv_service
from app.services.attendance_service import attendance_service

router = APIRouter(prefix="/classes", tags=["Classes"])

@router.get("/", response_model=List[LectureResponse])
async def get_all_classes(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all classes from timetable CSV
    """
    timetable = csv_service.get_timetable()
    student_counts = csv_service.get_student_count_per_lecture()
    
    classes = []
    for lecture in timetable:
        lecture_id = str(lecture['lecture_id'])
        classes.append(LectureResponse(
            lecture_id=lecture_id,
            room_no=lecture['room_no'],
            subject=lecture['subject'],
            start_time=lecture['start_time'],
            end_time=lecture['end_time'],
            student_count=student_counts.get(lecture_id, 0)
        ))
    
    return classes

@router.get("/{lecture_id}", response_model=ClassDetailResponse)
async def get_class_detail(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get class details with student attendance information
    """
    # Get lecture info
    lecture = csv_service.get_lecture_by_id(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Get students with attendance
    attendance_list = await attendance_service.get_class_attendance(db, lecture_id)
    
    students = [
        StudentAttendanceInfo(
            reg_no=a['reg_no'],
            student_name=a['student_name'],
            status=a['status'],
            entry_time=a['entry_time'],
            exit_time=a['exit_time']
        )
        for a in attendance_list
    ]
    
    return ClassDetailResponse(
        lecture_id=str(lecture['lecture_id']),
        room_no=lecture['room_no'],
        subject=lecture['subject'],
        start_time=lecture['start_time'],
        end_time=lecture['end_time'],
        total_students=len(students),
        students=students
    )
