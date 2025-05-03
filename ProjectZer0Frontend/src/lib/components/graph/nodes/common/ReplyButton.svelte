<!-- src/lib/components/graph/nodes/common/ReplyButton.svelte -->
<script lang="ts">
    import { spring } from 'svelte/motion';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import { createEventDispatcher } from 'svelte';

    export let y: number = 0;
    export let x: number = 0; 
    export let nodeId: string | undefined = undefined;
    export let disabled: boolean = false;
    
    const dispatch = createEventDispatcher<{
        click: void;
        reply: { nodeId: string | undefined };
    }>();

    let isHovered = false;
    const scale = spring(1, {
        stiffness: 0.3,
        damping: 0.6
    });

    const filterId = `reply-button-glow-${Math.random().toString(36).slice(2)}`;

    $: {
        scale.set(isHovered ? 1.5 : 1);
    }

    function handleClick() {
        if (disabled) return;
        
        // Dispatch regular click event
        dispatch('click');
        
        // Dispatch reply event with nodeId if available
        dispatch('reply', { nodeId });
        
        console.log(`[ReplyButton] Button clicked for node: ${nodeId}`);
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="reply-button"
    class:disabled
    transform="translate({x}, {y})"
    on:mouseenter={() => isHovered = true}
    on:mouseleave={() => isHovered = false}
    on:click={handleClick}
>
    <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <!-- Strong outer glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur1"/>
            <feFlood flood-color="#9b59b6" flood-opacity="0.6" result="color1"/>
            <feComposite in="color1" in2="blur1" operator="in" result="glow1"/>

            <!-- Medium glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur2"/>
            <feFlood flood-color="#9b59b6" flood-opacity="0.8" result="color2"/>
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
        style:filter={isHovered && !disabled ? `url(#${filterId})` : 'none'}
    />
    
    <!-- Reply arrow icon -->
    <path 
        d="M -3 -2 L 0 -2 L 0 -4 L 3 0 L 0 4 L 0 2 L -3 2 Z" 
        class="reply-icon"
        transform="scale(0.8)"
    />
    
    {#if isHovered}
        <text
            y="20"
            class="button-text"
            style:font-family={NODE_CONSTANTS.FONTS.hover.family}
            style:font-size={NODE_CONSTANTS.FONTS.hover.size}
            style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}
        >
            reply
        </text>
    {/if}
</g>

<style>
    .reply-button {
        cursor: pointer;
    }

    .reply-button.disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    .button-circle {
        fill: transparent;
        stroke: rgba(155, 89, 182, 0.8);
        stroke-width: 2;
        transition: all 0.3s ease-out;
        transform-origin: center;
        transform-box: fill-box;
    }

    .reply-button:hover:not(.disabled) .button-circle {
        stroke: rgba(155, 89, 182, 1);
        stroke-width: 2.5;
    }
    
    .reply-icon {
        fill: rgba(155, 89, 182, 0.8);
        pointer-events: none;
    }
    
    .reply-button:hover:not(.disabled) .reply-icon {
        fill: rgba(155, 89, 182, 1);
    }

    .button-text {
        text-anchor: middle;
        fill: rgba(155, 89, 182, 0.9);
        dominant-baseline: middle;
        user-select: none;
        pointer-events: none;
    }
</style>