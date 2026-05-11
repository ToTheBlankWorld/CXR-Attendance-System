import pandas as pd
import os
from typing import List, Dict, Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class CSVService:
    def __init__(self):
        self.timetable_path = os.path.join(settings.CSV_PATH, "timetable.csv")
        self.students_path = os.path.join(settings.CSV_PATH, "student_in_class.csv")
    
    def get_timetable(self) -> List[Dict]:
        """Read timetable from CSV"""
        try:
            df = pd.read_csv(self.timetable_path)
            return df.to_dict('records')
        except Exception as e:
            logger.error(f"Error reading timetable: {e}")
            return []
    
    def get_students_in_class(self, lecture_id: str) -> List[Dict]:
        """Get students for a specific lecture"""
        try:
            df = pd.read_csv(self.students_path)
            students = df[df['lecture_id'] == int(lecture_id)]
            return students.to_dict('records')
        except Exception as e:
            logger.error(f"Error reading students: {e}")
            return []
    
    def get_all_students(self) -> List[Dict]:
        """Get all students from CSV"""
        try:
            df = pd.read_csv(self.students_path)
            return df.to_dict('records')
        except Exception as e:
            logger.error(f"Error reading students: {e}")
            return []
    
    def get_student_reg_nos_for_class(self, lecture_id: str) -> List[str]:
        """Get list of registration numbers for a class"""
        students = self.get_students_in_class(lecture_id)
        return [str(s['reg_no']) for s in students]
    
    def get_lecture_by_id(self, lecture_id: str) -> Optional[Dict]:
        """Get lecture details by ID"""
        timetable = self.get_timetable()
        for lecture in timetable:
            if str(lecture['lecture_id']) == str(lecture_id):
                return lecture
        return None
    
    def get_student_count_per_lecture(self) -> Dict[str, int]:
        """Get student count for each lecture"""
        try:
            df = pd.read_csv(self.students_path)
            counts = df.groupby('lecture_id').size().to_dict()
            return {str(k): v for k, v in counts.items()}
        except Exception as e:
            logger.error(f"Error getting student counts: {e}")
            return {}

csv_service = CSVService()
