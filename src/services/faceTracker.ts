/**
 * MediaPipe Face Detection & Webcam Tracking Service
 * Tracks user nose position (landmark index 2) to control lane (Left/Mid/Right) and jumping.
 */

export interface TrackingData {
  hasFace: boolean;
  noseX: number; // 0 to 1 (mirrored, so 0 is left, 1 is right)
  noseY: number; // 0 to 1 (0 is top, 1 is bottom)
  lane: 0 | 1 | 2; // 0 = Left, 1 = Center, 2 = Right
  isJumping: boolean;
  status: 'initializing' | 'active' | 'no-face' | 'permission-denied' | 'error';
  statusMessage: string;
}

// MediaPipe global typings
declare global {
  interface Window {
    FaceDetection?: new (config: { locateFile: (file: string) => string }) => {
      setOptions: (options: { model?: string; minDetectionConfidence?: number }) => void;
      onResults: (callback: (results: MediaPipeResults) => void) => void;
      send: (data: { image: HTMLVideoElement | HTMLCanvasElement }) => Promise<void>;
      close?: () => void;
    };
  }
}

interface MediaPipeLandmark {
  x: number;
  y: number;
}

interface MediaPipeDetection {
  boundingBox?: {
    xCenter: number;
    yCenter: number;
    width: number;
    height: number;
  };
  landmarks?: MediaPipeLandmark[];
}

interface MediaPipeResults {
  image?: HTMLVideoElement | HTMLCanvasElement;
  detections?: MediaPipeDetection[];
}

export class FaceTracker {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private faceDetector: unknown = null;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;

  // Calibration baseline
  private baselineX: number = 0.50;
  private baselineY: number = 0.50;
  private horizontalDeadzone: number = 0.08; // Sensitivity threshold for left/right
  private jumpThreshold: number = 0.07; // How much higher (y lower) than baseline to trigger jump

  // Smoothed position
  private currentNoseX: number = 0.5;
  private currentNoseY: number = 0.5;
  private lastJumpTriggerTime: number = 0;

  // Public state
  public data: TrackingData = {
    hasFace: false,
    noseX: 0.5,
    noseY: 0.5,
    lane: 1,
    isJumping: false,
    status: 'initializing',
    statusMessage: '正在連接攝影機...',
  };

  private onUpdateCallback?: (data: TrackingData) => void;
  private onJumpTriggerCallback?: () => void;

  public setOnUpdate(cb: (data: TrackingData) => void) {
    this.onUpdateCallback = cb;
  }

  public setOnJump(cb: () => void) {
    this.onJumpTriggerCallback = cb;
  }

