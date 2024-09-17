<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { gsap } from 'gsap';
  import "../app.css";

  // Constants
  const CAMERA_FOV = 125;
  const CAMERA_NEAR = 0.1;
  const CAMERA_FAR = 1000;
  const CAMERA_POSITION_Z = 7;

  const SKYBOX_RADIUS = 100;
  const SKYBOX_SEGMENTS = 128;

  const LARGER_SPHERE_RADIUS = 4.1;
  const LARGER_SPHERE_SEGMENTS = 64;

  const SMALLER_SPHERE_RADIUS = 1.15;
  const SMALLER_SPHERE_SEGMENTS = 64;

  const ANIMATION_DURATION = 13;

  // Scene elements
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let skyBoxSphere: THREE.Mesh;
  let largerSphere: THREE.Mesh;
  let smallerSphere: THREE.Mesh;

  onMount(() => {
    initScene();
    createSkyBoxSphere();
    createLargerSphere();
    createSmallerSphere();
    startAnimation();
    animateSmallerSphere();
    window.addEventListener('resize', onWindowResize);
  });

  function initScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
    camera.position.z = CAMERA_POSITION_Z;

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
  }

  function createSkyBoxSphere() {
    const geometry = new THREE.SphereGeometry(SKYBOX_RADIUS, SKYBOX_SEGMENTS, SKYBOX_SEGMENTS);
    const texture = new THREE.TextureLoader().load('/images/background.png');
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });

    skyBoxSphere = new THREE.Mesh(geometry, material);
    scene.add(skyBoxSphere);
  }

  function createLargerSphere() {
    const geometry = new THREE.SphereGeometry(LARGER_SPHERE_RADIUS, LARGER_SPHERE_SEGMENTS, LARGER_SPHERE_SEGMENTS);
    const texture = new THREE.TextureLoader().load('/images/Star.png');
    const material = new THREE.MeshBasicMaterial({ map: texture });

    largerSphere = new THREE.Mesh(geometry, material);
    scene.add(largerSphere);
  }

  function createSmallerSphere() {
    const geometry = new THREE.SphereGeometry(SMALLER_SPHERE_RADIUS, SMALLER_SPHERE_SEGMENTS, SMALLER_SPHERE_SEGMENTS);
    const texture = new THREE.TextureLoader().load('/images/InvertedStar.png');
    const material = new THREE.MeshBasicMaterial({ map: texture });

    smallerSphere = new THREE.Mesh(geometry, material);
    smallerSphere.position.set(-5, 0, 4);
    scene.add(smallerSphere);
  }

  function startAnimation() {
    requestAnimationFrame(startAnimation);

    skyBoxSphere.rotation.x += 0.00004;
    skyBoxSphere.rotation.y += 0.00008;
    largerSphere.rotation.x += 0.0001;
    largerSphere.rotation.y += 0.00015;

    renderer.render(scene, camera);
  }

  function animateSmallerSphere() {
    gsap.to(smallerSphere.position, {
      duration: ANIMATION_DURATION,
      x: 0,
      z: 5,
      ease: 'expo.out'
    });
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function handleAuth0() {
    console.log('Enter button clicked');
  }
</script>

<!-- Flexbox structure -->
<div class="home-page">
  <div class="centered-content">
    <h1>PROJECT ZER0</h1>
    <h2>EXPERIMENT / GAME / REVOLUTION</h2>
    <button class="enter-button" on:click={handleAuth0}>ENTER</button>
  </div>
</div>

<style>
  .home-page {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    color: white;
  }

  .centered-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: translateY(5vh);
  }

  h1, h2 {
    font-family: 'Orbitron', sans-serif;
    font-weight: 900;
  }

  h1 {
    font-size: 7vw;
    margin-bottom: 1vh;
  }

  h2 {
    font-size: 2.4vw;
    margin-bottom: 16vh;
  }

  .enter-button {
    font-family: 'Orbitron', sans-serif;
    font-size: 3vw;
    font-weight: 900;
    color: white;
    background: none;
    border: none;
    cursor: pointer;
    padding: 10px 20px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .enter-button:hover {
    text-shadow: 0 0 20px rgba(255, 255, 255, 1);
  }

  .enter-button:focus {
    outline: none;
  }

  @media (max-width: 768px) {
    h1 { font-size: 8vw; }
    h2 { font-size: 3vw; }
    .enter-button { font-size: 3vw; }
  }
</style>
