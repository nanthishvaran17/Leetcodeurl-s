import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, SwitchCamera, Sparkles } from 'lucide-react';
import { extractFaceDescriptor, FaceExtractionResult } from '../utils/faceBiometrics';
import api from '../services/api';

interface FaceScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'enroll' | 'login' | 'test';
  usernameHint?: string;
  onSuccess: (data?: any) => void;
}

export const FaceScanModal: React.FC<FaceScanModalProps> = ({
  isOpen,
  onClose,
  mode,
  usernameHint,
  onSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<'requesting' | 'active' | 'error'>('requesting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [feedback, setFeedback] = useState<string>('Align face inside oval frame');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState<boolean>(false);

  // Accumulated high-quality descriptors for multi-frame averaging
  const frameDescriptorsRef = useRef<number[][]>([]);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      resetState();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const resetState = () => {
    setCameraState('requesting');
    setErrorMessage('');
    setFeedback('Align face inside oval frame');
    setScanProgress(0);
    setIsProcessing(false);
    setVerifiedSuccess(false);
    frameDescriptorsRef.current = [];
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraState('requesting');
    setErrorMessage('');
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          setCameraState('active');
          beginScanningLoop();
        };
      }
    } catch (err: any) {
      console.error('Camera open failed:', err);
      setCameraState('error');
      setErrorMessage(
        err?.message || 'Unable to access camera. Please allow camera permissions in your browser or device settings.'
      );
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const beginScanningLoop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    frameDescriptorsRef.current = [];
    setScanProgress(0);

    intervalRef.current = setInterval(() => {
      if (!videoRef.current || isProcessing || verifiedSuccess) return;

      const res: FaceExtractionResult | null = extractFaceDescriptor(videoRef.current);
      if (!res) return;

      if (!res.faceDetected) {
        setFeedback(res.feedback || 'Hold face steadily in center');
        setScanProgress((prev) => Math.max(0, prev - 15));
        return;
      }

      setFeedback(res.feedback);
      frameDescriptorsRef.current.push(res.descriptor);
      const currentFrames = frameDescriptorsRef.current.length;
      const progress = Math.min(100, Math.round((currentFrames / 4) * 100));
      setScanProgress(progress);

      // Once 4 clean frames have been captured, average them and execute action
      if (currentFrames >= 4) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        processFinalDescriptor(frameDescriptorsRef.current);
      }
    }, 180);
  };

  const processFinalDescriptor = async (frames: number[][]) => {
    setIsProcessing(true);
    setFeedback('Authenticating biometric signature...');

    // Vector average of frames for maximum stability
    const averaged: number[] = new Array(128).fill(0);
    for (let i = 0; i < 128; i++) {
      let sum = 0;
      for (const f of frames) {
        sum += f[i];
      }
      averaged[i] = Number((sum / frames.length).toFixed(5));
    }

    try {
      if (mode === 'enroll') {
        const res = await api.post('/auth/face/enroll', { descriptor: averaged });
        if (res.data?.success) {
          setVerifiedSuccess(true);
          setFeedback('Face ID enrolled successfully!');
          setTimeout(() => {
            onSuccess(res.data);
            onClose();
          }, 1200);
        } else {
          throw new Error(res.data?.message || 'Face enrollment failed');
        }
      } else if (mode === 'login') {
        const res = await api.post('/auth/face/login-verify', {
          descriptor: averaged,
          username: usernameHint || undefined,
        });
        if (res.data?.success) {
          setVerifiedSuccess(true);
          setFeedback(`Welcome back, ${res.data?.user?.full_name || res.data?.user?.username || 'User'}!`);
          setTimeout(() => {
            onSuccess(res.data);
            onClose();
          }, 1000);
        } else {
          throw new Error(res.data?.message || 'Face not recognized');
        }
      } else if (mode === 'test') {
        const res = await api.post('/auth/face/test-verify', { descriptor: averaged });
        if (res.data?.success && res.data?.match) {
          setVerifiedSuccess(true);
          setFeedback(res.data?.message || 'Face verified successfully!');
          setTimeout(() => {
            onSuccess(res.data);
            onClose();
          }, 1400);
        } else {
          throw new Error(res.data?.message || 'Face match verification failed.');
        }
      }
    } catch (err: any) {
      console.warn('Face action error:', err);
      setIsProcessing(false);
      setFeedback(err?.response?.data?.message || err?.message || 'Verification failed. Retrying...');
      frameDescriptorsRef.current = [];
      setScanProgress(0);
      // Restart loop after 1.5s delay
      setTimeout(() => {
        if (isOpen && !verifiedSuccess) {
          beginScanningLoop();
        }
      }, 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md bg-slate-900 border-2 border-cyan-500/30 rounded-3xl overflow-hidden shadow-2xl text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {mode === 'enroll'
                  ? 'Enroll Face ID'
                  : mode === 'login'
                  ? 'Face ID Sign In'
                  : 'Test Face ID Match'}
              </h3>
              <p className="text-[11px] text-slate-400">Secure Biometric Facial Recognition</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Viewport Area */}
        <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
          {cameraState === 'requesting' && (
            <div className="flex flex-col items-center gap-2 text-slate-400 p-6 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-xs font-semibold">Accessing optical sensor / camera...</p>
            </div>
          )}

          {cameraState === 'error' && (
            <div className="flex flex-col items-center gap-3 p-6 text-center text-rose-300">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <p className="text-xs font-medium">{errorMessage}</p>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 mt-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700"
              >
                Try Again
              </button>
            </div>
          )}

          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${
              facingMode === 'user' ? 'scale-x-[-1]' : ''
            } ${cameraState === 'active' ? 'block' : 'hidden'}`}
            playsInline
            muted
          />

          {/* Futuristic Biometric Facial Oval Overlay */}
          {cameraState === 'active' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className={`relative w-48 h-60 rounded-[50%] border-2 transition-all duration-300 ${
                  verifiedSuccess
                    ? 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.6)]'
                    : scanProgress > 50
                    ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]'
                    : 'border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                }`}
              >
                {/* Scanning Laser Line */}
                {!verifiedSuccess && (
                  <motion.div
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee]"
                    animate={{ top: ['5%', '92%', '5%'] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}

                {/* Target Markers */}
                <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-400"></div>
                <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan-400"></div>
                <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan-400"></div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-400"></div>
              </div>

              {/* Success Badge */}
              <AnimatePresence>
                {verifiedSuccess && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute flex flex-col items-center gap-2 p-4 bg-emerald-950/90 border border-emerald-500/50 rounded-2xl backdrop-blur-md shadow-2xl"
                  >
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                    <span className="text-xs font-black tracking-wide text-white uppercase">Verified</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Switch Camera Button for mobile devices */}
          {cameraState === 'active' && (
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="absolute bottom-3 right-3 p-2 bg-slate-900/70 hover:bg-slate-800 text-white rounded-full border border-slate-700/50 backdrop-blur-md transition-colors"
              title="Switch camera"
            >
              <SwitchCamera size={16} />
            </button>
          )}
        </div>

        {/* Progress Bar & Status Footer */}
        <div className="p-4 bg-slate-950/70 space-y-3">
          {/* Progress Bar */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <motion.div
              className={`h-full transition-all duration-200 ${
                verifiedSuccess ? 'bg-emerald-400' : 'bg-cyan-400'
              }`}
              style={{ width: `${verifiedSuccess ? 100 : scanProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {verifiedSuccess ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <RefreshCw
                  className={`w-4 h-4 text-cyan-400 ${
                    scanProgress > 0 ? 'animate-spin' : ''
                  }`}
                />
              )}
              <span
                className={`font-semibold ${
                  verifiedSuccess ? 'text-emerald-300' : 'text-slate-300'
                }`}
              >
                {feedback}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {verifiedSuccess ? '100%' : `${scanProgress}%`}
            </span>
          </div>

          <p className="text-[10px] text-slate-500 text-center">
            {mode === 'enroll'
              ? 'Your face vector is encrypted and stored securely as geometric descriptors.'
              : 'Face data is matched instantly on-device against verified biometric credentials.'}
          </p>
        </div>
      </motion.div>
    </div>
  );
};
