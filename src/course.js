import * as THREE from 'three';
import { buildCoil, boxCenter, recenterBy, boundsHeight } from './path.js';

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
  // Center the chamber directly "below" (along the esophagus's own
  // direction) the point it connects to, so that point sits ON the
  // sphere's surface regardless of how big the chamber is — otherwise a
  // bigger radius silently buries the seam deep inside the chamber.
  const esoDir = esoEnd.clone().sub(esoPoints[esoPoints.length - 2]).normalize();
  const stomachCenter = esoEnd.clone().addScaledVector(esoDir, stomachRadius);
  const entryDir = esoEnd.clone().sub(stomachCenter).normalize();
  const valveDir = new THREE.Vector3(0.8, -0.55, 0.5).normalize();
  const valveExitPoint = stomachCenter.clone().addScaledVector(valveDir, stomachRadius);

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

  // Proxy points standing in for the chamber's bounding box, so the
  // shared recenter/height pass accounts for its extent too.
  const chamberBoundsProxies = [1, -1].flatMap((s) =>
    [
      new THREE.Vector3(stomachRadius * s, 0, 0),
      new THREE.Vector3(0, stomachRadius * s, 0),
      new THREE.Vector3(0, 0, stomachRadius * s),
    ].map((v) => v.add(stomachCenter))
  );

  const allPoints = [...esoPoints, ...chamberBoundsProxies, ...colonPoints];
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
