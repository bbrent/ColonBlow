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

// A gently wandering tube whose vertical profile is a net descent PLUS a
// sine hump — so there is always at least one stretch that climbs uphill
// (in local space) rather than just falling straight down. That's what
// makes the level require active tilting: at the default orientation
// gravity alone cannot carry the food past the hump, no matter how long
// you wait. `phase` shifts where that hump falls — the default puts it a
// little way into the path (not right at the mouth) so the player gets a
// beat of easy, gentle downhill first to get a feel for the controls
// before the level actually demands a tilt.
function buildWave(start, { drop, waves = 1.7, humpHeight, phase = Math.PI / 2, segments = 22, xAmp = 1.1, zAmp = 0.9, xFreq = 3.1, zFreq = 2.3 }) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const y = start.y - drop * f + humpHeight * Math.sin(f * Math.PI * waves + phase);
    const x = start.x + Math.sin(f * Math.PI * xFreq) * xAmp;
    const z = start.z + Math.cos(f * Math.PI * zFreq) * zAmp;
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
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
//  0 = worm      -> short, mostly straight, one gentle bend + a hump
//  1 = frog/fish -> a few loops + a bigger hump
//  2 = fox       -> full anatomical coil, with a genuine ascending colon
//  3 = alien     -> exaggerated spiral that loops back uphill before the exit
// Every level guarantees at least one stretch where local Y rises against
// the default orientation, so gravity alone can never solve it — the
// player always has to tilt the creature to get past that stretch.
// `tubeRadius` sizes the coil spacing so loops never crowd each other
// regardless of how tight or thin a given level's tract is.
export function generatePath(level = 0, tubeRadius = 1) {
  let points = [];

  if (level === 0) {
    points = buildWave(new THREE.Vector3(0, 7, 0), { drop: 8, humpHeight: 2.6, waves: 1.6, xAmp: 1, zAmp: 0.8 });
  } else if (level === 1) {
    points = buildWave(new THREE.Vector3(0, 7.5, 0), { drop: 10, humpHeight: 3.2, waves: 1.8, xAmp: 1.6, zAmp: 1.3 });
  } else if (level === 2) {
    // lead-in: mouth -> esophagus -> stomach
    points.push(new THREE.Vector3(0, 7.5, 0));
    points.push(new THREE.Vector3(0.6, 5.5, -0.6));
    points.push(new THREE.Vector3(-0.6, 3.5, 0.6));
    points.push(new THREE.Vector3(1.2, 1.8, 0.9));
    points.push(new THREE.Vector3(0.8, 0, 0.2));

    const coil = buildCoil(points[points.length - 1], tubeRadius, { turns: 4, pitchMul: 4.2, radiusMul: 3.4, taper: 0.8 });
    points.push(...coil.points);

    // large intestine framed wide of the coil so it never overlaps it.
    // The ascending colon genuinely climbs back up from botY to topY —
    // real anatomy, and it's what forces a second tilt to get past.
    const cx = coil.coilRadius * 2.1;
    const topY = coil.endY + coil.coilRadius * 1.1;
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
    // Alien: a wide, wobbly spiral that then loops back UP before the
    // final drop to the exit — exotic, impossible-looking anatomy that
    // also guarantees a second required tilt.
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
    const last = coil.points[coil.points.length - 1];
    points.push(new THREE.Vector3(last.x * 0.6, coil.endY - tubeRadius * 1.2, last.z * 0.6));
    points.push(new THREE.Vector3(-last.x * 0.4, coil.endY + tubeRadius * 5.5, -last.z * 0.4 + 0.6));
    points.push(new THREE.Vector3(0.4, coil.endY + tubeRadius * 2.5, -0.3));
    points.push(new THREE.Vector3(0, coil.endY - tubeRadius * 3, 0));
    points.push(new THREE.Vector3(0, coil.endY - tubeRadius * 7, 0));
  }

  const centered = recenter(points);
  const curve = new THREE.CatmullRomCurve3(centered, false, 'catmullrom', 0.5);
  return { curve, height: boundsHeight(points) };
}

export const LEVELS = [
  { name: 'Worm', tubeRadius: 0.5, timeLimit: 40, obstacles: 6, camZoom: 1.6 },
  { name: 'Frog', tubeRadius: 0.4, timeLimit: 55, obstacles: 10, camZoom: 1.5 },
  { name: 'Fox', tubeRadius: 0.34, timeLimit: 80, obstacles: 16, camZoom: 1.35 },
  { name: 'Alien', tubeRadius: 0.3, timeLimit: 90, obstacles: 22, camZoom: 1.25 },
];
