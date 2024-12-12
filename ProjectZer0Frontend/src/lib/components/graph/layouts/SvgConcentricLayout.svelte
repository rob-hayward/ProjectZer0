<!-- src/lib/components/graph/layouts/SvgConcentricLayout.svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import * as d3 from 'd3';
    import type { GraphNode, GraphEdge } from '$lib/types/graph';
    import type { SvgLayoutConfig, SvgNodePosition } from '$lib/types/svgLayout';
    import { ConcentricLayout, LAYOUT_CONSTANTS } from './ConcentricLayout';

    export let nodes: GraphNode[];
    export let edges: GraphEdge[];
    export let config: Partial<SvgLayoutConfig> = {};

    let svg: SVGSVGElement;
    let contentGroup: SVGGElement;
    let positions: Map<string, SvgNodePosition>;
    let width: number;
    let height: number;
    let viewBox: string;
    
    const layout = new ConcentricLayout(config);
    let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;

    // Reactive statements for layout updates
    $: if (svg) {
        const rect = svg.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        viewBox = `0 0 ${width} ${height}`;
        positions = layout.calculateLayout(nodes, edges, width, height);
    }

    function getEdgePath(edge: GraphEdge): string {
        if (typeof edge.source !== 'string' || typeof edge.target !== 'string') {
            console.error('Invalid edge format:', edge);
            return '';
        }
        
        const sourcePos = positions?.get(edge.source);
        const targetPos = positions?.get(edge.target);
        
        if (!sourcePos || !targetPos) return '';

        return `M ${sourcePos.x} ${sourcePos.y} L ${targetPos.x} ${targetPos.y}`;
    }

    function getEdgeKey(edge: GraphEdge): string {
        if (typeof edge.source !== 'string' || typeof edge.target !== 'string') {
            console.error('Invalid edge format:', edge);
            return Math.random().toString();
        }
        return `${edge.source}-${edge.target}`;
    }

    function initializeZoom() {
        if (!svg) return;

        zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([
                LAYOUT_CONSTANTS.ZOOM.MIN / 100,
                LAYOUT_CONSTANTS.ZOOM.MAX / 100
            ])
            .on('zoom', handleZoom);

        d3.select(svg)
            .call(zoomBehavior)
            .call(
                zoomBehavior.transform,
                d3.zoomIdentity.scale(LAYOUT_CONSTANTS.ZOOM.INITIAL / 100)
            );
    }

    function handleZoom(event: d3.D3ZoomEvent<SVGSVGElement, unknown>) {
        if (!contentGroup) return;
        contentGroup.setAttribute('transform', event.transform.toString());
    }

    function resetView(duration = 750) {
        if (!svg || !zoomBehavior) return;

        d3.select(svg)
            .transition()
            .duration(duration)
            .call(
                zoomBehavior.transform,
                d3.zoomIdentity.scale(LAYOUT_CONSTANTS.ZOOM.INITIAL / 100)
            );
    }

    onMount(() => {
        if (svg) {
            initializeZoom();
        }
    });
</script>

<div class="layout-container">
    <svg
        bind:this={svg}
        {width}
        {height}
        {viewBox}
        class="layout-svg"
        preserveAspectRatio="xMidYMid meet"
    >
        <g 
            bind:this={contentGroup}
            class="content-group"
        >
            <g class="edges-group">
                {#each edges as edge (getEdgeKey(edge))}
                    <path 
                        class="edge"
                        d={getEdgePath(edge)}
                        stroke="rgba(255,255,255,0.2)"
                        stroke-width="1"
                        fill="none"
                    />
                    <slot name="edge" {edge} />
                {/each}
            </g>

            <g class="nodes-group">
                {#each nodes as node (node.id)}
                    {@const position = positions?.get(node.id)}
                    {#if position}
                        <g 
                            class="node-wrapper"
                            transform={position.svgTransform}
                            data-node-id={node.id}
                        >
                            <slot {node} position={position} />
                        </g>
                    {/if}
                {/each}
            </g>
        </g>
    </svg>

    <button 
        class="reset-view-button"
        on:click={() => resetView()}
        title="Reset View"
    >
        ⟲
    </button>
</div>

<style>
    .layout-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
    }

    .layout-svg {
        width: 100%;
        height: 100%;
        cursor: grab;
    }

    .layout-svg:active {
        cursor: grabbing;
    }

    .edge {
        pointer-events: none;
        transition: all 0.3s ease-out;
    }

    .node-wrapper {
        transition: transform 0.3s ease-out;
    }

    .content-group {
        will-change: transform;
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

    :global(.node-wrapper *) {
        vector-effect: non-scaling-stroke;
    }
</style> -->