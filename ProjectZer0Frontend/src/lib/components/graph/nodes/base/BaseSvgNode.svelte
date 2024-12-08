<!-- src/lib/components/graph/nodes/base/BaseSvgNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { NodeMode } from '$lib/types/nodes';
    
    export let mode: NodeMode = 'preview';
    export let width: number;
    export let height: number;
    export let isHovered = false;
    
    const dispatch = createEventDispatcher<{
        zoom: { bounds: DOMRect };
        hover: { isHovered: boolean };
    }>();
    
    $: radius = Math.min(width, height) / 2 - 5;
    $: centerX = 0;  // Changed to 0 to avoid adding translation
    $: centerY = 0;  // Changed to 0 to avoid adding translation
    $: viewBox = `${-width/2} ${-height/2} ${width} ${height}`;  // Center the viewBox
    
    function handleClick(event: MouseEvent) {
        const element = event.currentTarget as SVGGElement;
        const bounds = element.getBoundingClientRect();
        dispatch('zoom', { bounds });
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="base-node"
    class:preview={mode === 'preview'}
    class:zoomed={mode === 'zoomed'}
    class:hovered={isHovered}
    {viewBox}
    on:mouseenter={() => dispatch('hover', { isHovered: true })}
    on:mouseleave={() => dispatch('hover', { isHovered: false })}
    on:click={handleClick}
>
    <defs>
        <radialGradient id="hover-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.3)" />
            <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
        
        <radialGradient id="node-background" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(0,0,0,0.8)" />
            <stop offset="100%" stop-color="rgba(0,0,0,0.7)" />
        </radialGradient>
    </defs>

    <!-- Background circle -->
    <circle
        cx={centerX}
        cy={centerY}
        {radius}
        class="background"
        fill="url(#node-background)"
    />
    
    <!-- Glow effect for hover -->
    {#if isHovered}
        <circle
            cx={centerX}
            cy={centerY}
            {radius}
            class="glow"
            fill="url(#hover-glow)"
        >
            <animate
                attributeName="r"
                values={`${radius};${radius + 2};${radius}`}
                dur="2s"
                repeatCount="indefinite"
            />
            <animate
                attributeName="opacity"
                values="0.6;0.8;0.6"
                dur="2s"
                repeatCount="indefinite"
            />
        </circle>
    {/if}
    
    <!-- Inner glow -->
    <circle
        cx={centerX}
        cy={centerY}
        r={radius - 2}
        class="inner-glow"
        fill="none"
        stroke-width="2"
    />
    
    <!-- Main border -->
    <circle
        cx={centerX}
        cy={centerY}
        {radius}
        class="border"
        class:hovered={isHovered}
        fill="none"
        stroke-width="2"
    />
    
    <!-- Content slot -->
    <slot 
        {centerX} 
        {centerY} 
        {radius}
        {isHovered}
        {mode}
        {width}
        {height}
    />
</g>

<style>
    .base-node {
        transform-origin: center;
        transition: transform 0.3s ease-out;
        vector-effect: non-scaling-stroke;
    }
    
    .preview {
        cursor: pointer;
    }
    
    .preview.hovered {
        transform: scale(1.05);
    }
    
    .zoomed {
        cursor: default;
    }
    
    .background {
        fill: rgba(0, 0, 0, 0.7);
    }
    
    .glow {
        pointer-events: none;
        filter: blur(8px);
    }
    
    .inner-glow {
        stroke: rgba(255, 255, 255, 0.1);
        pointer-events: none;
    }
    
    .border {
        stroke: rgba(255, 255, 255, 0.2);
        transition: stroke 0.3s ease-out;
    }
    
    .border.hovered {
        stroke: rgba(255, 255, 255, 0.4);
    }
    
    :global(.base-node *) {
        vector-effect: non-scaling-stroke;
    }
</style>