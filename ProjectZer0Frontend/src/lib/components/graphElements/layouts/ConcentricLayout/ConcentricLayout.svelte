<!-- src/lib/components/graphElements/layouts/ConcentricLayout/ConcentricLayout.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { WordNode, Definition } from '$lib/types/nodes';
    import type { 
      ConcentricLayoutConfig, 
      NodeLayoutMetadata, 
      SortMode,
      ConcentricNodePosition
    } from '$lib/types/layout';
    import { 
      calculateNodePositions,
      calculateTransitionPositions 
    } from '$lib/services/layout/concentricPositioning';
    import WordNodeDisplay from '../../../../../routes/nodes/word/WordNodeDisplay.svelte';
    import AlternativeDefinitionNodeDisplay from '../../../../../routes/nodes/definition/AlternativeDefinitionNodeDisplay.svelte';
  
    // Props
    export let wordData: WordNode;
    export let alternativeDefinitions: Definition[];
    export let sortMode: SortMode = 'popular';
  
    // Internal state
    let container: HTMLElement;
    let positions = new Map<string, ConcentricNodePosition>();
    let isTransitioning = false;
    let animationFrame: number;
    let transitionStartTime: number;
    let startPositions: Map<string, ConcentricNodePosition>;
    let targetPositions: Map<string, ConcentricNodePosition>;
  
    // View state
    let zoom = 100;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let isPanMode = false;
    let currentFocusedNodeId: string | null = null;
  
    // Configuration
    const config: ConcentricLayoutConfig = {
      centerRadius: 200,
      ringSpacing: 250,
      minNodeSize: 100,
      maxNodeSize: 200,
      initialZoom: 1,
      minZoom: 0.5,
      maxZoom: 2
    };
  
    // Status text for screen readers
    $: statusText = `${zoom}% zoom, viewing ${alternativeDefinitions.length} alternative definitions for ${wordData.word}`;
  
    function createNodeMetadata(): {
      center: NodeLayoutMetadata;
      alternatives: NodeLayoutMetadata[];
    } {
      const center: NodeLayoutMetadata = {
        id: 'center',
        timestamp: new Date(wordData.createdAt),
        votesCount: 0,
        size: config.maxNodeSize,
        position: {
          x: 0,
          y: 0,
          scale: 1,
          ring: 0,
          ringPosition: 0,
          distanceFromCenter: 0
        }
      };
  
      const alternatives: NodeLayoutMetadata[] = alternativeDefinitions.map((def, index) => ({
        id: def.id,
        timestamp: new Date(def.createdAt),
        votesCount: def.votes,
        size: config.minNodeSize,
        position: {
          x: 0,
          y: 0,
          scale: 1,
          ring: 0,
          ringPosition: 0,
          distanceFromCenter: 0
        }
      }));
  
      return { center, alternatives };
    }
  
    function updateLayout(immediate = false) {
      const { center, alternatives } = createNodeMetadata();
      const newPositions = calculateNodePositions(
        center,
        alternatives,
        config,
        sortMode,
        container.clientWidth,
        container.clientHeight
      );
  
      if (immediate || !positions.size) {
        positions = newPositions;
      } else {
        startTransition(positions, newPositions);
      }
    }
  
    function startTransition(from: Map<string, ConcentricNodePosition>, to: Map<string, ConcentricNodePosition>) {
      isTransitioning = true;
      startPositions = new Map(from);
      targetPositions = new Map(to);
      transitionStartTime = Date.now();
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animateTransition();
    }
  
    function animateTransition() {
      const progress = Math.min(1, (Date.now() - transitionStartTime) / 500);
      positions = calculateTransitionPositions(startPositions, targetPositions, progress);
  
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animateTransition);
      } else {
        isTransitioning = false;
      }
    }
  
    // Interaction handlers
    function handleMouseDown(event: MouseEvent) {
      if (event.button === 0 && (isPanMode || event.shiftKey)) {
        isDragging = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        event.preventDefault();
      }
    }
  
    function handleMouseMove(event: MouseEvent) {
      if (!isDragging) return;
      const dx = event.clientX - lastMouseX;
      const dy = event.clientY - lastMouseY;
      panX += dx;
      panY += dy;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
    }
  
    function handleMouseUp() {
      isDragging = false;
    }
  
    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const zoomDelta = -event.deltaY * 0.1;
      updateZoom(zoomDelta, event.clientX, event.clientY);
    }
  
    function updateZoom(delta: number, clientX: number, clientY: number) {
      const newZoom = Math.max(25, Math.min(400, zoom + delta));
      if (newZoom !== zoom) {
        const rect = container.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        const zoomRatio = newZoom / zoom;
        panX = x - (x - panX) * zoomRatio;
        panY = y - (y - panY) * zoomRatio;
        
        zoom = newZoom;
      }
    }
  
    function handleKeyboardNavigation(event: KeyboardEvent) {
      switch(event.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown':
          event.preventDefault();
          navigateNodes(event.key);
          break;
        case '+':
          event.preventDefault();
          updateZoom(10, container.clientWidth / 2, container.clientHeight / 2);
          break;
        case '-':
          event.preventDefault();
          updateZoom(-10, container.clientWidth / 2, container.clientHeight / 2);
          break;
        case ' ':
          event.preventDefault();
          isPanMode = !isPanMode;
          break;
        case 'Escape':
          isDragging = false;
          isPanMode = false;
          break;
      }
    }
  
    function navigateNodes(direction: string) {
      // Implementation for keyboard navigation between nodes
      // This will need to be implemented based on your navigation requirements
    }
  
    onMount(() => {
      updateLayout(true);
      window.addEventListener('resize', () => updateLayout(true));
    });
  
    onDestroy(() => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', () => updateLayout(true));
    });
  
    $: if (sortMode) updateLayout();
  </script>
  
  <div 
    class="visualization-container"
    role="application"
    aria-label="Interactive word definition graph"
    tabindex="-1"
  >
    <!-- Screen reader description -->
    <div class="sr-only">
      Interactive graph view showing word definitions. Use arrow keys to navigate between nodes, 
      plus and minus to zoom, and space to toggle pan mode. When pan mode is active, use the mouse to drag the view.
    </div>
  
    <!-- Status updates -->
    <div 
      class="visualization-status" 
      aria-live="polite"
    >
      {statusText}
    </div>
  
    <!-- Main interactive area -->
    <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div 
      class="graph-viewport"
      bind:this={container}
      on:mousedown={handleMouseDown}
      on:mousemove={handleMouseMove}
      on:mouseup={handleMouseUp}
      on:mouseleave={handleMouseUp}
      on:wheel={handleWheel}
      on:keydown={handleKeyboardNavigation}
      tabindex="0"
      aria-roledescription="Graph viewport"
    >
      <div 
        class="nodes-container"
        style="transform: translate({panX}px, {panY}px) scale({zoom / 100})"
      >
        <!-- Center word node -->
        <div 
          class="node center-node"
          style="transform: translate({positions.get('center')?.x ?? 0}px, {positions.get('center')?.y ?? 0}px) scale({positions.get('center')?.scale ?? 1})"
        >
          <WordNodeDisplay {wordData} />
        </div>
  
        <!-- Alternative definition nodes -->
        {#each alternativeDefinitions as definition}
          {#if positions.has(definition.id)}
            {@const position = positions.get(definition.id)}
            <div 
              class="node alt-node"
              style="transform: translate({position?.x ?? 0}px, {position?.y ?? 0}px) scale({position?.scale ?? 1})"
            >
              <AlternativeDefinitionNodeDisplay 
                word={wordData.word}
                {definition}
              />
            </div>
          {/if}
        {/each}
      </div>
    </div>
  
    <!-- Keyboard controls overlay -->
    <div class="keyboard-controls" aria-hidden="true">
      <kbd>↑↓←→</kbd> Navigate 
      <kbd>+/-</kbd> Zoom
      <kbd>Space</kbd> Toggle pan mode
    </div>
  </div>
  
  <style>
    .visualization-container {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }
  
    .graph-viewport {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      user-select: none;
    }
  
    .nodes-container {
      position: absolute;
      top: 50%;
      left: 50%;
      transform-origin: center center;
      will-change: transform;
    }
  
    .node {
      position: absolute;
      transform-origin: center center;
      transition: transform 0.5s ease-out;
    }
  
    .center-node {
      z-index: 2;
    }
  
    .alt-node {
      z-index: 1;
    }
  
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  
    .visualization-status {
      position: absolute;
      top: 1rem;
      left: 1rem;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.9rem;
    }
  
    .keyboard-controls {
      position: absolute;
      bottom: 1rem;
      left: 1rem;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.9rem;
    }
  
    kbd {
      background: rgba(255, 255, 255, 0.1);
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      margin: 0 0.2rem;
    }
  </style>