<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { WordNode, NodeMode, NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import BaseNode from '../base/BaseNode.svelte';
    
    export let data: WordNode;
    export let mode: NodeMode = 'preview';
    export let transform: string;
    export let style: NodeStyle;

    const dispatch = createEventDispatcher<{
        click: { data: WordNode };
        hover: { data: WordNode; isHovered: boolean };
        modeChange: { mode: NodeMode };
    }>();

    function handleClick() {
        dispatch('click', { data });
        dispatch('modeChange', { 
            mode: mode === 'preview' ? 'detail' : 'preview' 
        });
    }

    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        dispatch('hover', { data, isHovered: event.detail.isHovered });
    }
</script>

<BaseNode 
    {style}
    {transform}
    on:click={handleClick}
    on:hover={handleHover}
    let:isHovered
>
    <!-- Title -->
    <text
        y={-style.padding.preview}
        class="title"
        style:font-family={NODE_CONSTANTS.FONTS.title.family}
        style:font-size={NODE_CONSTANTS.FONTS.title.size}
        style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
    >
        Word Node
    </text>

    <!-- Word -->
    <text
        y={style.padding.preview}
        class="word"
        style:font-family={NODE_CONSTANTS.FONTS.value.family}
        style:font-size={NODE_CONSTANTS.FONTS.value.size}
        style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
    >
        {data.word}
    </text>

    <!-- Hover text -->
    {#if isHovered}
        <text
            y={style.padding.preview * 2}
            class="hover-text"
            style:font-family={NODE_CONSTANTS.FONTS.hover.family}
            style:font-size={NODE_CONSTANTS.FONTS.hover.size}
            style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}
        >
            click to zoom
        </text>
    {/if}
</BaseNode>

<style>
    text {
        text-anchor: middle;
        fill: var(--text-color, white);
        user-select: none;
    }

    .title {
        --text-color: rgba(255, 255, 255, 0.7);
    }

    .word {
        --text-color: white;
    }

    .hover-text {
        --text-color: rgba(255, 255, 255, 0.5);
        transition: opacity var(--animation-duration, 0.3s) var(--animation-easing, ease-out);
    }

    :global(.word-node) {
        transition: transform var(--animation-duration, 0.3s) var(--animation-easing, ease-out);
    }
</style>