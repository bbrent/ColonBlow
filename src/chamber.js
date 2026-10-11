import * as THREE from 'three';

// A free-roam "organ chamber" (stomach, crop, etc): the food isn't
// constrained to a 1D curve here — it rolls around the INSIDE SURFACE of
// a hollow sphere, always settling toward wherever local gravity
// currently points (same tilt control as tube mode, different freedom).
// The player has to roll it to a specific exit point (the valve) rather
// than just ride a fixed path, which is the whole point of prototyping
// this as a distinct mode.
export function buildChamber({
  radius = 3,
  center = new THREE.Vector3(),
  entryDir = new THREE.Vector3(0, 1, 0),
  valveDir = new THREE.Vector3(0.6, -0.5, 0.6),
  obstacleCount = 4,
  obstacleScale = 1, // size multiplier — e.g. a gizzard's grinding stones read bigger than a stomach's turbulence
  obstacleColor = 0x8a5a2b,
  wallColor = 0xe0954a, // warm amber, deliberately distinct from the tube's pink so a chamber reads as a different organ at a glance
  wallEmissive = 0x4a2a0a,
  label = 'Stomach',
} = {}) {
  entryDir = entryDir.clone().normalize();
  valveDir = valveDir.clone().normalize();

  const group = new THREE.Group();
  group.position.copy(center);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide,
    emissive: wallEmissive,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const wall = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 20), wallMaterial);
  group.add(wall);

  // Valve marker: a bright disc + ring combo on the inner wall showing the
  // exit target — sized generously (not just a thin line) since the camera
  // sits far enough back that a subtle marker disappears entirely.
  const valveGroup = new THREE.Group();
  const valveMat = new THREE.MeshStandardMaterial({
    color: 0x9bffb0,
    emissive: 0x3dff7a,
    emissiveIntensity: 1.8,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const valveDisc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.3, 24), valveMat);
  const valveRing = new THREE.Mesh(new THREE.RingGeometry(radius * 0.32, radius * 0.46, 24), valveMat);
  valveGroup.add(valveDisc, valveRing);
  valveGroup.position.copy(valveDir).multiplyScalar(radius * 0.96);
  valveGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), valveDir);
  group.add(valveGroup);

  const valveLight = new THREE.PointLight(0x3dff7a, 0, radius * 3.5);
  valveLight.position.copy(valveDir).multiplyScalar(radius * 0.85);
  group.add(valveLight);

  // Turbulence obstacles: small floating blobs inside the chamber volume.
  const obstacleGroup = new THREE.Group();
  const obGeo = new THREE.SphereGeometry(1, 10, 10);
  const obMat = new THREE.MeshStandardMaterial({ color: obstacleColor, roughness: 0.5, emissive: 0x2a1a08, emissiveIntensity: 0.4 });
  const obstacles = [];
  for (let i = 0; i < obstacleCount; i++) {
    const dir = randomDirAwayFrom([entryDir, valveDir], 45);
    const depth = radius * (0.45 + Math.random() * 0.35); // not right at the wall, not at dead center
    const pos = dir.clone().multiplyScalar(depth);
    const scale = radius * (0.09 + Math.random() * 0.06) * obstacleScale;
    const mesh = new THREE.Mesh(obGeo, obMat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(scale);
    obstacleGroup.add(mesh);
    obstacles.push({ position: pos, radius: scale, mesh });
  }
  group.add(obstacleGroup);

  return {
    group,
    wall,
    wallMaterial,
    valveGroup,
    valveMaterial: valveMat,
    valveLight,
    obstacleGroup,
    obstacles,
    radius,
    center,
    entryDir,
    valveDir,
    label,
  };
}

// Picks a random unit direction that stays at least `minAngleDeg` away
// from a set of reserved directions (keeps obstacles clear of the entry
// point and the valve so neither is unfairly blocked).
function randomDirAwayFrom(reserved, minAngleDeg) {
  const minDot = Math.cos((minAngleDeg * Math.PI) / 180);
  for (let attempt = 0; attempt < 12; attempt++) {
    const d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    if (d.lengthSq() < 1e-6) continue;
    d.normalize();
    if (reserved.every((r) => d.dot(r) < minDot)) return d;
  }
  return new THREE.Vector3(1, 0, 0);
}
