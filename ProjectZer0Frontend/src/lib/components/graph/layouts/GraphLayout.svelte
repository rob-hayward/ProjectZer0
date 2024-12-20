<!-- src/lib/components/graph/layouts/GraphLayout.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as d3 from 'd3';
    import type { GraphNode, NodePosition, GraphData } from '$lib/types/graph';
    import { GraphLayout } from './GraphLayout';
    import NavigationNode from '../nodes/navigation/NavigationNode.svelte';
    import { isNavigationNode } from '$lib/types/graph';
 
    // Props
    export let nodes: GraphNode[] = [];
    export let width: number;
    export let height: number;
 
    // Local state
    let svg: SVGSVGElement;
    let container: SVGGElement;
    let layout: GraphLayout;
    let nodePositions = new Map<string, NodePosition>();
    let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
    let hoveredNodeId: string | null = null;
 
    function handleNodeHover(nodeId: string, isHovered: boolean) {
        console.log('Node hover:', nodeId, isHovered);
        hoveredNodeId = isHovered ? nodeId : null;
    }
 
    export function resetView() {
        if (!svg || !zoom) return;
        
        const initialTransform = d3.zoomIdentity
            .translate(width / 2, height / 2);
 
        d3.select(svg)
            .transition()
            .duration(750)
            .call(zoom.transform, initialTransform);
    }
 
    function initializeLayout() {
        layout = new GraphLayout(width, height);
        updateLayout();
    }
 
    function updateLayout() {
        if (!layout) return;
        nodePositions = layout.updateLayout({ nodes });
        nodes = nodes; // Force Svelte update
    }
 
    function initializeZoom() {
        zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                d3.select(container)
                    .attr('transform', event.transform.toString());
            });
 
        const initialTransform = d3.zoomIdentity
            .translate(width / 2, height / 2);
 
        d3.select(svg)
            .call(zoom)
            .call(zoom.transform, initialTransform);
    }
 
    onMount(() => {
        initializeLayout();
        initializeZoom();
    });
 
    onDestroy(() => {
        if (layout) {
            layout.stop();
        }
    });
 
    $: if (layout && nodes) {
        updateLayout();
    }
 </script>
 
 <svg
    bind:this={svg}
    class="graph"
    {width}
    {height}
    viewBox="0 0 {width} {height}"
 >
    <defs>
        <radialGradient id="node-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.1)" />
            <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
        <!-- Navigation node glow filter -->
        <filter id="nav-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3"/>
            <feColorMatrix
                type="matrix"
                values="
                    1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 5 -1
                "
            />
        </filter>
    </defs>
 
    <g bind:this={container}>
        {#each nodes as node (node.id)}
            {@const position = nodePositions.get(node.id)}
            {#if position}
                {#if isNavigationNode(node)}
                    <NavigationNode 
                        option={node.data}
                        transform={position.svgTransform}
                        isHovered={hoveredNodeId === node.id}
                        on:mouseenter={() => {
                            console.log('mouseenter', node.id);
                            handleNodeHover(node.id, true);
                        }}
                        on:mouseleave={() => {
                            console.log('mouseleave', node.id);
                            handleNodeHover(node.id, false);
                        }}
                    />
                {:else}
                    <g
                        class="node"
                        transform={position.svgTransform}
                        data-node-id={node.id}
                    >
                        <slot
                            name="node"
                            {node}
                            {position}
                        />
                    </g>
                {/if}
            {/if}
        {/each}
    </g>
 </svg>
 
 <style>
    .graph {
        width: 100%;
        height: 100%;
        cursor: grab;
    }
 
    .graph:active {
        cursor: grabbing;
    }
 
    :global(.graph .node) {
        transition: transform 0.3s ease-out;
    }
 
    :global(.graph *) {
        vector-effect: non-scaling-stroke;
    }
 </style>