<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { NavigationOption } from '$lib/types/navigation';
    import { getNavigationColor } from './navigationColors';
    import { createGlowFilter, createGlowGradient } from '$lib/utils/svgAnimations';

    const dispatch = createEventDispatcher();

    export let option: NavigationOption;
    export let transform: string;
    export let isHovered = false;

    const color = getNavigationColor(option.id);
    
    // Create unique filter and gradient IDs for this node
    const glowEffect = {
        color,
        radius: 25,
        intensity: 0.2,
        fade: true
    };
    
    const { id: filterId, element: filterElement } = createGlowFilter(glowEffect);
    const { id: gradientId, element: gradientElement } = createGlowGradient(glowEffect);
    
    $: transformValues = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/)?.slice(1).map(Number) ?? [0, 0];
    $: [translateX, translateY] = transformValues;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="navigation-node"
    {transform}
    on:mouseenter
    on:mouseleave
    on:click
>
    <defs>
        {@html filterElement}
        {@html gradientElement}
    </defs>

    {#if isHovered}
        <!-- Connection line to center -->
        <line 
            class="connection-line"
            x1="0"
            y1="0"
            x2={-translateX}
            y2={-translateY}
            stroke={`${color}50`}
            stroke-width="1"
        />

        <!-- Glow effect -->
        <circle
            class="glow"
            r="25"
            fill={`url(#${gradientId})`}
            filter={`url(#${filterId})`}
        />
    {/if}

    <!-- Icon -->
    <text
        class="icon"
        style:fill={isHovered ? color : 'white'}
        style:filter={isHovered ? `url(#${filterId})` : 'none'}
    >
        {option.icon}
    </text>

    <!-- Label -->
    {#if isHovered}
        <text
            class="label"
            dy="30"
            style:fill={color}
        >
            {option.label}
        </text>
    {/if}
</g>

<style>
    .navigation-node {
        cursor: pointer;
    }

    .icon {
        font-family: 'Orbitron', sans-serif;
        font-size: 24px;
        text-anchor: middle;
        dominant-baseline: middle;
        transition: fill 0.3s ease;
    }

    .label {
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        text-anchor: middle;
        dominant-baseline: middle;
        transition: fill 0.3s ease;
    }

    .connection-line {
        pointer-events: none;
        vector-effect: non-scaling-stroke;
    }

    .glow {
        pointer-events: none;
    }

    :global(.navigation-node *) {
        vector-effect: non-scaling-stroke;
    }
</style>