from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime
from typing import List, Optional, Dict
from app.models.models import Attendance, Student
from app.services.csv_service import csv_service
import logging

logger = logging.getLogger(__name__)

# Lab Session Modes
class LabSession:
    MORNING = "MORNING"
    LUNCH = "LUNCH"
    AFTER_LUNCH = "AFTER_LUNCH"
    EXIT = "EXIT"

# Session to lecture_id mapping
SESSION_LECTURE_MAP = {
    LabSession.MORNING: "LAB_MORNING",
    LabSession.LUNCH: "LAB_LUNCH",
    LabSession.AFTER_LUNCH: "LAB_AFTER_LUNCH",
    LabSession.EXIT: "LAB_EXIT",
}

# Status constants
class LabStatus:
    ENTERED = "ENTERED"
    LEFT_FOR_LUNCH = "LEFT_FOR_LUNCH"
    ENTERED_AFTER_LUNCH = "ENTERED_AFTER_LUNCH"
    LEFT_LAB = "LEFT_LAB"
    NOT_MARKED = "not_marked"

# Mapping lecture_id to the status to assign on recognition
LECTURE_STATUS_MAP = {
    "LAB_MORNING":    LabStatus.ENTERED,
    "LAB_LUNCH":      LabStatus.LEFT_FOR_LUNCH,
    "LAB_AFTER_LUNCH": LabStatus.ENTERED_AFTER_LUNCH,
    "LAB_EXIT":       LabStatus.LEFT_LAB,
}

