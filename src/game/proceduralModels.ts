import * as THREE from 'three';

/**
 * Procedural model factory for CyberWarp 3D.
 * Conforms to Three.js design standards: multi-part procedural assemblies,
 * PBR materials, varied roughness/metalness, grounded bottom-center pivots, zero 404s.
 */

// Procedural grid texture for the sci-fi track
export function createTrackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian sci-fi road
  ctx.fillStyle = '#060a14';
  ctx.fillRect(0, 0, 512, 1024);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(0, 220, 255, 0.18)';
  ctx.lineWidth = 2;
  const gridSpacing = 64;
  for (let y = 0; y < 1024; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Lane dividers (3 lanes: Left, Center, Right)
  // Lanes are at x: 1/6 (Left), 1/2 (Center), 5/6 (Right). Dividers at 1/3 and 2/3
  const div1 = 512 / 3;
  const div2 = (512 * 2) / 3;

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
  ctx.lineWidth = 4;
  ctx.setLineDash([32, 24]);
  ctx.beginPath();
  ctx.moveTo(div1, 0);
  ctx.lineTo(div1, 1024);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(div2, 0);
  ctx.lineTo(div2, 1024);
  ctx.stroke();
  ctx.setLineDash([]);

  // Neon edge glow strip
  const gradL = ctx.createLinearGradient(0, 0, 30, 0);
  gradL.addColorStop(0, 'rgba(255, 0, 160, 0.9)');
  gradL.addColorStop(1, 'rgba(255, 0, 160, 0)');
  ctx.fillStyle = gradL;
  ctx.fillRect(0, 0, 30, 1024);

  const gradR = ctx.createLinearGradient(512, 0, 482, 0);
  gradR.addColorStop(0, 'rgba(255, 0, 160, 0.9)');
  gradR.addColorStop(1, 'rgba(255, 0, 160, 0)');
  ctx.fillStyle = gradR;
  ctx.fillRect(482, 0, 30, 1024);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural hazard stripes texture for obstacles
export function createHazardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ff1144';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#10060a';
  ctx.beginPath();
  const stripeW = 32;
  for (let x = -256; x < 512; x += stripeW * 2) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW - 256, 256);
    ctx.lineTo(x - 256, 256);
    ctx.closePath();
  }
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Multi-part Procedural Sci-Fi Robot Model (Group with 9 parts)
export interface RobotCharacter {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  thrusterLight: THREE.PointLight;
  visorMesh: THREE.Mesh;
  coreMesh: THREE.Mesh;
  thrusterFlame: THREE.Mesh;
  animTime: number;
}

