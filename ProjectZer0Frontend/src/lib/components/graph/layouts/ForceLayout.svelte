
<!-- ProjectZer0Frontend/src/lib/components/graph/layouts/ForceLayout.svelte -->
<!-- <script lang="ts">
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
            transform: string;
        };
        edge: {
            edge: GraphEdge;
            sourceX: number;
            sourceY: number;
            targetX: number;
            targetY: number;
        };
    }

    const dispatch = createEventDispatcher<{
        nodeClick: { node: GraphNode };
        nodeHover: { node: GraphNode; isHovered: boolean };
        zoomChange: { scale: number };
    }>();

    let svg: SVGSVGElement;
    let container: SVGGElement;
    let width = 0;
    let height = 0;
    let positions = new Map<string, NodePosition>();
    let isSimulationReady = false;
    
    const layout = new ForceLayout();
    let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;

    function initializeLayout() {
        if (!svg || !width || !height) return;

        // Initialize zoom behavior
        zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([config.minZoom || 0.1, config.maxZoom || 4])
            .on('zoom', handleZoom);

        d3.select(svg)
            .call(zoom)
            .call(zoom.transform, d3.zoomIdentity);

        // Calculate initial positions
        positions = layout.calculateLayout({
            nodes,
            links: edges
        }, width, height);

        isSimulationReady = true;
    }

    function handleZoom(event: d3.D3ZoomEvent<SVGSVGElement, unknown>) {
        if (container) {
            d3.select(container).attr('transform', event.transform.toString());
        }
        dispatch('zoomChange', { scale: event.transform.k * 100 });
    }

    function handleNodeClick(node: GraphNode) {
        dispatch('nodeClick', { node });
    }

    function handleNodeHover(node: GraphNode, isHovered: boolean) {
        dispatch('nodeHover', { node, isHovered });
    }

    function getNodePosition(nodeId: string): NodePosition | undefined {
        return positions.get(nodeId);
    }

    function getNodeId(node: string | GraphNode | undefined): string {
        if (!node) return '';
        if (typeof node === 'string') return node;
        return node.id;
    }

    function getEdgePositions(edge: GraphEdge) {
        const sourceId = getNodeId(edge.source);
        const targetId = getNodeId(edge.target);
        
        const sourcePos = positions.get(sourceId);
        const targetPos = positions.get(targetId);

        if (!sourcePos || !targetPos) return null;

        return {
            sourceX: sourcePos.x,
            sourceY: sourcePos.y,
            targetX: targetPos.x,
            targetY: targetPos.y
        };
}

    function updateDimensions() {
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        
        if (isSimulationReady) {
            layout.resize(width, height);
        } else {
            initializeLayout();
        }
    }

    onMount(() => {
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
    });

    onDestroy(() => {
        window.removeEventListener('resize', updateDimensions);
        layout.destroy();
    });

    $: if (width && height && (nodes.length || edges.length)) {
        initializeLayout();
    }

    $: viewBox = width && height ? 
        `${-width/2} ${-height/2} ${width} ${height}` : 
        '0 0 0 0';
</script>

<svg
    bind:this={svg}
    {width}
    {height}
    {viewBox}
    class="force-layout"
    preserveAspectRatio="xMidYMid meet"
>
    <g 
        bind:this={container}
        class="container"
    >
        {#if isSimulationReady}
            <g class="edges">
                {#each edges as edge (edge.type + edge.source + edge.target)}
                    {@const positions = getEdgePositions(edge)}
                    {#if positions}
                        <slot 
                            name="edge"
                            {edge}
                            sourceX={positions.sourceX}
                            sourceY={positions.sourceY}
                            targetX={positions.targetX}
                            targetY={positions.targetY}
                        />
                    {/if}
                {/each}
            </g>

            <g class="nodes">
                {#each nodes as node (node.id)}
                    {@const position = getNodePosition(node.id)}
                    {#if position}
                        <g
                            class="node"
                            transform={position.svgTransform}
                            data-node-id={node.id}
                            role="button"
                            tabindex="0"
                            on:click={() => handleNodeClick(node)}
                            on:mouseenter={() => handleNodeHover(node, true)}
                            on:mouseleave={() => handleNodeHover(node, false)}
                            on:keydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleNodeClick(node);
                                }
                            }}
                        >
                            <slot 
                                name="node"
                                {node}
                                {position}
                                transform={position.svgTransform}
                            />
                        </g>
                    {/if}
                {/each}
            </g>
        {/if}
    </g>
</svg> -->

<!-- <style>
    .force-layout {
        width: 100%;
        height: 100%;
        overflow: visible;
        cursor: grab;
    }

    .force-layout:active {
        cursor: grabbing;
    }

    .container {
        will-change: transform;
    }

    .edges {
        pointer-events: none;
    }

    .node {
        transition: transform 0.3s ease-out;
    }

    .node:focus {
        outline: none;
    }

    .node:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.5);
        outline-offset: 2px;
    }

    :global(.force-layout *) {
        vector-effect: non-scaling-stroke;
    }
</style> -->
