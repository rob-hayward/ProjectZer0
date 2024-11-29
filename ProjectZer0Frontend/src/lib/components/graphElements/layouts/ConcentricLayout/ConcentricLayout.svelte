<!-- src/lib/components/graphElements/layouts/ConcentricLayout/ConcentricLayout.svelte -->
<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
    import type { WordNode, Definition } from '$lib/types/nodes';
    import type { 
        ConcentricLayoutConfig, 
        NodeLayoutMetadata, 
        SortMode,
        ConcentricNodePosition,
        NodeType,
        ConcentricLayoutProps
    } from '$lib/types/layout';
    import { 
        calculateNodePositions,
        calculateTransitionPositions 
    } from '$lib/services/layout/concentricPositioning';
    import WordNodePreview from '../../nodes/previews/WordNodePreview.svelte';
    import LiveDefinitionPreview from '../../nodes/previews/LiveDefinitionPreview.svelte';
    import AlternativeDefinitionPreview from '../../nodes/previews/AlternativeDefinitionPreview.svelte';
  
    // Props
    export let wordData: ConcentricLayoutProps['wordData'];
    export let sortMode: ConcentricLayoutProps['sortMode'] = 'popular';
  
    // Constants
    const PAN_SPEED = 20;
  
    // Internal state
    let container: HTMLElement;
    let positions = new Map<string, ConcentricNodePosition>();
    let isTransitioning = false;
    let animationFrame: number;
    let transitionStartTime: number;
    let startPositions: Map<string, ConcentricNodePosition>;
    let targetPositions: Map<string, ConcentricNodePosition>;
    let isPanning = false;
    let panDirection = '';
  
    // View state
    let zoom = 100;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
  
    // Configuration
    const config: ConcentricLayoutConfig = {
        centerRadius: 100,
        ringSpacing: 150,
        minNodeSize: 100,
        maxNodeSize: 150,
        initialZoom: 0.8,
        minZoom: 0.5,
        maxZoom: 2
    };

    // Derived values for live and alternative definitions
    $: liveDefinition = getLiveDefinition(wordData.definitions);
    $: alternativeDefinitions = getAlternativeDefinitions(wordData.definitions, liveDefinition?.id);
    
    // Status text for screen readers
    $: statusText = `${zoom}% zoom, viewing word "${wordData.word}" with ${alternativeDefinitions.length + 1} definitions`;
    
    function getVoteValue(votes: any): number {
        if (typeof votes === 'number') return votes;
        if (votes && typeof votes === 'object' && 'low' in votes) {
            return votes.low;
        }
        return 0;
    }

    function getLiveDefinition(definitions: Definition[]): Definition | null {
        if (!definitions || definitions.length === 0) return null;
        return [...definitions]
            .sort((a, b) => getVoteValue(b.votes) - getVoteValue(a.votes))[0];
    }

    function getAlternativeDefinitions(definitions: Definition[], liveDefId: string | undefined): Definition[] {
        if (!definitions || !liveDefId) return [];
        return definitions.filter(def => def.id !== liveDefId);
    }

    function createNodeMetadata(): {
        center: NodeLayoutMetadata;
        alternatives: NodeLayoutMetadata[];
    } {
        const center: NodeLayoutMetadata = {
            id: 'center',
            timestamp: new Date(wordData.createdAt),
            votesCount: 0,
            size: config.maxNodeSize,
            nodeType: 'word',
            position: {
                x: 0,
                y: 0,
                scale: 1,
                ring: 0,
                ringPosition: 0,
                distanceFromCenter: 0
            }
        };
  
        const alternatives: NodeLayoutMetadata[] = [];

        // Add live definition first
        if (liveDefinition) {
            alternatives.push({
                id: liveDefinition.id,
                timestamp: new Date(liveDefinition.createdAt),
                votesCount: getVoteValue(liveDefinition.votes),
                size: config.minNodeSize,
                nodeType: 'liveDefinition',
                position: {
                    x: 0,
                    y: 0,
                    scale: 1,
                    ring: 1,
                    ringPosition: 0,
                    distanceFromCenter: 0
                }
            });
        }

        // Add alternative definitions
        alternativeDefinitions.forEach((def) => {
            alternatives.push({
                id: def.id,
                timestamp: new Date(def.createdAt),
                votesCount: getVoteValue(def.votes),
                size: config.minNodeSize,
                nodeType: 'alternativeDefinition',
                position: {
                    x: 0,
                    y: 0,
                    scale: 1,
                    ring: 2,
                    ringPosition: 0,
                    distanceFromCenter: 0
                }
            });
        });
  
        return { center, alternatives };
    }
  
    async function updateLayout(immediate = false) {
        if (!container) return;
      
        const { center, alternatives } = createNodeMetadata();
        const newPositions = calculateNodePositions(
            center,
            alternatives,
            config,
            sortMode || 'popular',
            container.clientWidth || window.innerWidth,
            container.clientHeight || window.innerHeight
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

    // Mouse and keyboard handlers
    function handleMouseDown(event: MouseEvent) {
        if (event.button === 0) {
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

    function handleKeyboardNavigation(event: KeyboardEvent) {
        switch(event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                panX += PAN_SPEED;
                panDirection = 'left';
                isPanning = true;
                setTimeout(() => isPanning = false, 150);
                break;
            case 'ArrowRight':
                event.preventDefault();
                panX -= PAN_SPEED;
                panDirection = 'right';
                isPanning = true;
                setTimeout(() => isPanning = false, 150);
                break;
            case 'ArrowUp':
                event.preventDefault();
                panY += PAN_SPEED;
                panDirection = 'up';
                isPanning = true;
                setTimeout(() => isPanning = false, 150);
                break;
            case 'ArrowDown':
                event.preventDefault();
                panY -= PAN_SPEED;
                panDirection = 'down';
                isPanning = true;
                setTimeout(() => isPanning = false, 150);
                break;
            case '+':
                event.preventDefault();
                updateZoom(10, container.clientWidth / 2, container.clientHeight / 2);
                break;
            case '-':
                event.preventDefault();
                updateZoom(-10, container.clientWidth / 2, container.clientHeight / 2);
                break;
            case 'Escape':
                isDragging = false;
                isPanning = false;
                break;
        }
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

    onMount(async () => {
        await tick();
        updateLayout(true);
        window.addEventListener('resize', () => updateLayout(true));
    });

    onDestroy(() => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        window.removeEventListener('resize', () => updateLayout(true));
    });

    $: if (sortMode && container) updateLayout();
</script>

<div 
    class="visualization-container"
    role="application"
    aria-label="Interactive word definition graph"
    tabindex="-1"
>
    <div class="sr-only">
        Interactive graph view showing word definitions. Use arrow keys to pan the view, 
        plus and minus to zoom. Click nodes to view details.
    </div>

    <div class="visualization-status" aria-live="polite">
        {statusText}
    </div>

    <div 
        class="graph-viewport"
        class:is-panning={isPanning}
        data-pan-direction={panDirection}
        bind:this={container}
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseleave={handleMouseUp}
        on:wheel={handleWheel}
        on:keydown={handleKeyboardNavigation}
        role="presentation"
        aria-roledescription="Graph viewport"
    >
        <div 
            class="nodes-container"
            style="transform: translate(calc(-50% + {panX}px), calc(-50% + {panY}px)) scale({zoom / 100})"
        >
            <!-- Center word node -->
            <div 
                class="node center-node"
                style="transform: translate({positions.get('center')?.x ?? 0}px, {positions.get('center')?.y ?? 0}px) scale({positions.get('center')?.scale ?? 1})"
            >
                <WordNodePreview {wordData} />
            </div>

            <!-- Live definition -->
            {#if liveDefinition && positions.has(liveDefinition.id)}
                <div 
                    class="node live-definition-node"
                    style="transform: translate({positions.get(liveDefinition.id)?.x ?? 0}px, {positions.get(liveDefinition.id)?.y ?? 0}px) scale({positions.get(liveDefinition.id)?.scale ?? 1})"
                >
                    <LiveDefinitionPreview 
                        definition={liveDefinition}
                        word={wordData.word}
                    />
                </div>
            {/if}

            <!-- Alternative definitions -->
            {#each alternativeDefinitions as definition}
                {#if positions.has(definition.id)}
                    {@const position = positions.get(definition.id)}
                    <div 
                        class="node alt-node"
                        style="transform: translate({position?.x ?? 0}px, {position?.y ?? 0}px) scale({position?.scale ?? 1})"
                    >
                        <AlternativeDefinitionPreview
                            definition={definition}
                            word={wordData.word}
                        />
                    </div>
                {/if}
            {/each}
        </div>
    </div>

    <div class="keyboard-controls" aria-hidden="true">
        <kbd>↑↓←→</kbd> Pan view
        <kbd>+/-</kbd> Zoom
    </div>
</div>

<style>
    .visualization-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.2);
    }

    .graph-viewport {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        user-select: none;
    }

    .graph-viewport.is-panning {
        transition: background-color 0.15s ease-out;
        background-color: rgba(255, 255, 255, 0.05);
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
        z-index: 3;
    }

    .live-definition-node {
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