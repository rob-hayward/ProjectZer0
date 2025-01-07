<!-- ProjectZer0Frontend/src/lib/components/graphElements/nodes/zoomNode/ZoomNodeCanvas.svelte
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { spring } from 'svelte/motion';
  
    export let width: number = window.innerWidth;
    export let height: number = window.innerHeight;
    export let backgroundColor: string = 'black';

    const dispatch = createEventDispatcher();
    let canvas: HTMLCanvasElement;
    let mouseX = spring(0);
    let mouseY = spring(0);
  
    export let draw: (ctx: CanvasRenderingContext2D, mouseX: number, mouseY: number) => void;
    export let handleClick: ((x: number, y: number) => void) | undefined = undefined;
    export let handleMouseMove: ((x: number, y: number) => void) | undefined = undefined;
  
    onMount(() => {
      const ctx = canvas.getContext('2d')!;
      let frame: number;
      
      function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        draw(ctx, $mouseX, $mouseY);
        frame = requestAnimationFrame(animate);
      }
      
      canvas.width = width;
      canvas.height = height;
      animate();
  
      if (handleMouseMove) {
        canvas.addEventListener('mousemove', handleCanvasMouseMove);
      }
      if (handleClick) {
        canvas.addEventListener('click', handleCanvasClick);
      }
      
      return () => {
        cancelAnimationFrame(frame);
        if (handleMouseMove) canvas.removeEventListener('mousemove', handleCanvasMouseMove);
        if (handleClick) canvas.removeEventListener('click', handleCanvasClick);
      };
    });
  
    function handleCanvasMouseMove(event: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      mouseX.set(x);
      mouseY.set(y);
      if (handleMouseMove) handleMouseMove(x, y);
    }
  
    function handleCanvasClick(event: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (handleClick) handleClick(x, y);
    }
  </script>

<div class="zoom-node-canvas" style="background-color: {backgroundColor}">
    <canvas bind:this={canvas}></canvas>
  </div>
  
  <style>
    .zoom-node-canvas {
      width: 100%;
      height: 100%;
      overflow: hidden;
      position: relative;
    }
    
    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
  </style> -->