import * as THREE from 'three';

function makeSkinMaterial(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, opacity: 1, ...extra });
}

// Recenters an authored creature group on the origin and uniformly scales
// it to `targetHeight` — the actual bounding-box height of that level's
// tract curve — so the maze always nests inside the creature's silhouette
// regardless of how tall/short that particular tract turned out to be.
function finalizeCharacter(innerGroup, opaqueMaterials, targetHeight) {
  const box = new THREE.Box3().setFromObject(innerGroup);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  innerGroup.position.sub(center);

  const root = new THREE.Group();
  root.add(innerGroup);
  root.scale.setScalar(targetHeight / Math.max(size.y, 0.001));

  return {
    group: root,
    opaqueMaterials,
    setSkinOpacity(v) {
      for (const m of opaqueMaterials) m.opacity = v;
    },
  };
}

// Level 0: Worm — simple segmented tube, no limbs.
export function buildWorm(targetHeight) {
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

  // mouth: a small round pucker at the tip of the head segment
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3a1410 }));
  mouth.position.set(0, 8.2, 1.48);
  mouth.scale.set(1, 0.7, 0.4);
  group.add(mouth);

  return finalizeCharacter(group, mats, targetHeight);
}

// Level 1: Frog — round body, four short limbs, big eyes.
export function buildFrog(targetHeight) {
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

  // mouth: a wide flat grin across the front of the face
  const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 2.1, 4, 8), new THREE.MeshStandardMaterial({ color: 0x1f4a38 }));
  mouth.position.set(0, 5.6, 2.55);
  mouth.rotation.z = Math.PI / 2;
  group.add(mouth);

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

  return finalizeCharacter(group, mats, targetHeight);
}

// Level 2: Fox — biped-ish mammal with a head, arms, legs, tail.
export function buildFox(targetHeight) {
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

  // mouth: a dark mouth line at the snout's tip
  const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 4, 6), new THREE.MeshStandardMaterial({ color: 0x2a1410 }));
  mouth.position.set(0, 8.55, 2.2);
  mouth.rotation.z = Math.PI / 2;
  group.add(mouth);

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

  return finalizeCharacter(group, mats, targetHeight);
}

// Level 4: Alien — glowing exotic blob with tentacles.
export function buildAlien(targetHeight) {
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

  // mouth: a toothy radial maw low on the core
  const mouthRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 8, 14), new THREE.MeshStandardMaterial({ color: 0x1a0a2e }));
  mouthRing.position.set(0, 5.4, 2.0);
  group.add(mouthRing);
  const toothGeo = new THREE.ConeGeometry(0.1, 0.3, 6);
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xe8e0ff });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tooth = new THREE.Mesh(toothGeo, toothMat);
    tooth.position.set(Math.cos(a) * 0.55, 5.4 + Math.sin(a) * 0.55, 2.0);
    tooth.lookAt(0, 5.4, 2.0);
    tooth.rotateX(Math.PI / 2);
    group.add(tooth);
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

  return finalizeCharacter(group, mats, targetHeight);
}

// Level 3: Bird — plump body, two wings, a real open beak, thin legs.
export function buildBird(targetHeight) {
  const group = new THREE.Group();
  const mats = [];
  const color = 0x4a90d9;

  const bodyMat = makeSkinMaterial(color);
  mats.push(bodyMat);
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.3, 20, 16), bodyMat);
  body.scale.set(1, 1.25, 1.1);
  body.position.y = 5;
  group.add(body);

  const headMat = makeSkinMaterial(color);
  mats.push(headMat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.3, 18, 14), headMat);
  head.position.set(0, 8.3, 0.3);
  group.add(head);

  const eyeGeo = new THREE.SphereGeometry(0.16, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.5, 8.55, 1.2);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.5;
  group.add(eyeL, eyeR);

  // beak: two wedge cones forming an open upper/lower mandible — the
  // defining feature the user asked for on this species
  const beakMat = makeSkinMaterial(0xf2a93c, { roughness: 0.4 });
  mats.push(beakMat);
  const beakUpper = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 4), beakMat);
  beakUpper.rotation.x = Math.PI / 2;
  beakUpper.rotation.z = Math.PI / 4;
  beakUpper.position.set(0, 8.25, 1.75);
  const beakLower = beakUpper.clone();
  beakLower.scale.set(0.8, 0.8, 0.7);
  beakLower.position.set(0, 7.95, 1.6);
  group.add(beakUpper, beakLower);

  // wings: flattened cones swept back along the sides
  const wingMat = makeSkinMaterial(0x2f6bb0);
  mats.push(wingMat);
  const wingGeo = new THREE.ConeGeometry(1.1, 3.4, 12);
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.scale.set(0.45, 1, 0.9);
  wingL.position.set(-2.2, 5.2, -0.3);
  wingL.rotation.z = THREE.MathUtils.degToRad(80);
  wingL.rotation.y = THREE.MathUtils.degToRad(-15);
  const wingR = wingL.clone();
  wingR.position.x = 2.2;
  wingR.rotation.z = -wingL.rotation.z;
  wingR.rotation.y = -wingL.rotation.y;
  group.add(wingL, wingR);

  // thin legs
  const legMat = makeSkinMaterial(0xf2a93c, { roughness: 0.5 });
  mats.push(legMat);
  const legGeo = new THREE.CapsuleGeometry(0.22, 2.2, 6, 8);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.7, 1.6, 0);
  const legR = legL.clone();
  legR.position.x = 0.7;
  group.add(legL, legR);

  // tail feather fan
  const tailMat = makeSkinMaterial(0x2f6bb0);
  mats.push(tailMat);
  for (let i = -1; i <= 1; i++) {
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 6), tailMat);
    feather.position.set(i * 0.5, 5, -2.4);
    feather.rotation.x = -Math.PI / 2.1;
    feather.rotation.z = i * 0.25;
    group.add(feather);
  }

  return finalizeCharacter(group, mats, targetHeight);
}

export const BUILDERS = [buildWorm, buildFrog, buildFox, buildBird, buildAlien];

