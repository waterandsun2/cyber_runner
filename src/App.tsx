/**
 * CyberWarp 3D: Space Runner
 * Futuristic sci-fi runner game with 3D Three.js rendering, MediaPipe face/nose detection,
 * Web Audio procedural music & SFX, and cyberpunk HUD.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState } from './game/GameEngine';
import { FaceTracker } from './services/faceTracker';
import { WebcamHUD } from './components/WebcamHUD';
import { GameHUD } from './components/GameHUD';
import { soundSystem } from './services/audio';
import { Rocket, Sparkles, Volume2, Shield } from 'lucide-react';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);

  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: 3,
    combo: 0,
    maxCombo: 0,
    timeElapsed: 0,
    distance: 0,
    isGameOver: false,
    isPaused: false,
    currentLane: 1,
    currentSpeed: 24,
  });

  const [isMuted, setIsMuted] = useState<boolean>(soundSystem.getMuted());
  const [isHitFlashing, setIsHitFlashing] = useState<boolean>(false);

  // Initialize FaceTracker once
  if (!trackerRef.current) {
    trackerRef.current = new FaceTracker();
  }

  // Initialize Three.js Game Engine once mounted
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const engine = new GameEngine(canvasMountRef.current);
    engineRef.current = engine;

    engine.setOnStateChange((newState) => {
      setGameState(newState);
    });

    engine.setOnHitEffect(() => {
      setIsHitFlashing(true);
      setTimeout(() => setIsHitFlashing(false), 220);
    });

    // Keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        engineRef.current.moveLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        engineRef.current.moveRight();
      } else if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        engineRef.current.jump();
      } else if (e.key === 'p' || e.key === 'P') {
        engineRef.current.togglePause();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted(soundSystem.toggleMute());
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStartGame = () => {
    setHasStarted(true);
    soundSystem.startMusic();
    if (engineRef.current) {
      engineRef.current.restart();
    }
  };

  const handleLaneChange = useCallback((lane: 0 | 1 | 2) => {
    if (engineRef.current) {
      engineRef.current.setLane(lane);
    }
  }, []);

  const handleJump = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.jump();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const muted = soundSystem.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleTogglePause = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.togglePause();
    }
  }, []);

  const handleMoveLeft = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.moveLeft();
    }
  }, []);

  const handleMoveRight = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.moveRight();
    }
  }, []);

  const handleRestart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.restart();
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-tech">
      {/* 3D WebGL Canvas Container */}
      <div ref={canvasMountRef} className="absolute inset-0 z-0 w-full h-full" />

      {/* Live Webcam HUD at Top-Left */}
      {trackerRef.current && (
        <WebcamHUD
          tracker={trackerRef.current}
          onLaneChange={handleLaneChange}
          onJump={handleJump}
        />
      )}

      {/* Main Sci-Fi Game HUD */}
      {hasStarted && (
        <GameHUD
          state={gameState}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
          onMoveLeft={handleMoveLeft}
          onMoveRight={handleMoveRight}
          onJump={handleJump}
          onRestart={handleRestart}
          isHitFlashing={isHitFlashing}
        />
      )}

      {/* START SCREEN MODAL (User Gesture for Web Audio & Camera Authorization) */}
      {!hasStarted && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="hud-panel rounded-3xl max-w-lg w-full p-8 text-center space-y-6 border border-cyan-400/50 shadow-[0_0_50px_rgba(6,182,212,0.3)] animate-in fade-in zoom-in-95 duration-300">
            {/* Title / Badge */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 text-xs font-orbitron font-semibold tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>CYBERWARP 3D SPACE RUNNER</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-200 to-fuchsia-400 tracking-wider">
                未來科幻跑酷
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                結合 Three.js 3D 宇宙賽道與 MediaPipe 視訊 AI 姿態辨識
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-3 gap-2.5 text-left text-xs">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30">
                <div className="font-bold font-orbitron text-cyan-300 mb-1 flex items-center gap-1">
                  <span>📹 鼻子追蹤</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  鏡頭實時追蹤鼻子，頭部左右偏移換道，抬頭觸發跳躍！
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30">
                <div className="font-bold font-orbitron text-amber-300 mb-1 flex items-center gap-1">
                  <span>🪙 能量金幣</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  收集金幣 +1 分，連續吃幣可引發連擊 Combo 炫彩特效！
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30">
                <div className="font-bold font-orbitron text-rose-300 mb-1 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-rose-400 inline" />
                  <span>3 格生命</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  避開紅色雷射與電漿地雷，亦支援方向鍵與鍵盤控制。
                </p>
              </div>
            </div>

            {/* Audio notice */}
            <div className="text-[11px] text-cyan-300/80 flex items-center justify-center gap-1.5 font-mono">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>點擊啟動將播放未來電子合成波背景音樂與立體音效</span>
            </div>

            {/* Launch Button */}
            <button
              onClick={handleStartGame}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-500 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-black font-orbitron text-base tracking-widest shadow-[0_0_25px_rgba(6,182,212,0.6)] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Rocket className="w-5 h-5 fill-current" />
              <span>開始任務 (START MISSION)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
