<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { NodeMode } from '$lib/types/nodes';
    import { BaseNodeDisplay } from './BaseNodeDisplay';
  
    export let mode: NodeMode = 'preview';
    export let width: number;
    export let height: number;
    export let isHovered = false;
    export let drawContent: ((ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => void) | null = null;
  
    const dispatch = createEventDispatcher<{
      zoom: { bounds: DOMRect };
      hover: { isHovered: boolean };
    }>();
  
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null = null;
  
    $: if (canvas && ctx && (isHovered !== undefined)) {
      draw();
    }
  
    function draw() {
      if (!ctx) return;
      BaseNodeDisplay.clearCanvas(ctx, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 5;
  
      BaseNodeDisplay.drawNodeBackground(ctx, centerX, centerY, radius, isHovered);
      if (drawContent) {
        drawContent(ctx, centerX, centerY);
      }
    }
  
    function handleClick() {
      dispatch('zoom', { bounds: canvas.getBoundingClientRect() });
    }
  </script>
  
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="base-node"
    class:preview={mode === 'preview'}
    class:zoomed={mode === 'zoomed'}
    class:hovered={isHovered}
    style="width: {width}px; height: {height}px;"
    on:mouseenter={() => dispatch('hover', { isHovered: true })}
    on:mouseleave={() => dispatch('hover', { isHovered: false })}
    on:click={handleClick}
  >
    <canvas
      bind:this={canvas}
      {width}
      {height}
      style="width: {width}px; height: {height}px;"
    />
  </div>
  
  <style>
    .base-node {
      position: relative;
      transition: transform 0.3s ease-out;
    }
  
    .preview {
      cursor: pointer;
    }
  
    .preview.hovered {
      transform: scale(1.05);
    }
  
    .zoomed {
      cursor: default;
    }
  
    canvas {
      display: block;
    }
  </style>