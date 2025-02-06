<!-- ProjectZer0Frontend/src/lib/components/graph/layouts/GraphLayout.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import type { GraphData, NodePosition, ViewType } from '$lib/types/graph/core';
    import type { NodeMode } from '$lib/types/nodes';
    import { GraphLayoutEngine as LayoutClass } from './GraphLayoutEngine';
    import WordDefinitionEdge from '../edges/connections/WordDefinitionEdge.svelte';
 
    export let data: GraphData;
    export let width: number;
    export let height: number;
    export let viewType: ViewType;
    export let isPreviewMode = false;
 
    const dispatch = createEventDispatcher<{
        modechange: { nodeId: string; mode: NodeMode }
    }>();
 
    let layout: LayoutClass | null = null;
    let nodePositions: Map<string, NodePosition> = new Map();
    let expandedNodes = new Map<string, NodeMode>();
    let initialized = false;
    let layoutReady = false;
    let currentViewType = viewType;
    
    // Track previous values to prevent unnecessary updates
    let prevWidth = width;
    let prevHeight = height;
 
    function updateNodePositions() {
        if (!layout || !data) return;
        nodePositions = layout.updateLayout(data);
        layoutReady = true;
    }
 
    function handleNodeModeChange(nodeId: string, mode: NodeMode) {
        console.log('Node mode change:', { nodeId, mode });
        expandedNodes.set(nodeId, mode);
        expandedNodes = new Map(expandedNodes);
        
        if (layout) {
            layout.updateDefinitionModes(expandedNodes);
            updateNodePositions();
        }
 
        dispatch('modechange', { nodeId, mode });
    }
 
    function initializeLayout() {
        console.log('Initializing layout:', { width, height, viewType, isPreviewMode });
        layout = new LayoutClass(width, height, viewType, isPreviewMode);
        layout.updateDefinitionModes(expandedNodes);
        updateNodePositions();
        initialized = true;
        currentViewType = viewType;
        prevWidth = width;
        prevHeight = height;
    }

    // Watch for view type changes
    $: if (initialized && layout && viewType !== currentViewType) {
        console.log('View type changed:', { from: currentViewType, to: viewType });
        layout.updateViewType(viewType);
        currentViewType = viewType;
        updateNodePositions();
    }
 
    onMount(() => {
        console.log('GraphLayout mounting');
        initializeLayout();
    });
 
    onDestroy(() => {
        console.log('GraphLayout destroying');
        if (layout) {
            layout.stop();
        }
    });
 
    $: if (initialized && layout && isPreviewMode !== undefined) {
        console.log('Preview mode changed:', isPreviewMode);
        layout.updatePreviewMode(isPreviewMode);
        updateNodePositions();
    }
 
    $: if (initialized && layout && data) {
        console.log('Data changed:', { nodes: data.nodes.length, links: data.links?.length });
        updateNodePositions();
    }
 
    $: if (initialized && layout && (width !== prevWidth || height !== prevHeight)) {
        console.log('Dimensions changed:', { width, height, prev: { width: prevWidth, height: prevHeight } });
        layout.resize(width, height);
        updateNodePositions();
        prevWidth = width;
        prevHeight = height;
    }
</script>
 
<g class="graph-layout">
    {#if layoutReady && data.links?.length > 0}
    <g class="edges" aria-hidden="true">
        {#each data.links as link}
        {@const sourceId = typeof link.source === 'string' ? link.source : link.source.id}
        {@const targetId = typeof link.target === 'string' ? link.target : link.target.id}
        {@const sourceNode = data.nodes.find(n => n.id === sourceId)}
        {@const targetNode = data.nodes.find(n => n.id === targetId)}
        {@const sourcePos = nodePositions.get(sourceId)}
        {@const targetPos = nodePositions.get(targetId)}
        {#if sourcePos && targetPos && sourceNode && targetNode}
            <WordDefinitionEdge
                {sourceNode}
                {targetNode}
                sourceX={sourcePos.x}
                sourceY={sourcePos.y}
                targetX={targetPos.x}
                targetY={targetPos.y}
            />
        {/if}
        {/each}
    </g>
    {/if}

    {#if layoutReady && data.nodes?.length > 0}
        <g class="nodes">
            {#each data.nodes as node (node.id)}
                {@const position = nodePositions.get(node.id)}
                {#if position}
                    <g 
                        class="node {node.type} {node.group}"
                        transform={position.svgTransform}
                    >
                        <slot
                            {node}
                            {position}
                            {handleNodeModeChange}
                        />
                    </g>
                {/if}
            {/each}
        </g>
    {/if}
</g>
 
<style>
    .graph-layout {
        width: 100%;
        height: 100%;
        pointer-events: none;
    }
 
    .nodes {
        pointer-events: all;
    }
 
    .edges {
        pointer-events: none;
    }
 
    :global(.node) {
        transition: transform 0.3s ease-out;
    }
</style>