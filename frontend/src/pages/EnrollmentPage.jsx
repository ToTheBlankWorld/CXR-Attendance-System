import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, CheckCircle, AlertCircle, User, X } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { enrollmentAPI } from '../services/api';

export const EnrollmentPage = () => {
  const [name, setName] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const pendingStreamRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      pendingStreamRef.current = stream;
      streamRef.current = stream;
      setIsCapturing(true);
    } catch (err) {
      alert('Failed to access camera: ' + err.message);
    }
  };

  // Attach stream after <video> mounts (isCapturing re-render)
  useEffect(() => {
    if (isCapturing && videoRef.current && pendingStreamRef.current) {
      videoRef.current.srcObject = pendingStreamRef.current;
      pendingStreamRef.current = null;
    }
  }, [isCapturing]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setIsCapturing(false);
  };

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    stopCamera();
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);

    const image = capturedImage || uploadedImage;
    if (!image) {
      setResult({ success: false, message: 'Please capture or upload a face image' });
      return;
    }
    if (!name) {
      setResult({ success: false, message: 'Please enter the member name' });
      return;
    }

    setLoading(true);
    try {
      const response = await enrollmentAPI.enrollBase64(name, [image]);
      setResult({ success: true, message: response.data.message || 'Member enrolled successfully!' });
      setName('');
      setCapturedImage(null);
      setUploadedImage(null);
    } catch (err) {
      let msg = 'Enrollment failed';
      if (err.response?.data?.detail) {
        msg = Array.isArray(err.response.data.detail)
          ? err.response.data.detail.map(e => e.msg).join(', ')
          : err.response.data.detail;
      }
      setResult({ success: false, message: msg });
    } finally {
      setLoading(false);
    }
  };

  const currentImage = capturedImage || uploadedImage;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
          Enroll Member
        </h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          Register a new lab member with a single front-face image
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" style={{ color: '#00d4e8' }} />
              Enrollment Guidelines
            </span>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="rounded-xl p-4" style={{ background: 'rgba(0,212,232,0.06)', border: '1px solid rgba(0,212,232,0.15)' }}>
              <h3 className="font-semibold text-sm mb-2" style={{ color: '#00d4e8' }}>Single Front-Face Image</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                CXR Lab uses a simplified enrollment process. Only one clear front-facing image is needed. 
                Students will directly face the camera in the lab environment.
              </p>
            </div>

            <div className="rounded-xl p-4" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
              <h3 className="font-semibold text-sm mb-2" style={{ color: '#34d399' }}>Best Practices</h3>
              <ul className="text-xs text-slate-400 space-y-1">
                <li>Good, even lighting on face</li>
                <li>Look directly at the camera</li>
                <li>Neutral expression</li>
                <li>Clear, unobstructed face</li>
                <li>Neutral background preferred</li>
              </ul>
            </div>

            <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <h3 className="font-semibold text-sm mb-2" style={{ color: '#f87171' }}>Avoid</h3>
              <ul className="text-xs text-slate-400 space-y-1">
                <li>Glasses or sunglasses</li>
                <li>Face masks or coverings</li>
                <li>Strong shadows</li>
                <li>Looking away from camera</li>
              </ul>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="flex items-center gap-2">
              <Camera className="w-4 h-4" style={{ color: '#00d4e8' }} />
              Member Registration
            </span>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter member's full name"
                required
              />

              {currentImage ? (
                <div>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#64748b' }}>
                    Captured Image
                  </label>
                  <div className="relative">
                    <img src={currentImage} alt="Preview" className="w-full h-48 object-cover rounded-xl" style={{
                      border: '1px solid rgba(0,212,232,0.2)'
                    }} />
                    <button
                      type="button"
                      onClick={() => { setCapturedImage(null); setUploadedImage(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.8)' }}
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-medium" style={{
                      background: 'rgba(0,212,232,0.9)', color: '#0d1117'
                    }}>
                      Ready to enroll
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#64748b' }}>
                      Capture Face Image
                    </label>
                    {isCapturing ? (
                      <div className="space-y-3">
                        <div className="relative rounded-xl overflow-hidden bg-black" style={{ border: '1px solid rgba(0,212,232,0.2)', minHeight: '320px' }}>
                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ minHeight: '320px' }} />
                          <canvas ref={canvasRef} className="hidden" />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-48 h-48 rounded-full border-2 border-dashed opacity-60" style={{ borderColor: '#00d4e8' }} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" onClick={captureImage} className="flex-1">
                            <Camera className="w-4 h-4" />
                            Capture Photo
                          </Button>
                          <Button type="button" variant="secondary" onClick={stopCamera}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button type="button" onClick={startCamera} variant="outline" className="w-full py-3">
                        <Camera className="w-4 h-4" />
                        Open Camera
                      </Button>
                    )}
                  </div>

                  {!isCapturing && (
                    <div>
                      <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#64748b' }}>
                        Or Upload Image
                      </label>
                      <label
                        className="flex flex-col items-center justify-center w-full h-28 rounded-xl cursor-pointer transition-colors"
                        style={{
                          background: 'rgba(0,0,0,0.2)',
                          border: '2px dashed rgba(0,212,232,0.2)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,212,232,0.4)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0,212,232,0.2)'}
                      >
                        <Upload className="w-7 h-7 mb-2" style={{ color: '#475569' }} />
                        <span className="text-xs text-slate-500">Click to upload image</span>
                        <span className="text-xs text-slate-600 mt-0.5">JPG, PNG, WEBP supported</span>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>
                  )}
                </>
              )}

              {result && (
                <div className="px-4 py-3 rounded-lg flex items-start gap-3 text-sm" style={{
                  background: result.success ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${result.success ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  color: result.success ? '#34d399' : '#f87171'
                }}>
                  {result.success ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                  <span>{result.message}</span>
                </div>
              )}

              <Button type="submit" className="w-full py-3" loading={loading} disabled={!currentImage || !name}>
                <User className="w-4 h-4" />
                Enroll Member
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