class AttendanceService:
    
    async def get_or_create_attendance(
        self, 
        db: AsyncSession, 
        reg_no: str, 
        lecture_id: str,
        date: str = None
    ) -> Attendance:
        """Get existing attendance record or create new one"""
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        result = await db.execute(
            select(Attendance).where(
                and_(
                    Attendance.reg_no == reg_no,
                    Attendance.lecture_id == lecture_id,
                    Attendance.date == date
                )
            )
        )
        attendance = result.scalar_one_or_none()
        
        if attendance is None:
            attendance = Attendance(
                reg_no=reg_no,
                lecture_id=lecture_id,
                date=date,
                status=LabStatus.NOT_MARKED
            )
            db.add(attendance)
            await db.commit()
            await db.refresh(attendance)
        
        return attendance
    
    async def mark_entered(
        self, 
        db: AsyncSession, 
        reg_no: str, 
        lecture_id: str
    ) -> Attendance:
        """Mark student as entered (morning session)"""
        attendance = await self.get_or_create_attendance(db, reg_no, lecture_id)
        attendance.status = LabStatus.ENTERED
        attendance.entry_time = datetime.now()
        await db.commit()
        await db.refresh(attendance)
        logger.info(f"Marked {reg_no} as ENTERED for {lecture_id}")
        return attendance

    async def mark_left_for_lunch(
        self,
        db: AsyncSession,
        reg_no: str,
        lecture_id: str
    ) -> Attendance:
        """Mark student as left for lunch"""
        attendance = await self.get_or_create_attendance(db, reg_no, lecture_id)
        attendance.status = LabStatus.LEFT_FOR_LUNCH
        attendance.exit_time = datetime.now()
        await db.commit()
        await db.refresh(attendance)
        logger.info(f"Marked {reg_no} as LEFT_FOR_LUNCH for {lecture_id}")
        return attendance

    async def mark_entered_after_lunch(
        self,
        db: AsyncSession,
        reg_no: str,
        lecture_id: str
    ) -> Attendance:
        """Mark student as returned after lunch"""
        attendance = await self.get_or_create_attendance(db, reg_no, lecture_id)
        attendance.status = LabStatus.ENTERED_AFTER_LUNCH
        attendance.entry_time = datetime.now()
        await db.commit()
        await db.refresh(attendance)
        logger.info(f"Marked {reg_no} as ENTERED_AFTER_LUNCH for {lecture_id}")
        return attendance

    async def mark_left_lab(
        self,
        db: AsyncSession,
        reg_no: str,
        lecture_id: str
    ) -> Attendance:
        """Mark student as left lab (final exit)"""
        attendance = await self.get_or_create_attendance(db, reg_no, lecture_id)
        attendance.status = LabStatus.LEFT_LAB
        attendance.exit_time = datetime.now()
        await db.commit()
        await db.refresh(attendance)
        logger.info(f"Marked {reg_no} as LEFT_LAB for {lecture_id}")
        return attendance

    async def mark_by_session(
        self,
        db: AsyncSession,
        reg_no: str,
        lecture_id: str
    ) -> Attendance:
        """Automatically mark status based on the lecture/session ID"""
        status = LECTURE_STATUS_MAP.get(lecture_id, LabStatus.ENTERED)
        
        attendance = await self.get_or_create_attendance(db, reg_no, lecture_id)
        attendance.status = status
        
        now = datetime.now()
        if status in (LabStatus.ENTERED, LabStatus.ENTERED_AFTER_LUNCH):
            attendance.entry_time = now
        else:
            attendance.exit_time = now
        
        await db.commit()
        await db.refresh(attendance)
        logger.info(f"Marked {reg_no} as {status} for {lecture_id}")
        return attendance

    # Legacy methods (kept for backward compatibility)
    async def mark_present(self, db, reg_no, lecture_id):
        return await self.mark_by_session(db, reg_no, lecture_id)

    async def mark_absent(self, db, reg_no, lecture_id):
        return await self.mark_by_session(db, reg_no, lecture_id)
    
    async def mark_exit(self, db, reg_no, lecture_id):
        return await self.mark_left_lab(db, reg_no, lecture_id)
    
    async def get_student_status(
        self,
        db: AsyncSession,
        reg_no: str,
        lecture_id: str,
        date: str = None
    ) -> str:
        """Get current status for a student in a session"""
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        result = await db.execute(
            select(Attendance).where(
                and_(
                    Attendance.reg_no == reg_no,
                    Attendance.lecture_id == lecture_id,
                    Attendance.date == date
                )
            )
        )
        attendance = result.scalar_one_or_none()
        return attendance.status if attendance else LabStatus.NOT_MARKED
    
    async def reset_class_attendance(
        self,
        db: AsyncSession,
        lecture_id: str,
        date: str = None
    ) -> int:
        """Reset attendance for a session"""
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        from sqlalchemy import delete
        result = await db.execute(
            delete(Attendance).where(
                and_(
                    Attendance.lecture_id == lecture_id,
                    Attendance.date == date
                )
            )
        )
        await db.commit()
        return result.rowcount
    
    async def get_attendance_logs(
        self, 
        db: AsyncSession, 
        lecture_id: Optional[str] = None,
        date: Optional[str] = None
    ) -> List[Attendance]:
        """Get activity logs with optional filters"""
        query = select(Attendance)
        
        conditions = []
        if lecture_id:
            conditions.append(Attendance.lecture_id == lecture_id)
        if date:
            conditions.append(Attendance.date == date)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.order_by(Attendance.created_at.desc())
        
        result = await db.execute(query)
        return result.scalars().all()

    async def get_dashboard_stats(self, db: AsyncSession) -> Dict:
        """Get lab dashboard statistics"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get all members
        all_students = csv_service.get_all_students()
        total_members = len(all_students)
        
        # Also get from enrolled embeddings (more accurate for lab)
        try:
            from app.core.config import settings
            import os
            embeddings_path = settings.EMBEDDINGS_PATH
            if os.path.exists(embeddings_path):
                embed_count = len([f for f in os.listdir(embeddings_path) if f.endswith('.npy')])
                if embed_count > total_members:
                    total_members = embed_count
        except Exception:
            pass

        # Get today's attendance records
        result = await db.execute(
            select(Attendance).where(Attendance.date == today)
        )
        today_records = result.scalars().all()

        # Count by status
        currently_in = sum(1 for a in today_records if a.status == LabStatus.ENTERED)
        returned_after_lunch = sum(1 for a in today_records if a.status == LabStatus.ENTERED_AFTER_LUNCH)
        out_for_lunch = sum(1 for a in today_records if a.status == LabStatus.LEFT_FOR_LUNCH)
        left_lab = sum(1 for a in today_records if a.status == LabStatus.LEFT_LAB)

        # Live count = currently entered + returned after lunch
        live_count = currently_in + returned_after_lunch

        # Attendance percentage
        total_expected = total_members
        attendance_percentage = (live_count / total_expected * 100) if total_expected > 0 else 0

        return {
            "total_classes_today": 4,  # 4 lab sessions
            "active_classes": 1,
            "attendance_percentage": round(attendance_percentage, 2),
            "total_students": total_members,
            "live_student_count": live_count,
            "out_for_lunch": out_for_lunch,
            "left_lab": left_lab,
        }

attendance_service = AttendanceService()
