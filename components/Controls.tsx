import React, { useEffect, useRef, useState } from 'react';
import { EffectType, EffectConfig } from '../types';
import { FilesetResolver, HandLandmarker, ObjectDetector, DrawingUtils, Detection } from '@mediapipe/tasks-vision';

interface ControlsProps {
  activeEffect: EffectType;
  config: EffectConfig;
  onEffectChange: (type: EffectType) => void;
  onConfigChange: (newConfig: Partial<EffectConfig>) => void;
  explanation: string;
  isLoading: boolean;
  onClose: () => void;
  onHandStateChange: (isActive: boolean) => void;
}

const BASIC_EFFECTS: Record<string, string> = {
  [EffectType.GALAXY]: '星系 (Galaxy)',
  [EffectType.WAVE]: '波浪 (Wave)',
  [EffectType.RAIN]: '雨滴 (Rain)',
  [EffectType.SPHERE]: '球体 (Sphere)'
};

const CREATIVE_EFFECTS: Record<string, string> = {
  [EffectType.CREATIVE_TEXT]: '✌️ 比耶',
  [EffectType.CREATIVE_HEART_FIREWORK]: '✊ 握拳',
  [EffectType.CREATIVE_CAT_CAKE]: '🐱 猫咪'
};

const Controls: React.FC<ControlsProps> = ({ 
  activeEffect, 
  onEffectChange, 
  config, 
  onConfigChange,
  explanation,
  isLoading,
  onClose,
  onHandStateChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // Models
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const objectDetectorRef = useRef<ObjectDetector | null>(null);
  
  const [detectionLabel, setDetectionLabel] = useState<string>("初始化中...");

  // Initialize MediaPipe based on Active Effect
  useEffect(() => {
    let animationFrameId: number;
    let isMounted = true;

    // Clean up previous models/streams when effect changes
    const cleanup = () => {
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
      }
      if (objectDetectorRef.current) {
        objectDetectorRef.current.close();
        objectDetectorRef.current = null;
      }
      setIsCameraActive(false);
      setDetectionLabel("初始化中...");
    };

    const setupVision = async () => {
      cleanup();

      const isHand = activeEffect === EffectType.CREATIVE_TEXT || activeEffect === EffectType.CREATIVE_HEART_FIREWORK;
      const isObject = activeEffect === EffectType.CREATIVE_CAT_CAKE;

      if (!isHand && !isObject) {
         // Not a vision effect, stop camera
         if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
         }
         return;
      }

      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        
        if (!isMounted) return;

        if (isHand) {
            handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
              },
              runningMode: "VIDEO",
              numHands: 1
            });
            setDetectionLabel("等待手势...");
        } 
        else if (isObject) {
            objectDetectorRef.current = await ObjectDetector.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
                    delegate: "GPU"
                },
                scoreThreshold: 0.4,
                runningMode: "VIDEO",
                categoryAllowlist: ["cat"] // Optimize for cat
            });
            setDetectionLabel("寻找猫咪...");
        }

        startCamera();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        setDetectionLabel("模型加载失败");
      }
    };

    const startCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 320, height: 240 } 
          });
          if (isMounted && videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener('loadeddata', predictWebcam);
            setIsCameraActive(true);
          }
        } catch (err) {
          console.error("Camera access denied:", err);
          setDetectionLabel("无摄像头权限");
        }
      }
    };

    const predictWebcam = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (video.currentTime > 0 && !video.paused && !video.ended) {
         const startTimeMs = performance.now();
         let isActive = false;
         
         ctx.clearRect(0, 0, canvas.width, canvas.height);

         // --- Hand Detection ---
         if (handLandmarkerRef.current) {
             const results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
             
             if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                const worldLandmarks = results.worldLandmarks[0];

                // Draw
                const drawingUtils = new DrawingUtils(ctx);
                drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#FFFFFF", lineWidth: 2 });
                drawingUtils.drawLandmarks(landmarks, { color: "#FFFFFF", lineWidth: 1, radius: 3 });

                // Logic
                if (worldLandmarks) {
                    const wrist = worldLandmarks[0];
                    const handSize = Math.sqrt(
                        Math.pow(worldLandmarks[9].x - wrist.x, 2) +
                        Math.pow(worldLandmarks[9].y - wrist.y, 2) +
                        Math.pow(worldLandmarks[9].z - wrist.z, 2)
                    );

                    const isCurled = (tipIdx: number) => {
                        const tip = worldLandmarks[tipIdx];
                        const distToWrist = Math.sqrt(
                            Math.pow(tip.x - wrist.x, 2) +
                            Math.pow(tip.y - wrist.y, 2) +
                            Math.pow(tip.z - wrist.z, 2)
                        );
                        return distToWrist < handSize * 1.2;
                    };

                    const indexCurled = isCurled(8);
                    const middleCurled = isCurled(12);
                    const ringCurled = isCurled(16);
                    const pinkyCurled = isCurled(20);

                    if (activeEffect === EffectType.CREATIVE_TEXT) {
                        // Victory (V-Sign)
                        if (!indexCurled && !middleCurled && ringCurled && pinkyCurled) {
                            isActive = true;
                            setDetectionLabel("✌️ 比耶: 展示小龙虾");
                        } else {
                            setDetectionLabel("等待: ✌️");
                        }
                    } else if (activeEffect === EffectType.CREATIVE_HEART_FIREWORK) {
                        // Fist
                        if (indexCurled && middleCurled && ringCurled && pinkyCurled) {
                            isActive = true;
                            setDetectionLabel("✊ 握拳: 发射烟花");
                        } else {
                            setDetectionLabel("等待: ✊");
                        }
                    }
                }
             } else {
                 setDetectionLabel("未检测到手势");
             }
         }
         
         // --- Object Detection ---
         else if (objectDetectorRef.current) {
             const results = objectDetectorRef.current.detectForVideo(video, startTimeMs);
             
             if (results.detections && results.detections.length > 0) {
                 // Filter for cats
                 const catDetection = results.detections.find(d => 
                     d.categories.some(c => c.categoryName === 'cat')
                 );

                 if (catDetection && catDetection.boundingBox) {
                     isActive = true;
                     setDetectionLabel("🐱 发现猫咪! 生日快乐!");
                     
                     // Draw Box
                     const box = catDetection.boundingBox;
                     ctx.strokeStyle = "#00FF00";
                     ctx.lineWidth = 3;
                     ctx.strokeRect(box.originX, box.originY, box.width, box.height);
                     
                     ctx.fillStyle = "#00FF00";
                     ctx.font = "16px Arial";
                     ctx.fillText("CAT", box.originX, box.originY - 5);
                 } else {
                     setDetectionLabel("寻找猫咪...");
                 }
             } else {
                 setDetectionLabel("寻找猫咪...");
             }
         }

         onHandStateChange(isActive);
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupVision();

    return () => {
      isMounted = false;
      cleanup();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [activeEffect, onHandStateChange]);

  return (
    <div className="w-full bg-black/10 backdrop-blur-md text-white p-2 border-r border-white/10 rounded-lg flex flex-col gap-6 overflow-y-auto">
      
      {/* Header Controls */}
      {/* <div className="flex justify-end items-center">
        <button 
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-full transition-colors"
          aria-label="关闭面板"
        >
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div> */}

      {/* Camera View (Only for Creative Mode) */}
      {(activeEffect === EffectType.CREATIVE_TEXT || activeEffect === EffectType.CREATIVE_HEART_FIREWORK || activeEffect === EffectType.CREATIVE_CAT_CAKE) && (
        <div className="relative w-full aspect-[6/3] bg-black rounded-lg overflow-hidden border border-white/20">
           <video 
             ref={videoRef} 
             className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" 
             autoPlay 
             playsInline 
             muted
           />
           <canvas 
             ref={canvasRef} 
             className="absolute inset-0 w-full h-full transform -scale-x-100"
             width={320}
             height={240}
           />
           {/* <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-green-400 font-mono">
             {detectionLabel}
           </div> */}
           {!isCameraActive && (
             <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
               正在启动摄像头/模型...
             </div>
           )}
        </div>
      )}

      {/* Effect Selectors */}
      {/* <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">基础特效</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(BASIC_EFFECTS).map(([type, name]) => (
            <button
              key={type}
              onClick={() => onEffectChange(type as EffectType)}
              className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                activeEffect === type
                  ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div> */}

      {/* <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">创意类型 (AI识别)</label>
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(CREATIVE_EFFECTS).map(([type, name]) => (
            <button
              key={type}
              onClick={() => onEffectChange(type as EffectType)}
              className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                activeEffect === type
                  ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{name}</span>
                <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">
                  {type === EffectType.CREATIVE_CAT_CAKE ? 'Object' : 'Hand'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div> */}

      {/* AI Explanation */}
      {/* <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
           <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm1-13h-2v6h6v-2h-4z"/></svg>
           <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">AI 解析 (Gemini)</span>
        </div>
        <p className={`text-sm leading-relaxed text-gray-300 ${isLoading ? 'animate-pulse' : ''}`}>
          {isLoading ? '正在生成解释...' : explanation}
        </p>
      </div> */}

      {/* Parameters */}
      {/* <div className="flex flex-col gap-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">参数设置</label>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>粒子数量</span>
            <span className="text-gray-400">{config.count}</span>
          </div>
          <input
            type="range"
            min="1000"
            max="30000"
            step="1000"
            value={config.count}
            onChange={(e) => onConfigChange({ count: Number(e.target.value) })}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>速度</span>
            <span className="text-gray-400">{config.speed.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="5.0"
            step="0.1"
            value={config.speed}
            onChange={(e) => onConfigChange({ speed: Number(e.target.value) })}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

         <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>尺寸</span>
            <span className="text-gray-400">{config.size.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={config.size}
            onChange={(e) => onConfigChange({ size: Number(e.target.value) })}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>颜色</span>
          </div>
          <input 
            type="color" 
            value={config.color}
            onChange={(e) => onConfigChange({ color: e.target.value })}
            className="w-full h-8 rounded cursor-pointer bg-transparent border-0"
          />
        </div>
      </div> */}
    </div>
  );
};

export default Controls;