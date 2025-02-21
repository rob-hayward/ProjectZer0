<!-- src/lib/components/graph/Graph.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import * as d3 from 'd3';
    import type { GraphData, ViewType } from '$lib/types/graph/core';
    import type { BackgroundConfig } from '$lib/types/graph/background';
    import type { NodeMode } from '$lib/types/nodes';
    import { DEFAULT_BACKGROUND_CONFIG } from '$lib/types/graph/background';
    import { SvgBackground } from './backgrounds/SvgBackground';
    import GraphLayout from './layouts/GraphLayout.svelte';
    import { COORDINATE_SPACE } from '$lib/constants/graph';

    // Props
    export let data: GraphData;
    export let viewType: ViewType;
    export let backgroundConfig: Partial<BackgroundConfig> = {};
    export let isPreviewMode = false;

    // Event dispatch
    const dispatch = createEventDispatcher();

    // DOM refs
    let container: HTMLDivElement;
    let svg: SVGSVGElement;
    let backgroundGroup: SVGGElement;
    let contentGroup: SVGGElement;
    let graphLayout: GraphLayout;
    
    // Component state
    let background: SvgBackground | null = null;
    let initialTransform: d3.ZoomTransform;
    let resetZoom: (() => void) | undefined;
    let containerDimensions = {
        width: 0,
        height: 0
    };

    // Constant world dimensions from COORDINATE_SPACE
    const worldDimensions = {
        width: COORDINATE_SPACE.WORLD.WIDTH,
        height: COORDINATE_SPACE.WORLD.HEIGHT,
        viewBox: `${-COORDINATE_SPACE.WORLD.WIDTH/2} ${-COORDINATE_SPACE.WORLD.HEIGHT/2} ${COORDINATE_SPACE.WORLD.WIDTH} ${COORDINATE_SPACE.WORLD.HEIGHT}`
    };

    const mergedConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };
    
    function updateContainerDimensions() {
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        containerDimensions = {
            width: rect.width,
            height: rect.height
        };
        
        if (background) {
            background.resize(rect.width, rect.height);
        }
    }

    function initializeBackground() {
        if (!backgroundGroup) return;
        
        if (background) {
            background.destroy();
        }

        try {
            background = new SvgBackground(
                backgroundGroup, 
                containerDimensions.width, 
                containerDimensions.height,
                mergedConfig
            );
            background.start();
        } catch (error) {
            console.error('[Graph] Error initializing background:', error);
        }
    }

    function initializeZoom() {
        if (!svg || !contentGroup) return;

        initialTransform = d3.zoomIdentity
            .scale(COORDINATE_SPACE.WORLD.VIEW.INITIAL_ZOOM);

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([
                COORDINATE_SPACE.WORLD.VIEW.MIN_ZOOM,
                COORDINATE_SPACE.WORLD.VIEW.MAX_ZOOM
            ])
            .on('zoom', (event) => {
                const transform = event.transform.toString();
                d3.select(contentGroup).attr('transform', transform);
                d3.select(backgroundGroup).attr('transform', transform);
            });

        d3.select(svg)
            .call(zoom)
            .call(zoom.transform, initialTransform)
            .on('contextmenu', (event) => event.preventDefault());

        resetZoom = () => {
            d3.select(svg)
                .transition()
                .duration(750)
                .call(zoom.transform, initialTransform);
        };
    }

    function handleModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        dispatch('modechange', event.detail);
    }

    onMount(() => {
        updateContainerDimensions();
        
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateContainerDimensions);
            
            if (containerDimensions.width && containerDimensions.height) {
                initializeBackground();
                initializeZoom();
            }
        }
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', updateContainerDimensions);
        }
        if (background) {
            background.destroy();
        }
    });

    $: if (containerDimensions.width && containerDimensions.height) {
        updateContainerDimensions();
    }
</script>

<div bind:this={container} class="graph-container">
    <svg 
        bind:this={svg}
        width="100%"
        height="100%"
        viewBox={worldDimensions.viewBox}
        preserveAspectRatio="xMidYMid meet"
        class="graph-svg"
    >
        <defs>
            <!-- Add filters or patterns here -->
        </defs>

        <g class="background-layer">
            <svg 
                width="100%"
                height="100%"
                overflow="visible"
            >
                <g bind:this={backgroundGroup} />
            </svg>
        </g>

        <g 
            bind:this={contentGroup} 
            class="content-layer"
        >
            <GraphLayout
                bind:this={graphLayout}
                {data}
                width={COORDINATE_SPACE.WORLD.WIDTH}
                height={COORDINATE_SPACE.WORLD.HEIGHT}
                {viewType}
                {isPreviewMode}
                on:modechange={handleModeChange}
            >
                <svelte:fragment let:node let:position let:handleNodeModeChange>
                    <slot {node} transform={position.svgTransform} {handleNodeModeChange} />
                </svelte:fragment>
            </GraphLayout>
        </g>
    </svg>

    {#if resetZoom}
        <button
            class="reset-button"
            on:click={resetZoom}
            aria-label="Reset view"
        >
            <span class="material-symbols-outlined">restart_alt</span>
        </button>
    {/if}
</div>

<style>
    .graph-container {
        width: 100%;
        height: 100vh;
        background: black;
        overflow: hidden;
        position: relative;
    }

    .graph-svg {
        width: 100%;
        height: 100%;
        cursor: grab;
        touch-action: none;
        position: absolute;
    }

    .graph-svg:active {
        cursor: grabbing;
    }

    .background-layer {
        pointer-events: none;
    }

    .content-layer {
        pointer-events: all;
    }

    :global(.graph-svg *) {
        transform-box: fill-box;
        transform-origin: 50% 50%;
    }

    .reset-button {
        position: absolute;
        bottom: 1rem;
        right: 1rem;
        background-color: transparent;
        border: none;
        border-radius: 50%;
        width: 2.5rem;
        height: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        z-index: 50;
    }

    .reset-button:hover {
        transform: translateY(-1px);
    }

    .reset-button:active {
        transform: translateY(0);
    }

    .reset-button :global(.material-symbols-outlined) {
        color: white;
        font-size: 2.25rem;
    }
</style>