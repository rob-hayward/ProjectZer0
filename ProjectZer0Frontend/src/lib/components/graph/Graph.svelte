<!-- src/lib/components/graph/Graph.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import type { GraphNode, GraphEdge, ViewType } from '$lib/types/graph';
    import GraphLayout from '../graph/layouts/GraphLayout.svelte';
    import Edge from './edges/Edge.svelte';
    import { SvgBackground } from './backgrounds/SvgBackground';
    import type { BackgroundConfig } from './backgrounds/backgroundConfig';
    import { DEFAULT_BACKGROUND_CONFIG } from './backgrounds/backgroundConfig';
 
    export let nodes: GraphNode[] = [];
    export let links: GraphEdge[] = [];
    export let width = window.innerWidth;
    export let height = window.innerHeight;
    export let backgroundConfig: Partial<BackgroundConfig> = {};
    export let isPreviewMode: boolean = false;
    export let viewType: ViewType;
 
    const mergedConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };
    const dispatch = createEventDispatcher();
 
    let container: HTMLDivElement;
    let backgroundSvg: SVGSVGElement;
    let backgroundGroup: SVGGElement;
    let background: SvgBackground | null = null;
    let graphLayout: GraphLayout;
 
    function updateDimensions() {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        
        if (background) {
            background.resize(width, height);
        }
    }
 
    function initializeBackground() {
        if (!browser || !backgroundGroup) return;
        background = new SvgBackground(
            backgroundGroup, 
            width, 
            height
        );
        if (background) {
            background.start();
        }
    }
 
    function handleReset() {
        if (graphLayout) {
            graphLayout.resetView();
        }
    }
 
    onMount(() => {
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        if (width && height) {
            initializeBackground();
        }
    });
 
    onDestroy(() => {
        window.removeEventListener('resize', updateDimensions);
        if (background) {
            background.destroy();
        }
    });

    $: if (isPreviewMode !== undefined) {
        console.log('Graph.svelte - Preview mode changed:', isPreviewMode);
        if (graphLayout) {
            setTimeout(() => {
                graphLayout.resetView();
            }, 0);
        }
    }
 
    $: viewBox = width ? 
        `${width * mergedConfig.viewport.origin.x} ${height * mergedConfig.viewport.origin.y} ${width * mergedConfig.viewport.scale} ${height * mergedConfig.viewport.scale}` : 
        '0 0 100 100';
</script>
 
<div 
    class="graph-container"
    bind:this={container}
>
    <button 
        class="reset-button"
        on:click={handleReset}
        aria-label="Reset view"
    >
        ⟲
    </button>
 
    <svg 
        bind:this={backgroundSvg}
        class="background-svg"
        {width}
        {height}
        {viewBox}
        preserveAspectRatio={mergedConfig.viewport.preserveAspectRatio}
    >
        <g 
            bind:this={backgroundGroup}
            class="background-group"
        />
    </svg>
 
    <GraphLayout 
        bind:this={graphLayout}
        {nodes}
        {links}
        {width} 
        {height}
        {isPreviewMode}
        {viewType} 
        on:modeChange
    >
        <svelte:fragment slot="edge" let:link let:source let:target>
            <Edge {link} {source} {target} />
        </svelte:fragment>

        <svelte:fragment slot="node" let:node let:position>
            <slot 
                name="node" 
                {node}
                {position}
            />
        </svelte:fragment>
    </GraphLayout>
</div>
 
<style>
    .graph-container {
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
 
    .reset-button {
        position: absolute;
        bottom: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.8);
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        transition: all 0.3s ease-out;
    }
 
    .reset-button:hover {
        background: rgba(0, 0, 0, 0.8);
        border-color: rgba(255, 255, 255, 0.4);
        color: rgba(255, 255, 255, 1);
    }
 
    .reset-button:active {
        transform: scale(0.95);
    }
 
    :global(.graph-container svg) {
        width: 100%;
        height: 100%;
    }
 
    :global(.graph-container .node) {
        transition: transform 0.3s ease-out;
    }
 
    :global(.graph-container .edge) {
        pointer-events: none;
    }
</style>