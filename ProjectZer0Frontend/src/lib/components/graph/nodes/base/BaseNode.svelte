<!-- src/lib/components/graph/nodes/base/BaseNode.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    
    // Node data - contains ALL information needed for rendering
    export let node: RenderableNode;
    // Allow custom style to be passed in (optional)
    export let style = node.style;
    
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        click: void;
    }>();
    
    // Generate unique IDs for this instance
    const nodeId = `node-${Math.random().toString(36).slice(2)}`;
    const filterId = `glow-${nodeId}`;
    const gradientId = `gradient-${nodeId}`;
    
    // Extract visual properties only - NO position info
    $: radius = node.radius;
    $: highlightColor = style.highlightColor || style.colors?.border || '#3498db';

    function handleClick() {
        dispatch('click');
    }

    interface $$Slots {
        default: {
            radius: number;
            filterId: string;
            gradientId: string;
        };
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="base-node"
    data-node-id={nodeId}
    data-node-radius={radius}
    data-node-mode={node.mode || 'preview'}
    on:click={handleClick}
>
    <!-- Filter and gradient definitions -->
    <defs>
        <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%">
            <!-- Strong outer glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur1"/>
            <feFlood flood-color={highlightColor} flood-opacity="0.6" result="color1"/>
            <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
            
            <!-- Medium glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur2"/>
            <feFlood flood-color={highlightColor} flood-opacity="0.8" result="color2"/>
            <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
            
            <!-- Sharp inner glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur3"/>
            <feFlood flood-color={highlightColor} flood-opacity="1" result="color3"/>
            <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
            
            <feMerge>
                <feMergeNode in="shadow1"/>
                <feMergeNode in="shadow2"/>
                <feMergeNode in="shadow3"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>

        <!-- Gradient for the outer ring -->
        <radialGradient id={gradientId}>
            <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
            <stop offset="85%" stop-color={highlightColor} stop-opacity="0.5"/>
            <stop offset="100%" stop-color={highlightColor} stop-opacity="0.1"/>
        </radialGradient>
    </defs>

    <!-- Base node layers - Use explicit r={radius} instead of CSS vars -->
    <circle {radius} r={radius} class="background-layer-1" />
    <circle {radius} r={radius - 4} class="background-layer-2" />
    <circle {radius} r={radius - 8} class="background-layer-3" />
    <circle {radius} r={radius - 12} class="content-background" />
    
    <!-- Decorative rings with glow effect -->
    <circle
        {radius}
        r={radius}
        class="outer-ring"
        style:stroke={highlightColor}
        style:stroke-opacity="0.5"
        filter={`url(#${filterId})`}
    />
    
    <circle {radius} r={radius - 2} class="middle-ring" />
    
    <!-- Pass relevant data to child components -->
    <slot {radius} {filterId} {gradientId} />
</g>

<style>
    /* Base node styles */
    .base-node {
        position: relative;
    }
    
    .background-layer-1 {
        fill: rgba(0, 0, 0, 0.5);
        transition: r 0.3s ease-out;
    }
    
    .background-layer-2 {
        fill: rgba(0, 0, 0, 0.8);
        transition: r 0.3s ease-out;
    }
    
    .background-layer-3 {
        fill: rgba(0, 0, 0, 0.9);
        transition: r 0.3s ease-out;
    }
 
    .content-background {
        fill: rgba(0, 0, 0, 0.95);
        transition: r 0.3s ease-out;
    }
 
    .outer-ring {
        fill: none;
        stroke-width: 6;
        vector-effect: non-scaling-stroke;
        transition: r 0.3s ease-out;
    }
 
    .middle-ring {
        fill: none;
        stroke: rgba(255, 255, 255, 0.15);
        stroke-width: 1;
        transition: r 0.3s ease-out;
    }
 
    :global(.base-node *) {
        vector-effect: non-scaling-stroke;
    }
</style>