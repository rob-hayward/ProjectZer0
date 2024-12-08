<!-- src/lib/components/graph/MainGraph.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { GraphNode, GraphEdge } from '$lib/types/graph';
    import type { SvgLayoutConfig, SvgNodePosition } from '$lib/types/svgLayout';
    import SvgConcentricLayout from './layouts/SvgConcentricLayout.svelte';

    export let nodes: GraphNode[];
    export let edges: GraphEdge[];
    export let config: Partial<SvgLayoutConfig> = {};

    const dispatch = createEventDispatcher<{
        nodeClick: { node: GraphNode };
        nodeHover: { node: GraphNode; isHovered: boolean };
        detailView: { node: GraphNode };  // Changed from zoomChange
    }>();

    let container: HTMLDivElement;
    let containerWidth: number;
    let containerHeight: number;

    // Handle window resizing
    function updateDimensions() {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        containerWidth = rect.width;
        containerHeight = rect.height;
    }

    // Handle node events
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

        return () => {
            window.removeEventListener('resize', updateDimensions);
        };
    });
</script>

<div 
    class="main-graph"
    bind:this={container}
>
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