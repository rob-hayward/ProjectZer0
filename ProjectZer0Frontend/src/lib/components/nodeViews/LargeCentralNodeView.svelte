<!-- src/lib/components/nodeViews/LargeCentralNodeView.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  export let size: number;

  let canvas: HTMLCanvasElement;
  
  onMount(() => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
          animateBackground(ctx);
      }
  });

  function animateBackground(ctx: CanvasRenderingContext2D) {
      const particles: Array<{x: number, y: number, speed: number}> = [];
      for (let i = 0; i < 50; i++) {
          particles.push({
              x: Math.random() * size,
              y: Math.random() * size,
              speed: 0.1 + Math.random() * 0.5
          });
      }

      function draw() {
          ctx.clearRect(0, 0, size, size);
          ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
          particles.forEach(particle => {
              ctx.beginPath();
              ctx.arc(particle.x, particle.y, 1, 0, Math.PI * 2);
              ctx.fill();
              particle.y -= particle.speed;
              if (particle.y < 0) particle.y = size;
          });
          requestAnimationFrame(draw);
      }
      draw();
  }
</script>

<div class="large-central-node-view" style="--node-size: {size}px">
  <canvas bind:this={canvas} width={size} height={size}></canvas>
  <div class="content-area">
      <div class="node-content">
          <slot></slot>
      </div>
  </div>
</div>

<style>
  .large-central-node-view {
      width: var(--node-size);
      height: var(--node-size);
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      overflow: hidden;
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
  }

  canvas {
      position: absolute;
      top: 0;
      left: 0;
  }

  .content-area {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background: rgba(0, 31, 63, 0.8);
      border: 1px solid rgba(0, 255, 255, 0.3);
      border-radius: 50%;
  }

  .node-content {
      color: #00FFFF;
      font-family: 'Roboto', sans-serif;
      text-align: center;
      padding: 20px;
  }
</style>