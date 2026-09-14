import * as THREE from 'three';
import { generatePath, LEVELS, TARGET_HEIGHT } from './path.js';
import { buildTubeMesh, buildObstacles } from './tube.js';
import { BUILDERS } from './character.js';

const STATE = {
  TITLE: 'title',
  INTRO: 'intro',
  REVEAL: 'reveal',
  PLAY: 'play',
  LEVEL_CLEAR: 'level_clear',
  WIN: 'win',
  LOSE: 'lose',
};

const GRAVITY_T_ACCEL = 0.6; // t-units/sec^2 when the tract runs straight downhill
const FRICTION = 1.4; // per-second velocity decay
const LATERAL_SETTLE_RATE = 6; // how fast the food rolls to the gravity-facing wall
const BOOST_IMPULSE = 0.4;
const BOOST_COOLDOWN = 1.2;
const HIT_INVULN = 1.0;
const HIT_PENALTY = 4; // seconds lost on collision
const DOWN = new THREE.Vector3(0, -1, 0);

const PLAY_CAMERA_POS = new THREE.Vector3(0, TARGET_HEIGHT * 0.1, TARGET_HEIGHT * 1.7);

export class Game {
  constructor({ scene, camera, hud }) {
    this.scene = scene;
    this.camera = camera;
    this.hud = hud;

    this.state = STATE.TITLE;
    this.stateTime = 0;
    this.keys = new Set();
    this.levelIndex = 0;
    this.dragYaw = 0;
    this.dragPitch = 0;

    this.mazeGroup = new THREE.Group();
    scene.add(this.mazeGroup);

    this.food = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.5, emissive: 0x2a1a08, emissiveIntensity: 0.4 })
    );
    this.food.visible = false;
    this.mazeGroup.add(this.food);

    this._loadLevel(0);
    this._bindInput();
  }

  _disposeLevel() {
    if (!this.level) return;
    this.mazeGroup.remove(this.tubeMesh, this.obstacleGroup, this.character.group);
    this.tubeMesh.geometry.dispose();
    this.tubeMesh.material.dispose();
    if (this.obstacles[0]) {
      this.obstacles[0].mesh.geometry.dispose();
      this.obstacles[0].mesh.material.dispose();
    }
    for (const m of this.character.opaqueMaterials) m.dispose();
  }

  _loadLevel(index) {
    this._disposeLevel();
    this.levelIndex = index;
    this.level = LEVELS[index];

    this.curve = generatePath(index);
    const tube = buildTubeMesh(this.curve, { radius: this.level.tubeRadius });
    this.tubeMesh = tube.mesh;
    this.tubeRadius = tube.radius;
    this.foodRadius = this.tubeRadius * 0.28;
    this.mazeGroup.add(this.tubeMesh);

    const { group: obstacleGroup, obstacles } = buildObstacles(this.curve, this.tubeRadius, this.level.obstacles);
    this.obstacleGroup = obstacleGroup;
    this.obstacles = obstacles;
    obstacleGroup.visible = false;
    this.mazeGroup.add(this.obstacleGroup);

    this.character = BUILDERS[index]();
    this.mazeGroup.add(this.character.group);

    this.food.scale.setScalar(this.foodRadius);

    this.t = 0.001;
    this.tVel = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.timeLeft = this.level.timeLimit;
    this.boostCooldown = 0;
    this.invuln = 0;
    this.frameUp = new THREE.Vector3(0, 1, 0);
    this.mazeGroup.quaternion.identity();

    this.character.setSkinOpacity(1);
    this.character.group.visible = true;
    this.food.visible = false;
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

  // Called by main.js on pointer drag (mouse or touch, unified). dx/dy are
  // pixel deltas since the last event; rotates the whole creature+maze
  // rigid body like a labyrinth toy.
  rotateMaze(dx, dy) {
    if (this.state !== STATE.PLAY) return;
    const sensitivity = 0.007;
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -dx * sensitivity);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -dy * sensitivity);
    this.mazeGroup.quaternion.premultiply(qYaw).premultiply(qPitch);
  }

  tryBoost() {
    if (this.boostCooldown > 0) return;
    this.boostCooldown = BOOST_COOLDOWN;
    this.tVel += BOOST_IMPULSE;
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
    this.camera.position.lerpVectors(introStart, PLAY_CAMERA_POS, ease);
    this.camera.lookAt(0, 0, 0);
    if (p >= 1) {
      this.mazeGroup.quaternion.identity();
      this._setState(STATE.REVEAL);
    }
  }

  _updateReveal(dt) {
    const p = Math.min(this.stateTime / 2.2, 1);
    this.character.setSkinOpacity(THREE.MathUtils.lerp(1, 0.14, p));
    this.tubeMesh.material.opacity = THREE.MathUtils.lerp(0, 0.55, p);
    this.camera.position.copy(PLAY_CAMERA_POS);
    this.camera.lookAt(0, 0, 0);
    if (p >= 1) {
      this.obstacleGroup.visible = true;
      this.food.visible = true;
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
    if (kx || ky) this.rotateMaze(kx * 90 * dt, ky * 90 * dt);

    if (this.boostCooldown > 0) this.boostCooldown -= dt;

    // gravity, expressed in the maze's local space (it's the rigid body
    // that's being rotated, so "down" relative to it keeps changing).
    const invQuat = this.mazeGroup.quaternion.clone().invert();
    const localGravity = DOWN.clone().applyQuaternion(invQuat);

    const sampleT = THREE.MathUtils.clamp(this.t, 0.001, 0.999);
    const tangent = this.curve.getTangentAt(sampleT).normalize();
    let normal = this.frameUp.clone().sub(tangent.clone().multiplyScalar(this.frameUp.dot(tangent)));
    if (normal.lengthSq() < 1e-6) normal = new THREE.Vector3(1, 0, 0);
    normal.normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    this.frameUp = normal;

    // forward/backward motion: gravity component along the tract
    const accel = localGravity.dot(tangent) * GRAVITY_T_ACCEL;
    this.tVel += accel * dt;
    this.tVel *= Math.max(0, 1 - FRICTION * dt);
    let nextT = this.t + this.tVel * dt;

    if (nextT >= 1) {
      this._onLevelWon();
      return;
    }
    if (nextT <= 0) {
      nextT = 0;
      this.tVel = Math.max(0, this.tVel);
    }
    this.t = nextT;

    // lateral motion: settle toward the gravity-facing wall (rolling ball)
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

    const center = this.curve.getPointAt(sampleT);
    const playerPos = center.clone().addScaledVector(normal, this.offsetY).addScaledVector(binormal, this.offsetX);
    this.food.position.copy(playerPos);

    // camera stays fixed/zoomed-out; only the creature rotates
    this.camera.position.copy(PLAY_CAMERA_POS);
    this.camera.lookAt(0, 0, 0);

    if (this.invuln > 0) this.invuln -= dt;
    if (this.invuln <= 0) {
      for (const o of this.obstacles) {
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

    this.timeLeft -= dt;
    this.hud.updateHUD(this.t, Math.max(0, this.timeLeft), this.level.timeLimit);

    if (this.timeLeft <= 0) {
      this._setState(STATE.LOSE);
      this.hud.showEnd(false, this.level.name);
    }
  }

  _onLevelWon() {
    this.t = 1;
    this.food.visible = false;
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
