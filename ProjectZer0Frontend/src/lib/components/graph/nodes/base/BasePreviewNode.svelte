<!-- src/lib/components/graph/nodes/base/BasePreviewNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { spring } from 'svelte/motion';
    import type { NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from './BaseNodeConstants';
    import BaseNode from './BaseNode.svelte';

    export let style: NodeStyle;
    export let transform: string;
    export let hoverText: string = 'click to view detailed node';

    let isHovered = false;
    
    const dispatch = createEventDispatcher<{
        detail: void;
        hover: { isHovered: boolean };
    }>();

    function handleClick() {
        dispatch('detail');
    }

    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        isHovered = event.detail.isHovered;
        dispatch('hover', event.detail);
    }

    // Spring animation for hover effect
    const hoverScale = spring(1, {
        stiffness: 0.1,
        damping: 0.6
    });

    $: hoverScale.set(isHovered ? 1.05 : 1);
</script>

<BaseNode 
    {style}
    {transform}
    {isHovered}
    on:click={handleClick}
    on:hover={handleHover}
>
    <g transform={`scale(${$hoverScale})`}>
        <slot {isHovered} {style} />

        {#if isHovered}
            <text
                y={style.padding.preview * 2}
                class="hover-text"
                style:font-family={NODE_CONSTANTS.FONTS.hover.family}
                style:font-size={NODE_CONSTANTS.FONTS.hover.size}
                style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}
            >
                {hoverText}
            </text>
        {/if}
    </g>
</BaseNode>

<style>
    .hover-text {
        text-anchor: middle;
        fill: rgba(255, 255, 255, 0.5);
        transition: opacity 0.3s ease-out;
        user-select: none;
    }
</style>