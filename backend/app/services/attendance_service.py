from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime
from typing import List, Optional, Dict
from app.models.models import Attendance, Student
import asyncio
import logging

logger = logging.getLogger(__name__)

class LabSession:
    MORNING = "MORNING"
    LUNCH = "LUNCH"
    AFTER_LUNCH = "AFTER_LUNCH"
    EXIT = "EXIT"

SESSION_LECTURE_MAP = {
    LabSession.MORNING: "LAB_MORNING",
    LabSession.LUNCH: "LAB_LUNCH",
    LabSession.AFTER_LUNCH: "LAB_AFTER_LUNCH",
    LabSession.EXIT: "LAB_EXIT",
}

class LabStatus:
    ENTERED = "ENTERED"
    LEFT_FOR_LUNCH = "LEFT_FOR_LUNCH"
    ENTERED_AFTER_LUNCH = "ENTERED_AFTER_LUNCH"
    LEFT_LAB = "LEFT_LAB"
    NOT_MARKED = "not_marked"

LECTURE_STATUS_MAP = {
    "LAB_MORNING":    LabStatus.ENTERED,
    "LAB_LUNCH":      LabStatus.LEFT_FOR_LUNCH,
    "LAB_AFTER_LUNCH": LabStatus.ENTERED_AFTER_LUNCH,
    "LAB_EXIT":       LabStatus.LEFT_LAB,
}

