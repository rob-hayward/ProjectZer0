<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/common/HiddenNode.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { RenderableNode } from '$lib/types/graph/enhanced';
    import { isWordNodeData, isDefinitionData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '../../../../constants/graph/node-styling';
    import { COORDINATE_SPACE } from '../../../../constants/graph/coordinate-space';
    import ShowHideButton from './ShowHideButton.svelte';
    import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
    
    // Props
    export let node: RenderableNode;
    export let hiddenBy: 'community' | 'user' = 'community';
    export let netVotes: number = 0;
    
    // Calculate the appropriate radius based on node type
    $: {
        // Use the single size defined for all hidden nodes with fallback
        const hiddenSize = (COORDINATE_SPACE.NODES.SIZES as any).HIDDEN || 
                          COORDINATE_SPACE.NODES.SIZES.NAVIGATION * 2 || 
                          160; // Fallback to 160 if all else fails
        
        // Scale further if needed
        scaledRadius = hiddenSize / 2; // Dividing by 2 as the radius is half the diameter
    }
    
    // Define the scaled radius
    let scaledRadius: number;
    
    // Computed vote value - using statementNetworkStore for statements
    let displayVotes: number;
    
    // Initialize the display votes value
    onMount(() => {
        updateVoteDisplay();
    });
    
    // Get the vote value - using statementNetworkStore for statements
    function updateVoteDisplay() {
        if (node.type === 'statement') {
            // For statement nodes, always use statementNetworkStore (single source of truth)
            try {
                const voteData = statementNetworkStore.getVoteData(node.id);
                displayVotes = voteData.netVotes;
            } catch (error) {
                // Fall back to provided netVotes prop if store access fails
                displayVotes = netVotes;
            }
        } else {
            // For other node types, use the provided netVotes
            displayVotes = netVotes;
        }
    }
    
    // Reactive statement to update the displayed votes when netVotes changes
    $: {
        // Update display votes whenever netVotes changes
        if (node.type !== 'statement') {
            displayVotes = netVotes;
        } else {
            updateVoteDisplay();
        }
    }
    
    // Dispatch events
    const dispatch = createEventDispatcher<{
        visibilityChange: { isHidden: boolean };
        modeChange: { mode: 'preview' | 'detail' };
    }>();
    
    // Handle visibility change request
    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        console.log(`[HiddenNode] Visibility change requested for node ${node.id}`);
        console.log(`[HiddenNode] Current state: hidden (isHidden=true)`);
        console.log(`[HiddenNode] Button action: show (make visible)`);
        console.log(`[HiddenNode] Setting visibility for ${node.id} to visible (isHidden=false)`);
        
        // For a hidden node, the ShowHideButton will always dispatch the opposite visibility
        // When clicked, we want to make the node visible, so dispatch with isHidden: false
        dispatch('visibilityChange', {
            isHidden: false // Always false when showing a previously hidden node
        });
    }
    
    // Handle mode change (expand)
    function handleModeChange(event: CustomEvent<{ mode: 'preview' | 'detail' }>) {
        console.debug(`[HiddenNode] Mode change requested for ${node.id}:`, event.detail);
        dispatch('modeChange', event.detail);
    }
    
    // Filter and gradient IDs
    const nodeId = `hidden-node-${Math.random().toString(36).slice(2)}`;
    const filterId = `hidden-glow-${nodeId}`;
    const gradientId = `hidden-gradient-${nodeId}`;
</script>

<!-- Reduced size node with grey styling -->
<g class="hidden-node" data-node-type={node.type} data-node-id={node.id}>
    <!-- Filters and gradients -->
    <defs>
        <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%">
            <!-- Strong outer glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur1"/>
            <feFlood flood-color="#444444" flood-opacity="0.4" result="color1"/>
            <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
            
            <!-- Medium glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur2"/>
            <feFlood flood-color="#444444" flood-opacity="0.6" result="color2"/>
            <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
            
            <!-- Sharp inner glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur3"/>
            <feFlood flood-color="#444444" flood-opacity="0.8" result="color3"/>
            <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
            
            <feMerge>
                <feMergeNode in="shadow1"/>
                <feMergeNode in="shadow2"/>
                <feMergeNode in="shadow3"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
        
        <radialGradient id={gradientId}>
            <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
            <stop offset="85%" stop-color="#444444" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#444444" stop-opacity="0.1"/>
        </radialGradient>
    </defs>
    
    <!-- Background circles -->
    <circle r={scaledRadius} class="background-layer-1" />
    <circle r={scaledRadius - 2} class="background-layer-2" />
    <circle r={scaledRadius - 4} class="background-layer-3" />
    <circle r={scaledRadius - 6} class="content-background" />
    
    <!-- Border rings with glow effect -->
    <circle
        r={scaledRadius}
        class="outer-ring"
        style:stroke="#555555"
        style:stroke-opacity="0.8"
        filter={`url(#${filterId})`}
    />
    
    <circle 
        r={scaledRadius - 3} 
        class="middle-ring" 
    />
    
    <!-- Content -->
    <g class="content">
        <!-- "Hidden" text -->
        <text
            y="-8"
            class="hidden-label"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size={NODE_CONSTANTS.FONTS.title.size}
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            Hidden
        </text>
        
        <!-- "by community" or "by user" text -->
        <text
            y="8"
            class="hidden-source"
            style:font-family={NODE_CONSTANTS.FONTS.value.family}
            style:font-size="10px"
            style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
        >
            by {hiddenBy}
        </text>
        
        <!-- Net votes value - now using displayVotes -->
        <text
            y="24"
            class="net-votes"
            style:font-family={NODE_CONSTANTS.FONTS.value.family}
            style:font-size={NODE_CONSTANTS.FONTS.value.size}
            style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
        >
            {displayVotes}
        </text>
    </g>
    
    <!-- Show button centered - no need to move it for hidden nodes since there's no expand/collapse button -->
    <ShowHideButton 
        isHidden={true}
        y={scaledRadius}
        x={0} 
        on:visibilityChange={handleVisibilityChange}
    />
</g>

<style>
    /* Base node styles */
    .hidden-node {
        opacity: 0.9;
    }
    
    .background-layer-1 {
        fill: rgba(20, 20, 20, 0.6);
    }
    
    .background-layer-2 {
        fill: rgba(15, 15, 15, 0.7);
    }
    
    .background-layer-3 {
        fill: rgba(10, 10, 10, 0.8);
    }
    
    .content-background {
        fill: rgba(0, 0, 0, 0.95);
    }
    
    .outer-ring {
        fill: none;
        stroke-width: 1.5;
        vector-effect: non-scaling-stroke;
        transition: all 0.3s ease-out;
    }
    
    .middle-ring {
        fill: none;
        stroke: rgba(100, 100, 100, 0.2);
        stroke-width: 1;
    }
    
    /* Text styles */
    text {
        text-anchor: middle;
        fill: rgba(180, 180, 180, 0.9);
        dominant-baseline: middle;
    }
    
    .hidden-label {
        fill: rgba(180, 180, 180, 0.9);
    }
    
    .hidden-source {
        fill: rgba(150, 150, 150, 0.8);
    }
    
    .net-votes {
        fill: rgba(180, 180, 180, 0.8);
    }
    
    :global(.hidden-node *) {
        vector-effect: non-scaling-stroke;
    }
</style>