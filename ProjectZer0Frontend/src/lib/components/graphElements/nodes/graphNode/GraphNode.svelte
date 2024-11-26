<!-- src/lib/components/graphElements/nodes/graphNode/GraphNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { BaseZoomedCanvas, TEXT_STYLES } from '$lib/components/graphElements/layouts/baseZoomedCanvas';
    import { PREVIEW_TEXT_STYLES } from './previewStyles';
  
    const dispatch = createEventDispatcher<{
      click: void;
      hover: { isHovered: boolean };
    }>();
  
    // Props
    export let width = 200;  // Smaller default size for preview nodes
    export let height = 200;
    export let isHovered = false;
    export let isExpanded = false;
    export let drawContent: ((ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => void) | null = null;
  
    // Internal state
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null = null;
    
    // Constants
    const CONTENT_WIDTH = width - 40; // Leave space for padding
    const CONTENT_START_Y = -height/3;
  
    // Lifecycle
    $: if (canvas) {
      ctx = canvas.getContext('2d');
      if (ctx) {
        draw();
      }
    }
  
    // Drawing functions
    function draw() {
      if (!ctx) return;
  
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
  
      // Draw background circle with subtle glow
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 10;
  
      // Glow effect
      if (isHovered) {
        const gradient = ctx.createRadialGradient(
          centerX, centerY, radius * 0.8,
          centerX, centerY, radius * 1.2
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
  
      // Main circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fill();
      ctx.strokeStyle = isHovered ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.stroke();
  
      // Draw hover prompt if hovered
      if (isHovered && !isExpanded) {
        BaseZoomedCanvas.setTextStyle(ctx, PREVIEW_TEXT_STYLES.hover);
        ctx.fillText(
          'Click to view details',
          centerX,
          centerY + radius - 20
        );
      }
  
      // Call the drawContent function if provided
      if (drawContent && ctx) {
        drawContent(ctx, centerX, centerY);
      }
    }
  
    // Event handlers
    function handleMouseEnter() {
      isHovered = true;
      dispatch('hover', { isHovered: true });
      draw();
    }
  
    function handleMouseLeave() {
      isHovered = false;
      dispatch('hover', { isHovered: false });
      draw();
    }
  
    function handleClick() {
      dispatch('click');
    }
  
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    }
  
    // Expose draw method for parent components
    export function redraw() {
      draw();
    }
  </script>
  
  <button 
    class="graph-node"
    class:hovered={isHovered}
    class:expanded={isExpanded}
    style="width: {width}px; height: {height}px;"
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    on:click={handleClick}
    on:keydown={handleKeyDown}
    aria-label="Graph node, click to view details"
    type="button"
  >
    <canvas
      bind:this={canvas}
      {width}
      {height}
      style="width: {width}px; height: {height}px;"
    ></canvas>
  </button>
  
  <style>
    .graph-node {
      position: relative;
      cursor: pointer;
      transition: transform 0.3s ease-out;
      padding: 0;
      border: none;
      background: none;
      outline: none;
    }
  
    .graph-node.hovered {
      transform: scale(1.05);
    }
  
    .graph-node.expanded {
      transform: scale(1);
      cursor: default;
    }
  
    canvas {
      display: block;
    }
  </style>