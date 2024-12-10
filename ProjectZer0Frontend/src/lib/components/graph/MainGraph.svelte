<!-- src/lib/components/graph/MainGraph.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import type { GraphNode, GraphEdge } from '$lib/types/graph';
    import type { SvgLayoutConfig } from '$lib/types/svgLayout';
    import SvgConcentricLayout from './layouts/SvgConcentricLayout.svelte';
    import { SvgBackground } from './backgrounds/SvgBackground';
    import type { BackgroundConfig } from './backgrounds/backgroundConfig';
    import { DEFAULT_BACKGROUND_CONFIG } from './backgrounds/backgroundConfig';

    export let nodes: GraphNode[];
    export let edges: GraphEdge[];
    export let config: Partial<SvgLayoutConfig> = {};
    export let backgroundConfig: Partial<BackgroundConfig> = {};

    const mergedConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };

    const dispatch = createEventDispatcher<{
        nodeClick: { node: GraphNode };
        nodeHover: { node: GraphNode; isHovered: boolean };
        detailView: { node: GraphNode };
    }>();

    let container: HTMLDivElement;
    let containerWidth: number;
    let containerHeight: number;

    // Background elements
    let backgroundSvg: SVGSVGElement;
    let backgroundGroup: SVGGElement;
    let background: SvgBackground | null = null;

    function updateDimensions() {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        containerWidth = rect.width;
        containerHeight = rect.height;
        
        if (background) {
            background.resize(containerWidth, containerHeight);
        }
    }

    // In MainGraph.svelte
    function initializeBackground() {
        if (!browser || !backgroundGroup) return;
        background = new SvgBackground(
            backgroundGroup, 
            containerWidth, 
            containerHeight,
            
        );
        if (background) {
            background.start();
        }
    }

    function handleNodeClick(event: CustomEvent<{ node: GraphNode }>) {
        dispatch('nodeClick', event.detail);
    }

    function handleNodeHover(event: CustomEvent<{ node: GraphNode; isHovered: boolean }>) {
        dispatch('nodeHover', event.detail);
    }

    function handleDetailView(event: CustomEvent<{ node: GraphNode }>) {
        dispatch('detailView', event.detail);
    }

    onMount(() => {
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        if (containerWidth && containerHeight) {
            initializeBackground();
        }
    });

    onDestroy(() => {
        window.removeEventListener('resize', updateDimensions);
        if (background) {
            background.destroy();
        }
    });

    $: viewBox = containerWidth ? 
        `${containerWidth * mergedConfig.viewport.origin.x} ${containerHeight * mergedConfig.viewport.origin.y} ${containerWidth * mergedConfig.viewport.scale} ${containerHeight * mergedConfig.viewport.scale}` : 
        '0 0 100 100';
</script>

<div 
    class="main-graph"
    bind:this={container}
>
    <svg 
        bind:this={backgroundSvg}
        class="background-svg"
        width="100%"
        height="100%"
        {viewBox}
        preserveAspectRatio={mergedConfig.viewport.preserveAspectRatio}
    >
        <g 
            bind:this={backgroundGroup}
            class="background-group"
        />
    </svg>

    {#if nodes && edges && containerWidth && containerHeight}
        <SvgConcentricLayout 
            {nodes}
            {edges}
            {config}
            on:nodeClick={handleNodeClick}
            on:nodeHover={handleNodeHover}
            on:detailView={handleDetailView}
        >
            <svelte:fragment slot="default" let:node let:position>
                <slot 
                    name="node" 
                    {node}
                    {position}
                />
            </svelte:fragment>

            <svelte:fragment slot="edge" let:edge>
                <slot name="edge" {edge} />
            </svelte:fragment>
        </SvgConcentricLayout>
    {/if}
</div>

<style>
    .main-graph {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        background-color: black;
    }

    .background-svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        pointer-events: none;
        overflow: visible;
    }

    :global(.main-graph svg) {
        width: 100%;
        height: 100%;
    }

    :global(.main-graph .node) {
        transition: transform 0.3s ease-out;
    }

    :global(.main-graph .edge) {
        pointer-events: none;
    }

    :global(.main-graph .control-button) {
        background: rgba(0, 0, 0, 0.7);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        padding: 0.5rem;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
        transition: all 0.2s ease-out;
    }

    :global(.main-graph .control-button:hover) {
        background: rgba(0, 0, 0, 0.8);
        border-color: rgba(255, 255, 255, 0.4);
    }
</style>