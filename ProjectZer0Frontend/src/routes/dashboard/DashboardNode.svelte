<!-- routes/dashboard/DashboardNode.svelte -->
<script lang="ts">
  import { spring } from 'svelte/motion';
  import { goto } from '$app/navigation';
  import * as auth0 from '$lib/services/auth0';
  import type { UserProfile } from '$lib/types/user';
  import ZoomNodeCanvas from '$lib/components/graphElements/nodes/zoomNode/ZoomNodeCanvas.svelte';
  import { dashboardNavigationOptions } from '$lib/components/graphElements/nodes/navigationNode/navigationOptions';
  import { drawDynamicBackground, drawUserNode } from './dashboardCanvas';
  import { drawNavigationNode, isNavigationNodeHovered } from '$lib/components/graphElements/nodes/navigationNode/NavigationNode';
  import type { NavigationOption } from '$lib/types/navigation';

  export let node: UserProfile;

  let hoveredOption: string | null = null;
  let scaleSpring: Record<string, ReturnType<typeof spring<number>>> = {};

  // Initialize springs
  $: {
    scaleSpring = dashboardNavigationOptions.reduce((acc, option) => ({
      ...acc,
      [option.id]: spring(1, { stiffness: 0.15, damping: 1.6 })
    }), {});
  }

  function handleNavigation(optionId: string) {
    switch(optionId) {
      case 'create-node':
        goto('/create-node');
        break;
      case 'edit-profile':
        goto('/edit-profile');
        break;
      case 'logout':
        auth0.logout();
        break;
      default:
        goto(`/${optionId}`);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, mouseX: number, mouseY: number) {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    
    drawDynamicBackground(ctx, mouseX, mouseY);
    drawUserNode(ctx, centerX, centerY, node);
    drawNavigationNodes(ctx, centerX, centerY);
  }

  function drawNavigationNodes(
    ctx: CanvasRenderingContext2D, 
    centerX: number, 
    centerY: number
  ) {
    const radius = Math.min(ctx.canvas.width, ctx.canvas.height) * 0.35;

    dashboardNavigationOptions.forEach((option, index) => {
      const angle = (index / dashboardNavigationOptions.length) * 2 * Math.PI - Math.PI / 2;
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

  function getHoveredNode(x: number, y: number): NavigationOption | undefined {
    const canvas = document.querySelector('canvas');
    if (!canvas) return undefined;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;

    return dashboardNavigationOptions.find((option, index) => {
      const angle = (index / dashboardNavigationOptions.length) * 2 * Math.PI - Math.PI / 2;
      const nodeX = centerX + Math.cos(angle) * radius;
      const nodeY = centerY + Math.sin(angle) * radius;
      return isNavigationNodeHovered(x, y, nodeX, nodeY);
    });
  }

  function handleMouseMove(x: number, y: number) {
    const hoveredNode = getHoveredNode(x, y);
    hoveredOption = hoveredNode ? hoveredNode.id : null;

    dashboardNavigationOptions.forEach(option => {
      if (scaleSpring[option.id]) {
        scaleSpring[option.id].set(option.id === hoveredOption ? 1.5 : 1);
      }
    });
  }

  function handleClick(x: number, y: number) {
    const clickedNode = getHoveredNode(x, y);
    if (clickedNode) {
      handleNavigation(clickedNode.id);
    }
  }
</script>

<div class="dashboard-node" role="region" aria-label="User Dashboard">
    <ZoomNodeCanvas
    {draw}
    handleClick={(x, y) => handleClick(x, y)}
    handleMouseMove={(x, y) => handleMouseMove(x, y)}
    backgroundColor="black"
  />
</div>

<style>
  .dashboard-node {
    width: 100vw;
    height: 100vh;  
    font-family: 'Roboto', sans-serif;
  }
</style>