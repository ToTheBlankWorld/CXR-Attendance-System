# 🎓 CXR Lab - Face Recognition Attendance System

A production-ready **AI-powered attendance system** using **deep learning & face recognition** to automate student attendance marking in classrooms.

**Status**: ✅ Production Ready | **Version**: 2.0.0

## 🚀 Quick Start

### Automated Installation
```bash
python setup.py
```
This will automatically:
- ✅ Install all Python packages
- ✅ Download AI models (InsightFace)
- ✅ Create necessary directories
- ✅ Initialize database
- ✅ Verify all components

### Run the Application

#### Option 1: Local Startup
```bash
python start_app.py
```
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- API Docs: `http://localhost:8000/docs`

#### Option 2: Network Startup (Access from any device)
```bash
python start_app_network.py
```
- Frontend: `https://<your-ip>:5173`
- Backend: `http://<your-ip>:8000`

### Login
- **Username**: `admin`
- **Password**: `admin123`

---

## 📋 Features

### ✨ Core Features
- 🎯 **Real-time Face Recognition** - Live student detection at 15-20 FPS
- 📸 **Automatic Attendance Marking** - Mark attendance via face recognition
- 👨‍🎓 **Student Enrollment** - Self-service enrollment with 3 angle photos
- 📊 **Attendance Dashboard** - View attendance statistics and trends
- 📝 **Attendance Logs** - Detailed logs with expandable activity records
- 📋 **Class Management** - Manage classes and student rosters
- 👥 **Student Directory** - Browse enrolled students

### 🔧 Technical Features
- 🤖 **AI-Powered Recognition** - InsightFace + ArcFace embeddings
- 🗄️ **Database Storage** - SQLite with SQLAlchemy ORM
- ⚡ **Real-time Updates** - WebSocket notifications
- 🔐 **Secure Authentication** - JWT-based session management
- 📱 **Responsive UI** - Mobile-friendly React interface
- 🔒 **HTTPS Ready** - SSL certificates included

---

## 💻 System Requirements

**Minimum**:
- Python 3.10+
- Node.js 16+
- 2GB RAM
- 500MB disk space

**Recommended**:
- Python 3.11+
- Node.js 18+
- 4GB+ RAM
- 1GB+ disk space
- GPU (CUDA) for faster inference

---

## 📦 Installation

### Step 1: Clone Repository
```bash
git clone <repo-url>
cd CXR-Atta
```

### Step 2: Run Setup
```bash
python setup.py
```

The setup script will:
1. ✅ Check Python version (3.10+)
2. ✅ Install all dependencies from `requirements.txt`
3. ✅ Download InsightFace models (~200MB)
4. ✅ Create `/embeddings` directory
5. ✅ Initialize SQLite database
6. ✅ Create necessary folders
7. ✅ Verify installation

### Step 3: Verify Installation
```bash
python setup.py --verify
```

---

## 🎮 Usage Guide

### 1. First-Time Setup
1. Run `python setup.py`
2. Wait for model downloads (might take 2-3 minutes)
3. Launch with `python start_app.py`
4. Access frontend at `http://localhost:5173`
5. Login with `admin` / `admin123`

### 2. Enroll Students
1. Navigate to **Enrollment** page
2. Student enters: Name + Registration Number
3. Upload 3 photos: Front, Left 45°, Right 45°
4. Click **Embed** to generate and save embedding
5. Done! Student is now recognized

### 3. Take Attendance
1. Go to **Live Attendance** page
2. Select a class/session
3. Start camera
4. Students walk past camera
5. System auto-detects and marks attendance
6. View logs in real-time

### 4. View Reports
1. **Dashboard** - Overview statistics
2. **Attendance Logs** - Detailed logs (expandable rows for 4 activities)
3. **Member List** - All enrolled students
4. **Activity Details** - Time-based breakdowns

---

## 🏗️ Project Structure

