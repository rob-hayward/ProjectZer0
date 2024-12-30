<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
  import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
  import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
  import { gsap } from 'gsap';
  import { Background } from './Background';
  import { CAMERA, SKYBOX, LARGER_SPHERE, SMALLER_SPHERE, COLORS, ANIMATION_DURATION } from './constants';
  
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let composer: EffectComposer;
  let largerSphere: THREE.Mesh;
  let smallerSphere: THREE.Mesh;
  let background: Background;
  
  function initScene() {
    console.log('Initializing scene');
    scene = new THREE.Scene();
    scene.background = COLORS.BLACK;
    camera = new THREE.PerspectiveCamera(
      CAMERA.FOV, 
      window.innerWidth / window.innerHeight, 
      CAMERA.NEAR, 
      CAMERA.FAR
    );
    camera.position.z = CAMERA.POSITION_Z;
  
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.getElementById('three-js-container')?.appendChild(renderer.domElement);
  
    composer = new EffectComposer(renderer);
    
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.9,    // bloom strength
      0.7,    // bloom radius
      0.85    // bloom threshold
    );
    composer.addPass(bloomPass);
    console.log('Scene initialized');
  }
  
  function createLargerSphere() {
    console.log('Creating larger sphere');
    const geometry = new THREE.SphereGeometry(
      LARGER_SPHERE.RADIUS, 
      LARGER_SPHERE.SEGMENTS, 
      LARGER_SPHERE.SEGMENTS
    );
    const material = new THREE.MeshBasicMaterial({
      color: COLORS.WHITE,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    largerSphere = new THREE.Mesh(geometry, material);
    scene.add(largerSphere);
  }
  
  function createSmallerSphere() {
    console.log('Creating smaller sphere');
    const geometry = new THREE.SphereGeometry(
      SMALLER_SPHERE.RADIUS, 
      SMALLER_SPHERE.SEGMENTS, 
      SMALLER_SPHERE.SEGMENTS
    );
    const material = new THREE.MeshBasicMaterial({
      color: COLORS.BLACK,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    smallerSphere = new THREE.Mesh(geometry, material);
    smallerSphere.position.set(-1, 0, SMALLER_SPHERE.POSITION_Z);
    scene.add(smallerSphere);
  }
  
  function animateSmallerSphere() {
    gsap.to(smallerSphere.position, {
      duration: ANIMATION_DURATION,
      x: 0,
      ease: 'expo.out',
      onUpdate: () => {
        // Emit when sphere is 80% of the way there
        if (smallerSphere.position.x >= -0.2) {
          const event = new CustomEvent('animationComplete');
          window.dispatchEvent(event);
        }
      }
    });
}
  
  function startAnimation() {
    requestAnimationFrame(startAnimation);
    rotateSpheres();
    if (background) {
      background.update();
    }
    composer.render();
  }
  
  function rotateSpheres() {
    largerSphere.rotation.x += 0.0001;
    largerSphere.rotation.y += 0.00015;
    smallerSphere.rotation.x -= 0.0012;
    smallerSphere.rotation.y -= 0.0013;
  }
  
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  
  onMount(() => {
    let cleanupFunction: (() => void) | undefined;
  
    try {
      console.log('Starting scene initialization');
      initScene();
      
      console.log('Creating background');
      background = new Background(scene);
      console.log('Background created:', background);

      createLargerSphere();
      createSmallerSphere();
      startAnimation();
      animateSmallerSphere();
      
      window.addEventListener('resize', onWindowResize);
      
      cleanupFunction = () => {
        console.log('Cleaning up scene');
        window.removeEventListener('resize', onWindowResize);
        gsap.killTweensOf(smallerSphere.position);
        
        scene.remove(largerSphere, smallerSphere);
        largerSphere.geometry.dispose();
        smallerSphere.geometry.dispose();
        (largerSphere.material as THREE.Material).dispose();
        (smallerSphere.material as THREE.Material).dispose();
        
        if (background) {
          background.dispose();
        }
        
        renderer.dispose();
        composer.dispose();
        console.log('Cleanup complete');
      };
    } catch (error) {
      console.error('Error initializing Three.js scene:', error);
    }
  
    return () => {
      if (cleanupFunction) cleanupFunction();
    };
  });
</script>
  
<div id="three-js-container"></div>
  
<style>
  #three-js-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: black;
  }
</style>