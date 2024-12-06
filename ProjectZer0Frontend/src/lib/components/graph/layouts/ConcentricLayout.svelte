<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as d3 from 'd3';
    import type { GraphNode, GraphEdge } from '$lib/types/graph';
    import { ConcentricLayout, type NodePosition, LAYOUT_CONSTANTS } from './ConcentricLayout';
    import { zoomStore } from '$lib/stores/zoomStore';

    export let nodes: GraphNode[];
    export let edges: GraphEdge[];
    
    const layout = new ConcentricLayout();
    let positions: Map<string, NodePosition>;
    let container: HTMLDivElement;
    let zoom: d3.ZoomBehavior<HTMLDivElement, unknown>;
    let contentTransform = { x: 0, y: 0, k: 1 };

    $: {
        console.log('ConcentricLayout updating with nodes:', nodes);
        positions = layout.calculateLayout(
            nodes, 
            edges, 
            container?.clientWidth || window.innerWidth, 
            container?.clientHeight || window.innerHeight
        );
        console.log('Calculated positions:', positions);
    }

    function initializeZoom() {
    zoom = d3.zoom<HTMLDivElement, unknown>()
        .scaleExtent([
            LAYOUT_CONSTANTS.ZOOM.MIN / 100,
            LAYOUT_CONSTANTS.ZOOM.MAX / 100
        ])
        .on('zoom', handleZoom)
        // Set zoom center to middle of viewport
        .translateExtent([[-Infinity, -Infinity], [Infinity, Infinity]]);

    const initialTransform = d3.zoomIdentity
        .translate(0, 0)
        .scale(LAYOUT_CONSTANTS.ZOOM.INITIAL / 100);

    d3.select(container)
        .call(zoom as any)
        .call(zoom.transform, initialTransform);
}

function handleZoom(event: d3.D3ZoomEvent<HTMLDivElement, unknown>) {
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Apply transform relative to the viewport center
    contentTransform = {
        x: event.transform.x,
        y: event.transform.y,
        k: event.transform.k
    };

    // Update zoom store
    zoomStore.set({
        scale: Math.round(contentTransform.k * 100),
        x: Math.round(contentTransform.x),
        y: Math.round(contentTransform.y)
    });
    
    const content = d3.select(container).select('.zoom-content');
    content.style('transform-origin', '50% 50%');
    content.style('transform', `translate(${contentTransform.x}px, ${contentTransform.y}px) scale(${contentTransform.k})`);
}

    function resetView() {
        const width = container.clientWidth;
        const height = container.clientHeight;

        d3.select(container)
            .transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity
                .translate(width, height)
                .scale(LAYOUT_CONSTANTS.ZOOM.INITIAL / 100));
    }

    onMount(() => {
        initializeZoom();
        window.addEventListener('resize', initializeZoom);
    });

    onDestroy(() => {
        window.removeEventListener('resize', initializeZoom);
    });
</script>

<div class="concentric-layout" bind:this={container}>
    <div 
        class="zoom-content"
        style="transform: translate({contentTransform.x}px, {contentTransform.y}px) 
                       scale({contentTransform.k})"
    >
        {#each nodes as node (node.id)}
            {@const pos = positions.get(node.id)}
            {#if pos}
                <div 
                    class="node-wrapper"
                    style="transform: translate(-50%, -50%) 
                           translate({pos.x}px, {pos.y}px) 
                           scale({pos.scale})"
                >
                    <div class="node-content">
                        <slot {node} />
                    </div>
                </div>
            {/if}
        {/each}
    </div>

    <button 
        class="reset-view-button"
        on:click={resetView}
        title="Reset View"
    >
        ⟲
    </button>
</div>

<style>
    .concentric-layout {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        cursor: grab;
    }

    .concentric-layout:active {
        cursor: grabbing;
    }

    .zoom-content {
        position: absolute;
        width: 100%;
        height: 100%;
        transform-origin: center center;
        will-change: transform;
        top: 0;
        left: 0;
    }

    .node-wrapper {
        position: absolute;
        top: 0;
        left: 0;
        transition: transform 0.3s ease-out;
    }

    .node-content {
        position: relative;
        transform-origin: center center;
    }

    .reset-view-button {
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 10;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        padding: 0.5rem;
        font-size: 1.2rem;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
        transition: all 0.2s ease-out;
    }

    .reset-view-button:hover {
        background: rgba(0, 0, 0, 0.8);
        border-color: rgba(255, 255, 255, 0.4);
    }
</style>