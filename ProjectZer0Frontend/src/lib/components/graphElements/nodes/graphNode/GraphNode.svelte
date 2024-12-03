<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { PreviewNodeCanvas } from '../previews/base/previewNodeCanvas';

  const dispatch = createEventDispatcher<{
    click: void;
    hover: { isHovered: boolean };
  }>();

  export let width = 150;
  export let height = 150;
  export let isHovered = false;
  export let isExpanded = false;
  export let drawContent: ((ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => void) | null = null;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  
  onMount(() => {
    if (canvas) {
      ctx = PreviewNodeCanvas.initializeCanvas(canvas, width, height);
      if (ctx) {
        draw();
      }
    }
  });

  $: if (canvas && ctx && (isHovered !== undefined)) {
    draw();
  }

  function draw() {
    if (!ctx) return;

    PreviewNodeCanvas.clearCanvas(ctx, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 5;

    PreviewNodeCanvas.drawNodeBackground(ctx, centerX, centerY, radius, isHovered);

    if (drawContent) {
      drawContent(ctx, centerX, centerY);
    }
  }
</script>

<button 
  class="graph-node"
  class:hovered={isHovered}
  class:expanded={isExpanded}
  style="width: {width}px; height: {height}px;"
  on:mouseenter={() => {
      isHovered = true;
      dispatch('hover', { isHovered: true });
  }}
  on:mouseleave={() => {
      isHovered = false;
      dispatch('hover', { isHovered: false });
  }}
  on:click={() => dispatch('click')}
  on:keydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          dispatch('click');
      }
  }}
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