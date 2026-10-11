import * as THREE from 'three';
import { buildCoil, boxCenter, recenterBy, boundsHeight } from './path.js';

// Centers a new chamber directly "below" (along the previous segment's own
// exit direction) the point it connects to, so that point sits ON the new
// sphere's surface regardless of its radius — the same trick buildFoxCourse
// uses for its esophagus->stomach seam, generalized so chambers can chain
// into each other (crop -> gizzard) and not just follow a tube.
function chamberFrom(prevEnd, prevDir, radius) {
  const center = prevEnd.clone().addScaledVector(prevDir, radius);
  const entryDir = prevEnd.clone().sub(center).normalize();
  return { center, entryDir };
}

function exitPoint(center, valveDir, radius) {
  return center.clone().addScaledVector(valveDir, radius);
}

function chamberBoundsProxies(center, radius) {
  return [1, -1].flatMap((s) =>
    [new THREE.Vector3(radius * s, 0, 0), new THREE.Vector3(0, radius * s, 0), new THREE.Vector3(0, 0, radius * s)].map((v) =>
      v.add(center)
    )
  );
}

// A "course" is an ordered list of segments, each a distinct gameplay
// mode. Most levels are a single tube segment (unchanged tilt-and-roll).
// This is the prototype for multi-organ courses: the player rides a tube
// (esophagus), then has to actively roll the food around a free-roam
// chamber (stomach) to find the exit valve, then rides another tube
// (coiled small intestine + colon) to the finish. Everything is built in
// one shared coordinate space so the segments connect seamlessly, then
// recentered together so camera/character scaling still works the same
// way as a single-segment course.
export function buildFoxCourse(tubeRadius) {
  const esoPoints = [
    new THREE.Vector3(0, 10, 0),
    new THREE.Vector3(0.5, 8.2, -0.4),
    new THREE.Vector3(-0.3, 6.4, 0.3),
    new THREE.Vector3(0.3, 4.8, 0.2),
  ];

  const stomachRadius = tubeRadius * 7.5;
  const esoEnd = esoPoints[esoPoints.length - 1];
  const esoDir = esoEnd.clone().sub(esoPoints[esoPoints.length - 2]).normalize();
  const { center: stomachCenter, entryDir } = chamberFrom(esoEnd, esoDir, stomachRadius);
  const valveDir = new THREE.Vector3(0.8, -0.55, 0.5).normalize();
  const valveExitPoint = exitPoint(stomachCenter, valveDir, stomachRadius);

  const coil = buildCoil(valveExitPoint, tubeRadius, { turns: 4, pitchMul: 4.2, radiusMul: 3.4, taper: 0.8 });
  const colonPoints = [...coil.points];
  const cx = coil.coilRadius * 2.1;
  const topY = coil.endY + coil.coilRadius * 1.1;
  const botY = coil.endY - coil.coilRadius * 2.6;
  colonPoints.push(new THREE.Vector3(valveExitPoint.x, coil.endY - 0.5, valveExitPoint.z));
  colonPoints.push(new THREE.Vector3(cx, botY, 0));
  colonPoints.push(new THREE.Vector3(cx, topY, 0));
  colonPoints.push(new THREE.Vector3(0, topY + cx * 0.15, 0));
  colonPoints.push(new THREE.Vector3(-cx, topY, 0));
  colonPoints.push(new THREE.Vector3(-cx, botY, 0));
  colonPoints.push(new THREE.Vector3(-cx * 0.5, botY - cx * 0.5, 1.2));
  colonPoints.push(new THREE.Vector3(0, botY - cx * 0.85, -0.6));
  colonPoints.push(new THREE.Vector3(0, botY - cx * 1.3, 0));

  const allPoints = [...esoPoints, ...chamberBoundsProxies(stomachCenter, stomachRadius), ...colonPoints];
  const offset = boxCenter(allPoints);
  const height = boundsHeight(allPoints);

  const esoCurve = new THREE.CatmullRomCurve3(recenterBy(esoPoints, offset), false, 'catmullrom', 0.5);
  const colonCurve = new THREE.CatmullRomCurve3(recenterBy(colonPoints, offset), false, 'catmullrom', 0.5);
  const chamberCenter = stomachCenter.clone().sub(offset);

  const segments = [
    { mode: 'tube', curve: esoCurve, tubeRadius, obstacleCount: 3, label: 'Stomach' },
    {
      mode: 'chamber',
      center: chamberCenter,
      radius: stomachRadius,
      entryDir,
      valveDir,
      obstacleCount: 4,
      label: 'Small Intestine',
    },
    { mode: 'tube', curve: colonCurve, tubeRadius, obstacleCount: 13, label: 'Done' },
  ];

  return { segments, height };
}

