<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { calculateWordNodePositions, calculateTransitionPositions } from './wordConcentricPositioning';
    import type { 
        ConcentricLayoutProps, 
        NodePosition, 
        ConcentricNodePosition, 
        NodeType,
        SortMode 
    } from '$lib/types/layout';
    import type { Definition } from '$lib/types/nodes';
    import WordNodePreview from '../../../nodes/previews/WordNodePreview.svelte';
    import LiveDefinitionPreview from '../../../nodes/previews/LiveDefinitionPreview.svelte';
    import AlternativeDefinitionPreview from '../../../nodes/previews/AlternativeDefinitionPreview.svelte';
    import { LAYOUT_CONSTANTS, DEFAULT_CONFIG } from '../base/concentricPositioning';
    import { ZoomBackground } from '../../../backgrounds/ZoomBackground';
    import ZoomNodeCanvas from '../../../nodes/zoomNode/ZoomNodeCanvas.svelte';
    // Props
    export let wordData: ConcentricLayoutProps['wordData'];
    export let sortMode: ConcentricLayoutProps['sortMode'] = 'popular';
    
    // Container refs
    let container: HTMLDivElement;
    let nodesContainer: HTMLDivElement;
    
    // Background state
    let networkBg: ZoomBackground | null = null;
    let time = 0;
    
    // State
    let positions = new Map<string, ConcentricNodePosition>();
    let isTransitioning = false;
    let rafId: number | null = null;
    
    // View state
    let zoom = LAYOUT_CONSTANTS.INITIAL_ZOOM as number;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let containerCenter = { x: 0, y: 0 };
    
    // Status text for accessibility and info
    $: statusText = `${Math.round(zoom)}% zoom, viewing word "${wordData.word}" with ${wordData.definitions.length} definitions`;

    function drawBackground(ctx: CanvasRenderingContext2D, mouseX: number, mouseY: number) {
        time += 0.01;
        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height / 2;

        if (!networkBg) {
            networkBg = new ZoomBackground(35, ctx.canvas.width, ctx.canvas.height);
        }
        networkBg.update(ctx.canvas.width, ctx.canvas.height);
        networkBg.draw(ctx);
    }
    
    // Helper functions
    function getVoteValue(votes: any): number {
        if (typeof votes === 'number') return votes;
        return votes?.low ?? 0;
    }
    
    function getLiveDefinition(definitions: Definition[]): Definition | null {
        if (!definitions?.length) return null;
        return [...definitions].sort((a, b) => getVoteValue(b.votes) - getVoteValue(a.votes))[0];
    }
    
    function getAlternativeDefinitions(definitions: Definition[], liveDefId?: string): Definition[] {
        if (!definitions?.length) return [];
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
    
    // Layout management
    async function updateLayout(immediate = false) {
        if (!container) return;
    
        const liveDefinition = getLiveDefinition(wordData.definitions);
        const alternativeDefinitions = getAlternativeDefinitions(
            wordData.definitions,
            liveDefinition?.id
        );
    
        const newPositions = calculateWordNodePositions(
            {
                id: wordData.id,
                timestamp: new Date(wordData.createdAt),
                votesCount: wordData.positiveVotes - wordData.negativeVotes,
                size: LAYOUT_CONSTANTS.WORD_NODE_SIZE,
                nodeType: 'word' as NodeType,
                position: { x: 0, y: 0, scale: 1, ring: 0, ringPosition: 0, distanceFromCenter: 0 }
            },
            [
                ...(liveDefinition ? [{
                    id: liveDefinition.id,
                    timestamp: new Date(liveDefinition.createdAt),
                    votesCount: getVoteValue(liveDefinition.votes),
                    size: LAYOUT_CONSTANTS.DEFINITION_NODE_SIZE,
                    nodeType: 'liveDefinition' as NodeType,
                    position: { x: 0, y: 0, scale: 1, ring: 1, ringPosition: 0, distanceFromCenter: 0 }
                }] : []),
                ...alternativeDefinitions.map((def, index) => ({
                    id: def.id,
                    timestamp: new Date(def.createdAt),
                    votesCount: getVoteValue(def.votes),
                    size: LAYOUT_CONSTANTS.DEFINITION_NODE_SIZE,
                    nodeType: 'alternativeDefinition' as NodeType,
                    position: { x: 0, y: 0, scale: 1, ring: 2, ringPosition: index, distanceFromCenter: 0 }
                }))
            ],
            sortMode || 'popular',
            container.clientWidth,
            container.clientHeight
        );
    
        if (immediate || !positions.size) {
            positions = newPositions;
        } else {
            startTransition(positions, newPositions);
        }
    }
    
    // Animation handling
    function startTransition(from: Map<string, ConcentricNodePosition>, to: Map<string, ConcentricNodePosition>) {
        isTransitioning = true;
        const startTime = performance.now();
    
        function animate(currentTime: number) {
            const progress = Math.min(1, (currentTime - startTime) / 750);
            positions = calculateTransitionPositions(from, to, progress);
    
            if (progress < 1) {
                rafId = requestAnimationFrame(animate);
            } else {
                isTransitioning = false;
                rafId = null;
            }
        }
    
        rafId = requestAnimationFrame(animate);
    }
    
    // View control functions
    function resetView() {
        updateContainerCenter();
        panX = 0;
        panY = 0;
        zoom = LAYOUT_CONSTANTS.INITIAL_ZOOM as number;
    }
    
    // Interaction handlers
    function handleMouseDown(event: MouseEvent) {
        if (event.button === 0 && !isTransitioning) {
            isDragging = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
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
        if (isTransitioning) return;
    
        const rect = container.getBoundingClientRect();
        const mouseX = event.clientX - rect.left - containerCenter.x;
        const mouseY = event.clientY - rect.top - containerCenter.y;
        
        const oldZoom = zoom;
        const zoomDelta = -event.deltaY * 0.5;
        const newZoom = Math.max(
            LAYOUT_CONSTANTS.MIN_ZOOM as number,
            Math.min(LAYOUT_CONSTANTS.MAX_ZOOM as number, oldZoom + zoomDelta)
        );
        
        if (newZoom !== oldZoom) {
            const scale = newZoom / oldZoom;
            panX = mouseX - (mouseX - panX) * scale;
            panY = mouseY - (mouseY - panY) * scale;
            zoom = newZoom;
        }
    }
    
    // Lifecycle
    onMount(() => {
        updateContainerCenter();
        updateLayout(true);
        window.addEventListener('resize', () => {
            updateContainerCenter();
            updateLayout(true);
        });
    });
    
    onDestroy(() => {
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('resize', () => {
            updateContainerCenter();
            updateLayout(true);
        });
    });
    
    $: if (sortMode) updateLayout();
</script>

<div class="visualization-container">
    <!-- Background layer -->
    <div class="background-layer">
        <ZoomNodeCanvas
            draw={drawBackground}
            backgroundColor="black"
        />
    </div>

    <!-- Status and controls overlay -->
    <div class="controls-overlay">
        <div class="status-text" role="status">
            {statusText}
        </div>
        <div class="controls-info">
            <span>Mouse wheel to zoom</span>
            <span>Drag to pan</span>
            <button 
                class="reset-button"
                on:click={resetView}
            >
                Reset View
            </button>
        </div>
    </div>

    <!-- Main layout container -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class="layout-container"
        bind:this={container}
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseleave={handleMouseUp}
        on:wheel={handleWheel}
    >
        <div
            class="nodes-container"
            bind:this={nodesContainer}
            style="transform: translate3d({containerCenter.x + panX}px, {containerCenter.y + panY}px, 0) scale({zoom/100})"
        >
            <!-- Word Node -->
            {#if positions.has(wordData.id)}
                {@const pos = positions.get(wordData.id)}
                <div
                    class="node word-node"
                    style="transform: translate(-50%, -50%) translate3d({pos?.x}px, {pos?.y}px, 0) scale({pos?.scale ?? 1})"
                >
                    <WordNodePreview {wordData} />
                </div>
            {/if}

            <!-- Live Definition -->
            {#if getLiveDefinition(wordData.definitions)}
                {@const def = getLiveDefinition(wordData.definitions)}
                {#if def && positions.has(def.id)}
                    {@const pos = positions.get(def.id)}
                    <div
                        class="node definition-node"
                        style="transform: translate(-50%, -50%) translate3d({pos?.x}px, {pos?.y}px, 0) scale({pos?.scale ?? 1})"
                    >
                        <LiveDefinitionPreview
                            definition={def}
                            word={wordData.word}
                        />
                    </div>
                {/if}
            {/if}

            <!-- Alternative Definitions -->
            {#each getAlternativeDefinitions(wordData.definitions, getLiveDefinition(wordData.definitions)?.id) as def (def.id)}
                {#if positions.has(def.id)}
                    {@const pos = positions.get(def.id)}
                    <div
                        class="node definition-node"
                        style="transform: translate(-50%, -50%) translate3d({pos?.x}px, {pos?.y}px, 0) scale({pos?.scale ?? 1})"
                    >
                        <AlternativeDefinitionPreview
                            definition={def}
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
        width: 100vw;
        height: 100vh;
        position: relative;
        overflow: hidden;
    }

    .background-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
    }

    .controls-overlay {
        position: absolute;
        top: 1rem;
        left: 1rem;
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .status-text {
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
    }

    .controls-info {
        background: rgba(0, 0, 0, 0.7);
        color: rgba(255, 255, 255, 0.8);
        padding: 0.5rem 1rem;
        border-radius: 4px;
        font-size: 0.8rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .reset-button {
        background: rgba(74, 144, 226, 0.3);
        border: 1px solid rgba(74, 144, 226, 0.4);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.8rem;
        transition: all 0.2s;
    }

    .reset-button:hover {
        background: rgba(74, 144, 226, 0.4);
    }

    .layout-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
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
        transform-origin: center;
        transition: transform 0.3s ease;
    }

    .word-node {
        z-index: 3;
    }

    .definition-node {
        z-index: 2;
    }
</style>