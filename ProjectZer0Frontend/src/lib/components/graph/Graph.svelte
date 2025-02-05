<!-- src/lib/components/graph/Graph.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as d3 from 'd3';
    import type { GraphData, GraphNode, ViewType } from '$lib/types/graph/core';
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

    let mounted = false;
    let container: HTMLDivElement;
    let svg: SVGSVGElement;
    let backgroundGroup: SVGGElement;
    let contentGroup: SVGGElement;
    let background: SvgBackground | null = null;
    let transform = d3.zoomIdentity;
    let viewBox = '0 0 3000 2400'; // Initial viewBox matching default dimensions
    let resetZoom: (() => void) | undefined;

    const mergedConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };
    
    function updateDimensions() {
        if (!container) return;
        
        // Get container dimensions
        const rect = container.getBoundingClientRect();
        
        // Update dimensions based on container size
        const containerWidth = Math.max(rect.width, 1000); // Minimum width
        const containerHeight = Math.max(rect.height, 800); // Minimum height
        
        // Set dimensions while maintaining aspect ratio
        width = containerWidth as typeof DIMENSIONS.WIDTH;
        height = containerHeight as typeof DIMENSIONS.HEIGHT;
        
        if (background) {
            background.resize(containerWidth, containerHeight);
        }

        console.log('Dimensions updated:', { width, height });
        updateViewBox();
    }

    function initializeBackground() {
        if (!backgroundGroup) {
            console.log('No background group found');
            return;
        }
        
        console.log('Creating background with config:', mergedConfig);
        
        if (background) {
            background.destroy();
        }

        try {
            background = new SvgBackground(
                backgroundGroup, 
                width, 
                height,
                mergedConfig
            );
            console.log('Background created:', background);
            background.start();
        } catch (error) {
            console.error('Error initializing background:', error);
        }
    }

    function initializeZoom() {
        if (!svg || !contentGroup) return;

        console.log('Initializing zoom with dimensions:', {
            width,
            height,
            viewBox,
            transform: transform.toString()
        });

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                console.log('Zoom event:', {
                    type: event.sourceEvent?.type,
                    transform: event.transform,
                    k: event.transform.k,
                    x: event.transform.x,
                    y: event.transform.y
                });
                
                transform = event.transform;
                d3.select(contentGroup)
                    .attr('transform', transform.toString());
            });

        d3.select(svg)
            .call(zoom)
            .call(zoom.transform, d3.zoomIdentity)
            .on('contextmenu', (event) => event.preventDefault());

        resetZoom = () => {
            console.log('Reset zoom triggered');
            d3.select(svg)
                .transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity);
        };
    }

    function updateViewBox() {
        if (!width || !height) {
            console.log('Skipping viewBox update - no dimensions');
            return;
        }
        
        // Calculate centered viewBox
        const originX = -Math.round(width / 2);
        const originY = -Math.round(height / 2);
        const scaledWidth = Math.round(width);
        const scaledHeight = Math.round(height);
        
        viewBox = `${originX} ${originY} ${scaledWidth} ${scaledHeight}`;
        console.log('ViewBox updated:', { originX, originY, scaledWidth, scaledHeight, viewBox });
    }

    onMount(() => {
        console.log('Graph mounting with data:', data);
        mounted = true;
        
        // Initialize dimensions and viewBox
        updateDimensions();
        
        // Set up event listeners and initialize components
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateDimensions);
            
            if (width && height) {
                console.log('Initializing graph with dimensions:', { width, height });
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
    $: {
        if (data) {
            console.log('Graph data updated:', data);
        }
    }

    $: {
        if (mounted && width && height) {
            updateDimensions();
        }
    }
</script>

<div bind:this={container} class="graph-container">
    <svg 
        bind:this={svg}
        {width} 
        {height}
        {viewBox}
        preserveAspectRatio="xMidYMid meet"
        class="graph-svg"
    >
        <defs>
            <!-- Add filters or patterns here -->
        </defs>

        <!-- Background layer with explicit dimensions -->
        <g class="background-layer">
            <svg 
                width="100%"
                height="100%"
                overflow="visible"
            >
                <g bind:this={backgroundGroup} />
            </svg>
        </g>

        <!-- Content layer (gets transformed by zoom) -->
        <g 
            bind:this={contentGroup} 
            class="content-layer"
        >
            <GraphLayout
                {data}
                {width}
                {height}
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