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
        radius: 10,
        intensity: 0.1,
        fade: true
    };
    
    const { id: filterId, element: filterElement } = createGlowFilter(glowEffect);
    const { id: gradientId, element: gradientElement } = createGlowGradient(glowEffect);
    
    let transformValues: number[] = [];
    let translateX: number = 0;
    let translateY: number = 0;

    $: {
        const matches = transform.match(/translate\(([-\d.e+-]+),\s*([-\d.e+-]+)\)/);
        if (matches) {
            transformValues = [parseFloat(matches[1]), parseFloat(matches[2])];
            [translateX, translateY] = transformValues;
        } else {
            transformValues = [0, 0];
            [translateX, translateY] = transformValues;
        }
    }

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

    <!-- Icon Container -->
    <foreignObject 
        x="-16" 
        y="-16" 
        width="32" 
        height="32" 
        class="icon-container"
        style:filter={isHovered ? `url(#${filterId})` : 'none'}
    >
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div 
            class="icon-wrapper"
            {...{"xmlns": "http://www.w3.org/1999/xhtml"}}
        >
            <span 
                class="material-symbols-outlined"
                style:color={isHovered ? color : 'white'}
            >
                {option.icon}
            </span>
        </div>
    </foreignObject>

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

    .icon-container {
        overflow: visible;
        transition: transform 0.2s ease-out;
    }

    .icon-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    :global(.navigation-node .material-symbols-outlined) {
        font-size: 24px;
        transition: font-size 0.2s ease-out, color 0.3s ease;
    }

    :global(.navigation-node:hover .material-symbols-outlined) {
        font-size: 32px;
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