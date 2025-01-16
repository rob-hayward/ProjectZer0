<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { NodeStyle } from '$lib/types/nodes';
    
    export let transform: string;
    export let style: NodeStyle;
    
    const radius = style.previewSize / 2;
    const filterId = `glow-${Math.random().toString(36).slice(2)}`;
    const gradientId = `gradient-${Math.random().toString(36).slice(2)}`;
    
    $: highlightColor = style.highlightColor || '#FFFFFF';
 
    const dispatch = createEventDispatcher<{
        click: void;
    }>();
 
    function handleClick() {
        dispatch('click');
    }
</script>
 
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="base-node"
    {transform}
    on:click={handleClick}
>
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
 
    <!-- Base layers for depth -->
    <circle
        r={radius}
        class="background-layer-1"
    />
    
    <circle
        r={radius - 4}
        class="background-layer-2"
    />
    
    <circle
        r={radius - 8}
        class="background-layer-3"
    />
 
    <!-- Main content background -->
    <circle
        r={radius - 12}
        class="content-background"
    />
 
    <!-- Decorative rings -->
    <circle
        r={radius}
        class="outer-ring"
        style:stroke={highlightColor}
        style:stroke-opacity="5.5"
        filter={`url(#${filterId})`}
    />
 
    <circle
        r={radius}
        class="middle-ring"
    />
    
    <slot {radius} />
</g>
 
<style>
    .base-node {
        transform-origin: center;
    }
    
    /* Base layers for subtle depth effect */
    .background-layer-1 {
        fill: rgba(0, 0, 0, 0.5);  /* Lighter outer layer */
    }
    
    .background-layer-2 {
        fill: rgba(0, 0, 0, 0.8);  /* Darker middle layer */
    }
    
    .background-layer-3 {
        fill: rgba(0, 0, 0, 0.9);  /* Even darker inner layer */
    }
 
    /* Main content background */
    .content-background {
        fill: rgba(0, 0, 0, 0.95);  /* Almost black content background for best contrast */
    }
 
    /* Decorative rings */
    .outer-ring {
        stroke-width: 6;
        vector-effect: non-scaling-stroke;
        transition: all 0.3s ease-out;
    }
 
    .middle-ring {
        fill: none;
        stroke: rgba(255, 255, 255, 0.15);
        stroke-width: 1;
    }
 
    :global(.base-node *) {
        vector-effect: non-scaling-stroke;
    }
</style>