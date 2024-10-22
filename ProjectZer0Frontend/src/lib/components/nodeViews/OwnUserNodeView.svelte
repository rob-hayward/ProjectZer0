<!-- src/lib/components/nodeViews/OwnUserNodeView.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { spring } from 'svelte/motion';
  import { goto } from '$app/navigation';
  import * as auth0 from '$lib/services/auth0';
  import type { UserProfile } from '$lib/types/user';

  export let node: UserProfile;

  const dispatch = createEventDispatcher();

  let canvas: HTMLCanvasElement;
  let mouseX = spring(0);
  let mouseY = spring(0);
  let hoveredOption: string | null = null;

  const navigationOptions = [
    { id: 'explore', label: 'explore', icon: '◯' },
    { id: 'create-node', label: 'create node', icon: '+' },
    { id: 'network', label: 'social network', icon: '◎' },
    { id: 'creations', label: 'my creations', icon: '✦' },
    { id: 'interactions', label: 'my interactions', icon: '⟷' },
    { id: 'edit-profile', label: 'edit profile', icon: '⚙' },
    { id: 'logout', label: 'logout', icon: '↪' }
  ];

  let scaleSpring: Record<string, ReturnType<typeof spring<number>>> = {};

  function handleNavigation(optionId: string) {
    console.log('Navigation clicked:', optionId);
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

  onMount(() => {
    // Initialize scale springs for each navigation option
    scaleSpring = navigationOptions.reduce((acc, option) => {
      acc[option.id] = spring<number>(1, {
        stiffness: 0.15,
        damping: 1.6
      });
      return acc;
    }, {} as Record<string, ReturnType<typeof spring<number>>>);

    const ctx = canvas.getContext('2d')!;
    let frame: number;
    
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      drawDynamicBackground(ctx, $mouseX, $mouseY);
      drawUserNode(ctx);
      drawNavigationNodes(ctx);
      
      frame = requestAnimationFrame(draw);
    }
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();

    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('click', handleCanvasClick);
    
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('mousemove', handleCanvasMouseMove);
      canvas.removeEventListener('click', handleCanvasClick);
    };
  });
  
  function handleCanvasMouseMove(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    mouseX.set(x);
    mouseY.set(y);

    const hoveredNode = getHoveredNode(x, y);
    hoveredOption = hoveredNode ? hoveredNode.id : null;

    // Update scale springs
    navigationOptions.forEach(option => {
      if (scaleSpring[option.id]) {
        scaleSpring[option.id].set(option.id === hoveredOption ? 1.5 : 1);
      }
    });
  }

  function handleCanvasClick(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const clickedNode = getHoveredNode(x, y);
    if (clickedNode) {
      handleNavigation(clickedNode.id);
    }
  }

  function getHoveredNode(x: number, y: number) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;

    return navigationOptions.find((option, index) => {
      const angle = (index / navigationOptions.length) * 2 * Math.PI - Math.PI / 2;
      const nodeX = centerX + Math.cos(angle) * radius;
      const nodeY = centerY + Math.sin(angle) * radius;
      const distance = Math.sqrt(Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2));
      return distance < 30;
    });
  }
  
  function drawDynamicBackground(ctx: CanvasRenderingContext2D, mx: number, my: number) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.arc(mx, my, 100, 0, 2 * Math.PI);
    ctx.fill();
  }
  
  function drawUserNode(ctx: CanvasRenderingContext2D) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 150, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.font = '16px "Roboto", sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const name = node.preferred_username || node.name || node.nickname || 'User';
    ctx.fillText(name.toLowerCase(), centerX, centerY - 20);
    
    const mission = node.mission_statement || "no mission statement set.";
    const words = mission.split(' ');
    let line = '';
    let y = centerY + 20;
    
    for (let word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 250 && line !== '') {
        ctx.fillText(line, centerX, y);
        line = word + ' ';
        y += 25;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, centerX, y);
  }
  
  function drawNavigationNodes(ctx: CanvasRenderingContext2D) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;

    navigationOptions.forEach((option, index) => {
      const angle = (index / navigationOptions.length) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      let currentScale = 1;
      if (scaleSpring[option.id]) {
        const unsubscribe = scaleSpring[option.id].subscribe(value => {
          currentScale = value;
        });
        unsubscribe();
      } else if (hoveredOption === option.id) {
        currentScale = 1.5;
      }
      
      // Calculate opacity based on scale
      const opacity = (currentScale - 1) / 0.5; // Will be 0 when scale is 1, and 1 when scale is 1.5
      
      // Draw the icon with scaling
      ctx.font = `${24 * currentScale}px "Roboto", sans-serif`;
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(option.icon, x, y);
      
      // Draw label with fade effect
      if (option.id === hoveredOption || opacity > 0) {
        ctx.font = '14px "Roboto", sans-serif';
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fillText(option.label, x, y + 30);
      }
    });
  }
</script>

<div class="user-node-view" role="region" aria-label="User Dashboard">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .user-node-view {
    width: 100vw;
    height: 100vh;
    background: black;
    color: white;
    overflow: hidden;
    position: relative;
    font-family: 'Roboto', sans-serif;
  }
  
  canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>