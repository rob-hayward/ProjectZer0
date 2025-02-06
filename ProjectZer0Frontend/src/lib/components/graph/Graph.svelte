<!-- src/lib/components/graph/Graph.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as d3 from 'd3';
    import type { GraphData, ViewType } from '$lib/types/graph/core';
    import type { BackgroundConfig } from '$lib/types/graph/background';
    import { DEFAULT_BACKGROUND_CONFIG } from '$lib/types/graph/background';
    import { SvgBackground } from './backgrounds/SvgBackground';
    import GraphLayout from './layouts/GraphLayout.svelte';
    import { DIMENSIONS } from '$lib/constants/graph';

    // Props
    export let data: GraphData;
    export let width = DIMENSIONS.WIDTH;
    export let height = DIMENSIONS.HEIGHT;
    export let viewType: ViewType;
    export let backgroundConfig: Partial<BackgroundConfig> = {};
    export let isPreviewMode = false;

    // DOM refs
    let container: HTMLDivElement;
    let svg: SVGSVGElement;
    let backgroundGroup: SVGGElement;
    let contentGroup: SVGGElement;
    
    // Component state
    let background: SvgBackground | null = null;
    let initialTransform: d3.ZoomTransform;
    let resetZoom: (() => void) | undefined;
    let dimensions = {
        width,
        height,
        viewBox: `${-width/2} ${-height/2} ${width} ${height}`
    };

    const mergedConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };
    
    function updateDimensions() {
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const containerWidth = Math.max(rect.width, 1000);
        const containerHeight = Math.max(rect.height, 800);
        
        if (dimensions.width !== containerWidth || dimensions.height !== containerHeight) {
            dimensions = {
                width: containerWidth as typeof DIMENSIONS.WIDTH,
                height: containerHeight as typeof DIMENSIONS.HEIGHT,
                viewBox: `${-containerWidth/2} ${-containerHeight/2} ${containerWidth} ${containerHeight}`
            };
            
            if (background) {
                background.resize(containerWidth, containerHeight);
            }

            console.log('Dimensions updated:', dimensions);
        }
    }

    function initializeBackground() {
        if (!backgroundGroup) {
            console.log('No background group found');
            return;
        }
        
        if (background) {
            background.destroy();
        }

        try {
            background = new SvgBackground(
                backgroundGroup, 
                dimensions.width, 
                dimensions.height,
                mergedConfig
            );
            background.start();
        } catch (error) {
            console.error('Error initializing background:', error);
        }
    }

    function initializeZoom() {
        if (!svg || !contentGroup) return;

        // Initialize with identity transform since viewBox is already centered
        initialTransform = d3.zoomIdentity.scale(1);

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                d3.select(contentGroup)
                    .attr('transform', event.transform.toString());
                
                console.log('Zoom event:', {
                    type: event.sourceEvent?.type,
                    transform: event.transform
                });
            });

        // Apply zoom behavior
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

    onMount(() => {
        console.log('Graph mounting with data:', data);
        
        updateDimensions();
        
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateDimensions);
            
            if (dimensions.width && dimensions.height) {
                initializeBackground();
                initializeZoom();
            }
        }
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', updateDimensions);
        }
        if (background) {
            background.destroy();
        }
    });

    // Reactive statements
    $: if (data) {
        console.log('Graph data updated:', data);
    }

    $: if (dimensions.width && dimensions.height) {
        updateDimensions();
    }
</script>

<div bind:this={container} class="graph-container">
    <svg 
        bind:this={svg}
        width={dimensions.width} 
        height={dimensions.height}
        viewBox={dimensions.viewBox}
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
                {data}
                width={dimensions.width}
                height={dimensions.height}
                {viewType}
                {isPreviewMode}
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