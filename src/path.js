import * as THREE from 'three';

function recenter(points) {
  const box = new THREE.Box3().setFromPoints(points);
  const center = new THREE.Vector3();
  box.getCenter(center);
  return points.map((p) => p.clone().sub(center));
}

function boundsHeight(points) {
  const box = new THREE.Box3().setFromPoints(points);
  return box.max.y - box.min.y;
}

// A descending spiral, its pitch and radius sized off the tube's own
// radius so consecutive loops stay clearly separated even though the
// tract is rendered translucent from outside — the #1 thing that made
// early tight coils unreadable. `wobble` adds a gentle radius ripple for
// a more organic/exotic look without pulling loops close together.
function buildCoil(start, tubeRadius, { turns, pointsPerTurn = 6, pitchMul = 4.2, radiusMul = 3.6, wobble = 0, taper = 1 }) {
  const pitch = tubeRadius * pitchMul;
  const coilRadius = tubeRadius * radiusMul;
  const points = [];
  const total = turns * pointsPerTurn;
  for (let i = 0; i <= total; i++) {
    const f = i / total;
    const angle = f * turns * Math.PI * 2;
    const r = coilRadius * THREE.MathUtils.lerp(1, taper, f) * (1 + wobble * Math.sin(f * Math.PI * 3));
    const y = start.y - f * turns * pitch;
    points.push(new THREE.Vector3(start.x + Math.cos(angle) * r, y, start.z + Math.sin(angle) * r));
  }
  return { points, coilRadius, endY: points[points.length - 1].y };
}

// Generates a digestive-tract path whose complexity scales with `level`:
//  0 = worm      -> short, mostly straight, one gentle bend
//  1 = frog/fish -> a few loops, moderate length
//  2 = fox       -> full anatomical coil (stomach + coiled small intestine + colon)
//  3 = alien     -> exaggerated, tightly twisting, impossible-looking spirals
// `tubeRadius` sizes the coil spacing so loops never crowd each other
// regardless of how tight or thin a given level's tract is.
export function generatePath(level = 0, tubeRadius = 1) {
  let points = [];

  if (level === 0) {
    points = [
      new THREE.Vector3(0, 8, 0),
      new THREE.Vector3(1.2, 5.6, 0.8),
      new THREE.Vector3(-1.2, 3.2, -0.8),
      new THREE.Vector3(1.2, 0.8, 0.8),
      new THREE.Vector3(-0.8, -1.6, -0.4),
      new THREE.Vector3(0, -4, 0),
      new THREE.Vector3(0, -6.4, 0),
    ];
  } else if (level === 1) {
    points = [
      new THREE.Vector3(0, 7, 0),
      new THREE.Vector3(0.8, 5.4, 0.5),
      new THREE.Vector3(2.1, 3.8, 0.8),
      new THREE.Vector3(1.6, 1.6, -0.8),
      new THREE.Vector3(-0.5, 0.5, -1.1),
      new THREE.Vector3(-2.1, -0.5, 0.5),
      new THREE.Vector3(-1.1, -2.7, 0.8),
      new THREE.Vector3(0.8, -3.8, -0.5),
      new THREE.Vector3(0, -5.9, 0),
      new THREE.Vector3(0, -8, 0),
    ];
  } else if (level === 2) {
    // lead-in: mouth -> esophagus -> stomach
    points.push(new THREE.Vector3(0, 7.5, 0));
    points.push(new THREE.Vector3(0.6, 5.5, -0.6));
    points.push(new THREE.Vector3(-0.6, 3.5, 0.6));
    points.push(new THREE.Vector3(1.2, 1.8, 0.9));
    points.push(new THREE.Vector3(0.8, 0, 0.2));

    const coil = buildCoil(points[points.length - 1], tubeRadius, { turns: 4, pitchMul: 4.2, radiusMul: 3.4, taper: 0.8 });
    points.push(...coil.points);

    // large intestine framed wide of the coil so it never overlaps it
    const cx = coil.coilRadius * 2.1;
    const topY = coil.endY + coil.coilRadius * 0.4;
    const botY = coil.endY - coil.coilRadius * 2.6;
    points.push(new THREE.Vector3(0.8, coil.endY - 0.5, 0.2));
    points.push(new THREE.Vector3(cx, botY, 0));
    points.push(new THREE.Vector3(cx, topY, 0));
    points.push(new THREE.Vector3(0, topY + cx * 0.15, 0));
    points.push(new THREE.Vector3(-cx, topY, 0));
    points.push(new THREE.Vector3(-cx, botY, 0));
    points.push(new THREE.Vector3(-cx * 0.5, botY - cx * 0.5, 1.2));
    points.push(new THREE.Vector3(0, botY - cx * 0.85, -0.6));
    points.push(new THREE.Vector3(0, botY - cx * 1.3, 0));
  } else {
    // Alien: a wide, wobbly double-pitch spiral — exotic but still legible.
    points.push(new THREE.Vector3(0, 7, 0));
    points.push(new THREE.Vector3(0, 5, 0));
    const coil = buildCoil(points[points.length - 1], tubeRadius, {
      turns: 6,
      pointsPerTurn: 6,
      pitchMul: 4.4,
      radiusMul: 4.2,
      wobble: 0.16,
      taper: 0.55,
    });
    points.push(...coil.points);
    points.push(new THREE.Vector3(0, coil.endY - tubeRadius * 2, 0));
    points.push(new THREE.Vector3(0, coil.endY - tubeRadius * 5, 0));
  }

  const centered = recenter(points);
  const curve = new THREE.CatmullRomCurve3(centered, false, 'catmullrom', 0.5);
  return { curve, height: boundsHeight(points) };
}

export const LEVELS = [
  { name: 'Worm', tubeRadius: 0.5, timeLimit: 40, obstacles: 6 },
  { name: 'Frog', tubeRadius: 0.4, timeLimit: 55, obstacles: 10 },
  { name: 'Fox', tubeRadius: 0.34, timeLimit: 80, obstacles: 16 },
  { name: 'Alien', tubeRadius: 0.3, timeLimit: 90, obstacles: 22 },
];
