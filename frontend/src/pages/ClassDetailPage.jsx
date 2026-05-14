import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Camera, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Play,
  Square,
  RotateCcw,
  Eye,
  UserCheck,
  UserX
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { classesAPI, attendanceAPI, recognitionAPI } from '../services/api';
import { useCamera } from '../hooks/useCamera';

const Alert = ({ alerts, onDismiss }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`p-4 rounded-lg shadow-lg border-l-4 flex items-center gap-3 animate-slide-in ${
            alert.type === 'present'
              ? 'bg-green-50 border-green-500 text-green-800'
              : alert.type === 'absent'
              ? 'bg-red-50 border-red-500 text-red-800'
              : 'bg-yellow-50 border-yellow-500 text-yellow-800'
          }`}
        >
          {alert.type === 'present' && <UserCheck className="w-5 h-5 text-green-600" />}
          {alert.type === 'absent' && <UserX className="w-5 h-5 text-red-600" />}
          {alert.type === 'unknown' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
          <div className="flex-1">
            <p className="font-medium">{alert.message}</p>
            <p className="text-xs opacity-75">{alert.time}</p>
          </div>
          <button 
            onClick={() => onDismiss(alert.id)}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export const ClassDetailPage = () => {
  const { lectureId } = useParams();
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('idle');
  const [attendanceCompleted, setAttendanceCompleted] = useState(false);
  const [recognitions, setRecognitions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const scanIntervalRef = useRef(null);
  const alertIdRef = useRef(0);

  const { videoRef, canvasRef, isActive, error: cameraError, startCamera, stopCamera, captureFrame } = useCamera();

  const fetchClassData = useCallback(async () => {
    try {
      const response = await classesAPI.getDetail(lectureId);
      setClassData(response.data);
    } catch (err) {
      console.error('Failed to fetch class data:', err);
    } finally {
      setLoading(false);
    }
  }, [lectureId]);

  useEffect(() => {
    fetchClassData();
  }, [fetchClassData]);

  useEffect(() => {
    if (alerts.length > 0) {
      const timer = setTimeout(() => {
        setAlerts(prev => prev.slice(1));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alerts]);

  const addAlert = (type, message) => {
    const id = ++alertIdRef.current;
    const time = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    setAlerts(prev => [...prev, { id, type, message, time }]);
  };

  const dismissAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleStartAttendance = async () => {
    try {
      await recognitionAPI.loadClass(lectureId);
      await recognitionAPI.clearCooldowns();
      await startCamera();
      setMode('attendance');

      scanIntervalRef.current = setInterval(async () => {
        const frame = captureFrame();
        if (frame) {
          try {
            const response = await recognitionAPI.recognize(lectureId, frame, 'attendance');
            setRecognitions(response.data.recognitions);
            
            response.data.recognitions.forEach(r => {
              if (r.attendance_marked && r.status === 'present') {
                addAlert('present', `${r.name} marked PRESENT`);
                fetchClassData();
              }
              if (r.is_unknown && r.is_new_unknown) {
                addAlert('unknown', 'Unknown person entered the class');
              }
            });
            
            if (response.data.unknown_left && response.data.unknown_left.length > 0) {
              response.data.unknown_left.forEach(u => {
                addAlert('unknown', `Unknown person left after ${u.duration}`);
              });
            }
          } catch (err) {
            console.error('Recognition error:', err);
          }
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to start attendance:', err);
    }
  };

  const handleStopAttendance = async () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    stopCamera();
    
    try {
      await recognitionAPI.stopAttendance(lectureId);
    } catch (err) {
      console.error('Failed to stop attendance:', err);
    }
    
    setMode('idle');
    setAttendanceCompleted(true);
    setRecognitions([]);
    fetchClassData();
  };

  const handleStartMonitoring = async () => {
    try {
      await recognitionAPI.loadClass(lectureId);
      await recognitionAPI.clearCooldowns();
      await startCamera();
      setMode('monitoring');

      scanIntervalRef.current = setInterval(async () => {
        const frame = captureFrame();
        if (frame) {
          try {
            const response = await recognitionAPI.recognize(lectureId, frame, 'monitoring');
            setRecognitions(response.data.recognitions);
            
            response.data.recognitions.forEach(r => {
              if (r.attendance_marked && r.status === 'absent') {
                addAlert('absent', `${r.name} marked ABSENT (leaving)`);
                fetchClassData();
              }
              if (r.is_unknown) {
                addAlert('unknown', 'Unknown person detected');
              }
            });
            
            if (response.data.unknown_left && response.data.unknown_left.length > 0) {
              response.data.unknown_left.forEach(u => {
                addAlert('unknown', `Unknown person left after ${u.duration}`);
              });
            }
          } catch (err) {
            console.error('Recognition error:', err);
          }
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to start monitoring:', err);
    }
  };

  const handleStopMonitoring = async () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    stopCamera();
    
    try {
      await recognitionAPI.stopAttendance(lectureId);
    } catch (err) {
      console.error('Failed to stop monitoring:', err);
    }
    
    setMode('idle');
    setRecognitions([]);
    fetchClassData();
  };

  const handleResetAttendance = async () => {
    setResetting(true);
    setShowResetModal(false);
    try {
      await attendanceAPI.resetClass(lectureId);
      await recognitionAPI.clearCooldowns();
      setAttendanceCompleted(false);
      fetchClassData();
      addAlert('present', 'Attendance reset successfully');
    } catch (err) {
      console.error('Failed to reset attendance:', err);
    } finally {
      setResetting(false);
    }
  };

  const handleMarkPresent = async (studentName) => {
    try {
      await attendanceAPI.markPresent(lectureId, studentName);
      fetchClassData();
      addAlert('present', `${studentName} marked PRESENT (manual)`);
    } catch (err) {
      console.error('Failed to mark present:', err);
    }
  };

  const handleMarkAbsent = async (studentName) => {
    try {
      await attendanceAPI.markAbsent(lectureId, studentName);
      fetchClassData();
      addAlert('absent', `${studentName} marked ABSENT (manual)`);
    } catch (err) {
      console.error('Failed to mark absent:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0d7377]"></div>
      </div>
    );
  }

  if (!classData) {
    return <div className="text-center text-gray-500">Class not found</div>;
  }

  const presentCount = classData.students.filter(s => s.status === 'present').length;
  const absentCount = classData.students.filter(s => s.status === 'absent').length;
  const hasAttendance = presentCount > 0 || absentCount > 0;

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetAttendance}
        title="Reset Attendance"
        message="Are you sure you want to reset all attendance for this class? This action is for testing purposes only and cannot be undone."
        confirmText="Yes, Reset"
        cancelText="Cancel"
        type="warning"
        isLoading={resetting}
      />
      
      <Alert alerts={alerts} onDismiss={dismissAlert} />

      <div className="flex items-center gap-4">
        <Link to="/classes" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{classData.subject}</h1>
          <p className="text-gray-500">Room {classData.room_no} • {classData.start_time} - {classData.end_time}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#0d7377]" />
                Face Recognition
                {mode === 'attendance' && (
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                    ATTENDANCE MODE
                  </span>
                )}
                {mode === 'monitoring' && (
                  <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                    MONITORING MODE
                  </span>
                )}
              </h2>
              <div className="flex gap-2">
                {mode === 'idle' && !attendanceCompleted && (
                  <Button onClick={handleStartAttendance} size="sm">
                    <Play className="w-4 h-4" />
                    Start Attendance
                  </Button>
                )}
                {mode === 'attendance' && (
                  <Button onClick={handleStopAttendance} variant="danger" size="sm">
                    <Square className="w-4 h-4" />
                    Stop Attendance
                  </Button>
                )}
                {mode === 'idle' && attendanceCompleted && (
                  <Button onClick={handleStartMonitoring} size="sm" className="bg-orange-500 hover:bg-orange-600">
                    <Eye className="w-4 h-4" />
                    Start Monitoring
                  </Button>
                )}
                {mode === 'monitoring' && (
                  <Button onClick={handleStopMonitoring} variant="danger" size="sm">
                    <Square className="w-4 h-4" />
                    Stop Monitoring
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody>
              <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {!isActive && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <div className="text-center">
                      <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      {!attendanceCompleted ? (
                        <p>Click "Start Attendance" to begin</p>
                      ) : (
                        <p>Click "Start Monitoring" to detect leaving students</p>
                      )}
                    </div>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 text-white">
                    <p>{cameraError}</p>
                  </div>
                )}

                {recognitions.length > 0 && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-black/70 rounded-lg p-3">
                      <p className="text-white text-sm mb-2">
                        Detected: {recognitions.length} face(s)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {recognitions.map((r, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-1 rounded text-sm ${
                              r.recognized
                                ? r.status === 'present'
                                  ? 'bg-green-500 text-white'
                                  : r.status === 'absent'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-blue-500 text-white'
                                : 'bg-yellow-500 text-white'
                            }`}
                          >
                            {r.recognized 
                              ? `${r.name} (${(r.confidence * 100).toFixed(1)}%)` 
                              : 'Unknown'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0d7377]" />
                Students ({classData.total_students})
              </h2>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600 font-medium">Present: {presentCount}</span>
                <span className="text-red-600 font-medium">Absent: {absentCount}</span>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {classData.students.map((student) => (
                      <tr key={student.student_name} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.student_name}</td>
                        <td className="px-4 py-3">
                          <Badge status={student.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {student.entry_time || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {student.exit_time || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMarkPresent(student.student_name)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Mark Present"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleMarkAbsent(student.student_name)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Mark Absent"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Quick Stats</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Total Students</span>
                <span className="font-bold">{classData.total_students}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Present</span>
                <span className="font-bold text-green-600">{presentCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Absent</span>
                <span className="font-bold text-red-600">{absentCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Attendance %</span>
                <span className="font-bold text-[#0d7377]">
                  {classData.total_students > 0
                    ? ((presentCount / classData.total_students) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
            </CardBody>
          </Card>

          {hasAttendance && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <h2 className="font-semibold text-red-700">Testing Controls</h2>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-red-600 mb-4">
                  Reset all attendance for this class. This is only for testing purposes.
                </p>
                <Button 
                  onClick={() => setShowResetModal(true)}
                  variant="outline"
                  className="w-full border-red-300 text-red-700 hover:bg-red-100"
                  disabled={resetting}
                >
                  <RotateCcw className="w-4 h-4" />
                  {resetting ? 'Resetting...' : 'Reset Attendance'}
                </Button>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Mode Info</h2>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="font-medium text-green-700 mb-1">Attendance Mode</p>
                <p className="text-green-600">Faces detected = Mark PRESENT</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="font-medium text-orange-700 mb-1">Monitoring Mode</p>
                <p className="text-orange-600">Present students seen = Mark ABSENT (leaving)</p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
