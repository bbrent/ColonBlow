import * as THREE from 'three';
import { Game, STATE } from './game.js';
import { createHud } from './hud.js';

const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0710);
scene.fog = new THREE.Fog(0x0b0710, 20, 55);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 7, 16);

const hemi = new THREE.HemisphereLight(0xfff2e0, 0x1a0d14, 0.9);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(6, 14, 8);
scene.add(key);
const rim = new THREE.PointLight(0xff6699, 1.2, 60);
rim.position.set(-6, 4, -6);
scene.add(rim);

// A light that follows the camera so the tube interior always reads well.
const followLight = new THREE.PointLight(0xffe0cc, 1.4, 40);
scene.add(followLight);

const hud = createHud();
const game = new Game({ scene, camera, hud });

hud.bindStart(() => game.startIntro());
hud.bindRestart(() => {
  if (game.state === STATE.LOSE) game.retryLevel();
  else game.restartCampaign();
});
hud.showTitle();
hud.setLevelName(game.level.name);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.update(dt);
  followLight.position.copy(camera.position);
  renderer.render(scene, camera);
}
animate();
