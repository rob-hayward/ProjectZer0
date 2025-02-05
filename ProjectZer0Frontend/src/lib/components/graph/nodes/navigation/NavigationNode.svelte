<!-- src/lib/components/graph/nodes/navigation/NavigationNode.svelte -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { handleNavigation } from '$lib/services/navigation';
    import type { NavigationOption } from '$lib/types/navigation';
    import type { NavigationOptionId } from '$lib/services/navigation';
    import { getNavigationColor } from './navigationColors';

    const dispatch = createEventDispatcher();

    export let option: NavigationOption;
    export let transform: string;
    export let isHovered = false;

    const color = getNavigationColor(option.id);
    const filterId = `nav-glow-${Math.random().toString(36).slice(2)}`;
    
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

    function handleClick() {
        handleNavigation(option.id as NavigationOptionId);
    }

    function handleMouseEnter() {
        dispatch('hover', { isHovered: true });
        isHovered = true;
    }

    function handleMouseLeave() {
        dispatch('hover', { isHovered: false });
        isHovered = false;
    }
</script>

<g 
    class="navigation-node"
    {transform}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    on:click={handleClick}
>
    <defs>
        <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%">
            <!-- Strong outer glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="18" result="blur1"/>
            <feFlood flood-color={color} flood-opacity="0.6" result="color1"/>
            <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
 
            <!-- Medium glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur2"/>
            <feFlood flood-color={color} flood-opacity="0.8" result="color2"/>
            <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
 
            <!-- Sharp inner glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur3"/>
            <feFlood flood-color={color} flood-opacity="1" result="color3"/>
            <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
 
            <feMerge>
                <feMergeNode in="shadow1"/>
                <feMergeNode in="shadow2"/>
                <feMergeNode in="shadow3"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
    </defs>

    {#if isHovered}
        <!-- Connection line to center -->
        <line 
            class="connection-line"
            x1="0"
            y1="0"
            x2={-translateX * 0.55}
            y2={-translateY * 0.55}
            stroke={`${color}50`}
            stroke-width="1.5"
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
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .navigation-node:hover .icon-container {
        transform: scale(1.1);
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
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .navigation-node:hover :global(.material-symbols-outlined) {
        font-size: 32px;
    }

    .label {
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
        opacity: 0;
        animation: fadeIn 0.2s ease-out forwards;
    }

    .connection-line {
        pointer-events: none;
        vector-effect: non-scaling-stroke;
        opacity: 0;
        animation: fadeIn 0.2s ease-out forwards;
        stroke-dasharray: 2;
        animation: fadeIn 0.2s ease-out forwards, dash 20s linear infinite;
    }

    .glow {
        pointer-events: none;
        opacity: 0;
        animation: fadeIn 0.2s ease-out forwards, pulse 2s ease-in-out infinite;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes pulse {
        0% {
            transform: scale(1);
            opacity: 0.8;
        }
        50% {
            transform: scale(1.1);
            opacity: 0.6;
        }
        100% {
            transform: scale(1);
            opacity: 0.8;
        }
    }

    @keyframes dash {
        to {
            stroke-dashoffset: -1000;
        }
    }

    :global(.navigation-node *) {
        vector-effect: non-scaling-stroke;
    }
</style>