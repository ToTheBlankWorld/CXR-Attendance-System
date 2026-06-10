import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { recognitionAPI, classesAPI } from '../services/api';
import { useCamera } from '../hooks/useCamera';

export const LiveAttendancePage = () => {
  const { videoRef, canvasRef, isActive, error: cameraError, startCamera, stopCamera, captureFrame } = useCamera();
  
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState('all');
  const [recognitions, setRecognitions] = useState([]);
  const [stats, setStats] = useState({
    totalDetected: 0,
    totalRecognized: 0,
    totalUnknown: 0,
  });
  
  const scanIntervalRef = useRef(null);
  const readyCheckRef = useRef(null);
  const scanInProgressRef = useRef(false);
  const logIdRef = useRef(0);
  const previousSnapshotRef = useRef(null);
  const lastInTimeRef = useRef({});
  const lectureIdRef = useRef('all');

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await classesAPI.getAll();
        setClasses(response.data);
      } catch (err) {
        console.error('Failed to fetch classes:', err);
      }
    };
    fetchClasses();
  }, []);

  const doScan = useCallback(async () => {
    const frame = captureFrame();
    if (!frame) return;

    const lectureIdToUse = lectureIdRef.current;

    try {
      const response = await recognitionAPI.recognize(lectureIdToUse, frame, 'attendance');

      setRecognitions(response.data.recognitions);

      const currentSnapshot = {};
      response.data.recognitions.forEach((r) => {
        if (r.recognized && r.attendance_marked) {
          currentSnapshot[r.name] = {
            name: r.name,
            confidence: (r.confidence * 100).toFixed(2),
            timestamp: new Date().toLocaleTimeString(),
          };
        }
      });

      if (!previousSnapshotRef.current) {
        Object.entries(currentSnapshot).forEach(([, student]) => {
          const logId = ++logIdRef.current;
          setLogs((prev) => [
            { id: logId, timestamp: student.timestamp, type: 'recognized', name: student.name, confidence: student.confidence, status: 'in', lecture_id: lectureIdToUse },
            ...prev.slice(0, 99),
          ]);
          setStats((prev) => ({ ...prev, totalDetected: prev.totalDetected + 1, totalRecognized: prev.totalRecognized + 1 }));
        });
      } else {
        Object.entries(previousSnapshotRef.current).forEach(([name, prevStudent]) => {
          if (!currentSnapshot[name]) {
            const lastInTimeStr = lastInTimeRef.current[name];
            let gapFromLastInSec = 0;
            if (lastInTimeStr) {
              try {
                const lastInDate = new Date(`2024-01-01 ${lastInTimeStr}`);
                const currentOutDate = new Date(`2024-01-01 ${new Date().toLocaleTimeString()}`);
                gapFromLastInSec = (currentOutDate - lastInDate) / 1000;
                if (gapFromLastInSec < 0) gapFromLastInSec += 24 * 3600;
              } catch (e) { gapFromLastInSec = 0; }
            }
            if (gapFromLastInSec > 5) {
              const logId = ++logIdRef.current;
              setLogs((prev) => [
                { id: logId, timestamp: new Date().toLocaleTimeString(), type: 'recognized', name: prevStudent.name, confidence: 'N/A', status: 'out', lecture_id: lectureIdToUse },
                ...prev.slice(0, 99),
              ]);
            }
          }
        });

        Object.entries(currentSnapshot).forEach(([name, student]) => {
          if (!previousSnapshotRef.current[name]) {
            lastInTimeRef.current[name] = student.timestamp;
            const logId = ++logIdRef.current;
            setLogs((prev) => [
              { id: logId, timestamp: student.timestamp, type: 'recognized', name: student.name, confidence: student.confidence, status: 'in', lecture_id: lectureIdToUse },
              ...prev.slice(0, 99),
            ]);
            setStats((prev) => ({ ...prev, totalDetected: prev.totalDetected + 1, totalRecognized: prev.totalRecognized + 1 }));
          }
        });
      }

      previousSnapshotRef.current = currentSnapshot;

      response.data.recognitions.forEach((r) => {
        if (r.is_unknown && r.is_new_unknown) {
          const logId = ++logIdRef.current;
          setLogs((prev) => [
            { id: logId, timestamp: new Date().toLocaleTimeString(), type: 'unknown', tracking_id: r.tracking_id?.slice(-12), lecture_id: lectureIdToUse },
            ...prev.slice(0, 99),
          ]);
          setStats((prev) => ({ ...prev, totalDetected: prev.totalDetected + 1, totalUnknown: prev.totalUnknown + 1 }));
        }
      });
    } catch (err) {
      console.error('Recognition error:', err.response?.data || err.message);
    }
  }, [captureFrame]);

  const handleStart = async () => {
    try {
      await recognitionAPI.clearEmbeddings();

      if (selectedLecture !== 'all') {
        await recognitionAPI.loadClass(selectedLecture);
      } else {
        for (const cls of classes) {
          try { await recognitionAPI.loadClass(cls.lecture_id); } catch { /* ignore */ }
        }
      }

      await recognitionAPI.clearCooldowns();
      await startCamera();

      lectureIdRef.current = selectedLecture !== 'all' ? selectedLecture : 'all';
      setIsScanning(true);
      setLogs([]);
      logIdRef.current = 0;
      previousSnapshotRef.current = null;
      lastInTimeRef.current = {};
      setStats({ totalDetected: 0, totalRecognized: 0, totalUnknown: 0 });

      // Poll every 100ms until the camera delivers a real frame, then fire instantly
      readyCheckRef.current = setInterval(() => {
        if (captureFrame()) {
          clearInterval(readyCheckRef.current);
          readyCheckRef.current = null;
          doScan();
          scanIntervalRef.current = setInterval(doScan, 500);
        }
      }, 100);
    } catch (err) {
      console.error('Failed to start:', err);
      alert('Failed: ' + err.message);
    }
  };

  const handleStop = async () => {
    if (readyCheckRef.current) {
      clearInterval(readyCheckRef.current);
      readyCheckRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    scanInProgressRef.current = false;
    stopCamera();
    
    if (selectedLecture !== 'all') {
      try {
        await recognitionAPI.stopAttendance(selectedLecture);
      } catch (err) {
        console.error('Failed to stop attendance:', err);
      }
    }
    
    setIsScanning(false);
    setRecognitions([]);
  };

  const handleExport = () => {
    if (logs.length === 0) return;

    const timestamp = new Date().toISOString().split('T')[0];
    
    const studentSessions = {};
    
    logs.forEach((log) => {
      if (log.type === 'recognized' && (log.status === 'in' || log.status === 'out')) {
        if (!studentSessions[log.name]) {
          studentSessions[log.name] = {
            name: log.name,
            inTimes: [],
            outTimes: [],
          };
        }
        
        if (log.status === 'in') {
          studentSessions[log.name].inTimes.push(new Date(`2024-01-01 ${log.timestamp}`));
        } else {
          studentSessions[log.name].outTimes.push(new Date(`2024-01-01 ${log.timestamp}`));
        }
      }
    });

    const filteredData = Object.entries(studentSessions).map(([name, data]) => {
      const inTimes = data.inTimes.sort((a, b) => a - b);
      const outTimes = data.outTimes.sort((a, b) => a - b);
      
      const realSessions = [];
      let outIdx = 0;
      
      inTimes.forEach((inTime, inIdx) => {
        while (outIdx < outTimes.length) {
          const outTime = outTimes[outIdx];
          const inToOutGap = (outTime - inTime) / 1000;
          
          if (inToOutGap > 0) {
            const nextIn = inIdx + 1 < inTimes.length ? inTimes[inIdx + 1] : null;
            const outToNextInGap = nextIn ? (nextIn - outTime) / 1000 : 999999;
            
            if (outToNextInGap >= 10 || !nextIn) {
              const outDuration = outToNextInGap >= 10 ? outToNextInGap : 0;
              realSessions.push({
                inTime,
                outTime,
                outDuration,
              });
              outIdx++;
              break;
            } else if (outToNextInGap < 10) {
              outIdx++;
              continue;
            }
            break;
          }
          outIdx++;
        }
      });
      
      let totalInDuration = 0;
      let totalOutDuration = 0;
      let firstInTime = inTimes.length > 0 ? inTimes[0] : null;
      let lastOutTime = realSessions.length > 0 ? realSessions[realSessions.length - 1].outTime : null;
      
      realSessions.forEach((session) => {
        totalOutDuration += session.outDuration;
      });
      
      realSessions.forEach((session) => {
        const inToOutGap = (session.outTime - session.inTime) / 1000;
        totalInDuration += inToOutGap;
      });
      
      const lastRealSession = realSessions.length > 0 ? realSessions[realSessions.length - 1] : null;
      const lastInTime = inTimes.length > 0 ? inTimes[inTimes.length - 1] : null;
      if (lastInTime && (!lastRealSession || lastInTime > lastRealSession.inTime)) {
        const now = new Date(`2024-01-01 ${new Date().toLocaleTimeString()}`);
        totalInDuration += (now - lastInTime) / 1000;
      }
      
      return {
        name: data.name,
        firstInTime: firstInTime ? firstInTime.toLocaleTimeString() : 'N/A',
        lastOutTime: lastOutTime ? lastOutTime.toLocaleTimeString() : 'N/A',
        totalInDuration: totalInDuration >= 0 ? `${Math.floor(totalInDuration / 60)}m ${Math.floor(totalInDuration % 60)}s` : '0s',
        totalOutDuration: `${Math.floor(totalOutDuration / 60)}m ${Math.floor(totalOutDuration % 60)}s`,
      };
    });

    const headers = ['Student Name', 'First IN', 'Last OUT', 'Total IN Duration', 'Total OUT Duration'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map((row) => [
        `"${row.name}"`,
        row.firstInTime,
        row.lastOutTime,
        row.totalInDuration,
        row.totalOutDuration,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_summary_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Live Attendance</h1>
        <p className="text-gray-500">Real-time face recognition and attendance tracking</p>
      </div>

      {cameraError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <p className="font-medium">Camera Error</p>
          <p className="text-sm mt-1">{cameraError}</p>
        </div>
      )}

      <Card>
        <CardBody className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Class
            </label>
            <select
              value={selectedLecture}
              onChange={(e) => setSelectedLecture(e.target.value)}
              disabled={isScanning}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0d7377] disabled:opacity-50"
            >
              <option value="all">All Classes (Global Scan)</option>
              {classes.map((cls) => (
                <option key={cls.lecture_id} value={cls.lecture_id}>
                  {cls.subject} - {cls.lecture_id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 items-end pt-5">
            {!isScanning ? (
              <Button
                onClick={handleStart}
                className="!bg-green-600 hover:!bg-green-700 !text-white"
              >
                <Play className="w-4 h-4 mr-2" />
                Start
              </Button>
            ) : (
              <Button
                onClick={handleStop}
                className="!bg-red-600 hover:!bg-red-700 !text-white"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            )}

            <Button
              onClick={handleExport}
              disabled={logs.length === 0 || isScanning}
              variant="outline"
              className="!border-purple-500 !text-purple-600 hover:!bg-purple-50"
            >
              Export
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Detections</p>
              <p className="text-3xl font-bold text-[#0d7377]">{stats.totalDetected}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-center">
              <p className="text-sm text-gray-500">Recognized</p>
              <p className="text-3xl font-bold text-green-600">{stats.totalRecognized}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-center">
              <p className="text-sm text-gray-500">Unknown</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.totalUnknown}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <h2 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#0d7377]" />
                Camera Feed
                {isScanning && <span className="ml-auto text-sm text-green-600 font-medium">Live</span>}
              </h2>
            </CardHeader>
            <CardBody>
              {!isActive ? (
                <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <p className="mb-2">Click "Start" to begin scanning</p>
                    <p className="text-xs text-gray-500">Make sure camera permission is enabled</p>
                  </div>
                </div>
              ) : (
                <div className="w-full rounded-lg overflow-hidden bg-black relative" style={{ aspectRatio: '16/9' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  {recognitions.length > 0 && (
                    <svg
                      className="absolute top-0 left-0"
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none'
                      }}
                    >
                      {recognitions.map((r, idx) => {
                        const bbox = r.bbox;
                        const videoElement = videoRef.current;
                        if (!videoElement) return null;

                        const containerWidth = videoElement.clientWidth;
                        const containerHeight = videoElement.clientHeight;
                        const videoWidth = videoElement.videoWidth || 640;
                        const videoHeight = videoElement.videoHeight || 480;

                        const scaleX = containerWidth / videoWidth;
                        const scaleY = containerHeight / videoHeight;

                        return (
                          <g key={idx}>
                            <rect
                              x={bbox[0] * scaleX}
                              y={bbox[1] * scaleY}
                              width={(bbox[2] - bbox[0]) * scaleX}
                              height={(bbox[3] - bbox[1]) * scaleY}
                              fill="none"
                              stroke={r.recognized ? '#22c55e' : '#eab308'}
                              strokeWidth="2"
                            />
                            {r.recognized && (
                              <text
                                x={bbox[0] * scaleX + 5}
                                y={bbox[1] * scaleY - 5}
                                fill={r.recognized ? '#22c55e' : '#eab308'}
                                fontSize="14"
                                fontWeight="bold"
                              >
                                {r.name}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <h2 className="font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#0d7377]" />
                Live Log
              </h2>
            </CardHeader>
            <CardBody className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No detections yet
                  </div>
                ) : (
                  <div className="divide-y">
                    {logs.map((log) => (
                      <div key={log.id} className="p-3 text-xs border-b last:border-b-0">
                        <div className="flex items-start gap-2">
                          {log.type === 'recognized' ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{log.name} - {log.status === 'in' ? 'IN' : 'OUT'}</p>
                                <p className="text-gray-400 text-xs">Confidence: {log.confidence}</p>
                                <p className="text-gray-400 text-xs">{log.timestamp}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900">Unknown Face</p>
                                <p className="text-gray-500 text-xs">ID: {log.tracking_id}</p>
                                <p className="text-gray-400 text-xs">{log.timestamp}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
