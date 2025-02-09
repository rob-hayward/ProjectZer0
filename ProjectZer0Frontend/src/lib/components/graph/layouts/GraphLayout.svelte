<!-- src/lib/components/graph/layouts/GraphLayout.svelte -->
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
 
    function updateNodePositions(forceUpdate = false) {
        if (!layout || !data) return;
        
        // Extract modes from node data
        const modes = new Map<string, NodeMode>();
        data.nodes.forEach(node => {
            if ('mode' in node) {
                modes.set(node.id, node.mode as NodeMode);
            }
        });
        
        console.log('[GraphLayout] Updating node positions:', {
            nodeCount: data.nodes.length,
            linkCount: data.links?.length,
            modes: Array.from(modes.entries()),
            forceUpdate
        });

        // Update layout modes before updating positions
        if (modes.size > 0) {
            layout.updateDefinitionModes(modes);
        }
        
        nodePositions = layout.updateLayout(data, !forceUpdate);
        layoutReady = true;
    }

    function handleModeChange(nodeId: string, newMode: NodeMode) {
        console.log('[GraphLayout] Node mode change:', { nodeId, newMode });
        
        // Store previous state for debugging
        const prevMode = expandedNodes.get(nodeId);
        
        // Update mode
        expandedNodes.set(nodeId, newMode);
        expandedNodes = new Map(expandedNodes);
        
        if (layout) {
            console.log('[GraphLayout] Processing mode change:', {
                nodeId,
                prevMode,
                newMode,
                allModes: Array.from(expandedNodes.entries())
            });
            
            // Update the modes
            layout.updateDefinitionModes(expandedNodes);
            
            // Force a full layout update
            updateNodePositions(true);
        } else {
            console.warn('[GraphLayout] Layout not initialized for mode change');
        }
 
        dispatch('modechange', { nodeId, mode: newMode });
    }

    function createModeChangeHandler(nodeId: string) {
        return function(event: CustomEvent<{ mode: NodeMode }>) {
            handleModeChange(nodeId, event.detail.mode);
        };
    }
 
    function initializeLayout() {
        console.log('[GraphLayout] Initializing layout:', { 
            width, 
            height, 
            viewType, 
            isPreviewMode
        });
        
        layout = new LayoutClass(width, height, viewType, isPreviewMode);
        
        // Extract initial modes from node data
        const modes = new Map<string, NodeMode>();
        data.nodes.forEach(node => {
            if ('mode' in node) {
                modes.set(node.id, node.mode as NodeMode);
            }
        });
        
        if (modes.size > 0) {
            console.log('[GraphLayout] Setting initial definition modes:', 
                Array.from(modes.entries())
            );
            layout.updateDefinitionModes(modes);
        }
        
        updateNodePositions();
        initialized = true;
        currentViewType = viewType;
        prevWidth = width;
        prevHeight = height;
    }

    // Watch for view type changes
    $: if (initialized && layout && viewType !== currentViewType) {
        console.log('[GraphLayout] View type changed:', { 
            from: currentViewType, 
            to: viewType 
        });
        layout.updateViewType(viewType);
        currentViewType = viewType;
        updateNodePositions(true);
    }
 
    onMount(() => {
        console.log('[GraphLayout] Mounting');
        initializeLayout();
    });
 
    onDestroy(() => {
        console.log('[GraphLayout] Destroying');
        if (layout) {
            layout.stop();
        }
    });
 
    $: if (initialized && layout && isPreviewMode !== undefined) {
        console.log('[GraphLayout] Preview mode changed:', { 
            isPreviewMode,
            expandedNodes: Array.from(expandedNodes.entries())
        });
        layout.updatePreviewMode(isPreviewMode);
        updateNodePositions(true);
    }
 
    $: if (initialized && layout && data) {
        console.log('[GraphLayout] Data changed:', { 
            nodes: data.nodes.length, 
            links: data.links?.length,
            expandedNodes: Array.from(expandedNodes.entries())
        });
        updateNodePositions();
    }
 
    $: if (initialized && layout && (width !== prevWidth || height !== prevHeight)) {
        console.log('[GraphLayout] Dimensions changed:', { 
            width, 
            height, 
            prev: { width: prevWidth, height: prevHeight } 
        });
        layout.resize(width, height);
        updateNodePositions(true);
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
                            handleNodeModeChange={createModeChangeHandler(node.id)}
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