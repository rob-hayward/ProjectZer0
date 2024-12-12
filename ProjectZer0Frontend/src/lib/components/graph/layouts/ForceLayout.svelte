<script lang="ts">
    import { onMount, createEventDispatcher, onDestroy } from 'svelte';
    import * as d3 from 'd3';
    import type { GraphNode, GraphEdge, GraphLayoutConfig, NodePosition } from '$lib/types/graph';
    import { ForceLayout } from './ForceLayout';

    export let nodes: GraphNode[];
    export let edges: GraphEdge[];
    export let config: Partial<GraphLayoutConfig> = {};

    interface $$Slots {
        node: {
            node: GraphNode;
            position: NodePosition;
        };
        edge: {
            edge: GraphEdge;
            source: NodePosition;
            target: NodePosition;
        };
    }

    const dispatch = createEventDispatcher<{
        nodeClick: { node: GraphNode };
        nodeHover: { node: GraphNode; isHovered: boolean };
        zoomChange: { scale: number };
        keyPress: { node: GraphNode; key: string };
    }>();

    let svg: SVGSVGElement;
    let container: SVGGElement;
    let positions: Map<string, NodePosition>;
    let width: number;
    let height: number;
    
    const layout = new ForceLayout();
    let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
    let transform = d3.zoomIdentity;

    function initializeLayout() {
        if (!svg) return;
        
        const rect = svg.getBoundingClientRect();
        width = rect.width;
        height = rect.height;

        zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([config.minZoom || 0.1, config.maxZoom || 4])
            .on('zoom', handleZoom);

        d3.select(svg)
            .call(zoom)
            .call(zoom.transform, transform);

        updateLayout();
    }

    function updateLayout() {
        if (!width || !height) return;
        positions = layout.calculateLayout(nodes, edges, width, height);
    }

    function handleZoom(event: d3.D3ZoomEvent<SVGSVGElement, unknown>) {
        transform = event.transform;
        if (container) {
            container.setAttribute('transform', transform.toString());
        }
        dispatch('zoomChange', { scale: transform.k * 100 });
    }

    function getNodeId(node: unknown): string {
        if (typeof node === 'string') return node;
        if (node && typeof node === 'object' && 'id' in node) {
            return (node as GraphNode).id;
        }
        return '';
    }

    function getEdgeId(edge: GraphEdge): string {
        const sourceId = getNodeId(edge.source);
        const targetId = getNodeId(edge.target);
        return `${sourceId}-${targetId}`;
    }

    function getEdgePath(edge: GraphEdge): string {
        const sourceId = getNodeId(edge.source);
        const targetId = getNodeId(edge.target);
        const source = positions?.get(sourceId);
        const target = positions?.get(targetId);
        
        if (!source || !target) return '';
        
        return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }

    function handleNodeClick(node: GraphNode) {
        dispatch('nodeClick', { node });
    }

    function handleNodeHover(node: GraphNode, isHovered: boolean) {
        dispatch('nodeHover', { node, isHovered });
    }

    function handleKeyPress(node: GraphNode, event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            handleNodeClick(node);
        }
        dispatch('keyPress', { node, key: event.key });
    }

    onMount(() => {
        initializeLayout();
        window.addEventListener('resize', initializeLayout);
    });

    onDestroy(() => {
        window.removeEventListener('resize', initializeLayout);
        layout.stop();
    });

    $: if (width && height) {
        updateLayout();
    }

    $: viewBox = `${-width/2} ${-height/2} ${width} ${height}`;
</script>

<svg
    bind:this={svg}
    {width}
    {height}
    {viewBox}
    class="layout-svg"
    preserveAspectRatio="xMidYMid meet"
>
    <g 
        bind:this={container}
        class="container"
    >
        <g class="edges">
            {#each edges as edge (getEdgeId(edge))}
                {@const source = positions?.get(getNodeId(edge.source))}
                {@const target = positions?.get(getNodeId(edge.target))}
                {#if source && target}
                    <path 
                        class="edge"
                        d={getEdgePath(edge)}
                    />
                    <slot 
                        name="edge" 
                        {edge}
                        {source}
                        {target}
                    />
                {/if}
            {/each}
        </g>

        <g class="nodes">
            {#each nodes as node (node.id)}
                {@const position = positions?.get(node.id)}
                {#if position}
                    <g 
                        class="node"
                        transform={position.svgTransform}
                        data-node-id={node.id}
                        role="button"
                        tabindex="0"
                        aria-label={`${node.type} node`}
                        on:click={() => handleNodeClick(node)}
                        on:keydown={(e) => handleKeyPress(node, e)}
                        on:mouseenter={() => handleNodeHover(node, true)}
                        on:mouseleave={() => handleNodeHover(node, false)}
                    >
                        <slot 
                            name="node" 
                            {node}
                            {position}
                        />
                    </g>
                {/if}
            {/each}
        </g>
    </g>
</svg>

<style>
    .layout-svg {
        width: 100%;
        height: 100%;
        overflow: visible;
    }

    .container {
        will-change: transform;
    }

    .edge {
        stroke: rgba(255, 255, 255, 0.2);
        stroke-width: 1;
        fill: none;
        pointer-events: none;
        transition: stroke 0.3s ease;
    }

    .node {
        transition: transform 0.3s ease;
        outline: none;
    }

    .node:focus {
        outline: 2px solid rgba(255, 255, 255, 0.5);
        outline-offset: 2px;
    }

    :global(.layout-svg) {
        cursor: grab;
    }

    :global(.layout-svg:active) {
        cursor: grabbing;
    }

    :global(.node *) {
        vector-effect: non-scaling-stroke;
    }
</style>