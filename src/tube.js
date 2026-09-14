import * as THREE from 'three';

export function buildTubeMesh(curve, { radius = 1, tubularSegments = 400, radialSegments = 14 } = {}) {
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  const material = new THREE.MeshStandardMaterial({
    color: 0xd9576b,
    roughness: 0.75,
    metalness: 0.05,
    side: THREE.DoubleSide,
    emissive: 0x3a0f16,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, geometry, radius };
}

// Scatter small polyp obstacles near the tube wall, sized relative to the
// tube's own radius so smaller/tighter mazes get proportionally smaller polyps.
export function buildObstacles(curve, tubeRadius, count = 16) {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(1, 10, 10);
  const material = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.5, emissive: 0x553300, emissiveIntensity: 0.4 });
  const baseSize = tubeRadius * 0.4;

  const obstacles = [];
  for (let i = 0; i < count; i++) {
    // avoid very start/end so the player has a fair spawn and finish
    const t = THREE.MathUtils.lerp(0.08, 0.94, (i + Math.random() * 0.6) / count);
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
    if (normal.lengthSq() < 0.001) normal.set(1, 0, 0);
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    const angle = Math.random() * Math.PI * 2;
    const dist = tubeRadius * 0.72;
    const offset = new THREE.Vector3()
      .addScaledVector(normal, Math.cos(angle) * dist)
      .addScaledVector(binormal, Math.sin(angle) * dist);

    const scale = baseSize * (0.7 + Math.random() * 0.8);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(point).add(offset);
    mesh.scale.setScalar(scale);
    group.add(mesh);
    obstacles.push({ t, position: mesh.position.clone(), radius: scale, mesh });
  }
  return { group, obstacles };
}