export function createProceduralRobot(): RobotCharacter {
  const root = new THREE.Group();
  root.name = 'CyberRobot';

  // 1. Torso Chassis (metallic matte)
  const torsoGeo = new THREE.BoxGeometry(0.85, 1.05, 0.65);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: 0x162438,
    metalness: 0.85,
    roughness: 0.25,
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 1.35;
  torso.castShadow = true;
  torso.receiveShadow = true;
  root.add(torso);

  // Chest glowing energy core (cyan triangular reactor)
  const coreGeo = new THREE.OctahedronGeometry(0.2, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00d4ff,
    emissiveIntensity: 2.2,
    roughness: 0.1,
    metalness: 0.1,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.set(0, 0.12, 0.35);
  torso.add(core);

  // 2. Head Helmet
  const headGeo = new THREE.BoxGeometry(0.7, 0.65, 0.65);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x22354c,
    metalness: 0.9,
    roughness: 0.2,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.9;
  head.castShadow = true;
  torso.add(head);

  // Cyber Visor (glowing cyan bar)
  const visorGeo = new THREE.BoxGeometry(0.6, 0.2, 0.15);
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x00f5ff,
    emissive: 0x00ffff,
    emissiveIntensity: 2.5,
    roughness: 0.05,
    metalness: 0.1,
  });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.05, 0.32);
  head.add(visor);

  // Head cyber antenna ears
  const earGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8);
  const earMat = new THREE.MeshStandardMaterial({ color: 0x00e1ff, metalness: 0.9, roughness: 0.1 });
  const leftEar = new THREE.Mesh(earGeo, earMat);
  leftEar.position.set(-0.38, 0.1, 0);
  leftEar.rotation.z = Math.PI / 12;
  head.add(leftEar);

  const rightEar = leftEar.clone();
  rightEar.position.set(0.38, 0.1, 0);
  rightEar.rotation.z = -Math.PI / 12;
  head.add(rightEar);

  // 3. Jetpack / Thrusters on back
  const jetpackGeo = new THREE.BoxGeometry(0.65, 0.7, 0.3);
  const jetpackMat = new THREE.MeshStandardMaterial({
    color: 0x0b1320,
    metalness: 0.95,
    roughness: 0.3,
  });
  const jetpack = new THREE.Mesh(jetpackGeo, jetpackMat);
  jetpack.position.set(0, 0, -0.42);
  torso.add(jetpack);

  // Thruster nozzles
  const nozzleGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.25, 12);
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.95, roughness: 0.15 });

  const nozzleL = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzleL.position.set(-0.18, -0.38, 0);
  jetpack.add(nozzleL);

  const nozzleR = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzleR.position.set(0.18, -0.38, 0);
  jetpack.add(nozzleR);

  // Thruster energy flame
  const flameGeo = new THREE.ConeGeometry(0.18, 0.6, 8);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.85,
  });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(0, -0.45, -0.42);
  flame.rotation.x = Math.PI;
  torso.add(flame);

  const thrusterLight = new THREE.PointLight(0x00f0ff, 2.5, 6);
  thrusterLight.position.set(0, -0.3, -0.5);
  torso.add(thrusterLight);

  // 4. Arms
  const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x00c8e0, metalness: 0.8, roughness: 0.3 });
  const limbMat = new THREE.MeshStandardMaterial({ color: 0x1b283d, metalness: 0.7, roughness: 0.35 });

  // Left Arm Group (pivot at shoulder)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.55, 1.65, 0);
  const leftShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), shoulderMat);
  leftArm.add(leftShoulder);
  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), limbMat);
  leftForearm.position.y = -0.38;
  leftForearm.castShadow = true;
  leftArm.add(leftForearm);
  root.add(leftArm);

  // Right Arm Group
  const rightArm = new THREE.Group();
  rightArm.position.set(0.55, 1.65, 0);
  const rightShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), shoulderMat);
  rightArm.add(rightShoulder);
  const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), limbMat);
  rightForearm.position.y = -0.38;
  rightForearm.castShadow = true;
  rightArm.add(rightForearm);
  root.add(rightArm);

  // 5. Legs & Feet
  // Left Leg Group (pivot at hip)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.25, 0.85, 0);
  const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.26), limbMat);
  leftThigh.position.y = -0.42;
  leftThigh.castShadow = true;
  leftLeg.add(leftThigh);
  // Cyber boot
  const bootGeo = new THREE.BoxGeometry(0.28, 0.22, 0.44);
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f1c2e, metalness: 0.9, roughness: 0.2 });
  const leftBoot = new THREE.Mesh(bootGeo, bootMat);
  leftBoot.position.set(0, -0.8, 0.08);
  leftBoot.castShadow = true;
  leftLeg.add(leftBoot);
  root.add(leftLeg);

  // Right Leg Group
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.25, 0.85, 0);
  const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.26), limbMat);
  rightThigh.position.y = -0.42;
  rightThigh.castShadow = true;
  rightLeg.add(rightThigh);
  const rightBoot = new THREE.Mesh(bootGeo, bootMat);
  rightBoot.position.set(0, -0.8, 0.08);
  rightBoot.castShadow = true;
  rightLeg.add(rightBoot);
  root.add(rightLeg);

  // Soft contact shadow disc under the robot
  const shadowGeo = new THREE.CircleGeometry(0.7, 16);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02; // Ground offset
  root.add(shadow);

  return {
    group: root,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    thrusterLight,
    visorMesh: visor,
    coreMesh: core,
    thrusterFlame: flame,
    animTime: 0,
  };
}

