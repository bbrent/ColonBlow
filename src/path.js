import * as THREE from 'three';

// Every level's tract is centered on the origin and scaled to this height,
// so the maze always nests neatly inside its creature's silhouette and the
// camera framing/gravity constants stay valid across levels.
export const TARGET_HEIGHT = 16;

function fitPoints(points, targetHeight) {
  const box = new THREE.Box3().setFromPoints(points);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const scale = targetHeight / Math.max(size.y, 0.001);
  return points.map((p) => p.clone().sub(center).multiplyScalar(scale));
}

// Generates a digestive-tract path whose complexity scales with `level`:
//  0 = worm      -> short, mostly straight, one gentle bend
//  1 = frog/fish -> a few loops, moderate length
//  2 = fox       -> full anatomical coil (stomach + coiled small intestine + colon)
//  3 = alien     -> exaggerated, tightly twisting, impossible-looking spirals
export function generatePath(level = 0) {
  const points = [];

  if (level === 0) {
    points.push(new THREE.Vector3(0, 20, 0));
    points.push(new THREE.Vector3(3, 14, 2));
    points.push(new THREE.Vector3(-3, 8, -2));
    points.push(new THREE.Vector3(3, 2, 2));
    points.push(new THREE.Vector3(-2, -4, -1));
    points.push(new THREE.Vector3(0, -10, 0));
    points.push(new THREE.Vector3(0, -16, 0));
  } else if (level === 1) {
    points.push(new THREE.Vector3(0, 26, 0));
    points.push(new THREE.Vector3(3, 20, 2));
    points.push(new THREE.Vector3(8, 14, 3));
    points.push(new THREE.Vector3(6, 6, -3));
    points.push(new THREE.Vector3(-2, 2, -4));
    points.push(new THREE.Vector3(-8, -2, 2));
    points.push(new THREE.Vector3(-4, -10, 3));
    points.push(new THREE.Vector3(3, -14, -2));
    points.push(new THREE.Vector3(0, -22, 0));
    points.push(new THREE.Vector3(0, -30, 0));
  } else if (level === 2) {
    points.push(new THREE.Vector3(0, 40, 0));
    points.push(new THREE.Vector3(2, 32, -2));
    points.push(new THREE.Vector3(-2, 24, 2));
    points.push(new THREE.Vector3(0, 16, 0));
    points.push(new THREE.Vector3(4, 10, 3));
    points.push(new THREE.Vector3(10, 6, 4));
    points.push(new THREE.Vector3(8, -2, 2));
    points.push(new THREE.Vector3(0, -4, 0));
    const coilTurns = 5;
    const coilPointsPerTurn = 6;
    const totalCoilPoints = coilTurns * coilPointsPerTurn;
    for (let i = 0; i <= totalCoilPoints; i++) {
      const f = i / totalCoilPoints;
      const angle = f * coilTurns * Math.PI * 2;
      const r = THREE.MathUtils.lerp(9, 6, f);
      const y = THREE.MathUtils.lerp(-6, -34, f);
      points.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
    }
    const lastCoil = points[points.length - 1];
    points.push(new THREE.Vector3(lastCoil.x, lastCoil.y - 2, lastCoil.z));
    points.push(new THREE.Vector3(16, -30, 0));
    points.push(new THREE.Vector3(17, -18, 0));
    points.push(new THREE.Vector3(16, -6, 0));
    points.push(new THREE.Vector3(8, -2, 0));
    points.push(new THREE.Vector3(-8, -2, 0));
    points.push(new THREE.Vector3(-16, -6, 0));
    points.push(new THREE.Vector3(-17, -18, 0));
    points.push(new THREE.Vector3(-16, -30, 0));
    points.push(new THREE.Vector3(-10, -36, 4));
    points.push(new THREE.Vector3(-4, -34, -3));
    points.push(new THREE.Vector3(-2, -40, 2));
    points.push(new THREE.Vector3(0, -48, 0));
    points.push(new THREE.Vector3(0, -56, 0));
  } else {
    points.push(new THREE.Vector3(0, 44, 0));
    points.push(new THREE.Vector3(0, 36, 0));
    const turns = 7;
    const pointsPerTurn = 5;
    const total = turns * pointsPerTurn;
    for (let i = 0; i <= total; i++) {
      const f = i / total;
      const angle = f * turns * Math.PI * 2;
      const r = 7 + Math.sin(f * Math.PI * 3) * 3.5;
      const y = THREE.MathUtils.lerp(30, -30, f);
      points.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
    }
    const last = points[points.length - 1];
    points.push(new THREE.Vector3(last.x * 0.4, last.y - 6, last.z * 0.4));
    points.push(new THREE.Vector3(0, -44, 0));
    points.push(new THREE.Vector3(0, -52, 0));
  }

  return new THREE.CatmullRomCurve3(fitPoints(points, TARGET_HEIGHT), false, 'catmullrom', 0.5);
}

export const LEVELS = [
  { name: 'Worm', tubeRadius: 1.35, timeLimit: 40, obstacles: 6 },
  { name: 'Frog', tubeRadius: 0.95, timeLimit: 55, obstacles: 10 },
  { name: 'Fox', tubeRadius: 0.62, timeLimit: 80, obstacles: 16 },
  { name: 'Alien', tubeRadius: 0.48, timeLimit: 90, obstacles: 22 },
];
