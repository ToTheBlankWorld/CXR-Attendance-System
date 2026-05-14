import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Square, AlertTriangle, CheckCircle, Clock, Sun, Coffee, Sunrise, DoorOpen, Users } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { recognitionAPI } from '../services/api';
import { useCamera } from '../hooks/useCamera';

const SESSION_CONFIG = {
  morning: {
    id: 'MORNING',
    label: 'Morning Lab',
    icon: Sun,
    timeLabel: '8:00 AM \u2013 9:30 AM',
    description: 'Students entering the lab for the morning session',
    markStatus: 'ENTERED',
    statusLabel: 'Entered',
    color: '#00d4e8',
    bg: 'rgba(0,212,232,0.1)',
    border: 'rgba(0,212,232,0.25)',
  },
  lunch: {
    id: 'LUNCH',
    label: 'Lunch Break',
    icon: Coffee,
    timeLabel: '12:00 PM \u2013 1:00 PM',
    description: 'Monitor students leaving for lunch break',
    markStatus: 'LEFT_FOR_LUNCH',
    statusLabel: 'Left for Lunch',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.1)',
    border: 'rgba(251,191,36,0.25)',
  },
  'after-lunch': {
    id: 'AFTER_LUNCH',
    label: 'After Lunch',
    icon: Sunrise,
    timeLabel: 'After 1:00 PM',
    description: 'Students returning to lab after lunch break',
    markStatus: 'ENTERED_AFTER_LUNCH',
    statusLabel: 'Entered After Lunch',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.1)',
    border: 'rgba(52,211,153,0.25)',
  },
  leaving: {
    id: 'EXIT',
    label: 'Leaving Lab',
    icon: DoorOpen,
    timeLabel: 'End of Day',
    description: 'Final exit tracking \u2014 students leaving the lab',
    markStatus: 'LEFT_LAB',
    statusLabel: 'Left Lab',
    color: '#f87171',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.25)',
  },
};

const SESSION_LECTURE_MAP = {
  MORNING: 'LAB_MORNING',
  LUNCH: 'LAB_LUNCH',
  AFTER_LUNCH: 'LAB_AFTER_LUNCH',
  EXIT: 'LAB_EXIT',
};