// Procedural 3D Gold Coin (Holographic Cyber Energy Token)
export function createCoinMesh(): THREE.Group {
  const coinGroup = new THREE.Group();
  coinGroup.name = 'CyberCoin';

  // Outer gold octagon ring
  const ringGeo = new THREE.TorusGeometry(0.48, 0.1, 8, 16);
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.95,
    roughness: 0.15,
    emissive: 0xffa500,
    emissiveIntensity: 0.6,
  });
  const ring = new THREE.Mesh(ringGeo, goldMat);
  coinGroup.add(ring);

  // Inner floating energy diamond
  const coreGeo = new THREE.OctahedronGeometry(0.3, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffea00,
    emissive: 0xffd700,
    emissiveIntensity: 1.8,
    roughness: 0.1,
    metalness: 0.3,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  coinGroup.add(core);

  // Orbiting energy micro-ring
  const orbRingGeo = new THREE.TorusGeometry(0.62, 0.02, 6, 24);
  const orbRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
  });
  const orbRing = new THREE.Mesh(orbRingGeo, orbRingMat);
  orbRing.rotation.x = Math.PI / 3;
  coinGroup.add(orbRing);

  // Point light for glowing presence
  const coinLight = new THREE.PointLight(0xffea00, 1.2, 3);
  coinGroup.add(coinLight);

  return coinGroup;
}

// Procedural Obstacles (3 distinct futuristic types)
export type ObstacleType = 'barrier' | 'laser_gate' | 'plasma_mine';

export function createObstacleMesh(type: ObstacleType, hazardTex: THREE.Texture): THREE.Group {
  const obstacleGroup = new THREE.Group();
  obstacleGroup.name = `Obstacle_${type}`;

  if (type === 'barrier') {
    // Low jumpable or avoidable barrier
    const baseGeo = new THREE.BoxGeometry(2.3, 0.85, 0.6);
    const baseMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      metalness: 0.8,
      roughness: 0.3,
      emissive: 0xff0044,
      emissiveIntensity: 0.4,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.45;
    base.castShadow = true;
    obstacleGroup.add(base);

    // Glowing danger neon light bar
    const barGeo = new THREE.BoxGeometry(2.4, 0.12, 0.65);
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xff0055,
      emissive: 0xff0033,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });
    const topBar = new THREE.Mesh(barGeo, barMat);
    topBar.position.y = 0.9;
    obstacleGroup.add(topBar);

    const warnLight = new THREE.PointLight(0xff0044, 2, 4);
    warnLight.position.y = 1.0;
    obstacleGroup.add(warnLight);
  } else if (type === 'laser_gate') {
    // Laser Gate: Left & Right vertical cyber pylons + horizontal beam
    const pylonGeo = new THREE.CylinderGeometry(0.18, 0.22, 2.4, 8);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.9,
      roughness: 0.2,
    });

    const leftPylon = new THREE.Mesh(pylonGeo, pylonMat);
    leftPylon.position.set(-1.15, 1.2, 0);
    obstacleGroup.add(leftPylon);

    const rightPylon = new THREE.Mesh(pylonGeo, pylonMat);
    rightPylon.position.set(1.15, 1.2, 0);
    obstacleGroup.add(rightPylon);

    // High laser beam (can slide or dodge) or low beam (jump)
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.3, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff0033,
      transparent: true,
      opacity: 0.9,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 0.7; // Low beam requires jump!
    beam.rotation.z = Math.PI / 2;
    obstacleGroup.add(beam);

    const pylonLight = new THREE.PointLight(0xff1144, 2.5, 4.5);
    pylonLight.position.y = 1.0;
    obstacleGroup.add(pylonLight);
  } else {
    // Plasma Mine: Floating spiked energy sphere
    const coreGeo = new THREE.IcosahedronGeometry(0.55, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff1744,
      emissive: 0xff0040,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 1.0;
    obstacleGroup.add(core);

    // Spikes
    const spikeGeo = new THREE.ConeGeometry(0.14, 0.6, 6);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x220505, metalness: 0.9, roughness: 0.2 });

    const directions = [
      [1, 0, 0, 0, 0, -Math.PI / 2],
      [-1, 0, 0, 0, 0, Math.PI / 2],
      [0, 1, 0, 0, 0, 0],
      [0, -1, 0, Math.PI, 0, 0],
      [0, 0, 1, Math.PI / 2, 0, 0],
      [0, 0, -1, -Math.PI / 2, 0, 0],
    ];

    directions.forEach(([x, y, z, rx, ry, rz]) => {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(x * 0.55, 1.0 + y * 0.55, z * 0.55);
      spike.rotation.set(rx, ry, rz);
      obstacleGroup.add(spike);
    });

    const mineLight = new THREE.PointLight(0xff1744, 2, 5);
    mineLight.position.y = 1.0;
    obstacleGroup.add(mineLight);
  }

  return obstacleGroup;
}
