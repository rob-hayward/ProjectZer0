<!-- src/lib/components/graph/nodes/common/DiscussButton.svelte -->
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
        discuss: { nodeId: string | undefined };
    }>();

    let isHovered = false;
    const scale = spring(1, {
        stiffness: 0.3,
        damping: 0.6
    });

    const filterId = `discuss-button-glow-${Math.random().toString(36).slice(2)}`;

    $: {
        scale.set(isHovered ? 1.5 : 1);
    }

    function handleClick() {
        if (disabled) return;
        
        // Dispatch regular click event
        dispatch('click');
        
        // Dispatch discuss event with nodeId if available
        dispatch('discuss', { nodeId });
        
        console.log(`[DiscussButton] Button clicked for node: ${nodeId}`);
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="discuss-button"
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
            <feFlood flood-color="#3498db" flood-opacity="0.6" result="color1"/>
            <feComposite in="color1" in2="blur1" operator="in" result="glow1"/>

            <!-- Medium glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur2"/>
            <feFlood flood-color="#3498db" flood-opacity="0.8" result="color2"/>
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
    
    <!-- Chat bubble icon -->
    <path 
        d="M -3.5 -2 A 4 4 0 1 1 3.5 -2 L 3.5 1 A 1 1 0 0 1 2.5 2 L 0 2 L -2 4 L -2 2 L -3.5 2 A 1 1 0 0 1 -4.5 1 L -4.5 -1 A 1 1 0 0 1 -3.5 -2 Z" 
        class="chat-icon"
        transform="scale(0.9)"
    />
    
    {#if isHovered}
        <text
            y="20"
            class="button-text"
            style:font-family={NODE_CONSTANTS.FONTS.hover.family}
            style:font-size={NODE_CONSTANTS.FONTS.hover.size}
            style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}
        >
            discuss
        </text>
    {/if}
</g>

<style>
    .discuss-button {
        cursor: pointer;
    }

    .discuss-button.disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    .button-circle {
        fill: transparent;
        stroke: rgba(52, 152, 219, 0.8);
        stroke-width: 2;
        transition: all 0.3s ease-out;
        transform-origin: center;
        transform-box: fill-box;
    }

    .discuss-button:hover:not(.disabled) .button-circle {
        stroke: rgba(52, 152, 219, 1);
        stroke-width: 2.5;
    }
    
    .chat-icon {
        fill: none;
        stroke: rgba(52, 152, 219, 0.8);
        stroke-width: 1.5;
        pointer-events: none;
    }
    
    .discuss-button:hover:not(.disabled) .chat-icon {
        stroke: rgba(52, 152, 219, 1);
    }

    .button-text {
        text-anchor: middle;
        fill: rgba(52, 152, 219, 0.9);
        dominant-baseline: middle;
        user-select: none;
        pointer-events: none;
    }
</style>