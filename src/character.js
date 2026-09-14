import * as THREE from 'three';

function makeSkinMaterial(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, opacity: 1, ...extra });
}

function wrapCharacter(group, opaqueMaterials, previewTubeGeometry, previewScale, previewPos) {
  const previewMat = new THREE.MeshStandardMaterial({
    color: 0xd9576b,
    roughness: 0.8,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0,
  });
  const preview = new THREE.Mesh(previewTubeGeometry, previewMat);
  preview.scale.setScalar(previewScale);
  preview.position.copy(previewPos);
  preview.rotation.y = Math.PI * 0.15;
  group.add(preview);

  return {
    group,
    opaqueMaterials,
    previewMaterial: previewMat,
    setSkinOpacity(v) {
      for (const m of opaqueMaterials) m.opacity = v;
    },
    setPreviewOpacity(v) {
      previewMat.opacity = v;
    },
  };
}

// Level 0: Worm — simple segmented tube, no limbs.
export function buildWorm(previewTubeGeometry) {
  const group = new THREE.Group();
  const mats = [];
  const color = 0x9bd651;
  const segCount = 6;
  for (let i = 0; i < segCount; i++) {
    const f = i / (segCount - 1);
    const radius = THREE.MathUtils.lerp(1.5, 0.9, f);
    const mat = makeSkinMaterial(color);
    mats.push(mat);
    const seg = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), mat);
    seg.position.y = 8 - f * 6.5;
    seg.position.z = Math.sin(f * Math.PI * 2) * 0.4;
    group.add(seg);
  }
  const eyeGeo = new THREE.SphereGeometry(0.22, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.55, 8.6, 1.3);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.55;
  group.add(eyeL, eyeR);

  return wrapCharacter(group, mats, previewTubeGeometry, 0.09, new THREE.Vector3(0, 5.5, 0));
}

// Level 1: Frog — round body, four short limbs, big eyes.
export function buildFrog(previewTubeGeometry) {
  const group = new THREE.Group();
  const mats = [];
  const color = 0x4fb286;
  const bodyMat = makeSkinMaterial(color);
  mats.push(bodyMat);
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 16), bodyMat);
  body.scale.set(1.1, 0.85, 1.2);
  body.position.y = 5;
  group.add(body);

  const eyeGeo = new THREE.SphereGeometry(0.7, 12, 10);
  const eyeMat = makeSkinMaterial(color);
  mats.push(eyeMat);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-1.1, 7.2, 1.4);
  const eyeR = eyeL.clone();
  eyeR.position.x = 1.1;
  group.add(eyeL, eyeR);
  const pupilGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
  pupilL.position.set(-1.1, 7.3, 2.0);
  const pupilR = pupilL.clone();
  pupilR.position.x = 1.1;
  group.add(pupilL, pupilR);

  const limbGeo = new THREE.CapsuleGeometry(0.45, 2, 6, 8);
  const limbMat = makeSkinMaterial(color);
  mats.push(limbMat);
  const positions = [
    [-2.4, 3, 1.6],
    [2.4, 3, 1.6],
    [-2.4, 3, -1.6],
    [2.4, 3, -1.6],
  ];
  for (const [x, y, z] of positions) {
    const limb = new THREE.Mesh(limbGeo, limbMat);
    limb.position.set(x, y, z);
    limb.rotation.z = x < 0 ? 0.5 : -0.5;
    group.add(limb);
  }

  return wrapCharacter(group, mats, previewTubeGeometry, 0.075, new THREE.Vector3(0, 5, 0));
}

// Level 2: Fox — biped-ish mammal with a head, arms, legs, tail.
export function buildFox(previewTubeGeometry) {
  const group = new THREE.Group();
  const mats = [];
  const color = 0xe08a3c;

  const torsoMat = makeSkinMaterial(color);
  mats.push(torsoMat);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 4.5, 6, 12), torsoMat);
  torso.position.y = 5;
  group.add(torso);

  const headMat = makeSkinMaterial(color);
  mats.push(headMat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 16), headMat);
  head.position.y = 9.2;
  group.add(head);
  const snoutMat = makeSkinMaterial(0xf5efe6);
  mats.push(snoutMat);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 10), snoutMat);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 8.9, 1.6);
  group.add(snout);

  const earGeo = new THREE.ConeGeometry(0.55, 1.3, 8);
  const earMat = makeSkinMaterial(color);
  mats.push(earMat);
  const earL = new THREE.Mesh(earGeo, earMat);
  earL.position.set(-1, 10.6, 0);
  const earR = earL.clone();
  earR.position.x = 1;
  group.add(earL, earR);

  const eyeGeo = new THREE.SphereGeometry(0.18, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.55, 9.4, 1.45);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.55;
  group.add(eyeL, eyeR);

  const limbMat = makeSkinMaterial(color);
  mats.push(limbMat);
  const armGeo = new THREE.CapsuleGeometry(0.55, 4, 6, 10);
  const armL = new THREE.Mesh(armGeo, limbMat);
  armL.position.set(-2.9, 5, 0);
  armL.rotation.z = THREE.MathUtils.degToRad(18);
  const armR = armL.clone();
  armR.position.x = 2.9;
  armR.rotation.z = -armL.rotation.z;
  group.add(armL, armR);

  const legGeo = new THREE.CapsuleGeometry(0.65, 4.2, 6, 10);
  const legL = new THREE.Mesh(legGeo, limbMat);
  legL.position.set(-1.1, -0.3, 0);
  const legR = legL.clone();
  legR.position.x = 1.1;
  group.add(legL, legR);

  const tailMat = makeSkinMaterial(0xf5efe6);
  mats.push(tailMat);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.2, 10), tailMat);
  tail.position.set(0, 5, -2.6);
  tail.rotation.x = -Math.PI / 2.4;
  group.add(tail);

  return wrapCharacter(group, mats, previewTubeGeometry, 0.055, new THREE.Vector3(0, 8, 0));
}

// Level 3: Alien — glowing exotic blob with tentacles.
export function buildAlien(previewTubeGeometry) {
  const group = new THREE.Group();
  const mats = [];
  const color = 0x8a4fd6;

  const coreMat = makeSkinMaterial(color, { emissive: 0x3a1a6e, emissiveIntensity: 0.6 });
  mats.push(coreMat);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), coreMat);
  core.position.y = 6;
  group.add(core);

  const eyeGeo = new THREE.SphereGeometry(0.5, 10, 10);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x9dffe0, emissive: 0x2fffb0, emissiveIntensity: 1 });
  for (const [x, y, z] of [
    [-0.9, 7.4, 1.7],
    [0.9, 7.4, 1.7],
    [0, 8.3, 1.4],
  ]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x, y, z);
    group.add(eye);
  }

  const tentacleMat = makeSkinMaterial(color, { emissive: 0x2a0f52, emissiveIntensity: 0.4 });
  mats.push(tentacleMat);
  const tentacleGeo = new THREE.CapsuleGeometry(0.35, 3.6, 6, 8);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const tentacle = new THREE.Mesh(tentacleGeo, tentacleMat);
    tentacle.position.set(Math.cos(angle) * 2.2, 2.2, Math.sin(angle) * 2.2);
    tentacle.rotation.z = Math.cos(angle) * 0.6;
    tentacle.rotation.x = Math.sin(angle) * 0.6;
    group.add(tentacle);
  }

  return wrapCharacter(group, mats, previewTubeGeometry, 0.075, new THREE.Vector3(0, 6, 0));
}

export const BUILDERS = [buildWorm, buildFrog, buildFox, buildAlien];
