<!-- src/lib/components/graph/nodes/word/SvgWordNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { WordNode, NodeMode } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import BaseSvgNode from '../base/BaseSvgNode.svelte';
    
    export let data: WordNode;
    export let mode: NodeMode = 'preview';
    export let transform: string;

    const style = {
        previewSize: NODE_CONSTANTS.SIZES.WORD.preview,
        detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
        colors: NODE_CONSTANTS.COLORS.WORD,
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE
    };

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

<BaseSvgNode 
    {style}
    {transform}
    on:click={handleClick}
    on:hover={handleHover}
    let:isHovered
>
    <defs>
        <radialGradient id="word-gradient" cx="50%" cy="50%" r="50%">
            <stop 
                offset="0%" 
                stop-color={style.colors.gradient.start}
            />
            <stop 
                offset="100%" 
                stop-color={style.colors.gradient.end}
            />
        </radialGradient>

        <filter id="glow-effect">
            <feGaussianBlur 
                in="SourceGraphic" 
                stdDeviation={NODE_CONSTANTS.SVG.filters.glow.deviation}
            />
            <feComponentTransfer>
                <feFuncA 
                    type="linear" 
                    slope={NODE_CONSTANTS.SVG.filters.glow.strength}
                />
            </feComponentTransfer>
        </filter>
    </defs>

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
</BaseSvgNode>

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