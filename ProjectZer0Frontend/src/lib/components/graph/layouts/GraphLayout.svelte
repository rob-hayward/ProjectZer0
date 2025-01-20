<!-- src/lib/components/graph/layouts/GraphLayout.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as d3 from 'd3';
    import type { GraphNode, NodePosition, GraphData, GraphEdge, ViewType } from '$lib/types/graph';
    import { GraphLayout } from './GraphLayout';
    import NavigationNode from '../nodes/navigation/NavigationNode.svelte';
    import { isNavigationNode } from '$lib/types/graph';
    import { handleNavigation } from '$lib/services/navigation';
    import type { NavigationOptionId } from '$lib/services/navigation';

    export let nodes: GraphNode[] = [];
    export let links: GraphEdge[] = [];
    export let width: number;
    export let height: number;
    export let isPreviewMode: boolean = false;
    export let viewType: ViewType = 'word'; // Add viewType prop with default
 
    let svg: SVGSVGElement;
    let container: SVGGElement;
    let layout: GraphLayout;
    let nodePositions = new Map<string, NodePosition>();
    let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
    let hoveredNodeId: string | null = null;
 
    function handleNodeHover(nodeId: string, isHovered: boolean) {
        hoveredNodeId = isHovered ? nodeId : null;
    }

    function handleNodeClick(nodeId: string) {
        handleNavigation(nodeId as NavigationOptionId);
    }
 
    export function resetView() {
        if (!svg || !zoom) return;
        
        const initialTransform = d3.zoomIdentity
            .translate(width / 2, height * 0.515);
 
        d3.select(svg)
            .transition()
            .duration(750)
            .call(zoom.transform, initialTransform);
    }
 
    function initializeLayout() {
        layout = new GraphLayout(width, height, viewType, isPreviewMode);
        updateLayout();
    }
 
    function updateLayout() {
        if (!layout) return;
        nodePositions = layout.updateLayout({ nodes, links });
        nodes = nodes;
    }
 
    function initializeZoom() {
        zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                d3.select(container)
                    .attr('transform', event.transform.toString());
            });
 
        const initialTransform = d3.zoomIdentity
            .translate(width / 2, height * 0.515);
 
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

    $: if (layout && isPreviewMode !== undefined) {
    console.log('Preview mode change detected:', { isPreviewMode });
    layout.updatePreviewMode(isPreviewMode);
    // Force a complete layout update after preview mode changes
    setTimeout(() => {
        console.log('Forcing layout update after preview mode change');
        updateLayout();
    }, 50); // Small delay to ensure preview mode change has taken effect
}
 
    $: if (layout && (nodes || links)) {
        updateLayout();
    }

    // Debug log for edge rendering
        $: {
        console.log('Edge rendering state:', {
            links: links.map(link => ({
                source: link.source,
                target: link.target,
                type: link.type,
                value: link.value
            })),
            nodePositions: Object.fromEntries(
                Array.from(nodePositions.entries()).map(([id, pos]) => [
                    id,
                    {
                        x: pos.x,
                        y: pos.y
                    }
                ])
            )
        });
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
    </defs>
 
    <g bind:this={container}>
      <!-- Update the edge rendering section -->
        {#each links as link}
            {@const sourceId = typeof link.source === 'string' ? link.source : 
                'id' in link.source ? link.source.id : null}
            {@const targetId = typeof link.target === 'string' ? link.target : 
                'id' in link.target ? link.target.id : null}
            {@const sourcePos = sourceId ? nodePositions.get(sourceId) : null}
            {@const targetPos = targetId ? nodePositions.get(targetId) : null}
            {#if sourcePos && targetPos}
                <slot 
                    name="edge"
                    {link}
                    source={sourcePos}
                    target={targetPos}
                />
            {/if}
        {/each}

        <!-- Render nodes -->
        {#each nodes as node (node.id)}
            {@const position = nodePositions.get(node.id)}
            {#if position}
                {#if isNavigationNode(node)}
                    <NavigationNode 
                        option={node.data}
                        transform={position.svgTransform}
                        isHovered={hoveredNodeId === node.id}
                        on:click={() => handleNodeClick(node.data.id)}
                        on:mouseenter={() => handleNodeHover(node.id, true)}
                        on:mouseleave={() => handleNodeHover(node.id, false)}
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