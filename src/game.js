import * as THREE from 'three';
import { generatePath, LEVELS } from './path.js';
import { buildTubeMesh, buildObstacles } from './tube.js';
import { buildChamber } from './chamber.js';
import { buildFoxCourse, buildBirdCourse } from './course.js';
import { BUILDERS } from './character.js';

const STATE = {
  TITLE: 'title',
  INTRO: 'intro',
  REVEAL: 'reveal',
  PLAY: 'play',
  SEGMENT_TRANSITION: 'segment_transition',
  LEVEL_CLEAR: 'level_clear',
  WIN: 'win',
  LOSE: 'lose',
};

const GRAVITY_T_ACCEL = 0.6; // t-units/sec^2 when the tract runs straight downhill
const FRICTION = 1.4; // per-second velocity decay
const LATERAL_SETTLE_RATE = 6; // how fast the food rolls to the gravity-facing wall (tube mode)
const CHAMBER_SETTLE_RATE = 3.2; // radians/sec the food rolls toward the low point of a chamber
const VALVE_TOLERANCE = THREE.MathUtils.degToRad(26); // how close to the valve counts as "there"
const VALVE_DWELL_TIME = 0.45; // seconds held near the valve before it counts as cleared
const BOOST_IMPULSE = 0.4;
const BOOST_COOLDOWN = 1.2;
const HIT_INVULN = 1.0;
const HIT_PENALTY = 4; // seconds lost on collision
const SEGMENT_TRANSITION_TIME = 1.3; // pause-and-message beat between organs
const DOWN = new THREE.Vector3(0, -1, 0);
const FOOD_LIGHT_COLOR = 0xffe0b0;

// Levels are mostly a single tube segment (unchanged tilt-and-roll). This
// is where multi-organ courses opt in: a level index maps to a builder
// returning {segments, height}, where each segment names a `mode` (tube
// or chamber) handled by its own physics update below.
const COURSE_BUILDERS = {
  2: buildFoxCourse,
  3: buildBirdCourse,
};