export const LabPage = () => {
  const { session: sessionKey } = useParams();
  const config = SESSION_CONFIG[sessionKey] || SESSION_CONFIG.morning;
  const lectureId = SESSION_LECTURE_MAP[config.id];

  const { videoRef, canvasRef, isActive, error: cameraError, startCamera, stopCamera, captureFrame } = useCamera();

  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [recognitions, setRecognitions] = useState([]);
  const [stats, setStats] = useState({ detected: 0, recognized: 0 });
  const [recognizedMembers, setRecognizedMembers] = useState({});

  const scanIntervalRef = useRef(null);
  const logIdRef = useRef(0);
  const previousSnapshotRef = useRef(null);

  const Icon = config.icon;

  useEffect(() => {
    setIsScanning(false);
    setLogs([]);
    setRecognitions([]);
    setStats({ detected: 0, recognized: 0 });
    setRecognizedMembers({});
    previousSnapshotRef.current = null;
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (isActive) stopCamera();
  }, [sessionKey]);

  const addLog = useCallback((entry) => {
    setLogs((prev) => [{ id: ++logIdRef.current, ...entry }, ...prev.slice(0, 99)]);
  }, []);

  const doScan = useCallback(async () => {
    const frame = captureFrame();
    if (!frame) return;

    try {
      const response = await recognitionAPI.recognize(lectureId, frame, 'attendance');
      setRecognitions(response.data.recognitions);

      const currentSnapshot = {};
      response.data.recognitions.forEach((r) => {
        if (r.recognized) {
          currentSnapshot[r.name] = {
            name: r.name,
            confidence: (r.confidence * 100).toFixed(1),
            timestamp: new Date().toLocaleTimeString(),
          };
        }
      });

      if (!previousSnapshotRef.current) {
        Object.entries(currentSnapshot).forEach(([, member]) => {
          addLog({
            type: 'entry',
            name: member.name,
            confidence: member.confidence,
            status: config.markStatus,
            statusLabel: config.statusLabel,
            timestamp: member.timestamp,
          });
          setRecognizedMembers(prev => ({ ...prev, [member.name]: { ...member, status: config.markStatus } }));
          setStats(prev => ({ detected: prev.detected + 1, recognized: prev.recognized + 1 }));
        });
      } else {
        Object.entries(currentSnapshot).forEach(([name, member]) => {
          if (!previousSnapshotRef.current[name]) {
            addLog({
              type: 'entry',
              name: member.name,
              confidence: member.confidence,
              status: config.markStatus,
              statusLabel: config.statusLabel,
              timestamp: member.timestamp,
            });
            setRecognizedMembers(prev => ({ ...prev, [name]: { ...member, status: config.markStatus } }));
            setStats(prev => ({ detected: prev.detected + 1, recognized: prev.recognized + 1 }));
          }
        });
      }

      previousSnapshotRef.current = currentSnapshot;

      response.data.recognitions.forEach((r) => {
        if (r.is_unknown && r.is_new_unknown) {
          addLog({
            type: 'unknown',
            tracking_id: r.tracking_id?.slice(-8),
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      });
    } catch (err) {
      console.error('Recognition error:', err.response?.data || err.message);
    }
  }, [lectureId, captureFrame, addLog, config]);

  const handleStart = async () => {
    try {
      await recognitionAPI.clearEmbeddings();
      await recognitionAPI.loadClass(lectureId);
      await recognitionAPI.clearCooldowns();
      await startCamera();

      setIsScanning(true);
      setLogs([]);
      logIdRef.current = 0;
      previousSnapshotRef.current = null;
      setStats({ detected: 0, recognized: 0 });

      setTimeout(() => doScan(), 500);

      scanIntervalRef.current = setInterval(() => doScan(), 3000);
    } catch (err) {
      alert('Failed to start: ' + err.message);
    }
  };

  const handleStop = async () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    stopCamera();
    try {
      await recognitionAPI.stopAttendance(lectureId);
    } catch (err) {
      console.error('Stop error:', err);
    }
    setIsScanning(false);
    setRecognitions([]);
  };

  const memberCount = Object.keys(recognizedMembers).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl" style={{ background: config.bg, border: `1px solid ${config.border}` }}>
            <Icon className="w-6 h-6" style={{ color: config.color }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              {config.label}
            </h1>
            <p className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: '#64748b' }}>
              <Clock className="w-3 h-3" />
              {config.timeLabel} &middot; {config.description}
            </p>
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{
          background: config.bg,
          color: config.color,
          border: `1px solid ${config.border}`
        }}>
          {config.id} SESSION
        </div>
      </div>

      {cameraError && (
        <div className="p-4 rounded-lg text-sm" style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171'
        }}>
          <p className="font-medium">Camera Error</p>
          <p className="mt-1 text-xs">{cameraError}</p>
        </div>
      )}

      <div className="flex gap-3">
        {!isScanning ? (
          <Button onClick={handleStart} style={{
            background: `linear-gradient(135deg, ${config.color}, ${config.color}bb)`,
            color: '#0d1117'
          }}>
            <Play className="w-4 h-4" />
            Start Monitoring
          </Button>
        ) : (
          <Button onClick={handleStop} variant="danger">
            <Square className="w-4 h-4" />
            Stop Monitoring
          </Button>
        )}
        {isScanning && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{
            background: 'rgba(52,211,153,0.1)',
            border: '1px solid rgba(52,211,153,0.2)'
          }}>
            <div className="w-2 h-2 rounded-full bg-green-400 pulse-live" />
            <span className="text-xs font-medium text-green-400">Live \u2014 Scanning every 3s</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Recognized', value: stats.recognized, color: config.color },
          { label: 'Session Status', value: config.statusLabel, color: config.color },
          { label: 'Unique Members', value: memberCount, color: '#94a3b8' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{
            background: '#161b22',
            border: '1px solid rgba(0,212,232,0.1)'
          }}>
            <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "'Rajdhani', sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" style={{ color: config.color }} />
                  Camera Feed
                </span>
                {isScanning && (
                  <span className="text-xs font-medium" style={{ color: '#34d399' }}>&bull; Live</span>
                )}
              </div>
            </CardHeader>
            <CardBody>
              {!isActive ? (
                <div className="w-full aspect-video rounded-xl flex items-center justify-center" style={{
                  background: '#0d1117',
                  border: '1px solid rgba(0,212,232,0.08)'
                }}>
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{
                      background: config.bg,
                      border: `1px solid ${config.border}`
                    }}>
                      <Icon className="w-8 h-8" style={{ color: config.color }} />
                    </div>
                    <p className="text-sm text-slate-400">Click "Start Monitoring" to begin</p>
                    <p className="text-xs text-slate-600 mt-1">Make sure camera permission is enabled</p>
                  </div>
                </div>
              ) : (
                <div className="w-full rounded-xl overflow-hidden bg-black relative" style={{ aspectRatio: '16/9' }}>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  {recognitions.length > 0 && (
                    <svg
                      className="absolute top-0 left-0"
                      style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}
                    >
                      {recognitions.map((r, idx) => {
                        const bbox = r.bbox;
                        const videoElement = videoRef.current;
                        if (!videoElement) return null;
                        const cw = videoElement.clientWidth;
                        const ch = videoElement.clientHeight;
                        const vw = videoElement.videoWidth || 640;
                        const vh = videoElement.videoHeight || 480;
                        const sx = cw / vw;
                        const sy = ch / vh;
                        return (
                          <g key={idx}>
                            <rect
                              x={bbox[0] * sx} y={bbox[1] * sy}
                              width={(bbox[2] - bbox[0]) * sx} height={(bbox[3] - bbox[1]) * sy}
                              fill="none"
                              stroke={r.recognized ? config.color : '#fbbf24'}
                              strokeWidth="2"
                            />
                            {r.recognized ? (
                              <text x={bbox[0] * sx + 5} y={bbox[1] * sy - 5}
                                fill={config.color} fontSize="13" fontWeight="bold">
                                {r.name}
                              </text>
                            ) : (
                              <text x={bbox[0] * sx + 5} y={bbox[1] * sy - 5}
                                fill="#fbbf24" fontSize="13" fontWeight="bold">
                                Unknown
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
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: config.color }} />
                Activity Log
              </span>
            </CardHeader>
            <CardBody className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    No activity yet
                  </div>
                ) : (
                  <div>
                    {logs.map((log) => (
                      <div key={log.id} className="px-4 py-3 border-b text-xs" style={{ borderColor: 'rgba(0,212,232,0.06)' }}>
                        {log.type === 'entry' ? (
                          <div className="flex gap-2 items-start">
                            <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: config.color }} />
                            <div>
                              <p className="font-semibold text-slate-200">{log.name}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{
                                  background: config.bg, color: config.color, border: `1px solid ${config.border}`
                                }}>
                                  {log.statusLabel}
                                </span>
                                <span className="text-slate-600">{log.timestamp}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 items-start">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-yellow-500" />
                            <div>
                              <p className="font-medium text-slate-300">Unknown Face</p>
                              <p className="text-slate-500">ID: {log.tracking_id}</p>
                              <p className="text-slate-600 mt-0.5">{log.timestamp}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {memberCount > 0 && (
        <Card>
          <CardHeader>
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: config.color }} />
              Recognized Members ({memberCount})
            </span>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                    {['Name', 'Status', 'Time', 'Confidence'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(recognizedMembers).map(([name, m]) => (
                    <tr key={name} className="border-t" style={{ borderColor: 'rgba(0,212,232,0.06)' }}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-200">{m.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{
                          background: config.bg, color: config.color, border: `1px solid ${config.border}`
                        }}>
                          {config.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.timestamp}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: config.color }}>{m.confidence}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
