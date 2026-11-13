import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Eye, EyeOff, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { FaceTracker, TrackingData } from '../services/faceTracker';

interface WebcamHUDProps {
  tracker: FaceTracker;
  onLaneChange: (lane: 0 | 1 | 2) => void;
  onJump: () => void;
}

export const WebcamHUD: React.FC<WebcamHUDProps> = ({ tracker, onLaneChange, onJump }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<TrackingData>(tracker.data);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showGuideLines, setShowGuideLines] = useState<boolean>(true);
  const [calibratedNotice, setCalibratedNotice] = useState<boolean>(false);

  useEffect(() => {
    tracker.setOnUpdate((newData) => {
      setData(newData);
      onLaneChange(newData.lane);
    });

    tracker.setOnJump(() => {
      onJump();
    });

    if (videoRef.current) {
      tracker.start(videoRef.current);
    }

    return () => {
      tracker.stop();
    };
  }, [tracker, onLaneChange, onJump]);

  // Render tracking overlay on canvas
  useEffect(() => {
    let animId: number;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || video.readyState < 2) {
        animId = requestAnimationFrame(renderOverlay);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Draw mirrored video stream
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();

      // Cyber scanline overlay
      ctx.fillStyle = 'rgba(2, 6, 23, 0.25)';
      ctx.fillRect(0, 0, w, h);

      if (showGuideLines) {
        const baseline = tracker.getBaseline();
        const leftThreshold = (baseline.baselineX - baseline.horizontalDeadzone) * w;
        const rightThreshold = (baseline.baselineX + baseline.horizontalDeadzone) * w;
        const jumpY = (baseline.baselineY - baseline.jumpThreshold) * h;

        // Draw Lane Columns
        ctx.lineWidth = 1.5;
        // Left lane divider
        ctx.strokeStyle = data.lane === 0 ? 'rgba(0, 240, 255, 0.9)' : 'rgba(0, 240, 255, 0.3)';
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(leftThreshold, 0);
        ctx.lineTo(leftThreshold, h);
        ctx.stroke();

        // Right lane divider
        ctx.strokeStyle = data.lane === 2 ? 'rgba(0, 240, 255, 0.9)' : 'rgba(0, 240, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(rightThreshold, 0);
        ctx.lineTo(rightThreshold, h);
        ctx.stroke();

        // Jump trigger line
        ctx.strokeStyle = data.isJumping ? 'rgba(255, 0, 128, 0.95)' : 'rgba(255, 0, 128, 0.45)';
        ctx.beginPath();
        ctx.moveTo(0, jumpY);
        ctx.lineTo(w, jumpY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Lane labels at bottom
        ctx.font = '10px Chakra Petch, monospace';
        ctx.fillStyle = data.lane === 0 ? '#00f0ff' : 'rgba(255, 255, 255, 0.5)';
        ctx.fillText('左 (L)', 8, h - 6);

        ctx.fillStyle = data.lane === 1 ? '#00f0ff' : 'rgba(255, 255, 255, 0.5)';
        ctx.fillText('中 (MID)', w / 2 - 16, h - 6);

        ctx.fillStyle = data.lane === 2 ? '#00f0ff' : 'rgba(255, 255, 255, 0.5)';
        ctx.fillText('右 (R)', w - 34, h - 6);

        // Jump label
        ctx.fillStyle = data.isJumping ? '#ff0080' : 'rgba(255, 0, 128, 0.7)';
        ctx.fillText('▲ 跳躍門檻 (JUMP)', 8, Math.max(14, jumpY - 4));

        // Draw Nose Tracker Reticle
        if (data.hasFace) {
          const nx = data.noseX * w;
          const ny = data.noseY * h;

          // Glowing crosshair
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(nx, ny, 10, 0, Math.PI * 2);
          ctx.stroke();

          // Center dot
          ctx.fillStyle = data.isJumping ? '#ff0080' : '#00f0ff';
          ctx.beginPath();
          ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Cross lines
          ctx.beginPath();
          ctx.moveTo(nx - 14, ny);
          ctx.lineTo(nx + 14, ny);
          ctx.moveTo(nx, ny - 14);
          ctx.lineTo(nx, ny + 14);
          ctx.stroke();

          // Text marker
          ctx.fillStyle = '#00f0ff';
          ctx.font = '9px monospace';
          ctx.fillText('NOSE', nx + 12, ny - 8);
        }
      }

      animId = requestAnimationFrame(renderOverlay);
    };

    animId = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(animId);
  }, [data, showGuideLines, tracker]);

  const handleCalibrate = () => {
    tracker.calibrate();
    setCalibratedNotice(true);
    setTimeout(() => setCalibratedNotice(false), 1500);
  };

  return (
    <div className="absolute top-4 left-4 z-40 transition-all select-none">
      {/* Container Frame */}
      <div className="hud-panel rounded-xl p-2.5 backdrop-blur-md shadow-2xl border border-cyan-500/40 w-64 text-xs font-tech">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-cyan-500/30 text-cyan-300">
          <div className="flex items-center gap-1.5 font-bold tracking-wider">
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI 視訊姿態控制</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowGuideLines(!showGuideLines)}
              className="p-1 hover:text-white rounded bg-slate-800/80 transition-colors"
              title="切換準心輔助線"
            >
              {showGuideLines ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:text-white rounded bg-slate-800/80 transition-colors"
              title={isMinimized ? '展開' : '縮小'}
            >
              {isMinimized ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Video / Canvas viewport */}
        {!isMinimized && (
          <div className="mt-2 space-y-2">
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-slate-950 border border-cyan-500/30">
              {/* Hidden HTML5 Video used for capture */}
              <video
                ref={videoRef}
                playsInline
                muted
                className="hidden"
                width={320}
                height={240}
              />
              {/* Visible Mirrored Canvas with HUD overlays */}
              <canvas
                ref={canvasRef}
                width={240}
                height={180}
                className="w-full h-full object-cover"
              />

              {/* Status indicator pill on top right */}
              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] bg-slate-950/80 border border-cyan-500/40 text-cyan-300 font-mono flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${data.hasFace ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'}`} />
                <span>{data.hasFace ? '臉部鎖定' : '搜尋中'}</span>
              </div>

              {/* Jump Flash alert */}
              {data.isJumping && (
                <div className="absolute inset-0 bg-fuchsia-500/20 pointer-events-none flex items-center justify-center">
                  <span className="font-orbitron text-xs font-bold text-fuchsia-300 bg-black/70 px-2 py-0.5 rounded border border-fuchsia-400">
                    JUMPING!
                  </span>
                </div>
              )}
            </div>

            {/* Controls Bar: Calibration & Status */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="text-slate-400">當前跑道:</span>
                <span className="font-bold text-cyan-300 font-orbitron">
                  {data.lane === 0 ? '◀ 左跑道' : data.lane === 1 ? '◆ 中間跑道' : '右跑道 ▶'}
                </span>
              </div>

              <div className="flex gap-1.5 pt-0.5">
                <button
                  onClick={handleCalibrate}
                  className="flex-1 py-1 px-2 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 font-medium flex items-center justify-center gap-1 text-[11px] transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>校準中心點</span>
                </button>
              </div>

              {calibratedNotice && (
                <div className="text-center text-[10px] text-emerald-400 flex items-center justify-center gap-1 font-tech">
                  <Sparkles className="w-3 h-3" />
                  <span>已校準當前姿勢為中心基準！</span>
                </div>
              )}

              <p className="text-[10px] text-slate-400 leading-tight">
                💡 頭部/鼻子向左向右傾移切換跑道，抬頭觸發跳躍避開障礙物。亦可隨時用方向鍵或 A/D/Space 鍵。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
