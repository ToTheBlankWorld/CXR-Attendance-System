from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

# Student Schemas
class StudentBase(BaseModel):
    name: str

class StudentCreate(StudentBase):
    pass

class StudentResponse(StudentBase):
    id: int
    created_at: datetime
    has_embedding: bool = False
    
    class Config:
        from_attributes = True

# Lecture Schemas
class LectureBase(BaseModel):
    lecture_id: str
    room_no: str
    subject: str
    start_time: str
    end_time: str

class LectureCreate(LectureBase):
    pass

class LectureResponse(LectureBase):
    student_count: int = 0
    
    class Config:
        from_attributes = True

# Attendance Schemas
class AttendanceBase(BaseModel):
    student_name: str
    lecture_id: str
    status: str = "not_marked"

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceUpdate(BaseModel):
    status: str
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None

class AttendanceResponse(BaseModel):
    id: int
    student_name: str
    lecture_id: str
    status: str
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    date: str
    
    class Config:
        from_attributes = True

class StudentAttendanceInfo(BaseModel):
    student_name: str
    status: str
    entry_time: Optional[str] = None
    exit_time: Optional[str] = None

# Class Detail Schema
class ClassDetailResponse(BaseModel):
    lecture_id: str
    room_no: str
    subject: str
    start_time: str
    end_time: str
    total_students: int
    students: List[StudentAttendanceInfo]

# Dashboard Schemas
class DashboardStats(BaseModel):
    total_classes_today: int = 4
    active_classes: int = 0
    attendance_percentage: float = 0.0
    total_students: int = 0
    live_student_count: int = 0
    out_for_lunch: int = 0
    left_lab: int = 0

# Enrollment Schemas
class EnrollmentRequest(BaseModel):
    name: str

class EnrollBase64Request(BaseModel):
    name: str
    images: List[str]

class EnrollmentResponse(BaseModel):
    success: bool
    message: str
    name: Optional[str] = None

# Face Recognition Schemas
class RecognitionResult(BaseModel):
    name: str
    confidence: float
    status: str

class FaceDetectionResult(BaseModel):
    faces_detected: int
    recognitions: List[RecognitionResult]

# WebSocket Message
class WSMessage(BaseModel):
    type: str
    message: str
    data: Optional[dict] = None