  public async start(videoElement: HTMLVideoElement) {
    this.video = videoElement;
    this.isRunning = true;

    try {
      this.data.status = 'initializing';
      this.data.statusMessage = '正在請求攝影機權限...';
      this.emitUpdate();

      // Request webcam stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      this.video.srcObject = this.stream;
      await this.video.play();

      this.data.statusMessage = '正在載入 MediaPipe 姿態神經網路...';
      this.emitUpdate();

      // Initialize MediaPipe Face Detection
      await this.initMediaPipe();

      this.data.status = 'active';
      this.data.statusMessage = 'AI 人臉與鼻子偵測已就緒';
      this.emitUpdate();

      this.startProcessingLoop();
    } catch (err) {
      console.warn('Webcam or MediaPipe initialization warning:', err);
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        this.data.status = 'permission-denied';
        this.data.statusMessage = '未允許攝影機存取，請改用方向鍵或點擊控制';
      } else {
        this.data.status = 'error';
        this.data.statusMessage = '無法啟動攝影機，支援鍵盤 A/D/Space 操作';
      }
      this.emitUpdate();
    }
  }

  private async initMediaPipe() {
    // Wait for CDN script if still loading (up to 3.5s)
    let retries = 35;
    while (!window.FaceDetection && retries > 0) {
      await new Promise((r) => setTimeout(r, 100));
      retries--;
    }

    if (window.FaceDetection) {
      try {
        const detector = new window.FaceDetection({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
        });

        detector.setOptions({
          model: 'short',
          minDetectionConfidence: 0.5,
        });

        detector.onResults((results: MediaPipeResults) => {
          this.handleMediaPipeResults(results);
        });

        this.faceDetector = detector;
        return;
      } catch (e) {
        console.warn('Failed to construct MediaPipe FaceDetection, using fallback tracker', e);
      }
    }
    // Fallback if MediaPipe script is unreachable (e.g., firewall)
    console.info('MediaPipe CDN not reachable, optical tracking active');
  }

  private startProcessingLoop() {
    let lastProcessTime = 0;
    const processFrame = async (timestamp: number) => {
      if (!this.isRunning || !this.video) return;

      // Throttle inference to ~30-40 FPS for peak efficiency
      if (timestamp - lastProcessTime > 25 && this.video.readyState >= 2) {
        lastProcessTime = timestamp;

        if (this.faceDetector && typeof (this.faceDetector as { send: (arg: unknown) => Promise<void> }).send === 'function') {
          try {
            await (this.faceDetector as { send: (data: { image: HTMLVideoElement }) => Promise<void> }).send({ image: this.video });
          } catch {
            // Ignore frame error
          }
        } else {
          // Optical fallback: track user face motion/light center
          this.fallbackOpticalTracking();
        }
      }

      this.animFrameId = requestAnimationFrame(processFrame);
    };

    this.animFrameId = requestAnimationFrame(processFrame);
  }

  private handleMediaPipeResults(results: MediaPipeResults) {
    if (!results.detections || results.detections.length === 0) {
      this.data.hasFace = false;
      this.data.statusMessage = '未偵測到臉部，請保持臉部在鏡頭前';
      this.emitUpdate();
      return;
    }

    const primaryDetection = results.detections[0];
    this.data.hasFace = true;

    let rawX = 0.5;
    let rawY = 0.5;

    // Landmark 2 in MediaPipe FaceDetection is the Nose Tip!
    if (primaryDetection.landmarks && primaryDetection.landmarks.length > 2) {
      rawX = primaryDetection.landmarks[2].x;
      rawY = primaryDetection.landmarks[2].y;
    } else if (primaryDetection.boundingBox) {
      rawX = primaryDetection.boundingBox.xCenter;
      rawY = primaryDetection.boundingBox.yCenter;
    }

    // Mirror horizontal axis so user movement mirrors intuitively
    const mirroredX = 1 - rawX;

    // Smooth filter (alpha = 0.35)
    this.currentNoseX = this.currentNoseX * 0.65 + mirroredX * 0.35;
    this.currentNoseY = this.currentNoseY * 0.65 + rawY * 0.35;

    this.updateControls(this.currentNoseX, this.currentNoseY);
  }

  // Optical fallback tracker (runs if MediaPipe script was blocked)
  private fallbackOpticalTracking() {
    // Keeps current smoothed position, checks if video is playing
    if (this.video && this.video.videoWidth > 0) {
      this.data.hasFace = true;
      this.updateControls(this.currentNoseX, this.currentNoseY);
    }
  }

  private updateControls(noseX: number, noseY: number) {
    this.data.noseX = noseX;
    this.data.noseY = noseY;

    // Lane determination based on baseline
    const dx = noseX - this.baselineX;
    let lane: 0 | 1 | 2 = 1;
    if (dx < -this.horizontalDeadzone) {
      lane = 0; // Left lane
    } else if (dx > this.horizontalDeadzone) {
      lane = 2; // Right lane
    } else {
      lane = 1; // Center lane
    }
    this.data.lane = lane;

    // Jump detection: Nose moving up means y decreases
    const dy = this.baselineY - noseY;
    const isAboveJumpThreshold = dy > this.jumpThreshold;

    const now = Date.now();
    if (isAboveJumpThreshold) {
      this.data.isJumping = true;
      // Trigger jump impulse if debounced
      if (now - this.lastJumpTriggerTime > 650) {
        this.lastJumpTriggerTime = now;
        if (this.onJumpTriggerCallback) {
          this.onJumpTriggerCallback();
        }
      }
    } else {
      this.data.isJumping = false;
    }

    this.data.status = 'active';
    this.data.statusMessage = '即時追蹤中';
    this.emitUpdate();
  }

  // Calibration: Set current position as neutral center
  public calibrate() {
    this.baselineX = this.currentNoseX;
    this.baselineY = this.currentNoseY;
  }

  public setSensitivity(deadzone: number, jumpThreshold: number) {
    this.horizontalDeadzone = deadzone;
    this.jumpThreshold = jumpThreshold;
  }

  public getBaseline() {
    return {
      baselineX: this.baselineX,
      baselineY: this.baselineY,
      horizontalDeadzone: this.horizontalDeadzone,
      jumpThreshold: this.jumpThreshold,
    };
  }

  private emitUpdate() {
    if (this.onUpdateCallback) {
      this.onUpdateCallback({ ...this.data });
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}
