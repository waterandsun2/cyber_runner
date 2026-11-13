import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GAME_CONFIG, LANE_X_POSITIONS } from './constants';
import {
  createCoinMesh,
  createHazardTexture,
  createObstacleMesh,
  createProceduralRobot,
  createTrackTexture,
  ObstacleType,
  RobotCharacter,
} from './proceduralModels';
import { soundSystem } from '../services/audio';

export interface GameState {
  score: number;
  lives: number;
  combo: number;
  maxCombo: number;
  timeElapsed: number; // seconds
  distance: number; // meters
  isGameOver: boolean;
  isPaused: boolean;
  currentLane: 0 | 1 | 2;
  currentSpeed: number;
}

interface ActiveItem {
  id: number;
  type: 'coin' | 'obstacle';
  obstacleType?: ObstacleType;
  lane: 0 | 1 | 2;
  mesh: THREE.Group;
  collected?: boolean;
}

export class GameEngine {
  private container: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private frameId: number = 0;
  private isDestroyed: boolean = false;

  // Track & Environment
  private trackMesh1!: THREE.Mesh;
  private trackMesh2!: THREE.Mesh;
  private starfield!: THREE.Points;
  private starSpeeds!: Float32Array;
  private hazardTexture!: THREE.CanvasTexture;

  // Character
  private robot!: RobotCharacter;
  private targetLaneX: number = 0;
  private currentLaneIndex: 0 | 1 | 2 = 1;

  // Jump physics
  private isJumping: boolean = false;
  private jumpY: number = 0;
  private jumpVelocity: number = 0;
  private gravity: number = -38;
  private jumpImpulse: number = 13.5;

  // Invulnerability after hit
  private invulnerableTimer: number = 0;

  // Spawner & Active Items
  private items: ActiveItem[] = [];
  private nextItemId: number = 1;
  private nextSpawnZ: number = -40;

  // Game state
  public state: GameState = {
    score: 0,
    lives: GAME_CONFIG.INITIAL_LIVES,
    combo: 0,
    maxCombo: 0,
    timeElapsed: 0,
    distance: 0,
    isGameOver: false,
    isPaused: false,
    currentLane: 1,
    currentSpeed: GAME_CONFIG.BASE_SPEED,
  };

  // Particle bursts
  private coinBurstParticles: THREE.Points[] = [];

