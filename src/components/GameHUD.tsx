import React, { useState } from 'react';
import { Volume2, VolumeX, Pause, Play, HelpCircle, ChevronDown, ChevronUp, RotateCcw, Trophy, Zap, ShieldAlert, Award } from 'lucide-react';
import { GameState } from '../game/GameEngine';
import confetti from 'canvas-confetti';

interface GameHUDProps {
  state: GameState;
  isMuted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onJump: () => void;
  onRestart: () => void;
  isHitFlashing: boolean;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  state,
  isMuted,
  onToggleMute,
  onTogglePause,
  onMoveLeft,
  onMoveRight,
  onJump,
  onRestart,
  isHitFlashing,
}) => {
  const [controlsCollapsed, setControlsCollapsed] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // Format time mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // High score tracking
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('cyberwarp_highscore') || '0', 10);
    } catch {
      return 0;
    }
  });

  // When game over, save high score and fire confetti if beat high score
  React.useEffect(() => {
    if (state.isGameOver && state.score > highScore) {
      setHighScore(state.score);
      try {
        localStorage.setItem('cyberwarp_highscore', state.score.toString());
      } catch {
        // Ignore
      }
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [state.isGameOver, state.score, highScore]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-tech">
      {/* Red damage vignette flash */}
      <div
        className={`absolute inset-0 bg-red-600/35 pointer-events-none transition-opacity duration-150 ${
          isHitFlashing ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* TOP HUD ROW */}
      <div className="absolute top-4 left-0 right-0 px-6 flex justify-between items-start pointer-events-auto">
        {/* Left Side: Space for Webcam at top-left + LIFE energy gauge */}
        <div className="flex flex-col gap-2 ml-72">
          {/* Life gauge panel matching screenshot */}
          <div className="hud-panel rounded-lg px-4 py-2 flex items-center gap-3 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[12px] font-bold tracking-wider text-cyan-300 font-orbitron">
                  生命能量 (LIFE)
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 font-mono flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-cyan-400" />
                  <span>磁力吸引 1/3</span>
                </span>
              </div>

              {/* 3 Energy Life blocks */}
              <div className="flex gap-1.5">
                {[0, 1, 2].map((idx) => {
                  const isActive = idx < state.lives;
                  return (
                    <div
                      key={idx}
                      className={`h-4 w-9 rounded-sm transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-400 to-cyan-300 shadow-[0_0_12px_#06b6d4] border border-cyan-200'
                          : 'bg-slate-900/80 border border-cyan-900/40'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Center: SCORE & COMBO */}
        <div className="flex flex-col items-center">
          <div className="text-center">
            <div className="text-[11px] font-bold tracking-widest text-amber-300/90 font-orbitron">
              能量金幣 SCORE
            </div>
            <div className="text-4xl md:text-5xl font-black font-orbitron text-amber-400 neon-text-gold tracking-tight drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]">
              {state.score}
            </div>

            {/* Combo Badge */}
            {state.combo > 1 && (
              <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/30 to-rose-500/30 border border-amber-400/60 text-amber-300 text-xs font-bold font-orbitron animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                <span>🔥 連擊 COMBO</span>
                <span className="text-white">x{state.combo}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: WARP FLIGHT DATA (TIME & DISTANCE) */}
        <div className="hud-panel rounded-lg px-4 py-2 backdrop-blur-md">
          <div className="text-[11px] font-bold tracking-wider text-cyan-300 font-orbitron mb-1 text-center">
            飛行數據 (WARP)
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">時間 TIME</div>
              <div className="text-base font-bold font-orbitron text-cyan-300">
                {formatTime(state.timeElapsed)}
              </div>
            </div>
            <div className="w-[1px] bg-cyan-500/30 my-0.5" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">距離 DIST</div>
              <div className="text-base font-bold font-orbitron text-cyan-300">
                {Math.floor(state.distance)}M
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TRACK INDICATOR (Center above bottom dock) */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto">
        <div className="px-3 py-1 rounded-full bg-slate-950/80 border border-cyan-500/40 text-[11px] font-orbitron text-cyan-300 flex items-center gap-2 backdrop-blur-sm">
          <span className="text-slate-400">跑道 TRACK:</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                state.currentLane === 0
                  ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee] scale-125'
                  : 'bg-slate-700 border border-slate-600'
              }`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                state.currentLane === 1
                  ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee] scale-125'
                  : 'bg-slate-700 border border-slate-600'
              }`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                state.currentLane === 2
                  ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee] scale-125'
                  : 'bg-slate-700 border border-slate-600'
              }`}
            />
          </div>
        </div>

        {/* Collapsible toggle */}
        <button
          onClick={() => setControlsCollapsed(!controlsCollapsed)}
          className="text-[10px] text-cyan-400/80 hover:text-cyan-200 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/60 border border-cyan-500/30 transition-colors"
        >
          {controlsCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span>{controlsCollapsed ? '展開控制台 (Show Controls)' : '收合控制台 (Hide Controls)'}</span>
        </button>
      </div>

      {/* BOTTOM CONTROL DOCK */}
      {!controlsCollapsed && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-3 w-full max-w-xl px-4 justify-center">
          {/* Left Button */}
          <button
            onClick={onMoveLeft}
            className="flex-1 max-w-[140px] py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-950/90 to-slate-900/90 hover:from-cyan-900 hover:to-slate-800 border border-cyan-500/50 hover:border-cyan-400 text-cyan-200 font-orbitron font-bold text-xs tracking-wider shadow-[0_0_12px_rgba(6,182,212,0.25)] active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <span>〈 左 (A / ◄)</span>
          </button>

          {/* Center Actions: Jump, Sound, Pause, Help */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 border border-cyan-500/40 backdrop-blur-md">
            {/* Jump button */}
            <button
              onClick={onJump}
              className="py-1.5 px-3.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-orbitron font-bold text-xs tracking-wider shadow-[0_0_12px_rgba(217,70,239,0.4)] active:scale-95 transition-all flex items-center gap-1"
              title="跳躍 (W / SPACE / 抬頭)"
            >
              <span>▲ 跳躍</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={onToggleMute}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 hover:text-white transition-colors border border-cyan-500/30"
              title={isMuted ? '開啟音效' : '靜音'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* Pause Toggle */}
            <button
              onClick={onTogglePause}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 hover:text-white transition-colors border border-cyan-500/30"
              title={state.isPaused ? '繼續遊戲' : '暫停'}
            >
              {state.isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Help / Instructions */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 hover:text-white transition-colors border border-cyan-500/30"
              title="操作說明與規則"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          {/* Right Button */}
          <button
            onClick={onMoveRight}
            className="flex-1 max-w-[140px] py-2.5 px-3 rounded-lg bg-gradient-to-l from-cyan-950/90 to-slate-900/90 hover:from-cyan-900 hover:to-slate-800 border border-cyan-500/50 hover:border-cyan-400 text-cyan-200 font-orbitron font-bold text-xs tracking-wider shadow-[0_0_12px_rgba(6,182,212,0.25)] active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <span>右 (D / ►) 〉</span>
          </button>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {state.isGameOver && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto p-4">
          <div className="hud-panel-danger rounded-2xl max-w-md w-full p-6 text-center space-y-5 border-2 border-rose-500/60 shadow-[0_0_35px_rgba(244,63,94,0.3)] animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <div className="inline-flex p-3 rounded-full bg-rose-500/20 text-rose-400 mb-1 border border-rose-500/40">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black font-orbitron text-rose-400 tracking-wider">
                任務終止 SYSTEM FAILURE
              </h2>
              <p className="text-xs text-slate-300">機械人生命能量耗盡，數據已同步至基地</p>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30">
                <div className="text-[10px] text-slate-400 uppercase font-orbitron">本次得分</div>
                <div className="text-3xl font-black font-orbitron text-amber-400 neon-text-gold">
                  {state.score}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30">
                <div className="text-[10px] text-slate-400 uppercase font-orbitron">歷史最高紀錄</div>
                <div className="text-3xl font-black font-orbitron text-cyan-300 flex items-center justify-center gap-1">
                  <Trophy className="w-5 h-5 text-amber-400 inline" />
                  <span>{Math.max(state.score, highScore)}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-orbitron">飛行距離</div>
                <div className="text-lg font-bold font-orbitron text-slate-200">
                  {Math.floor(state.distance)} M
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-orbitron">最高連擊</div>
                <div className="text-lg font-bold font-orbitron text-rose-300">
                  x{state.maxCombo}
                </div>
              </div>
            </div>

            {/* Restart Button */}
            <button
              onClick={onRestart}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-500 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-black font-orbitron text-sm tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.5)] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 stroke-[2.5]" />
              <span>重新啟動任務 (RESTART)</span>
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {state.isPaused && !state.isGameOver && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto">
          <div className="hud-panel rounded-2xl p-6 text-center space-y-4 max-w-sm w-full mx-4 border border-cyan-500/50 shadow-2xl">
            <h3 className="text-xl font-bold font-orbitron text-cyan-300">
              ⏸ 遊戲已暫停
            </h3>
            <p className="text-xs text-slate-300">放鬆一下，點擊下方按鈕隨時繼續賽程</p>
            <button
              onClick={onTogglePause}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-orbitron text-xs tracking-wider transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>繼續奔跑 (RESUME)</span>
            </button>
          </div>
        </div>
      )}

      {/* HELP / INSTRUCTIONS MODAL */}
      {showHelpModal && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-4">
          <div className="hud-panel rounded-2xl p-6 max-w-md w-full space-y-4 border border-cyan-500/50 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/30">
              <div className="flex items-center gap-2 font-bold font-orbitron text-cyan-300">
                <Award className="w-5 h-5 text-cyan-400" />
                <span>遊戲指南與操作模式</span>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
                <div className="font-bold text-cyan-300 mb-1 flex items-center gap-1 font-orbitron">
                  <span>📹 模式一：AI 視訊臉部/鼻子追蹤</span>
                </div>
                <p>
                  透過 MediaPipe 實時追蹤您鼻子在鏡頭中的位置。
                  頭部往左移進入左跑道，往右移進入右跑道；迅速抬頭向上即可操控機械人躍起避開障礙！
                  若初始偏位，可點擊視訊窗下方的「校準中心點」。
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60">
                <div className="font-bold text-cyan-300 mb-1 font-orbitron">
                  ⌨️ 模式二：鍵盤 / 觸控控制
                </div>
                <p>
                  • 切換跑道：<kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-600">A</kbd> / <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-600">D</kbd> 或方向鍵 <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-600">◀</kbd> / <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-600">▶</kbd>
                  <br />
                  • 跳躍避障：<kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-600">W</kbd> / <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-600">SPACE</kbd> / <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-600">▲</kbd>
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60">
                <div className="font-bold text-amber-300 mb-1 font-orbitron">
                  ⚡ 規則與計分
                </div>
                <p>
                  • 收集金幣：每枚金幣加 1 分，連續收集可累積連擊數！
                  <br />
                  • 碰撞障礙物：扣 1 格生命值（初始為 3 格）。
                  <br />
                  • 較矮的障礙物與雷射閘門可直接跳躍跨過！
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-orbitron text-xs transition-colors"
            >
              了解，開始遊戲！
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