class AttendanceService:
    def __init__(self):
        self._lock = asyncio.Lock()

    async def _get_student_id(self, db: AsyncSession, name: str) -> Optional[int]:
        result = await db.execute(select(Student.id).where(Student.name == name))
        row = result.scalar_one_or_none()
        return row
    
    async def get_or_create_attendance(
        self,
        db: AsyncSession,
        name: str,
        lecture_id: str,
        date: str = None
    ) -> Attendance:
        async with self._lock:
            return await self._get_or_create_attendance_locked(db, name, lecture_id, date)

    async def _get_or_create_attendance_locked(
        self,
        db: AsyncSession,
        name: str,
        lecture_id: str,
        date: str = None
    ) -> Attendance:
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        student_id = await self._get_student_id(db, name)
        if student_id is None:
            student = Student(name=name)
            db.add(student)
            await db.commit()
            await db.refresh(student)
            student_id = student.id
        
        result = await db.execute(
            select(Attendance).where(
                and_(
                    Attendance.student_id == student_id,
                    Attendance.lecture_id == lecture_id,
                    Attendance.date == date
                )
            )
        )
        attendance = result.scalars().first()

        if attendance is None:
            attendance = Attendance(
                student_id=student_id,
                lecture_id=lecture_id,
                date=date,
                status=LabStatus.NOT_MARKED
            )
            db.add(attendance)
            await db.commit()
            await db.refresh(attendance)
        
        return attendance
    
    async def mark_entered(self, db: AsyncSession, name: str, lecture_id: str) -> Attendance:
        attendance = await self.get_or_create_attendance(db, name, lecture_id)
        attendance.status = LabStatus.ENTERED
        attendance.entry_time = datetime.now()
        await db.commit()
        await db.refresh(attendance)
        logger.info(f"Marked {name} as ENTERED for {lecture_id}")
        return attendance

    async def mark_left_for_lunch(self, db: AsyncSession, name: str, lecture_id: str) -> Attendance:
        attendance = await self.get_or_create_attendance(db, name, lecture_id)
        attendance.status = LabStatus.LEFT_FOR_LUNCH
        attendance.exit_time = datetime.now()
        await db.commit()
        await db.refresh(attendance)
        logger.info(f"Marked {name} as LEFT_FOR_LUNCH for {lecture_id}")
        return attendance

    async def mark_entered_after_lunch(self, db: AsyncSession, name: str, lecture_id: str) -> Attendance:
        attendance = await self.get_or_create_attendance(db, name, lecture_id)
        attendance.status = LabStatus.ENTERED_AFTER_LUNCH
        attendance.entry_time = datetime.now()
        await db.commit()
        await db.refresh(attendance)
        logger.info(f"Marked {name} as ENTERED_AFTER_LUNCH for {lecture_id}")
        return attendance

    async def mark_left_lab(self, db: AsyncSession, name: str, lecture_id: str) -> Attendance:
        attendance = await self.get_or_create_attendance(db, name, lecture_id)
        attendance.status = LabStatus.LEFT_LAB
        attendance.exit_time = datetime.now()
        await db.commit()
        await db.refresh(attendance)
        logger.info(f"Marked {name} as LEFT_LAB for {lecture_id}")
        return attendance

    async def mark_by_session(self, db: AsyncSession, name: str, lecture_id: str) -> Attendance:
        status = LECTURE_STATUS_MAP.get(lecture_id, LabStatus.ENTERED)
        
        attendance = await self.get_or_create_attendance(db, name, lecture_id)
        attendance.status = status
        
        now = datetime.now()
        if status in (LabStatus.ENTERED, LabStatus.ENTERED_AFTER_LUNCH):
            attendance.entry_time = now
        else:
            attendance.exit_time = now
        
        await db.commit()
        await db.refresh(attendance)
        logger.info(f"Marked {name} as {status} for {lecture_id}")
        return attendance

    async def mark_present(self, db, name, lecture_id):
        return await self.mark_by_session(db, name, lecture_id)

    async def mark_absent(self, db, name, lecture_id):
        return await self.mark_by_session(db, name, lecture_id)
    
    async def mark_exit(self, db, name, lecture_id):
        return await self.mark_left_lab(db, name, lecture_id)
    
    async def get_student_status(self, db: AsyncSession, name: str, lecture_id: str, date: str = None) -> str:
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        student_id = await self._get_student_id(db, name)
        if student_id is None:
            return LabStatus.NOT_MARKED
        
        result = await db.execute(
            select(Attendance).where(
                and_(
                    Attendance.student_id == student_id,
                    Attendance.lecture_id == lecture_id,
                    Attendance.date == date
                )
            )
        )
        attendance = result.scalar_one_or_none()
        return attendance.status if attendance else LabStatus.NOT_MARKED
    
    async def reset_class_attendance(self, db: AsyncSession, lecture_id: str, date: str = None) -> int:
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
    
    async def get_attendance_logs(self, db: AsyncSession, lecture_id: Optional[str] = None, date: Optional[str] = None) -> List[Attendance]:
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

    async def get_class_attendance(self, db: AsyncSession, lecture_id: str, date: str = None) -> List[Dict]:
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        from sqlalchemy import join as sa_join
        
        query = select(
            Student.name,
            Attendance.status,
            Attendance.entry_time,
            Attendance.exit_time
        ).select_from(
            sa_join(Attendance, Student, Attendance.student_id == Student.id)
        ).where(
            and_(
                Attendance.lecture_id == lecture_id,
                Attendance.date == date
            )
        )
        
        result = await db.execute(query)
        rows = result.fetchall()
        
        attendance_list = []
        for row in rows:
            attendance_list.append({
                "student_name": row[0],
                "status": row[1],
                "entry_time": row[2].strftime("%H:%M:%S") if row[2] else None,
                "exit_time": row[3].strftime("%H:%M:%S") if row[3] else None,
            })
        
        return attendance_list

    async def get_dashboard_stats(self, db: AsyncSession) -> Dict:
        today = datetime.now().strftime("%Y-%m-%d")
        
        try:
            from app.core.config import settings
            import os
            embeddings_path = settings.EMBEDDINGS_PATH
            total_members = 0
            if os.path.exists(embeddings_path):
                total_members = len([f for f in os.listdir(embeddings_path) if f.endswith('.npy')])
        except Exception:
            total_members = 0

        result = await db.execute(
            select(Attendance).where(Attendance.date == today)
        )
        today_records = result.scalars().all()

        currently_in = sum(1 for a in today_records if a.status == LabStatus.ENTERED)
        returned_after_lunch = sum(1 for a in today_records if a.status == LabStatus.ENTERED_AFTER_LUNCH)
        out_for_lunch = sum(1 for a in today_records if a.status == LabStatus.LEFT_FOR_LUNCH)
        left_lab = sum(1 for a in today_records if a.status == LabStatus.LEFT_LAB)

        live_count = currently_in + returned_after_lunch

        total_expected = total_members
        attendance_percentage = (live_count / total_expected * 100) if total_expected > 0 else 0

        return {
            "total_classes_today": 4,
            "active_classes": 1,
            "attendance_percentage": round(attendance_percentage, 2),
            "total_students": total_members,
            "live_student_count": live_count,
            "out_for_lunch": out_for_lunch,
            "left_lab": left_lab,
        }

attendance_service = AttendanceService()