  // State change listener
  private onStateChange?: (state: GameState) => void;
  private onHitEffect?: () => void;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    // 1. Detect software WebGL guard
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Setup Three.js Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020611); // Deep cosmic black-blue
    this.scene.fog = new THREE.FogExp2(0x020611, 0.016);

    this.camera = new THREE.PerspectiveCamera(
      62,
      container.clientWidth / container.clientHeight,
      0.1,
      250
    );
    // Camera positioned behind and slightly above the robot looking forward
    this.camera.position.set(0, 4.4, 7.2);
    this.camera.lookAt(0, 1.8, -12);

    // 4. Lighting Rig (Warm key light, cool hemisphere fill, Studio PMREM)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0x00f0ff, 0x110033, 0.8);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
    keyLight.position.set(5, 12, 10);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 30;
      keyLight.shadow.camera.left = -6;
      keyLight.shadow.camera.right = 6;
      keyLight.shadow.camera.top = 8;
      keyLight.shadow.camera.bottom = -2;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    // Cyber track side neon lights
    const cyanRim = new THREE.DirectionalLight(0x00d4ff, 1.2);
    cyanRim.position.set(-8, 3, -15);
    this.scene.add(cyanRim);

    const magentaRim = new THREE.DirectionalLight(0xff0088, 1.2);
    magentaRim.position.set(8, 3, -15);
    this.scene.add(magentaRim);

    // 5. Build Environment & Actors
    this.initTrack();
    this.initStarfield();
    this.initRobot();

    // 6. Bind resize handler
    window.addEventListener('resize', this.onResize);

    // Start game loop
    this.tick = this.tick.bind(this);
    this.frameId = requestAnimationFrame(this.tick);
  }

  public setOnStateChange(cb: (state: GameState) => void) {
    this.onStateChange = cb;
  }

  public setOnHitEffect(cb: () => void) {
    this.onHitEffect = cb;
  }

  private onResize = () => {
    if (!this.container || this.isDestroyed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private initTrack() {
    const trackWidth = 9.4;
    const trackLen = GAME_CONFIG.TRACK_SEGMENT_LENGTH;
    const trackGeo = new THREE.PlaneGeometry(trackWidth, trackLen);
    const trackTex = createTrackTexture();
    this.hazardTexture = createHazardTexture();

    const trackMat = new THREE.MeshStandardMaterial({
      map: trackTex,
      metalness: 0.85,
      roughness: 0.2,
    });

    // Segment 1
    this.trackMesh1 = new THREE.Mesh(trackGeo, trackMat);
    this.trackMesh1.rotation.x = -Math.PI / 2;
    this.trackMesh1.position.set(0, 0, -trackLen / 2 + 15);
    this.trackMesh1.receiveShadow = true;
    this.scene.add(this.trackMesh1);

    // Segment 2
    this.trackMesh2 = new THREE.Mesh(trackGeo, trackMat);
    this.trackMesh2.rotation.x = -Math.PI / 2;
    this.trackMesh2.position.set(0, 0, -trackLen * 1.5 + 15);
    this.trackMesh2.receiveShadow = true;
    this.scene.add(this.trackMesh2);

    // Neon Guardrails on track edges (Left & Right magenta glowing tubes)
    this.createGuardrails(trackWidth, trackLen * 2);
  }

  private createGuardrails(trackWidth: number, totalLen: number) {
    const halfW = trackWidth / 2;
    const railMat = new THREE.MeshBasicMaterial({ color: 0xff0088 });

    const railGeo = new THREE.CylinderGeometry(0.09, 0.09, totalLen, 8);

    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.rotation.x = Math.PI / 2;
    leftRail.position.set(-halfW, 0.45, -totalLen / 4);
    this.scene.add(leftRail);

    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.rotation.x = Math.PI / 2;
    rightRail.position.set(halfW, 0.45, -totalLen / 4);
    this.scene.add(rightRail);
  }

  private initStarfield() {
    const count = 1400;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.starSpeeds = new Float32Array(count);

    const colorChoices = [
      new THREE.Color(0x00f0ff),
      new THREE.Color(0xff00aa),
      new THREE.Color(0xffffff),
      new THREE.Color(0x7000ff),
    ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 160;
      positions[i * 3 + 1] = Math.random() * 60 - 5;
      positions[i * 3 + 2] = -Math.random() * 220;

      const c = colorChoices[Math.floor(Math.random() * colorChoices.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      this.starSpeeds[i] = 0.5 + Math.random() * 1.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });

    this.starfield = new THREE.Points(geo, mat);
    this.scene.add(this.starfield);
  }

  private initRobot() {
    this.robot = createProceduralRobot();
    this.robot.group.position.set(0, 0, 0);
    this.scene.add(this.robot.group);
  }

  // Input actions
  public setLane(lane: 0 | 1 | 2) {
    if (this.state.isGameOver || this.state.isPaused) return;
    if (lane !== this.currentLaneIndex) {
      soundSystem.playSwitch();
    }
    this.currentLaneIndex = lane;
    this.state.currentLane = lane;
    this.targetLaneX = LANE_X_POSITIONS[lane];
    this.emitState();
  }

  public jump() {
    if (this.state.isGameOver || this.state.isPaused) return;
    if (!this.isJumping) {
      this.isJumping = true;
      this.jumpVelocity = this.jumpImpulse;
      soundSystem.playJump();
    }
  }

  public moveLeft() {
    if (this.currentLaneIndex > 0) {
      this.setLane((this.currentLaneIndex - 1) as 0 | 1 | 2);
    }
  }

  public moveRight() {
    if (this.currentLaneIndex < 2) {
      this.setLane((this.currentLaneIndex + 1) as 0 | 1 | 2);
    }
  }

  public togglePause() {
    if (this.state.isGameOver) return;
    this.state.isPaused = !this.state.isPaused;
    if (this.state.isPaused) {
      soundSystem.stopMusic();
    } else {
      soundSystem.startMusic();
    }
    this.emitState();
  }

  public restart() {
    // Clear items
    for (const item of this.items) {
      this.scene.remove(item.mesh);
    }
    this.items = [];

    // Reset state
    this.state = {
      score: 0,
      lives: GAME_CONFIG.INITIAL_LIVES,
      combo: 0,
      maxCombo: 0,
      timeElapsed: 0,
      distance: 0,
      isGameOver: false,
      isPaused: false,
      currentLane: 1,
      currentSpeed: GAME_CONFIG.BASE_SPEED,
    };

    this.currentLaneIndex = 1;
    this.targetLaneX = 0;
    this.isJumping = false;
    this.jumpY = 0;
    this.jumpVelocity = 0;
    this.invulnerableTimer = 0;
    this.nextSpawnZ = -40;

    if (this.robot) {
      this.robot.group.position.set(0, 0, 0);
      this.robot.group.visible = true;
    }

    soundSystem.startMusic();
    this.emitState();
  }

  private emitState() {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  // Spawn generation for coins and obstacles
  private updateSpawning(delta: number) {
    // Move existing items towards player (z increases towards camera)
    const speed = this.state.currentSpeed;
    const moveZ = speed * delta;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.mesh.position.z += moveZ;

      // Animate item rotations
      if (item.type === 'coin') {
        item.mesh.rotation.y += delta * 3.5;
        // Hover floating sine
        item.mesh.position.y = 1.1 + Math.sin(this.state.timeElapsed * 5 + item.id) * 0.15;
      } else if (item.obstacleType === 'plasma_mine') {
        item.mesh.rotation.y += delta * 2.2;
        item.mesh.rotation.x += delta * 1.5;
      }

      // Check collision if item is near player z (z: -1.2 to 1.2)
      if (!item.collected && item.mesh.position.z > -1.2 && item.mesh.position.z < 1.4) {
        this.checkCollision(item);
      }

      // Despawn if passed behind player
      if (item.mesh.position.z > GAME_CONFIG.DESPAWN_DISTANCE) {
        this.scene.remove(item.mesh);
        this.items.splice(i, 1);
      }
    }

    // Spawn new items ahead
    this.nextSpawnZ += moveZ;
    if (this.nextSpawnZ > GAME_CONFIG.SPAWN_AHEAD_DISTANCE) {
      this.spawnPattern();
      // Distance between spawn clusters depends on speed
      this.nextSpawnZ = GAME_CONFIG.SPAWN_AHEAD_DISTANCE - (16 + Math.random() * 8);
    }
  }

  private spawnPattern() {
    const patternType = Math.random();
    const spawnZ = GAME_CONFIG.SPAWN_AHEAD_DISTANCE;

    // Pattern 1: One obstacle on a random lane, coins on the other 1-2 lanes
    if (patternType < 0.6) {
      const obstacleLane = Math.floor(Math.random() * 3) as 0 | 1 | 2;
      const obsType: ObstacleType =
        Math.random() < 0.45 ? 'barrier' : Math.random() < 0.7 ? 'laser_gate' : 'plasma_mine';

      const obsMesh = createObstacleMesh(obsType, this.hazardTexture);
      obsMesh.position.set(LANE_X_POSITIONS[obstacleLane], 0, spawnZ);
      this.scene.add(obsMesh);

      this.items.push({
        id: this.nextItemId++,
        type: 'obstacle',
        obstacleType: obsType,
        lane: obstacleLane,
        mesh: obsMesh,
      });

      // Spawn coins in one of the open lanes
      const coinLane = ((obstacleLane + 1 + Math.floor(Math.random() * 2)) % 3) as 0 | 1 | 2;
      for (let c = 0; c < 3; c++) {
        const coinMesh = createCoinMesh();
        coinMesh.position.set(LANE_X_POSITIONS[coinLane], 1.1, spawnZ - c * 3.5);
        this.scene.add(coinMesh);

        this.items.push({
          id: this.nextItemId++,
          type: 'coin',
          lane: coinLane,
          mesh: coinMesh,
        });
      }
    }
    // Pattern 2: Two obstacles, only 1 safe lane full of coins!
    else if (patternType < 0.85) {
      const safeLane = Math.floor(Math.random() * 3) as 0 | 1 | 2;
      const obsLanes = ([0, 1, 2] as const).filter((l) => l !== safeLane);

      obsLanes.forEach((l) => {
        const obsType: ObstacleType = Math.random() < 0.5 ? 'barrier' : 'plasma_mine';
        const obsMesh = createObstacleMesh(obsType, this.hazardTexture);
        obsMesh.position.set(LANE_X_POSITIONS[l], 0, spawnZ);
        this.scene.add(obsMesh);

        this.items.push({
          id: this.nextItemId++,
          type: 'obstacle',
          obstacleType: obsType,
          lane: l,
          mesh: obsMesh,
        });
      });

      // 4 coins along safe lane
      for (let c = 0; c < 4; c++) {
        const coinMesh = createCoinMesh();
        coinMesh.position.set(LANE_X_POSITIONS[safeLane], 1.1, spawnZ - c * 3.2);
        this.scene.add(coinMesh);

        this.items.push({
          id: this.nextItemId++,
          type: 'coin',
          lane: safeLane,
          mesh: coinMesh,
        });
      }
    }
    // Pattern 3: Coin trail arc across lanes (Left -> Center -> Right)
    else {
      const lanes: (0 | 1 | 2)[] = [0, 1, 2];
      lanes.forEach((l, idx) => {
        const coinMesh = createCoinMesh();
        coinMesh.position.set(LANE_X_POSITIONS[l], 1.1, spawnZ - idx * 5);
        this.scene.add(coinMesh);

        this.items.push({
          id: this.nextItemId++,
          type: 'coin',
          lane: l,
          mesh: coinMesh,
        });
      });
    }
  }

  private checkCollision(item: ActiveItem) {
    const playerX = this.robot.group.position.x;
    const itemX = item.mesh.position.x;
    const xDist = Math.abs(playerX - itemX);

    // Lateral collision threshold
    if (xDist > 1.35) return;

    if (item.type === 'coin') {
      // Coin collected!
      item.collected = true;
      this.state.score += GAME_CONFIG.COIN_POINTS;
      this.state.combo += 1;
      if (this.state.combo > this.state.maxCombo) {
        this.state.maxCombo = this.state.combo;
      }
      soundSystem.playCoin();
      this.createCoinBurst(item.mesh.position);
      this.scene.remove(item.mesh);
      this.emitState();
    } else if (item.type === 'obstacle') {
      // Check if jumping over a low barrier / laser gate
      if (this.isJumping && this.jumpY > 1.2 && (item.obstacleType === 'barrier' || item.obstacleType === 'laser_gate')) {
        // Successfully jumped over!
        return;
      }

      // If invulnerable, ignore hit
      if (this.invulnerableTimer > 0) return;

      // Player took damage!
      item.collected = true;
      this.state.lives = Math.max(0, this.state.lives - 1);
      this.state.combo = 0; // Break combo
      this.invulnerableTimer = GAME_CONFIG.INVULNERABLE_DURATION;

      soundSystem.playHit();
      if (this.onHitEffect) {
        this.onHitEffect();
      }

      // Camera screen shake
      this.triggerScreenShake();

      if (this.state.lives <= 0) {
        this.handleGameOver();
      }

      this.emitState();
    }
  }

  private triggerScreenShake() {
    const origY = this.camera.position.y;
    const origX = this.camera.position.x;
    let shakeCount = 8;
    const shake = () => {
      if (shakeCount <= 0) {
        this.camera.position.set(origX, origY, 7.2);
        return;
      }
      this.camera.position.x = origX + (Math.random() - 0.5) * 0.45;
      this.camera.position.y = origY + (Math.random() - 0.5) * 0.45;
      shakeCount--;
      requestAnimationFrame(shake);
    };
    shake();
  }

  private createCoinBurst(pos: THREE.Vector3) {
    const count = 18;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 4;
      velocities.push(
        new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed + 2,
          (Math.random() - 0.5) * speed
        )
      );
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffea00,
      size: 0.28,
      transparent: true,
      opacity: 1,
    });

    const pSystem = new THREE.Points(geo, mat);
    (pSystem as unknown as { velocities: THREE.Vector3[]; age: number }).velocities = velocities;
    (pSystem as unknown as { age: number }).age = 0;

    this.scene.add(pSystem);
    this.coinBurstParticles.push(pSystem);
  }

  private handleGameOver() {
    this.state.isGameOver = true;
    soundSystem.playGameOver();
    soundSystem.stopMusic();
    this.emitState();
  }

  private tick() {
    if (this.isDestroyed) return;

    const delta = Math.min(this.clock.getDelta(), 0.08); // Cap delta to prevent tunneling

    if (!this.state.isPaused && !this.state.isGameOver) {
      // 1. Advance distance and time
      this.state.timeElapsed += delta;
      this.state.distance += this.state.currentSpeed * delta;

      // Speed gradually increases with distance
      this.state.currentSpeed = Math.min(
        GAME_CONFIG.MAX_SPEED,
        GAME_CONFIG.BASE_SPEED + (this.state.distance / 100) * GAME_CONFIG.SPEED_ACCELERATION
      );

      // 2. Infinite looping track segments
      const speed = this.state.currentSpeed;
      const trackMove = speed * delta;
      this.trackMesh1.position.z += trackMove;
      this.trackMesh2.position.z += trackMove;

      const halfLen = GAME_CONFIG.TRACK_SEGMENT_LENGTH;
      if (this.trackMesh1.position.z > halfLen + 15) {
        this.trackMesh1.position.z = this.trackMesh2.position.z - halfLen;
      }
      if (this.trackMesh2.position.z > halfLen + 15) {
        this.trackMesh2.position.z = this.trackMesh1.position.z - halfLen;
      }

      // 3. Starfield warp effect
      if (this.starfield) {
        const positions = this.starfield.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length / 3; i++) {
          positions[i * 3 + 2] += (speed * 1.5 * this.starSpeeds[i]) * delta;
          if (positions[i * 3 + 2] > 10) {
            positions[i * 3 + 2] = -220;
            positions[i * 3] = (Math.random() - 0.5) * 160;
            positions[i * 3 + 1] = Math.random() * 60 - 5;
          }
        }
        this.starfield.geometry.attributes.position.needsUpdate = true;
      }

      // 4. Update Robot kinematics
      // Smooth lateral movement towards target lane using MathUtils.damp
      this.robot.group.position.x = THREE.MathUtils.damp(
        this.robot.group.position.x,
        this.targetLaneX,
        14,
        delta
      );
      // Subtle bank tilt when changing lanes
      const xDiff = this.targetLaneX - this.robot.group.position.x;
      this.robot.group.rotation.z = -xDiff * 0.12;

      // Jump mechanics
      if (this.isJumping) {
        this.jumpVelocity += this.gravity * delta;
        this.jumpY += this.jumpVelocity * delta;

        if (this.jumpY <= 0) {
          this.jumpY = 0;
          this.isJumping = false;
          this.jumpVelocity = 0;
        }
      }
      this.robot.group.position.y = this.jumpY;

      // Robot procedural running animation (arms & legs swing)
      const runCycleSpeed = speed * 0.65;
      this.robot.animTime += delta * runCycleSpeed;
      const swing = Math.sin(this.robot.animTime) * 0.75;

      this.robot.leftLeg.rotation.x = swing;
      this.robot.rightLeg.rotation.x = -swing;
      this.robot.leftArm.rotation.x = -swing * 0.85;
      this.robot.rightArm.rotation.x = swing * 0.85;

      // Subtle torso running bounce
      if (!this.isJumping) {
        this.robot.group.position.y = Math.abs(Math.sin(this.robot.animTime * 2)) * 0.12;
      }

      // Jetpack flame pulse
      const flameScale = 0.8 + Math.random() * 0.4;
      this.robot.thrusterFlame.scale.set(flameScale, flameScale * 1.4, flameScale);
      this.robot.thrusterLight.intensity = 2.0 + Math.random() * 1.2;

      // Invulnerability flicker
      if (this.invulnerableTimer > 0) {
        this.invulnerableTimer -= delta;
        this.robot.group.visible = Math.floor(this.invulnerableTimer * 15) % 2 === 0;
      } else {
        this.robot.group.visible = true;
      }

      // 5. Spawn & collision updates
      this.updateSpawning(delta);

      // 6. Particle burst updates
      for (let p = this.coinBurstParticles.length - 1; p >= 0; p--) {
        const sys = this.coinBurstParticles[p];
        const age = ((sys as unknown as { age: number }).age += delta);
        const velocities = (sys as unknown as { velocities: THREE.Vector3[] }).velocities;
        const posAttr = sys.geometry.attributes.position;
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < velocities.length; i++) {
          arr[i * 3] += velocities[i].x * delta;
          arr[i * 3 + 1] += velocities[i].y * delta;
          arr[i * 3 + 2] += velocities[i].z * delta;
          velocities[i].y -= 9.8 * delta; // Gravity
        }
        posAttr.needsUpdate = true;
        (sys.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - age / 0.6);

        if (age > 0.6) {
          this.scene.remove(sys);
          this.coinBurstParticles.splice(p, 1);
        }
      }

      // Update HUD periodically
      this.emitState();
    }

    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.tick);
  }

  public destroy() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onResize);
    soundSystem.stopMusic();

    // Dispose Three.js scene & renderer
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
