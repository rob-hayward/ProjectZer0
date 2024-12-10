<!-- src/lib/components/graph/nodes/navigation/NavigationNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { NavigationOption } from '$lib/types/navigation';
    import { getNavigationColor } from './navigationColors';
    import { COLORS } from '$lib/constants/colors';
    
    export let option: NavigationOption;
    export let x: number = 0;
    export let y: number = 0;
    export let scale: number = 1;
    export let isHovered: boolean = false;

    const dispatch = createEventDispatcher();

    $: color = getNavigationColor(option.id);
    $: transform = `translate(${x}, ${y}) scale(${scale})`;
    $: opacity = isHovered ? 1 : (scale - 1) / 0.5;
    $: labelOpacity = Math.max(0, Math.min(1, opacity));

    function handleClick() {
        dispatch('click', { id: option.id });
    }

    function handleMouseEnter() {
        dispatch('mouseenter', { id: option.id });
    }

    function handleMouseLeave() {
        dispatch('mouseleave', { id: option.id });
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="navigation-node" 
    {transform}
    class:hovered={isHovered}
    on:click={handleClick}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
>
    <!-- Glow effect when hovered -->
    {#if isHovered}
        <circle
            r="25"
            class="glow"
            fill="none"
            stroke={color}
            stroke-opacity="0.15"
            filter="url(#navigationGlow)"
        />
    {/if}

    <!-- Connection line when hovered -->
    {#if isHovered}
        <line
            class="connection-line"
            x1="0"
            y1="0"
            x2={-x}
            y2={-y}
            stroke={color}
            stroke-opacity="0.3"
            stroke-width="1"
        />
    {/if}

    <!-- Icon -->
    <text
        class="icon"
        fill={isHovered ? color : COLORS.UI.TEXT.PRIMARY}
        font-size="24"
        text-anchor="middle"
        dominant-baseline="central"
    >
        {option.icon}
    </text>

    <!-- Label -->
    <text
        class="label"
        y="30"
        fill={isHovered ? color : COLORS.UI.TEXT.SECONDARY}
        opacity={labelOpacity}
        font-size="14"
        text-anchor="middle"
        dominant-baseline="central"
    >
        {option.label}
    </text>
</g>

<style>
    .navigation-node {
        font-family: 'Orbitron', sans-serif;
        transition: transform 0.3s ease-out;
        cursor: pointer;
    }

    .glow {
        transition: stroke-opacity 0.3s ease-out;
    }

    .connection-line {
        transition: stroke-opacity 0.3s ease-out;
    }

    .icon {
        transition: fill 0.3s ease-out;
    }

    .label {
        transition: fill 0.3s ease-out, opacity 0.3s ease-out;
    }

    :global(.navigation-node text) {
        user-select: none;
    }
</style>