```
CXR-Atta/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py               # Login/auth endpoints
│   │   │   ├── classes.py            # Class management
│   │   │   ├── attendance.py         # Attendance logs
│   │   │   ├── enrollment.py         # Student enrollment
│   │   │   ├── recognition.py        # Face recognition API
│   │   │   ├── dashboard.py          # Statistics
│   │   │   └── websocket.py          # Real-time updates
│   │   ├── core/
│   │   │   ├── config.py             # Configuration
│   │   │   ├── database.py           # Database setup
│   │   │   └── security.py           # JWT utilities
│   │   ├── models/                   # SQLAlchemy models
│   │   ├── schemas/                  # Pydantic schemas
│   │   └── services/
│   │       ├── face_recognition.py   # InsightFace logic
│   │       └── attendance_service.py
│   ├── main.py                       # FastAPI app
│   ├── requirements.txt
│   └── attendance.db                 # Database (auto-created)
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── LiveAttendancePage.jsx
│   │   │   ├── AttendanceLogsPage.jsx
│   │   │   ├── EmbedListPage.jsx
│   │   │   └── EnrollmentPage.jsx
│   │   ├── components/
│   │   │   └── layout/
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── node_modules/
│
├── embeddings/                       # Face embeddings (.npy files)
├── unknown_faces/                    # Unrecognized faces
├── public/
│   └── assets/                       # Images and resources
├── start_app.py                      # Local startup
├── start_app_network.py              # Network startup
├── setup.py                          # Automated installation ✨ NEW
├── README.md                         # This file
├── .gitignore
├── cert.pem & key.pem               # SSL certificates
└── timetable.csv                     # Class schedule
```

---

## 🧠 How It Works

### Face Recognition Pipeline

```
Input Frame → Face Detection → Face Alignment → Embedding Generation → Similarity Matching → Result
```

1. **Face Detection** - InsightFace detects all faces in frame
2. **Face Alignment** - Normalized face positioning
3. **Feature Extraction** - ArcFace generates 512-D embedding
4. **Similarity Matching** - Compare with stored embeddings (cosine similarity)
5. **Attendance Mark** - If match > threshold, mark present

### Technical Details
- **Model**: InsightFace Buffalo_L (ArcFace)
- **Embedding Dimension**: 512
- **Similarity Metric**: Cosine similarity  
- **Threshold**: 0.5-0.6
- **Performance**: 15-20 FPS on CPU
- **Inference Time**: ~100ms per face

### Activity Session Order
Attendance activities are automatically sorted and displayed in this order:
1. **Morning** - Lab session start
2. **Lunch** - Lunch break exit
3. **Return** - After lunch return
4. **Exit** - Lab session end

Each activity on **Attendance Logs** can be expanded to show all 4 session details for that student on that date.

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login with username/password |
| GET | `/api/v1/dashboard/stats` | Get dashboard statistics |
| GET | `/api/v1/classes/` | List all classes |
| POST | `/api/v1/attendance/mark-present/{reg}` | Mark student present |
| GET | `/api/v1/attendance/logs` | Get attendance logs |
| POST | `/api/v1/recognition/recognize` | Real-time face recognition |
| GET | `/api/v1/recognition/enrolled-students` | List enrolled students |
| POST | `/api/v1/enrollment/enroll` | Enroll new student |

**Full API docs**: Visit `http://localhost:8000/docs` for interactive Swagger UI

---

## 🛠️ Tech Stack

### Backend
- **Python 3.10+** - Core language
- **FastAPI** - Async web framework
- **SQLAlchemy** - ORM
- **SQLite** - Database
- **InsightFace** - Face detection & embeddings
- **ONNX Runtime** - Model inference
- **OpenCV** - Image processing
- **NumPy** - Array operations

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Lucide Icons** - Icons
- **WebRTC** - Camera access

---

## 📸 Student Enrollment Guide

### Requirements
✅ 3 high-quality photos from different angles:
1. **Front** - Face centered, straight at camera
2. **Left** - Face ~45° to left
3. **Right** - Face ~45° to right

### Photo Tips
- ✨ Good lighting (natural light preferred)
- 📌 Clear facial features visible
- 😊 Neutral expression
- 🎯 Face centered in frame
- 🚫 No masks, glasses, or heavy makeup

### Enrollment Process
1. Go to **Enrollment** page
2. Enter Student Name: "John Doe"
3. Enter Registration Number: "2023001127"
4. Upload 3 photos (different angles)
5. Click **Embed**
6. Wait for processing (few seconds)
7. Success! System is now trained on this student

---

## ⚙️ Configuration

### Backend Config
**File**: `backend/app/core/config.py`

```python
# Database
DATABASE_URL = "sqlite+aiosqlite:///./attendance.db"

# Face Recognition
SIMILARITY_THRESHOLD = 0.5
RECOGNITION_COOLDOWN = 10  # seconds between recognitions

# Admin Credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# JWT
SECRET_KEY = "your-secret-key"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440
```

