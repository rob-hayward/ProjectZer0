<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/common/ShowHideButton.svelte -->
<script lang="ts">
    import { spring } from 'svelte/motion';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import { createEventDispatcher } from 'svelte';

    // This indicates the CURRENT visibility state - if true, node is hidden; if false, node is visible
    export let isHidden: boolean = false;
    export let y: number = 0;
    export let x: number = 20; // Default offset to the right by 20 units
    export const nodeId: string = ""; // Changed to export const since it's only for external reference
    
    const dispatch = createEventDispatcher<{
        click: void;
        visibilityChange: { isHidden: boolean };
    }>();

    let isHovered = false;
    const scale = spring(1, {
        stiffness: 0.3,
        damping: 0.6
    });

    const filterId = `visibility-button-glow-${Math.random().toString(36).slice(2)}`;
    const uniqueId = Math.random().toString(36).substring(2, 9);

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
            <feFlood flood-color="#AAAAAA" flood-opacity="0.6" result="color1"/>
            <feComposite in="color1" in2="blur1" operator="in" result="glow1"/>

            <!-- Medium glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur2"/>
            <feFlood flood-color="#AAAAAA" flood-opacity="0.8" result="color2"/>
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
    
    <!-- Eye icon with slash when hidden (when button shows "show"), without slash when visible (when button shows "hide") -->
    <path 
        d="M 0 -1 C 2 -1, 4 -3, 6 -1 C 4 1, 2 1, 0 -1 Z" 
        class="eye-icon"
        transform="scale(0.7)"
    />
    
    <!-- Pupil dot -->
    <circle 
        cx="0"
        cy="-1"
        r="1.2"
        class="pupil"
        transform="scale(0.7)"
    />
    
    <!-- Slash when node is hidden (when button shows "show") -->
    {#if isHidden}
        <line 
            x1="-6" 
            y1="3" 
            x2="6" 
            y2="-5" 
            class="slash-line"
            transform="scale(0.7)"
        />
    {/if}
    
    {#if isHovered}
        <text
            y="20"
            class="button-text"
            style:font-family={NODE_CONSTANTS.FONTS.hover.family}
            style:font-size={NODE_CONSTANTS.FONTS.hover.size}
            style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}
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
        stroke: rgba(170, 170, 170, 0.8);
        stroke-width: 2;
        transition: all 0.3s ease-out;
        transform-origin: center;
        transform-box: fill-box;
    }

    .visibility-button:hover .button-circle {
        stroke: rgba(200, 200, 200, 1);
        stroke-width: 2.5;
    }
    
    .eye-icon {
        fill: none;
        stroke: rgba(170, 170, 170, 0.8);
        stroke-width: 1.5;
        pointer-events: none;
    }
    
    .pupil {
        fill: rgba(170, 170, 170, 0.8);
        pointer-events: none;
    }
    
    .slash-line {
        stroke: rgba(170, 170, 170, 0.8);
        stroke-width: 1.5;
        pointer-events: none;
    }

    .button-text {
        text-anchor: middle;
        fill: rgba(170, 170, 170, 0.9);
        dominant-baseline: middle;
        user-select: none;
        pointer-events: none;
    }
</style>