<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/common/ShowHideButton.svelte -->
<script lang="ts">
    import { spring } from 'svelte/motion';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import { createEventDispatcher } from 'svelte';

    // This indicates the CURRENT visibility state - if true, node is hidden; if false, node is visible
    export let isHidden: boolean = false;
    export let y: number = 0;
    export let x: number = 20; // Default offset to the right by 20 units
    export const nodeId: string | undefined = undefined; // Changed to export const since it's only for external reference
    
    const dispatch = createEventDispatcher<{
        click: void;
        visibilityChange: { isHidden: boolean };
    }>();

    let isHovered = false;
    const scale = spring(1, {
        stiffness: 0.3,
        damping: 0.6
    });

    // Create a unique filter ID for this instance
    const filterId = `visibility-button-glow-${Math.random().toString(36).slice(2)}`;
    const uniqueId = Math.random().toString(36).substring(2, 9);

    // Set button color to white for better contrast (matching other buttons)
    const buttonColor = "#FFFFFF";

    // Increased button size to match other buttons (from 8 to 10)
    const buttonRadius = 10;

    $: {
        scale.set(isHovered ? 1.5 : 1);
    }

    // Log the current state for debugging
    $: console.log(`[ShowHideButton-${uniqueId}] Current state: ${isHidden ? 'hidden' : 'visible'}, Button shows "${isHidden ? 'show' : 'hide'}"`);

    function handleClick() {
        // When the button is clicked we want to toggle the visibility state
        // If isHidden is true (node is hidden), pressing "show" will set isHidden to false
        // If isHidden is false (node is visible), pressing "hide" will set isHidden to true
        const newIsHidden = !isHidden;
        
        console.log(`[ShowHideButton-${uniqueId}] Button clicked. Changing visibility from ${isHidden ? 'hidden' : 'visible'} to ${newIsHidden ? 'hidden' : 'visible'}`);
        
        // Dispatch event with the NEW state
        dispatch('click');
        dispatch('visibilityChange', { isHidden: newIsHidden });
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="visibility-button"
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
        style:filter={isHovered ? `url(#${filterId})` : 'none'}
        style:stroke={buttonColor}
    />
    
    <!-- Material Symbol for Visibility (when button shows "hide") or Visibility_off (when button shows "show") -->
    <text 
        class="material-symbols-outlined"
        x="0" 
        y="3.5"
        style:font-size="12px"
        style:text-anchor="middle"
        style:dominant-baseline="middle"
        style:fill={buttonColor}
    >
        {isHidden ? 'visibility' : 'visibility_off'}
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
            {isHidden ? 'show' : 'hide'}
        </text>
    {/if}
</g>

<style>
    .visibility-button {
        cursor: pointer;
        z-index: 100;
        pointer-events: all;
    }

    .button-circle {
        fill: transparent;
        stroke-width: 2;
        transition: all 0.3s ease-out;
        transform-origin: center;
        transform-box: fill-box;
    }

    .visibility-button:hover .button-circle {
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