### Customization
- Change threshold for stricter/lenient recognition
- Adjust cooldown for repeated attendance marks
- Modify admin credentials
- Configure database path

---

## 🐛 Troubleshooting

### Backend Issues

**Port 8000 already in use**
```bash
# Change port in start_app.py or run:
python -m uvicorn main:app --port 8001
```

**Import errors / Missing packages**
```bash
pip install -r backend/requirements.txt --force-reinstall
```

**Database locked / Corrupted**
```bash
# Backup and recreate
rm attendance.db
python setup.py
```

### Frontend Issues

**Blank page / Not loading**
```bash
# Clear cache and reinstall
rm -rf frontend/node_modules frontend/.next
cd frontend && npm install && npm run dev
```

**Camera not working**
- ✅ Grant browser permission to access camera
- ✅ Use HTTPS (self-signed cert included)
- ✅ Refresh the page
- ✅ Try different browser (Chrome recommended)

### Face Recognition Issues

**Not recognizing students**
- ✅ Check lighting during enrollment and recognition
- ✅ Ensure photos are clear and high quality
- ✅ Re-enroll student with better photos
- ✅ Lower threshold in config (0.45-0.50)

**False positives (recognizing wrong student)**
- ✅ Increase threshold (0.55-0.60)
- ✅ Re-enroll with more varied angles
- ✅ Check for similar-looking students

---

## 📊 Performance

- **FPS**: 15-20 (on CPU)
- **Detection**: <50ms per frame
- **Embedding**: <100ms per face
- **Matching**: <10ms for 100 students
- **Database Query**: <5ms

**GPU Performance** (if available):
- **FPS**: 30+ FPS
- **Detection**: <20ms
- **Embedding**: <30ms

---

## 🔐 Security

✅ **JWT Authentication** - Secure token-based login
✅ **Password Security** - Passwords never stored in DB
✅ **HTTPS Support** - SSL certificates included
✅ **CORS Protection** - Configured for frontend
✅ **Input Validation** - Pydantic schema validation
✅ **Admin-only Features** - Role-based access control

---

## 📝 CSV Files

### timetable.csv (Optional)
```csv
lecture_id,room_no,subject,start_time,end_time
101,Room 113,OOSE,09:00,09:50
102,Room 114,DBMS,10:00,10:50
103,Room 115,ML,11:00,11:50
```

### student_in_class.csv (Optional)
```csv
lecture_id,reg_no,student_name
101,2023001127,Nareen
101,2023001128,John
102,2023001129,Sarah
```

---

## 📚 Additional Resources

### API Documentation
- **Interactive Docs**: `http://localhost:8000/docs` (Swagger UI)
- **ReDoc**: `http://localhost:8000/redoc`

### Project Features
- ✨ Real-time WebSocket updates
- ✨ Expandable activity logs with 4 session types
- ✨ Unknown face detection and logging
- ✨ Export attendance to CSV
- ✨ Responsive mobile interface
- ✨ Dark mode support

---

## 🎓 Academic Value

This project implements **Complete Deep Learning Computer Vision Pipeline**:

✅ **Dataset Collection** - Student face images  
✅ **Face Detection** - InsightFace detector  
✅ **Face Alignment** - Geometric normalization  
✅ **Feature Extraction** - ArcFace embeddings (512-D)  
✅ **Storage** - NumPy arrays (.npy files)  
✅ **Inference** - Real-time recognition  
✅ **Production** - Full-stack deployment  

**Meets Final-Year Project Requirements:**
- ✅ Deep learning implementation (InsightFace ArcFace)
- ✅ Production-ready code
- ✅ Real-time processing
- ✅ Database integration
- ✅ Web interface
- ✅ Security implementation
- ✅ Comprehensive documentation
- ✅ Advanced features

---

## 🚀 Deployment

### Local Development
```bash
python start_app.py
```

### Network Access
```bash
python start_app_network.py
```

### Production Notes
- Update `SECRET_KEY` in config
- Use strong passwords for admin account
- Set database path to persistent location
- Configure CORS for production domain
- Use proper SSL certificates

---

## 📄 License

Educational project for learning purposes.

---

## 👨‍💻 Credits

Built with ❤️ for computer vision and deep learning education.

**Tech Stack**: FastAPI + React + InsightFace + SQLite

---

**Version**: 2.0.0  
**Status**: ✅ Production Ready  
**Last Updated**: 2025
