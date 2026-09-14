import * as THREE from 'three';
import { generatePath, LEVELS } from './path.js';
import { buildTubeMesh, buildObstacles } from './tube.js';
import { BUILDERS } from './character.js';

const STATE = {
  TITLE: 'title',
  INTRO: 'intro',
  REVEAL: 'reveal',
  DIVE: 'dive',
  PLAY: 'play',
  LEVEL_CLEAR: 'level_clear',
  WIN: 'win',
  LOSE: 'lose',
};

const BASE_SPEED = 0.045; // t-units per second
const BOOST_SPEED = 0.11;
const BOOST_DURATION = 0.5;
const BOOST_COOLDOWN = 1.8;
const STEER_SPEED = 9; // units/sec of lateral offset
const FOOD_RADIUS = 0.8;
const HIT_INVULN = 1.0;
const HIT_PENALTY = 4; // seconds lost on collision

export class Game {
  constructor({ scene, camera, hud }) {
    this.scene = scene;
    this.camera = camera;
    this.hud = hud;

    this.state = STATE.TITLE;
    this.stateTime = 0;
    this.keys = new Set();
    this.levelIndex = 0;

    this.food = new THREE.Mesh(
      new THREE.SphereGeometry(FOOD_RADIUS, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.5, emissive: 0x2a1a08, emissiveIntensity: 0.4 })
    );
    this.food.visible = false;
    scene.add(this.food);

