import { useEffect, useRef, useState, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { AppConfig } from '../server/config'

// Helper to calculate Euclidean distance
function distance(p1: {x: number, y: number}, p2: {x: number, y: number}) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// Helper to check if 5 fingers are open robustly using distance
function areFiveFingersOpen(landmarks: any) {
  if (!landmarks || landmarks.length === 0) return false;
  
  const hand = landmarks[0];
  const wrist = hand[0]; // Wrist joint
  let openFingers = 0;

  // Thumb: check if tip (4) is further from the pinky base (17) than the IP joint (3)
  // This indicates the thumb is extended away from the palm.
  if (distance(hand[4], hand[17]) > distance(hand[3], hand[17])) {
    openFingers++;
  }

  // Index, Middle, Ring, Pinky fingers
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  
  for (let i = 0; i < tips.length; i++) {
    // A finger is open if its tip is further from the wrist than its PIP joint
    if (distance(hand[tips[i]], wrist) > distance(hand[pips[i]], wrist)) {
      openFingers++;
    }
  }

  return openFingers === 5;
}

export function CameraScreen({ onCapture, config }: { onCapture: (rawBlob: Blob, finalBlob: Blob) => void, config: AppConfig }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const isDetectingRef = useRef(false)
  const lastVideoTimeRef = useRef(-1)
  const requestRef = useRef<number>(0)
  const countdownRef = useRef<number | null>(null)

  countdownRef.current = countdown;

  useEffect(() => {
    async function initMediaPipe() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      )
      
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      })
      handLandmarkerRef.current = landmarker
    }
    initMediaPipe()
  }, [])

  useEffect(() => {
    let stream: MediaStream | null = null

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadeddata = () => {
            isDetectingRef.current = true;
            detect();
          }
        }
        setHasPermission(true)
      } catch (err) {
        console.error("Error accessing camera:", err)
        setHasPermission(false)
      }
    }

    startCamera()

    return () => {
      isDetectingRef.current = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (stream) stream.getTracks().forEach(track => track.stop());
    }
  }, [])

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    
    const vW = video.videoWidth
    const vH = video.videoHeight
    const sW = window.innerWidth
    const sH = window.innerHeight

    const vRatio = vW / vH
    const sRatio = sW / sH

    let drawW = vW
    let drawH = vH
    let startX = 0
    let startY = 0

    // Simulate object-cover: crop the video to match the screen's aspect ratio
    if (sRatio > vRatio) {
      // Screen is wider (or less tall) than the video
      drawH = vW / sRatio
      startY = (vH - drawH) / 2
    } else {
      // Screen is narrower (or taller) than the video
      drawW = vH * sRatio
      startX = (vW - drawW) / 2
    }

    canvas.width = drawW
    canvas.height = drawH

    const ctx = canvas.getContext('2d')
    if (!ctx) return;

    // Draw video (mirrored and cropped)
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    ctx.drawImage(video, startX, startY, drawW, drawH, 0, 0, drawW, drawH);
    ctx.restore();

    // First get the raw blob
    canvas.toBlob((rawBlob) => {
      if (!rawBlob) return;

      const addWatermarkText = () => {
      if (!config.watermark?.enabled) return;

      const text = config.watermark?.text || "thermal photoboth by ASIRO | supported by Alfabet Innovation";
      
      let fontSize = Math.floor(drawW * 0.03); // Base desired size
      ctx.save();
      ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
      
      // Ensure text doesn't overflow horizontally
      const maxTextWidth = drawW * 0.95; 
      let textWidth = ctx.measureText(text).width;
      if (textWidth > maxTextWidth) {
        fontSize = Math.max(8, Math.floor(fontSize * (maxTextWidth / textWidth)));
        ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      
      // Black shadow to ensure text is readable on light backgrounds
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = Math.max(4, Math.floor(fontSize * 0.3));
      ctx.shadowOffsetX = Math.max(1, Math.floor(fontSize * 0.07));
      ctx.shadowOffsetY = Math.max(1, Math.floor(fontSize * 0.07));
      
      ctx.fillStyle = "#ffffff";
      const marginBottom = Math.max(10, Math.floor(drawH * 0.03));
      
      ctx.fillText(text, canvas.width / 2, canvas.height - marginBottom);
      ctx.restore();
    }

      const finalizeCapture = () => {
        addWatermarkText();
        canvas.toBlob((finalBlob) => {
          if (finalBlob) onCapture(rawBlob, finalBlob)
        }, 'image/jpeg', 0.9)
      }

      // Draw frame on top if enabled
      if (config.frame.enabled && config.frame.imageUrl) {
        const frameImg = new Image();
        frameImg.onload = () => {
          // Draw frame normally (NOT mirrored)
          ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
          finalizeCapture();
        };
        frameImg.onerror = () => finalizeCapture();
        frameImg.src = config.frame.imageUrl;
      } else {
        finalizeCapture();
      }
    }, 'image/jpeg', 0.9);

  }, [onCapture, config])

  const startCountdown = useCallback(() => {
    if (countdownRef.current !== null) return;

    let count = config.photo.countdownSeconds || 5;
    setCountdown(count);
    
    const interval = setInterval(() => {
      count -= 1;
      setCountdown(count);
      
      if (count === 0) {
        clearInterval(interval);
        captureFrame();
        setTimeout(() => setCountdown(null), 1000);
      }
    }, 1000);
  }, [captureFrame, config.photo.countdownSeconds]);

  const detect = useCallback(() => {
    if (!isDetectingRef.current || !videoRef.current || !handLandmarkerRef.current) {
      if (isDetectingRef.current) requestRef.current = requestAnimationFrame(detect);
      return;
    }

    const video = videoRef.current;
    const startTimeMs = performance.now();

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);

      if (countdownRef.current === null && results.landmarks.length > 0) {
        const isOpen = areFiveFingersOpen(results.landmarks);
        if (isOpen) {
          startCountdown();
        }
      }
    }

    requestRef.current = requestAnimationFrame(detect);
  }, [startCountdown]);


  if (hasPermission === false) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <p className="text-xl">Izinkan akses kamera untuk menggunakan photobooth.</p>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* UI Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-between p-8 pointer-events-none z-20">
        <div className="text-center text-white drop-shadow-lg bg-black/40 px-8 py-4 rounded-3xl backdrop-blur-md">
          <h1 className="text-4xl font-bold tracking-tight">Smart Photobooth</h1>
          <p className="mt-2 text-lg font-medium opacity-90">Buka ke-5 jari tangan Anda untuk memotret</p>
        </div>

        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[40vw] sm:text-[30vw] md:text-[25vw] lg:text-[18rem] font-black text-white drop-shadow-[0_0_40px_rgba(255,255,255,1)] animate-pulse">
              {countdown}
            </span>
          </div>
        )}
        
        {countdown === 0 && (
          <div className="absolute inset-0 bg-white opacity-90 animate-ping z-50" />
        )}

        <div className="pointer-events-auto opacity-0 hover:opacity-100 transition-opacity">
          <button 
            onClick={startCountdown}
            className="rounded-full bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur-md"
          >
            Force Capture
          </button>
        </div>
      </div>
    </div>
  )
}
