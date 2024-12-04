<script lang="ts">
  import { spring, type Spring } from 'svelte/motion';
  import ZoomNodeCanvas from '../../nodes/zoomNode/ZoomNodeCanvas.svelte';
  import { ZoomBackground } from '../../backgrounds/BaseBackground';
  import { drawNavigationNode, isNavigationNodeHovered } from '../../nodes/navigationNode/NavigationNode';
  import type { NavigationOption } from '$lib/types/navigation';
  import type { NavigationOptionId } from '$lib/services/navigation';
  import { BaseZoomedCanvas } from './baseZoomedCanvas';

  // Props
  export let navigationOptions: NavigationOption[];
  export let onNavigate: (optionId: NavigationOptionId) => void;
  export let drawContent: (ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => void;

  // State
  let networkBg: ZoomBackground | null = null;
  let hoveredOption: NavigationOptionId | null = null;
  let time = 0;
  let scaleSpring = new Map<NavigationOptionId, Spring<number>>();

  // Initialize springs
  $: {
    navigationOptions.forEach(option => {
      if (!scaleSpring.has(option.id as NavigationOptionId)) {
        scaleSpring.set(
          option.id as NavigationOptionId,
          spring(1, { stiffness: 0.15, damping: 1.6 })
        );
      }
    });
  }

  function draw(ctx: CanvasRenderingContext2D, mouseX: number, mouseY: number) {
    time += 0.01;
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;

    if (!networkBg) {
      networkBg = new ZoomBackground(35, ctx.canvas.width, ctx.canvas.height);
    }
    networkBg.update(ctx.canvas.width, ctx.canvas.height);
    networkBg.draw(ctx);

    BaseZoomedCanvas.drawCentralCircle(ctx, centerX, centerY, time);
    drawNavigationNodes(ctx, centerX, centerY);
    drawContent(ctx, centerX, centerY);
  }

  function drawNavigationNodes(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
    navigationOptions.forEach((option, index) => {
      const angle = (index / navigationOptions.length) * 2 * Math.PI - Math.PI / 2;
      const baseRadius = Math.min(ctx.canvas.width, ctx.canvas.height);
      const radius = option.id === 'explore' 
        ? baseRadius * 0.45
        : baseRadius * 0.48;
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      let currentScale = 1;
      const optionSpring = scaleSpring.get(option.id as NavigationOptionId);
      if (optionSpring) {
        const unsubscribe = optionSpring.subscribe(value => {
          currentScale = value;
        });
        unsubscribe();
      }

      drawNavigationNode(
        ctx,
        option,
        x,
        y,
        currentScale,
        option.id === hoveredOption
      );
    });
  }

  function handleMouseMove(x: number, y: number) {
    const hoveredNode = getHoveredNode(x, y);
    hoveredOption = hoveredNode ? hoveredNode.id as NavigationOptionId : null;

    navigationOptions.forEach(option => {
      const springValue = scaleSpring.get(option.id as NavigationOptionId);
      if (springValue) {
        springValue.set(option.id === hoveredOption ? 1.5 : 1);
      }
    });
  }

  function handleClick(x: number, y: number) {
    const clickedNode = getHoveredNode(x, y);
    if (clickedNode) {
      onNavigate(clickedNode.id as NavigationOptionId);
    }
  }

  function getHoveredNode(x: number, y: number): NavigationOption | undefined {
    const canvas = document.querySelector('canvas');
    if (!canvas) return undefined;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadius = Math.min(canvas.width, canvas.height);

    return navigationOptions.find((option, index) => {
      const angle = (index / navigationOptions.length) * 2 * Math.PI - Math.PI / 2;
      const radius = option.id === 'explore' 
        ? baseRadius * 0.45 
        : baseRadius * 0.48;
      
      const nodeX = centerX + Math.cos(angle) * radius;
      const nodeY = centerY + Math.sin(angle) * radius;
      return isNavigationNodeHovered(x, y, nodeX, nodeY);
    });
  }
</script>

<div class="base-zoomed-page">
  <ZoomNodeCanvas
    {draw}
    handleClick={(x, y) => handleClick(x, y)}
    handleMouseMove={(x, y) => handleMouseMove(x, y)}
    backgroundColor="black"
  />
  <slot />
</div>

<style>
  .base-zoomed-page {
    width: 100vw;
    height: 100vh;
    position: relative;
  }
</style>