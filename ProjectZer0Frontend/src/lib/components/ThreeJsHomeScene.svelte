<script lang="ts">
    import { onMount } from 'svelte';
    import * as THREE from 'three';
    import { gsap } from 'gsap';
  
    const CAMERA = {
      FOV: 100,
      NEAR: 0.1,
      FAR: 2000,
      POSITION_Z: 9
    };
  
    const SKYBOX = {
      RADIUS: 200,
      SEGMENTS: 128
    };
  
    const LARGER_SPHERE = {
      RADIUS: 6,
      SEGMENTS: 64
    };
  
    const SMALLER_SPHERE = {
      RADIUS: 0.45,
      SEGMENTS: 64,
      POSITION_Z: 8.3
    };
  
    const ANIMATION_DURATION = 13;
  
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let skyBoxSphere: THREE.Mesh;
    let largerSphere: THREE.Mesh;
    let smallerSphere: THREE.Mesh;
  
    async function loadTextures() {
      const loader = new THREE.TextureLoader();
      const [backgroundTexture, starTexture, invertedStarTexture] = await Promise.all([
        loader.loadAsync('/images/background.png'),
        loader.loadAsync('/images/Star.png'),
        loader.loadAsync('/images/InvertedStar.png')
      ]);
      return { backgroundTexture, starTexture, invertedStarTexture };
    }
  
    function initScene() {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(CAMERA.FOV, window.innerWidth / window.innerHeight, CAMERA.NEAR, CAMERA.FAR);
      camera.position.z = CAMERA.POSITION_Z;
  
      renderer = new THREE.WebGLRenderer();
      renderer.setSize(window.innerWidth, window.innerHeight);
      document.getElementById('three-js-container')?.appendChild(renderer.domElement);
    }
  
    function createSkyBoxSphere(texture: THREE.Texture) {
      const geometry = new THREE.SphereGeometry(SKYBOX.RADIUS, SKYBOX.SEGMENTS, SKYBOX.SEGMENTS);
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
      skyBoxSphere = new THREE.Mesh(geometry, material);
      scene.add(skyBoxSphere);
    }
  
    function createLargerSphere(texture: THREE.Texture) {
      const geometry = new THREE.SphereGeometry(LARGER_SPHERE.RADIUS, LARGER_SPHERE.SEGMENTS, LARGER_SPHERE.SEGMENTS);
      const material = new THREE.MeshBasicMaterial({ map: texture });
      largerSphere = new THREE.Mesh(geometry, material);
      scene.add(largerSphere);
    }
  
    function createSmallerSphere(texture: THREE.Texture) {
      const geometry = new THREE.SphereGeometry(SMALLER_SPHERE.RADIUS, SMALLER_SPHERE.SEGMENTS, SMALLER_SPHERE.SEGMENTS);
      const material = new THREE.MeshBasicMaterial({ map: texture });
      smallerSphere = new THREE.Mesh(geometry, material);
      smallerSphere.position.set(-1, 0, SMALLER_SPHERE.POSITION_Z);
      scene.add(smallerSphere);
    }
  
    function animateSmallerSphere() {
      gsap.to(smallerSphere.position, {
        duration: ANIMATION_DURATION,
        x: 0,
        ease: 'expo.out'
      });
    }
  
    function startAnimation() {
      requestAnimationFrame(startAnimation);
      rotateSpheres();
      renderer.render(scene, camera);
    }
  
    function rotateSpheres() {
      skyBoxSphere.rotation.x += 0.00004;
      skyBoxSphere.rotation.y += 0.00008;
      largerSphere.rotation.x += 0.0001;
      largerSphere.rotation.y += 0.00015;
      smallerSphere.rotation.x -= 0.0012;
      smallerSphere.rotation.y -= 0.0013;
    }
  
    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  
    onMount(() => {
      let cleanupFunction: (() => void) | undefined;
  
      (async () => {
        try {
          const textures = await loadTextures();
          initScene();
          createSkyBoxSphere(textures.backgroundTexture);
          createLargerSphere(textures.starTexture);
          createSmallerSphere(textures.invertedStarTexture);
          startAnimation();
          animateSmallerSphere();
          
          window.addEventListener('resize', onWindowResize);
          
          cleanupFunction = () => {
            window.removeEventListener('resize', onWindowResize);
            // Stop any ongoing animations
            gsap.killTweensOf(smallerSphere.position);
            // Dispose of Three.js objects
            scene.remove(skyBoxSphere, largerSphere, smallerSphere);
            skyBoxSphere.geometry.dispose();
            largerSphere.geometry.dispose();
            smallerSphere.geometry.dispose();
            (skyBoxSphere.material as THREE.Material).dispose();
            (largerSphere.material as THREE.Material).dispose();
            (smallerSphere.material as THREE.Material).dispose();
            renderer.dispose();
          };
        } catch (error) {
          console.error('Error initializing Three.js scene:', error);
        }
      })();
  
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
    }
  </style>