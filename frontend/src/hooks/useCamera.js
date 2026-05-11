import { useState, useRef, useCallback, useEffect } from 'react';

export const useCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const pendingStreamRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  const startCamera = useCallback(async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      pendingStreamRef.current = stream;
      setIsActive(true);
      setError(null);
    } catch (err) {
      console.error('Camera error:', err);
      const errorMsg = err.name === 'NotAllowedError' 
        ? 'Camera permission denied. Please allow camera access in browser settings.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : 'Failed to access camera: ' + err.message;
      setError(errorMsg);
    }
  }, []);

  // When videoRef is mounted, attach the pending stream
  useEffect(() => {
    if (videoRef.current && pendingStreamRef.current) {
      videoRef.current.srcObject = pendingStreamRef.current;
      streamRef.current = pendingStreamRef.current;
      pendingStreamRef.current = null;
    }
  }, [isActive]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      return null;
    }

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      const imageData = canvas.toDataURL('image/jpeg', 0.85);
      if (!imageData || imageData.length < 100) {
        return null;
      }

      return imageData;
    } catch (err) {
      console.error('Error capturing frame:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    isActive,
    error,
    startCamera,
    stopCamera,
    captureFrame,
  };
};