    this._loadLevel(0);
    this._bindInput();
  }

  _disposeLevel() {
    if (!this.level) return;
    this.scene.remove(this.tubeMesh, this.obstacleGroup, this.character.group);
    this.tubeMesh.geometry.dispose();
    this.tubeMesh.material.dispose();
    // all obstacle meshes share one geometry + one material
    if (this.obstacles[0]) {
      this.obstacles[0].mesh.geometry.dispose();
      this.obstacles[0].mesh.material.dispose();
    }
    for (const m of this.character.opaqueMaterials) m.dispose();
    this.character.previewMaterial.dispose();
  }

  _loadLevel(index) {
    this._disposeLevel();
    this.levelIndex = index;
    this.level = LEVELS[index];

    this.curve = generatePath(index);
    const tube = buildTubeMesh(this.curve, { radius: this.level.tubeRadius });
    this.tubeMesh = tube.mesh;
    this.tubeRadius = tube.radius;
    this.tubeMesh.visible = false;
    this.scene.add(this.tubeMesh);

    const { group: obstacleGroup, obstacles } = buildObstacles(this.curve, this.tubeRadius, this.level.obstacles);
    this.obstacleGroup = obstacleGroup;
    this.obstacles = obstacles;
    obstacles.forEach((o) => (o.mesh.visible = false));
    this.scene.add(this.obstacleGroup);

    this.character = BUILDERS[index](tube.geometry);
    this.scene.add(this.character.group);

    this.t = 0.001;
    this.offsetX = 0;
    this.offsetY = 0;
    this.velX = 0;
    this.velY = 0;
    this.timeLeft = this.level.timeLimit;
    this.boostTimer = 0;
    this.boostCooldown = 0;
    this.invuln = 0;
    this.frameUp = new THREE.Vector3(0, 1, 0);

    this.character.setSkinOpacity(1);
    this.character.setPreviewOpacity(0);
    this.character.group.visible = true;
    this.character.group.rotation.set(0, 0, 0);
    this.character.group.position.set(0, 0, 0);
    this.food.visible = false;
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      if (this.state === STATE.TITLE && (e.code === 'Enter' || e.code === 'Space')) this.startIntro();
      if (this.state === STATE.LOSE && (e.code === 'Enter' || e.code === 'Space')) this.retryLevel();
      if (this.state === STATE.WIN && (e.code === 'Enter' || e.code === 'Space')) this.restartCampaign();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
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
      case STATE.DIVE:
        this._updateDive(dt);
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
    this.character.group.rotation.y += dt * 0.4;
    const angle = this.stateTime * 0.25;
    this.camera.position.set(Math.sin(angle) * 16, 7, Math.cos(angle) * 16);
    this.camera.lookAt(0, 5, 0);
  }

  _updateIntro(dt) {
    this.character.group.rotation.y += dt * 0.15;
    const p = Math.min(this.stateTime / 1.4, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const angle = 0.3;
    const dist = THREE.MathUtils.lerp(16, 8, ease);
    this.camera.position.set(Math.sin(angle) * dist, THREE.MathUtils.lerp(7, 6, ease), Math.cos(angle) * dist);
    this.camera.lookAt(0, 6, 0);
    if (p >= 1) this._setState(STATE.REVEAL);
  }

  _updateReveal(dt) {
    const p = Math.min(this.stateTime / 2.2, 1);
    this.character.setSkinOpacity(THREE.MathUtils.lerp(1, 0.1, p));
    this.character.setPreviewOpacity(THREE.MathUtils.lerp(0, 1, p));
    const dist = THREE.MathUtils.lerp(8, 4.5, p);
    this.camera.position.set(Math.sin(0.3) * dist, 6.4, Math.cos(0.3) * dist);
    this.camera.lookAt(0, 8, 0);
    if (p >= 1) {
      this.hud.showMessage('DIVING IN...');
      this._setState(STATE.DIVE);
    }
  }

  _updateDive(dt) {
    const p = Math.min(this.stateTime / 1.6, 1);
    const ease = p * p;
    this.character.group.visible = ease < 0.999;
    this.character.setSkinOpacity(THREE.MathUtils.lerp(0.1, 0, p));
    this.character.setPreviewOpacity(THREE.MathUtils.lerp(1, 0, Math.max(0, p - 0.4) / 0.6));

    const startPoint = this.curve.getPointAt(0.001);
    const camStart = new THREE.Vector3(Math.sin(0.3) * 4.5, 6.4, Math.cos(0.3) * 4.5);
    this.camera.position.lerpVectors(camStart, startPoint.clone().add(new THREE.Vector3(0, 0, 6)), ease);
    this.camera.lookAt(startPoint);

    if (p >= 1) {
      this.hud.hideMessage();
      this.tubeMesh.visible = true;
      this.food.visible = true;
      this.obstacles.forEach((o) => (o.mesh.visible = true));
      this._setState(STATE.PLAY);
    }
  }

  _updatePlay(dt) {
    let inX = 0;
    let inY = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) inX -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) inX += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) inY += 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) inY -= 1;

    this.velX += inX * STEER_SPEED * dt;
    this.velY += inY * STEER_SPEED * dt;
    this.velX *= 0.9;
    this.velY *= 0.9;
    this.offsetX += this.velX * dt;
    this.offsetY += this.velY * dt;

    const maxOffset = this.tubeRadius - FOOD_RADIUS - 0.3;
    const mag = Math.hypot(this.offsetX, this.offsetY);
    if (mag > maxOffset) {
      const k = maxOffset / mag;
      this.offsetX *= k;
      this.offsetY *= k;
      this.velX *= -0.3;
      this.velY *= -0.3;
    }

    if (this.boostCooldown > 0) this.boostCooldown -= dt;
    if (this.keys.has('Space') && this.boostTimer <= 0 && this.boostCooldown <= 0) {
      this.boostTimer = BOOST_DURATION;
      this.boostCooldown = BOOST_COOLDOWN;
      this.hud.pulseBoost();
    }
    let speed = BASE_SPEED;
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      speed = BOOST_SPEED;
    }
    this.t = Math.min(this.t + speed * dt, 1);

    const tangent = this.curve.getTangentAt(Math.min(this.t, 0.999)).normalize();
    let normal = this.frameUp.clone().sub(tangent.clone().multiplyScalar(this.frameUp.dot(tangent)));
    if (normal.lengthSq() < 1e-6) normal = new THREE.Vector3(1, 0, 0);
    normal.normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    this.frameUp = normal;

    const center = this.curve.getPointAt(Math.min(this.t, 0.999));
    const playerPos = center
      .clone()
      .addScaledVector(normal, this.offsetY)
      .addScaledVector(binormal, this.offsetX);
    this.food.position.copy(playerPos);

    const camPos = playerPos
      .clone()
      .addScaledVector(tangent, -9)
      .addScaledVector(normal, 3.2);
    this.camera.position.lerp(camPos, Math.min(1, dt * 6));
    const lookTarget = playerPos.clone().addScaledVector(tangent, 6);
    this.camera.lookAt(lookTarget);

    if (this.invuln > 0) this.invuln -= dt;
    if (this.invuln <= 0) {
      for (const o of this.obstacles) {
        if (Math.abs(o.t - this.t) > 0.02) continue;
        if (playerPos.distanceTo(o.position) < FOOD_RADIUS + o.radius) {
          this.timeLeft -= HIT_PENALTY;
          this.invuln = HIT_INVULN;
          this.velX *= -1.5;
          this.velY *= -1.5;
          this.hud.flashHit();
          break;
        }
      }
    }

    this.timeLeft -= dt;
    this.hud.updateHUD(this.t, Math.max(0, this.timeLeft), this.level.timeLimit);

    if (this.t >= 1) {
      this._onLevelWon();
    } else if (this.timeLeft <= 0) {
      this._setState(STATE.LOSE);
      this.hud.showEnd(false, this.level.name);
    }
  }

  _onLevelWon() {
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
