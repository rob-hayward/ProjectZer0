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

    // Create a unique filter ID for this instance
    const filterId = `reply-button-glow-${Math.random().toString(36).slice(2)}`;

    // Set button color to white for better contrast
    const buttonColor = "#FFFFFF";

    // Increased button size (from 8 to 10)
    const buttonRadius = 10;

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
            <feFlood flood-color={buttonColor} flood-opacity="0.6" result="color1"/>
            <feComposite in="color1" in2="blur1" operator="in" result="glow1"/>

            <!-- Medium glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur2"/>
            <feFlood flood-color={buttonColor} flood-opacity="0.8" result="color2"/>
            <feComposite in="color2" in2="blur2" operator="in" result="glow2"/>

            <feMerge>
                <feMergeNode in="glow1"/>
                <feMergeNode in="glow2"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
    </defs>

    <circle 
        r={buttonRadius}
        class="button-circle"
        style:transform="scale({$scale})"
        style:filter={isHovered && !disabled ? `url(#${filterId})` : 'none'}
        style:stroke={buttonColor}
    />
    
    <!-- Material Symbol icon using text element - increased size -->
    <text 
        class="material-symbols-outlined"
        x="0" 
        y="3.5"
        style:font-size="12px"
        style:text-anchor="middle"
        style:dominant-baseline="middle"
        style:fill={buttonColor}
    >
        add_comment
    </text>
    
    {#if isHovered}
        <text
            y="24"
            class="button-text"
            style:font-family={NODE_CONSTANTS.FONTS.hover.family}
            style:font-size={NODE_CONSTANTS.FONTS.hover.size}
            style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}
            style:fill={buttonColor}
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
        stroke-width: 2;
        transition: all 0.3s ease-out;
        transform-origin: center;
        transform-box: fill-box;
    }

    .reply-button:hover:not(.disabled) .button-circle {
        stroke-width: 2.5;
    }
    
    .button-text {
        text-anchor: middle;
        dominant-baseline: middle;
        user-select: none;
        pointer-events: none;
    }
    
    :global(.material-symbols-outlined) {
        font-family: 'Material Symbols Outlined';
        font-variation-settings: 'FILL' 1;
        pointer-events: none;
    }
</style>