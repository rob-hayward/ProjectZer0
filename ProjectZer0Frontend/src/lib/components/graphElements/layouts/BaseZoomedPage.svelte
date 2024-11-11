<!-- ProjectZer0Frontend/src/lib/components/graphElements/layouts/BaseZoomedPage.svelte -->
<script lang="ts">
    import { spring } from 'svelte/motion';
    import ZoomNodeCanvas from '../nodes/zoomNode/ZoomNodeCanvas.svelte';
    import { ZoomBackground } from '../backgrounds/ZoomBackground';
    import { drawNavigationNode, isNavigationNodeHovered } from '../nodes/navigationNode/NavigationNode';
    import { drawGlow } from '$lib/utils/canvasAnimations';
    import type { NavigationOption } from '$lib/types/navigation';
  
    // Props
    export let navigationOptions: NavigationOption[];
    export let onNavigate: (optionId: string) => void;
    export let drawContent: (ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => void;
  
    // State
    let networkBg: ZoomBackground | null = null;
    let hoveredOption: string | null = null;
    let time = 0;
    let scaleSpring: Record<string, ReturnType<typeof spring<number>>> = {};
  
    // Initialize springs
    $: {
      scaleSpring = navigationOptions.reduce((acc, option) => ({
        ...acc,
        [option.id]: spring(1, { stiffness: 0.15, damping: 1.6 })
      }), {});
    }
  
    function draw(ctx: CanvasRenderingContext2D, mouseX: number, mouseY: number) {
      time += 0.01;
      const centerX = ctx.canvas.width / 2;
      const centerY = ctx.canvas.height / 2;
  
      // Initialize and draw background
      if (!networkBg) {
        networkBg = new ZoomBackground(35, ctx.canvas.width, ctx.canvas.height);
      }
      networkBg.update(ctx.canvas.width, ctx.canvas.height);
      networkBg.draw(ctx);
  
      // Draw central circle
      const circleRadius = 285;
      drawGlow(ctx, centerX, centerY, {
        color: '#4A90E2',
        radius: circleRadius + 10,
        intensity: 0.1
      });
  
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);
      ctx.stroke();
  
      const pulseRadius = circleRadius - 5 + Math.sin(time * 2) * 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
      ctx.stroke();
  
      // Draw navigation nodes
      drawNavigationNodes(ctx, centerX, centerY);
  
      // Draw page-specific content
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
        if (scaleSpring[option.id]) {
          const unsubscribe = scaleSpring[option.id].subscribe(value => {
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
      hoveredOption = hoveredNode ? hoveredNode.id : null;
  
      navigationOptions.forEach(option => {
        if (scaleSpring[option.id]) {
          scaleSpring[option.id].set(option.id === hoveredOption ? 1.5 : 1);
        }
      });
    }
  
    function handleClick(x: number, y: number) {
      const clickedNode = getHoveredNode(x, y);
      if (clickedNode) {
        onNavigate(clickedNode.id);
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