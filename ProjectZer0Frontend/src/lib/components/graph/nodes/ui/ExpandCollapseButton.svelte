<!-- src/lib/components/graph/nodes/common/ExpandCollapseButton.svelte -->
<script lang="ts">
    import { spring } from 'svelte/motion';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import { createEventDispatcher, onMount } from 'svelte';
    import type { NodeMode } from '$lib/types/graph/enhanced';

    export let mode: 'expand' | 'collapse';
    export let y: number = 0;
    export let x: number = -20; // Default to left side positioning
    // Node position for centering
    export let nodeX: number | undefined = undefined;
    export let nodeY: number | undefined = undefined;
    // Optional ID to identify which node is changing
    export let nodeId: string | undefined = undefined;

    const dispatch = createEventDispatcher<{
        click: void;
        modeChange: { 
            mode: NodeMode; 
            position?: { x: number; y: number };
            nodeId?: string;
        };
    }>();

    let isHovered = false;
    const scale = spring(1, {
        stiffness: 0.3,
        damping: 0.6
    });

    const filterId = `button-glow-${Math.random().toString(36).slice(2)}`;

    $: {
        if (mode === 'expand') {
            scale.set(isHovered ? 1.5 : 1);
        } else {
            scale.set(isHovered ? 1 : 1.5);
        }
    }

    function handleClick() {
        // Dispatch regular click event
        dispatch('click');
        
        // Determine the new mode
        const newMode: NodeMode = mode === 'expand' ? 'detail' : 'preview';
        
        // Prepare event data
        const eventData: { 
            mode: NodeMode; 
            position?: { x: number; y: number };
            nodeId?: string;
        } = { mode: newMode };
        
        // Include position data if available - always do this for accurate centering
        if (nodeX !== undefined && nodeY !== undefined) {
            eventData.position = { x: nodeX, y: nodeY };
        }
        
        // Include node ID if provided
        if (nodeId !== undefined) {
            eventData.nodeId = nodeId;
        }
        
        // Dispatch enhanced mode change event
        dispatch('modeChange', eventData);
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="mode-button"
    transform="translate({x}, {y})"
    on:mouseenter={() => isHovered = true}
    on:mouseleave={() => isHovered = false}
    on:click={handleClick}
>
    <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <!-- Strong outer glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur1"/>
            <feFlood flood-color="#FFFFFF" flood-opacity="0.6" result="color1"/>
            <feComposite in="color1" in2="blur1" operator="in" result="glow1"/>

            <!-- Medium glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur2"/>
            <feFlood flood-color="#FFFFFF" flood-opacity="0.8" result="color2"/>
            <feComposite in="color2" in2="blur2" operator="in" result="glow2"/>

            <feMerge>
                <feMergeNode in="glow1"/>
                <feMergeNode in="glow2"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
    </defs>

    <circle 
        r="8"
        class="button-circle"
        style:transform="scale({$scale})"
        style:filter={isHovered ? `url(#${filterId})` : 'none'}
    />
    
    {#if isHovered}
        <text
            y="20"
            class="button-text"
            style:font-family={NODE_CONSTANTS.FONTS.hover.family}
            style:font-size={NODE_CONSTANTS.FONTS.hover.size}
            style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}
        >
            {mode}
        </text>
    {/if}
</g>

<style>
    .mode-button {
        cursor: pointer;
    }

    .button-circle {
        fill: transparent;
        stroke: rgba(255, 255, 255, 0.8);
        stroke-width: 2;
        transition: all 0.3s ease-out;
        transform-origin: center;
        transform-box: fill-box;
    }

    .mode-button:hover .button-circle {
        stroke: rgba(255, 255, 255, 1);
        stroke-width: 2.5;
    }

    .button-text {
        text-anchor: middle;
        fill: rgba(255, 255, 255, 0.9);
        dominant-baseline: middle;
        user-select: none;
    }
</style>