// Bird: esophagus -> crop (a roomy storage pouch, gentle) -> gizzard (a
// smaller, denser chamber that grinds food between stones) -> a short
// intestine to the exit. Two chambers back to back, each chained directly
// off the previous one's valve rather than off a tube, which is the real
// test of whether the multi-segment system generalizes past one organ.
export function buildBirdCourse(tubeRadius) {
  const esoPoints = [
    new THREE.Vector3(0, 9, 0),
    new THREE.Vector3(0.4, 7.3, -0.3),
    new THREE.Vector3(-0.3, 5.6, 0.3),
    new THREE.Vector3(0.2, 4.2, 0.1),
  ];
  const esoEnd = esoPoints[esoPoints.length - 1];
  const esoDir = esoEnd.clone().sub(esoPoints[esoPoints.length - 2]).normalize();

  const cropRadius = tubeRadius * 6.5;
  const { center: cropCenter, entryDir: cropEntryDir } = chamberFrom(esoEnd, esoDir, cropRadius);
  const cropValveDir = new THREE.Vector3(0.7, -0.6, 0.4).normalize();
  const cropExit = exitPoint(cropCenter, cropValveDir, cropRadius);

  const gizzardRadius = tubeRadius * 5;
  const { center: gizzardCenter, entryDir: gizzardEntryDir } = chamberFrom(cropExit, cropValveDir, gizzardRadius);
  const gizzardValveDir = new THREE.Vector3(-0.6, -0.65, 0.5).normalize();
  const gizzardExit = exitPoint(gizzardCenter, gizzardValveDir, gizzardRadius);

  const coil = buildCoil(gizzardExit, tubeRadius, { turns: 2, pitchMul: 4.0, radiusMul: 3.0, taper: 0.85 });
  const intestinePoints = [...coil.points];
  const last = intestinePoints[intestinePoints.length - 1];
  intestinePoints.push(new THREE.Vector3(last.x * 0.5, coil.endY - tubeRadius * 4, last.z * 0.5));
  intestinePoints.push(new THREE.Vector3(0, coil.endY - tubeRadius * 8, 0));

  const allPoints = [
    ...esoPoints,
    ...chamberBoundsProxies(cropCenter, cropRadius),
    ...chamberBoundsProxies(gizzardCenter, gizzardRadius),
    ...intestinePoints,
  ];
  const offset = boxCenter(allPoints);
  const height = boundsHeight(allPoints);

  const esoCurve = new THREE.CatmullRomCurve3(recenterBy(esoPoints, offset), false, 'catmullrom', 0.5);
  const intestineCurve = new THREE.CatmullRomCurve3(recenterBy(intestinePoints, offset), false, 'catmullrom', 0.5);

  const segments = [
    { mode: 'tube', curve: esoCurve, tubeRadius, obstacleCount: 2, label: 'Crop' },
    {
      mode: 'chamber',
      center: cropCenter.clone().sub(offset),
      radius: cropRadius,
      entryDir: cropEntryDir,
      valveDir: cropValveDir,
      obstacleCount: 3,
      wallColor: 0xcbb67a, // tan/khaki storage pouch
      wallEmissive: 0x4a3f1a,
      label: 'Gizzard',
    },
    {
      mode: 'chamber',
      center: gizzardCenter.clone().sub(offset),
      radius: gizzardRadius,
      entryDir: gizzardEntryDir,
      valveDir: gizzardValveDir,
      obstacleCount: 7,
      obstacleScale: 1.7, // grinding stones read bigger than turbulence
      obstacleColor: 0x8a8a7a, // grey stone, not food-colored
      wallColor: 0x6b6b60, // muscular grey-green, distinct from the crop
      wallEmissive: 0x1f1f1a,
      label: 'Intestine',
    },
    { mode: 'tube', curve: intestineCurve, tubeRadius, obstacleCount: 5, label: 'Done' },
  ];

  return { segments, height };
}
