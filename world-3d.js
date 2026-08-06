/Suraya-ai/world-3d.js
import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0d0ff);

// دوربین
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(10, 15, 20);

// رندر
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// زمین دهکده
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshStandardMaterial({ color: 0x88cc88 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// نور خورشید
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
scene.add(light);

// حلقهٔ رندر
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