export class Game {
  constructor({ scene, camera, hud }) {
    this.scene = scene;
    this.camera = camera;
    this.hud = hud;

    this.state = STATE.TITLE;
    this.stateTime = 0;
    this.keys = new Set();
    this.levelIndex = 0;
    this.dragStartQuat = null;
    this.dragStartVec = null;

    this.mazeGroup = new THREE.Group();
    scene.add(this.mazeGroup);

    this.food = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffcf6b, roughness: 0.4, emissive: 0xff9d1a, emissiveIntensity: 1.1 })
    );
    this.food.visible = false;
    this.mazeGroup.add(this.food);

    // Two additive halo layers plus a small warm light travel with the
    // food so its position always reads clearly, even when several
    // translucent coils (or chamber walls) overlap it on screen.
    this.foodGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 12),
      new THREE.MeshBasicMaterial({ color: FOOD_LIGHT_COLOR, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.foodGlowOuter = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 12),
      new THREE.MeshBasicMaterial({ color: FOOD_LIGHT_COLOR, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.foodGlow.visible = false;
    this.foodGlowOuter.visible = false;
    this.mazeGroup.add(this.foodGlow, this.foodGlowOuter);

    this.foodLight = new THREE.PointLight(FOOD_LIGHT_COLOR, 0, 6);
    this.mazeGroup.add(this.foodLight);

    this._loadLevel(0);
    this._bindInput();
  }

  _disposeLevel() {
    if (!this.course) return;
    for (const seg of this.course.segments) {
      if (seg.mode === 'tube') {
        this.mazeGroup.remove(seg.tubeMesh, seg.obstacleGroup);
        seg.tubeMesh.geometry.dispose();
        seg.tubeMesh.material.dispose();
        if (seg.obstacles[0]) {
          seg.obstacles[0].mesh.geometry.dispose();
          seg.obstacles[0].mesh.material.dispose();
        }
      } else {
        this.mazeGroup.remove(seg.group);
        seg.wall.geometry.dispose();
        seg.wallMaterial.dispose();
        for (const child of seg.valveGroup.children) child.geometry.dispose();
        seg.valveMaterial.dispose();
        if (seg.obstacles[0]) {
          seg.obstacles[0].mesh.geometry.dispose();
          seg.obstacles[0].mesh.material.dispose();
        }
      }
    }
    this.mazeGroup.remove(this.character.group);
    for (const m of this.character.opaqueMaterials) m.dispose();
  }

  _singleTubeCourse(index) {
    const { curve, height } = generatePath(index, this.level.tubeRadius);
    return {
      segments: [{ mode: 'tube', curve, tubeRadius: this.level.tubeRadius, obstacleCount: this.level.obstacles, label: 'Done' }],
      height,
    };
  }

  _buildSegmentMeshes(seg) {
    if (seg.mode === 'tube') {
      const tube = buildTubeMesh(seg.curve, { radius: seg.tubeRadius });
      seg.tubeMesh = tube.mesh;
      const { group, obstacles } = buildObstacles(seg.curve, seg.tubeRadius, seg.obstacleCount);
      seg.obstacleGroup = group;
      seg.obstacles = obstacles;
      seg.obstacleGroup.visible = false;
      this.mazeGroup.add(seg.tubeMesh, seg.obstacleGroup);
    } else {
      const chamber = buildChamber({
        radius: seg.radius,
        center: seg.center,
        entryDir: seg.entryDir,
        valveDir: seg.valveDir,
        obstacleCount: seg.obstacleCount,
        obstacleScale: seg.obstacleScale,
        obstacleColor: seg.obstacleColor,
        wallColor: seg.wallColor,
        wallEmissive: seg.wallEmissive,
        label: seg.label,
      });
      Object.assign(seg, chamber);
      seg.obstacleGroup.visible = false;
      this.mazeGroup.add(seg.group);
    }
  }

  _loadLevel(index) {
    this._disposeLevel();
    this.levelIndex = index;
    this.level = LEVELS[index];

    const courseBuilder = COURSE_BUILDERS[index];
    this.course = courseBuilder ? courseBuilder(this.level.tubeRadius) : this._singleTubeCourse(index);
    for (const seg of this.course.segments) this._buildSegmentMeshes(seg);

    this.character = BUILDERS[index](this.course.height);
    this.mazeGroup.add(this.character.group);

    // camera framing scales with this level's own course height, since
    // each level is sized off its tubeRadius rather than a shared constant
    const zoom = this.level.camZoom ?? 1.5;
    this.playCameraPos = new THREE.Vector3(0, this.course.height * 0.12 * zoom, this.course.height * zoom);

    this.foodRadius = this.level.tubeRadius * 0.34;
    this.food.scale.setScalar(this.foodRadius);
    this.foodGlow.scale.setScalar(this.foodRadius * 4.5);
    this.foodGlowOuter.scale.setScalar(this.foodRadius * 9);
    this.foodLight.intensity = 2.2;
    this.foodLight.distance = this.level.tubeRadius * 12;

    this.timeLeft = this.level.timeLimit;
    this.boostCooldown = 0;
    this.mazeGroup.quaternion.identity();
    this.dragStartVec = null;

    this._enterSegment(0);

    this.character.setSkinOpacity(1);
    this.character.group.visible = true;
    this.food.visible = false;
    this.foodGlow.visible = false;
    this.foodGlowOuter.visible = false;
    this.foodLight.visible = false;
  }

  // Resets per-segment runtime state when a course moves onto segment
  // `index` — called on level load (index 0) and after a transition beat.
  _enterSegment(index) {
    this.segIndex = index;
    const seg = this.course.segments[index];
    this.segment = seg;
    if (seg.mode === 'tube') {
      this.t = 0.001;
      this.tVel = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      this.frameUp = new THREE.Vector3(0, 1, 0);
      this.tubeRadius = seg.tubeRadius;
    } else {
      this.chamberDir = seg.entryDir.clone();
      this.valveDwell = 0;
    }
    this.invuln = 0;
  }

  _courseProgress(localT) {
    return (this.segIndex + localT) / this.course.segments.length;
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      if (this.state === STATE.TITLE && (e.code === 'Enter' || e.code === 'Space')) this.startIntro();
      if (this.state === STATE.LOSE && (e.code === 'Enter' || e.code === 'Space')) this.retryLevel();
      if (this.state === STATE.WIN && (e.code === 'Enter' || e.code === 'Space')) this.restartCampaign();
      if (this.state === STATE.PLAY && e.code === 'Space') this.tryBoost();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  // Arcball rotation: treat the maze as if it sits inside an invisible
  // sphere filling the viewport, and drag it like you're spinning that
  // sphere with a finger. Unlike incremental per-frame yaw/pitch, this
  // recomputes the full rotation from where the drag STARTED to where the
  // pointer is NOW every move, so it stays reliable and consistent no
  // matter how the object is currently oriented.
  _projectToSphere(x, y, w, h) {
    const radius = Math.min(w, h) * 0.5;
    const nx = (x - w / 2) / radius;
    const ny = (y - h / 2) / radius;
    const lenSq = nx * nx + ny * ny;
    if (lenSq <= 1) {
      return new THREE.Vector3(nx, -ny, Math.sqrt(1 - lenSq));
    }
    const norm = 1 / Math.sqrt(lenSq);
    return new THREE.Vector3(nx * norm, -ny * norm, 0);
  }

  // Called by main.js on pointerdown (mouse or touch, unified).
  beginDrag(x, y, w, h) {
    if (this.state !== STATE.PLAY) return;
    this.dragStartQuat = this.mazeGroup.quaternion.clone();
    this.dragStartVec = this._projectToSphere(x, y, w, h);
  }

  // Called by main.js on pointermove while dragging.
  updateDrag(x, y, w, h) {
    if (this.state !== STATE.PLAY || !this.dragStartVec) return;
    const currentVec = this._projectToSphere(x, y, w, h);
    const axis = new THREE.Vector3().crossVectors(this.dragStartVec, currentVec);
    if (axis.lengthSq() < 1e-10) return;
    axis.normalize();
    const dot = THREE.MathUtils.clamp(this.dragStartVec.dot(currentVec), -1, 1);
    const angle = Math.acos(dot);
    // the axis was derived from screen-space coordinates (camera-local);
    // rotate it into world space via the camera's own orientation.
    axis.applyQuaternion(this.camera.quaternion);
    const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    this.mazeGroup.quaternion.copy(deltaQuat.multiply(this.dragStartQuat));
  }

  endDrag() {
    this.dragStartVec = null;
  }

  // Keyboard alt-input: small fixed-axis nudges, used only by arrow keys.
  _nudgeRotation(yaw, pitch) {
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
    this.mazeGroup.quaternion.premultiply(qYaw).premultiply(qPitch);
  }

  tryBoost() {
    if (this.boostCooldown > 0) return;
    this.boostCooldown = BOOST_COOLDOWN;
    if (this.segment.mode === 'tube') this.tVel += BOOST_IMPULSE;
    this.hud.pulseBoost();
  }

  startIntro() {
    this._setState(STATE.INTRO);
    this.hud.hideTitle();
    this.hud.setLevelName(this.level.name);
  }

  retryLevel() {
    this._loadLevel(this.levelIndex);
    this.hud.hideEnd();
    this._setState(STATE.INTRO);
    this.hud.setLevelName(this.level.name);
  }

  restartCampaign() {
    this._loadLevel(0);
    this.hud.hideEnd();
    this.hud.showTitle();
    this._setState(STATE.TITLE);
  }

  _setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  update(dt) {
    this.stateTime += dt;
    switch (this.state) {
      case STATE.TITLE:
        this._updateTitle(dt);
        break;
      case STATE.INTRO:
        this._updateIntro(dt);
        break;
      case STATE.REVEAL:
        this._updateReveal(dt);
        break;
      case STATE.PLAY:
        this._updatePlay(dt);
        break;
      case STATE.SEGMENT_TRANSITION:
        this._updateSegmentTransition(dt);
        break;
      case STATE.LEVEL_CLEAR:
        this._updateLevelClear(dt);
        break;
      default:
        break;
    }
  }

  _updateTitle(dt) {
    this.mazeGroup.rotation.y += dt * 0.4;
    const angle = this.stateTime * 0.25;
    this.camera.position.set(Math.sin(angle) * 16, 7, Math.cos(angle) * 16);
    this.camera.lookAt(0, 0, 0);
  }

  _updateIntro(dt) {
    this.mazeGroup.rotation.y += dt * 0.15;
    const p = Math.min(this.stateTime / 1.4, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const angle = 0.3;
    const introStart = new THREE.Vector3(Math.sin(angle) * 16, 7, Math.cos(angle) * 16);
    this.camera.position.lerpVectors(introStart, this.playCameraPos, ease);
    this.camera.lookAt(0, 0, 0);
    if (p >= 1) {
      this.mazeGroup.quaternion.identity();
      this._setState(STATE.REVEAL);
    }
  }

  _updateReveal(dt) {
    const p = Math.min(this.stateTime / 2.2, 1);
    this.character.setSkinOpacity(THREE.MathUtils.lerp(1, 0.14, p));
    for (const seg of this.course.segments) {
      if (seg.mode === 'tube') {
        seg.tubeMesh.material.opacity = THREE.MathUtils.lerp(0, 0.55, p);
      } else {
        seg.wallMaterial.opacity = THREE.MathUtils.lerp(0, 0.45, p);
        seg.valveMaterial.opacity = THREE.MathUtils.lerp(0, 0.95, p);
        seg.valveLight.intensity = THREE.MathUtils.lerp(0, 1.6, p);
      }
    }
    this.camera.position.copy(this.playCameraPos);
    this.camera.lookAt(0, 0, 0);
    if (p >= 1) {
      for (const seg of this.course.segments) seg.obstacleGroup.visible = true;
      this.food.visible = true;
      this.foodGlow.visible = true;
      this.foodGlowOuter.visible = true;
      this.foodLight.visible = true;
      this._setState(STATE.PLAY);
      this.hud.showMessage('GO! Drag to tilt the creature');
      setTimeout(() => this.hud.hideMessage(), 1400);
    }
  }

  _updatePlay(dt) {
    // keyboard alt-input for rotation (arrows), same handler as pointer drag
    let kx = 0;
    let ky = 0;
    if (this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('ArrowDown')) ky += 1;
    if (kx || ky) this._nudgeRotation(kx * dt, ky * dt);

    if (this.boostCooldown > 0) this.boostCooldown -= dt;

    if (this.segment.mode === 'tube') this._updatePlayTube(dt);
    else this._updatePlayChamber(dt);
  }

  // Shared end-of-frame bookkeeping for both modes: advances the timer,
  // updates the HUD, and triggers LOSE if time ran out.
  _tickTimer(dt, progress) {
    this.timeLeft -= dt;
    this.hud.updateHUD(progress, Math.max(0, this.timeLeft), this.level.timeLimit);
    if (this.timeLeft <= 0) {
      this._setState(STATE.LOSE);
      this.hud.showEnd(false, this.level.name);
    }
  }

  // --- Tube mode: bead-on-a-wire, unchanged from the original design. ---
  _updatePlayTube(dt) {
    const seg = this.segment;
    const invQuat = this.mazeGroup.quaternion.clone().invert();
    const localGravity = DOWN.clone().applyQuaternion(invQuat);

    const sampleT = THREE.MathUtils.clamp(this.t, 0.001, 0.999);
    const tangent = seg.curve.getTangentAt(sampleT).normalize();
    let normal = this.frameUp.clone().sub(tangent.clone().multiplyScalar(this.frameUp.dot(tangent)));
    if (normal.lengthSq() < 1e-6) normal = new THREE.Vector3(1, 0, 0);
    normal.normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    this.frameUp = normal;

    const accel = localGravity.dot(tangent) * GRAVITY_T_ACCEL;
    this.tVel += accel * dt;
    this.tVel *= Math.max(0, 1 - FRICTION * dt);
    let nextT = this.t + this.tVel * dt;

    if (nextT >= 1) {
      this._advanceSegment();
      return;
    }
    if (nextT <= 0) {
      nextT = 0;
      this.tVel = Math.max(0, this.tVel);
    }
    this.t = nextT;

    const gAlong = tangent.clone().multiplyScalar(localGravity.dot(tangent));
    const gPerp = localGravity.clone().sub(gAlong);
    const restDist = this.tubeRadius - this.foodRadius - 0.04;
    let targetX = 0;
    let targetY = 0;
    if (gPerp.lengthSq() > 1e-5) {
      gPerp.normalize();
      targetY = gPerp.dot(normal) * restDist;
      targetX = gPerp.dot(binormal) * restDist;
    }
    const settle = Math.min(1, LATERAL_SETTLE_RATE * dt);
    this.offsetX += (targetX - this.offsetX) * settle;
    this.offsetY += (targetY - this.offsetY) * settle;

    const center = seg.curve.getPointAt(sampleT);
    const playerPos = center.clone().addScaledVector(normal, this.offsetY).addScaledVector(binormal, this.offsetX);
    this.food.position.copy(playerPos);
    this.foodGlow.position.copy(playerPos);
    this.foodGlowOuter.position.copy(playerPos);
    this.foodLight.position.copy(playerPos);

    this.camera.position.copy(this.playCameraPos);
    this.camera.lookAt(0, 0, 0);

    if (this.invuln > 0) this.invuln -= dt;
    if (this.invuln <= 0) {
      for (const o of seg.obstacles) {
        if (Math.abs(o.t - this.t) > 0.03) continue;
        if (playerPos.distanceTo(o.position) < this.foodRadius + o.radius) {
          this.timeLeft -= HIT_PENALTY;
          this.invuln = HIT_INVULN;
          this.tVel *= -0.4;
          this.hud.flashHit();
          break;
        }
      }
    }

    this._tickTimer(dt, this._courseProgress(this.t));
  }

  // --- Chamber mode: a free-roam organ. The food rolls around the INSIDE
  // of a hollow sphere, always settling toward whatever direction local
  // gravity currently points (same tilt control as tube mode), and the
  // player has to roll it to a fixed exit point (the valve) rather than
  // just ride a path. ---
  _updatePlayChamber(dt) {
    const seg = this.segment;
    const invQuat = this.mazeGroup.quaternion.clone().invert();
    const localGravity = DOWN.clone().applyQuaternion(invQuat).normalize();

    const angle = Math.acos(THREE.MathUtils.clamp(this.chamberDir.dot(localGravity), -1, 1));
    if (angle > 1e-4) {
      const axis = new THREE.Vector3().crossVectors(this.chamberDir, localGravity);
      if (axis.lengthSq() > 1e-8) {
        axis.normalize();
        const step = Math.min(angle, CHAMBER_SETTLE_RATE * dt);
        this.chamberDir.applyAxisAngle(axis, step).normalize();
      }
    }

    const restDist = seg.radius - this.foodRadius - 0.06;
    const localFoodPos = this.chamberDir.clone().multiplyScalar(restDist);
    const worldFoodPos = localFoodPos.clone().add(seg.center);
    this.food.position.copy(worldFoodPos);
    this.foodGlow.position.copy(worldFoodPos);
    this.foodGlowOuter.position.copy(worldFoodPos);
    this.foodLight.position.copy(worldFoodPos);

    this.camera.position.copy(this.playCameraPos);
    this.camera.lookAt(0, 0, 0);

    if (this.invuln > 0) this.invuln -= dt;
    if (this.invuln <= 0) {
      for (const o of seg.obstacles) {
        if (localFoodPos.distanceTo(o.position) < this.foodRadius + o.radius) {
          this.timeLeft -= HIT_PENALTY;
          this.invuln = HIT_INVULN;
          const away = o.position.clone().normalize().multiplyScalar(-1);
          if (away.lengthSq() > 1e-6) this.chamberDir.add(away.multiplyScalar(0.25)).normalize();
          this.hud.flashHit();
          break;
        }
      }
    }

    const valveAngle = Math.acos(THREE.MathUtils.clamp(this.chamberDir.dot(seg.valveDir), -1, 1));
    if (valveAngle < VALVE_TOLERANCE) {
      this.valveDwell += dt;
      if (this.valveDwell > VALVE_DWELL_TIME) {
        this._advanceSegment();
        return;
      }
    } else {
      this.valveDwell = 0;
    }

    const localProgress = THREE.MathUtils.clamp(1 - valveAngle / Math.PI, 0, 1);
    this._tickTimer(dt, this._courseProgress(localProgress));
  }

  // Called when the active segment's completion condition is met (tube
  // reaches its end, or the chamber's valve has been held long enough).
  // Either moves to the next organ (with a beat for the player to
  // prepare) or, if this was the last segment, finishes the level.
  _advanceSegment() {
    const segs = this.course.segments;
    if (this.segIndex >= segs.length - 1) {
      this._onLevelWon();
      return;
    }
    const finishedSeg = segs[this.segIndex];
    this.food.visible = false;
    this.foodGlow.visible = false;
    this.foodGlowOuter.visible = false;
    this.foodLight.visible = false;
    this.pendingSegIndex = this.segIndex + 1;
    this._setState(STATE.SEGMENT_TRANSITION);
    this.hud.showMessage(`Entering the ${finishedSeg.label.toUpperCase()}...`);
  }

  _updateSegmentTransition(dt) {
    this.camera.position.copy(this.playCameraPos);
    this.camera.lookAt(0, 0, 0);
    if (this.stateTime >= SEGMENT_TRANSITION_TIME) {
      this.hud.hideMessage();
      this._enterSegment(this.pendingSegIndex);
      this.food.visible = true;
      this.foodGlow.visible = true;
      this.foodGlowOuter.visible = true;
      this.foodLight.visible = true;
      this._setState(STATE.PLAY);
    }
  }

  _onLevelWon() {
    this.food.visible = false;
    this.foodGlow.visible = false;
    this.foodGlowOuter.visible = false;
    this.foodLight.visible = false;
    const isLast = this.levelIndex >= LEVELS.length - 1;
    if (isLast) {
      this._setState(STATE.WIN);
      this.hud.showEnd(true, this.level.name, true);
    } else {
      this._setState(STATE.LEVEL_CLEAR);
      this.hud.showMessage(`${this.level.name.toUpperCase()} DELIVERED! Get ready for ${LEVELS[this.levelIndex + 1].name}...`);
    }
  }

  _updateLevelClear(dt) {
    if (this.stateTime >= 2.4) {
      this.hud.hideMessage();
      this._loadLevel(this.levelIndex + 1);
      this.hud.setLevelName(this.level.name);
      this._setState(STATE.INTRO);
    }
  }
}

export { STATE };
