<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/common/HiddenNode.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { RenderableNode } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import { COORDINATE_SPACE } from '../../../../constants/graph/coordinate-space';
    import ShowHideButton from '../ui/ShowHideButton.svelte';
    
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
    
    // Display the net votes value directly from the prop
    $: displayVotes = netVotes;
    
    // Dispatch events
    const dispatch = createEventDispatcher<{
        visibilityChange: { isHidden: boolean };
        modeChange: { mode: 'preview' | 'detail' };
    }>();
    
    // Handle visibility change request
    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        // When showing a hidden node, always forward the event without modification
        // This prevents duplicating visibility change logic
        dispatch('visibilityChange', event.detail);
    }
    
    // Handle mode change (expand)
    function handleModeChange(event: CustomEvent<{ mode: 'preview' | 'detail' }>) {
        dispatch('modeChange', event.detail);
    }
    
    // Filter and gradient IDs
    const nodeId = `hidden-node-${Math.random().toString(36).slice(2)}`;
    const filterId = `hidden-glow-${nodeId}`;
    const gradientId = `hidden-gradient-${nodeId}`;
    
    // Define the very dull red color - much more subdued
    const redGlowColor = "#4A1A1A"; // Very dark dull red - barely visible negative feeling
</script>

<!-- Reduced size node with red glowing styling -->
<g class="hidden-node" data-node-type={node.type} data-node-id={node.id}>
    <!-- Filters and gradients -->
    <defs>
        <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%">
            <!-- Strong outer glow - changed to red -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur1"/>
            <feFlood flood-color={redGlowColor} flood-opacity="0.4" result="color1"/>
            <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
            
            <!-- Medium glow - changed to red -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur2"/>
            <feFlood flood-color={redGlowColor} flood-opacity="0.6" result="color2"/>
            <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
            
            <!-- Sharp inner glow - changed to red -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur3"/>
            <feFlood flood-color={redGlowColor} flood-opacity="0.8" result="color3"/>
            <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
            
            <feMerge>
                <feMergeNode in="shadow1"/>
                <feMergeNode in="shadow2"/>
                <feMergeNode in="shadow3"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
        
        <!-- Changed gradient to red -->
        <radialGradient id={gradientId}>
            <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
            <stop offset="85%" stop-color={redGlowColor} stop-opacity="0.4"/>
            <stop offset="100%" stop-color={redGlowColor} stop-opacity="0.1"/>
        </radialGradient>
    </defs>
    
    <!-- Background circles -->
    <circle r={scaledRadius} class="background-layer-1" />
    <circle r={scaledRadius - 2} class="background-layer-2" />
    <circle r={scaledRadius - 4} class="background-layer-3" />
    <circle r={scaledRadius - 6} class="content-background" />
    
    <!-- Border - single clean glowing circle -->
    <circle
        r={scaledRadius}
        class="outer-ring"
        style:stroke={redGlowColor}
        style:stroke-opacity="0.8"
        filter={`url(#${filterId})`}
    />
    
    <!-- Content -->
    <g class="content">
        <!-- "Hidden" text -->
        <text
            y="-8"
            class="hidden-label"
            style:font-family="Inter"
            style:font-size={NODE_CONSTANTS.FONTS.title.size}
            style:font-weight="500"
        >
            Hidden
        </text>
        
        <!-- "by community" or "by user" text -->
        <text
            y="8"
            class="hidden-source"
            style:font-family="Inter"
            style:font-size="10px"
            style:font-weight="400"
        >
            by {hiddenBy}
        </text>
        
        <!-- Net votes value - use displayVotes directly -->
        <text
            y="24"
            class="net-votes"
            style:font-family="Inter"
            style:font-size={NODE_CONSTANTS.FONTS.value.size}
            style:font-weight="400"
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
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
        transition: all 0.3s ease-out;
    }
    
    /* Text styles - updated to use Inter fonts */
    text {
        text-anchor: middle;
        fill: rgba(180, 180, 180, 0.9);
        dominant-baseline: middle;
        font-family: 'Inter', sans-serif;  /* Changed from default to Inter */
    }
    
    .hidden-label {
        fill: rgba(180, 180, 180, 0.9);
        font-family: 'Inter', sans-serif;  /* Changed to Inter */
        font-weight: 500;
    }
    
    .hidden-source {
        fill: rgba(150, 150, 150, 0.8);
        font-family: 'Inter', sans-serif;  /* Changed to Inter */
        font-weight: 400;
    }
    
    .net-votes {
        fill: rgba(180, 180, 180, 0.8);
        font-family: 'Inter', sans-serif;  /* Changed to Inter */
        font-weight: 400;
    }
    
    :global(.hidden-node *) {
        vector-effect: non-scaling-stroke;
    }
</style>