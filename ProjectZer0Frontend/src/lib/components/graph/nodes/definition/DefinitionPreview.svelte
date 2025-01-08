<!-- src/lib/components/graph/nodes/definition/DefinitionPreview.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Definition, NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import { goto } from '$app/navigation';

    export let word: string;
    export let definition: Definition;
    export let type: 'live' | 'alternative';
    export let style: NodeStyle;
    export let transform: string = "";

    const dispatch = createEventDispatcher<{
        click: { data: Definition };
        hover: { data: Definition; isHovered: boolean };
        modeChange: { mode: 'preview' | 'detail' };
    }>();

    function handleDetailView() {
        if (type === 'live') {
            goto(`/graph/word?word=${word}`);
        } else {
            dispatch('click', { data: definition });
        }
    }

    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        dispatch('hover', { data: definition, isHovered: event.detail.isHovered });
    }

    // Size calculations for definition text container
    $: textContainerWidth = style.previewSize - (style.padding.preview * 2);
    $: textContainerHeight = style.previewSize * 0.4;  // 40% of preview size for text
</script>

<BasePreviewNode 
    {style}
    {transform}
    hoverText={type === 'live' ? 'click to view word details' : 'click to view definition'}
    on:detail={handleDetailView}
    on:hover={handleHover}
>
    <svelte:fragment slot="default" let:isHovered>
        <!-- Title -->
        <text
            y={-style.previewSize/4}
            class="title"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size={NODE_CONSTANTS.FONTS.title.size}
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            {type === 'live' ? 'Live Definition' : 'Alternative Definition'}
        </text>

        <!-- Definition text -->
        <foreignObject
            x={-textContainerWidth/2}
            y={-textContainerHeight/2}
            width={textContainerWidth}
            height={textContainerHeight}
        >
            <div class="definition-text">
                {definition.text}
            </div>
        </foreignObject>

        <!-- Votes (if not API definition) -->
        {#if definition.createdBy !== 'FreeDictionaryAPI'}
            <text
                y={style.previewSize/3 - style.lineHeight.preview}
                class="votes"
                style:font-family={NODE_CONSTANTS.FONTS.value.family}
                style:font-size={NODE_CONSTANTS.FONTS.value.size}
                style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
            >
                Votes: {definition.votes}
            </text>
        {/if}
    </svelte:fragment>
</BasePreviewNode>

<style>
    text {
        text-anchor: middle;
        fill: var(--text-color, white);
        user-select: none;
    }

    .title {
        --text-color: rgba(255, 255, 255, 0.7);
    }

    .definition-text {
        color: rgba(255, 255, 255, 0.9);
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        line-height: 1.4;
        text-align: center;
        overflow-wrap: break-word;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 10px;
    }

    .votes {
        --text-color: rgba(255, 255, 255, 0.7);
    }
</style>