<!-- src/lib/components/graph/nodes/word/WordNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { WordNode, NodeMode, NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import BaseNode from '../base/BaseNode.svelte';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    
    export let data: WordNode;
    export let mode: NodeMode = 'preview';
    export let transform: string;
    export let style: NodeStyle;
 
    const dispatch = createEventDispatcher<{
        click: { data: WordNode };
        hover: { data: WordNode; isHovered: boolean };
        modeChange: { mode: NodeMode };
    }>();
 
    function handleNodeClick() {
        if ($page.params.view === 'alternative-definitions') {
            // In alternative definitions view, toggle mode locally
            const newMode = mode === 'preview' ? 'detail' : 'preview';
            dispatch('modeChange', { mode: newMode });
        } else {
            // In other views, navigate to word detail
            goto(`/graph/word?word=${data.word}`);
        }
    }
 
    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        dispatch('hover', { data, isHovered: event.detail.isHovered });
    }
 
    const previewHoverText = 'click to expand';
    const detailHoverText = 'click to collapse';
</script>

{#if mode === 'preview'}
    <BasePreviewNode 
        {style}
        {transform}
        hoverText={previewHoverText}
        on:detail={handleNodeClick}
        on:hover={handleHover}
    >
        <svelte:fragment slot="default" let:isHovered>
            <text
                y={-style.padding.preview}
                class="title"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size={NODE_CONSTANTS.FONTS.title.size}
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                Word Node
            </text>

            <text
                y={style.padding.preview}
                class="word"
                style:font-family={NODE_CONSTANTS.FONTS.value.family}
                style:font-size={NODE_CONSTANTS.FONTS.value.size}
                style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
            >
                {data.word}
            </text>
        </svelte:fragment>
    </BasePreviewNode>
{:else}
    <BaseNode 
        {style}
        {transform}
        on:click={handleNodeClick}
        on:hover={handleHover}
        let:isHovered
    >
        <text
            y={-style.padding.preview}
            class="title"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size={NODE_CONSTANTS.FONTS.title.size}
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            Word Node
        </text>

        <text
            y={style.padding.preview}
            class="word"
            style:font-family={NODE_CONSTANTS.FONTS.value.family}
            style:font-size={NODE_CONSTANTS.FONTS.value.size}
            style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
        >
            {data.word}
        </text>

        {#if isHovered}
            <text
                y={style.padding.preview * 2}
                class="hover-text"
                style:font-family={NODE_CONSTANTS.FONTS.hover.family}
                style:font-size={NODE_CONSTANTS.FONTS.hover.size}
                style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}
            >
                {detailHoverText}
            </text>
        {/if}
    </BaseNode>
{/if}

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
</style>