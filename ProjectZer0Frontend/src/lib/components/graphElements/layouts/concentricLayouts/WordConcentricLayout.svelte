<!-- ProjectZer0Frontend/src/lib/components/graphElements/layouts/concentricLayouts/WordConcentricLayout.svelte -->
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
    } from '$lib/components/graphElements/layouts/concentricLayouts/base/concentricPositioning';
    import WordNodePreview from '../../nodes/previews/WordNodePreview.svelte';
    import LiveDefinitionPreview from '../../nodes/previews/LiveDefinitionPreview.svelte';
    import AlternativeDefinitionPreview from '../../nodes/previews/AlternativeDefinitionPreview.svelte';
  
    // Props
    export let wordData: ConcentricLayoutProps['wordData'];
    export let sortMode: ConcentricLayoutProps['sortMode'] = 'popular';
  
    // Constants
    const PAN_SPEED = 20;
    const WORD_NODE_SIZE = 150;
    const DEFINITION_NODE_SIZE = 130;
    const MIN_ZOOM = 50;
    const MAX_ZOOM = 200;
    const INITIAL_ZOOM = 100;
    const BASE_RING_SPACING = 60;
    const SPACING_MULTIPLIER = 0.5;
  
    // Internal state
    let container: HTMLElement;
    let nodesContainer: HTMLElement;
    let positions = new Map<string, ConcentricNodePosition>();
    let isTransitioning = false;
    let animationFrame: number | null = null;
    let transitionStartTime: number;
    let startPositions: Map<string, ConcentricNodePosition>;
    let targetPositions: Map<string, ConcentricNodePosition>;
    let isPanning = false;
    let panDirection = '';
  
    // View state with proper initialization
    let zoom = INITIAL_ZOOM;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let containerCenter = { x: 0, y: 0 };
  
    // Configuration with dynamic spacing
    const config: ConcentricLayoutConfig = {
        centerRadius: WORD_NODE_SIZE / 2,
        ringSpacing: BASE_RING_SPACING * SPACING_MULTIPLIER,
        minNodeSize: DEFINITION_NODE_SIZE,
        maxNodeSize: WORD_NODE_SIZE,
        initialZoom: INITIAL_ZOOM / 100,
        minZoom: MIN_ZOOM / 100,
        maxZoom: MAX_ZOOM / 100
    };

    // Derived values
    $: liveDefinition = getLiveDefinition(wordData.definitions);
    $: alternativeDefinitions = getAlternativeDefinitions(wordData.definitions, liveDefinition?.id);
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

    function updateContainerCenter() {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        containerCenter = {
            x: rect.width / 2,
            y: rect.height / 2
        };
    }

    function createNodeMetadata(): {
        center: NodeLayoutMetadata;
        alternatives: NodeLayoutMetadata[];
    } {
        updateContainerCenter();
        
        const center: NodeLayoutMetadata = {
            id: 'center',
            timestamp: new Date(wordData.createdAt),
            votesCount: 0,
            size: WORD_NODE_SIZE,
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

        if (liveDefinition) {
            alternatives.push({
                id: liveDefinition.id,
                timestamp: new Date(liveDefinition.createdAt),
                votesCount: getVoteValue(liveDefinition.votes),
                size: DEFINITION_NODE_SIZE,
                nodeType: 'liveDefinition',
                position: {
                    x: 0,
                    y: -config.ringSpacing,
                    scale: 1,
                    ring: 1,
                    ringPosition: 0,
                    distanceFromCenter: config.ringSpacing
                }
            });
        }

        const ringRadius = config.ringSpacing * 1.5;
        alternativeDefinitions.forEach((def, index) => {
            const angle = (index / alternativeDefinitions.length) * 2 * Math.PI;
            alternatives.push({
                id: def.id,
                timestamp: new Date(def.createdAt),
                votesCount: getVoteValue(def.votes),
                size: DEFINITION_NODE_SIZE,
                nodeType: 'alternativeDefinition',
                position: {
                    x: Math.cos(angle) * ringRadius,
                    y: Math.sin(angle) * ringRadius,
                    scale: 1,
                    ring: 2,
                    ringPosition: index / alternativeDefinitions.length,
                    distanceFromCenter: ringRadius
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
            container.clientWidth,
            container.clientHeight
        );
  
        if (immediate || !positions.size) {
            positions = newPositions;
            resetView();
        } else {
            startTransition(positions, newPositions);
        }
    }

    function resetView() {
        panX = 0;
        panY = 0;
        zoom = INITIAL_ZOOM;
        updateContainerCenter();
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
            animationFrame = null;
        }
    }

    function handleMouseDown(event: MouseEvent) {
        if (event.button === 0 && !isTransitioning) {
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
        updatePan(dx, dy);
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    }

    function updatePan(dx: number, dy: number) {
        panX += dx;
        panY += dy;
    }

    function handleMouseUp() {
        isDragging = false;
    }

    function handleWheel(event: WheelEvent) {
        event.preventDefault();
        if (isTransitioning) return;

        const rect = container.getBoundingClientRect();
        const mouseX = event.clientX - rect.left - containerCenter.x;
        const mouseY = event.clientY - rect.top - containerCenter.y;
        
        const zoomDelta = -event.deltaY * 0.5;
        updateZoom(zoomDelta, mouseX, mouseY);
    }

    function updateZoom(delta: number, mouseX: number, mouseY: number) {
        const oldZoom = zoom;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
        
        if (newZoom !== oldZoom) {
            const scale = newZoom / oldZoom;
            panX = mouseX - (mouseX - panX) * scale;
            panY = mouseY - (mouseY - panY) * scale;
            zoom = newZoom;
        }
    }

    onMount(() => {
        async function setup() {
            await tick();
            updateLayout(true);
            
            const resizeObserver = new ResizeObserver(() => {
                updateLayout(true);
            });
            
            resizeObserver.observe(container);
        }

        setup();

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
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
        Interactive graph view showing word definitions. Use arrow keys to pan,
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
        role="presentation"
    >
        <div 
            class="nodes-container"
            bind:this={nodesContainer}
            style="transform: translate3d({containerCenter.x + panX}px, {containerCenter.y + panY}px, 0) scale({zoom / 100})"
        >
            <!-- Center word node -->
            <div class="node word-node">
                <WordNodePreview {wordData} />
            </div>

            <!-- Live definition node -->
            {#if liveDefinition && positions.has(liveDefinition.id)}
                {@const position = positions.get(liveDefinition.id)}
                <div 
                    class="node live-definition-node"
                    style="transform: translate3d(
                        {position?.x ?? 0}px,
                        {position?.y ?? 0}px,
                        0
                    ) translate(-50%, -50%)"
                >
                    <LiveDefinitionPreview 
                        definition={liveDefinition}
                        word={wordData.word}
                    />
                </div>
            {/if}

            <!-- Alternative definition nodes -->
            {#each alternativeDefinitions as definition (definition.id)}
                {#if positions.has(definition.id)}
                    {@const position = positions.get(definition.id)}
                    <div 
                        class="node alternative-node"
                        style="transform: translate3d(
                            {position?.x ?? 0}px,
                            {position?.y ?? 0}px,
                            0
                        ) translate(-50%, -50%)"
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

    .nodes-container {
        position: absolute;
        transform-origin: center;
        will-change: transform;
    }

    .node {
        position: absolute;
        pointer-events: auto;
    }

    .word-node {
        z-index: 3;
        transform: translate(-50%, -50%);
    }

    .live-definition-node {
        z-index: 2;
    }

    .alternative-node {
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
        z-index: 10;
    }
</style>