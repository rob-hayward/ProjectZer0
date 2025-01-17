<!-- src/lib/components/graph/nodes/definition/DefinitionPreview.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Definition, NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import { getVoteValue } from '../utils/nodeUtils';

    export let definition: Definition;
    export let type: 'live' | 'alternative';
    export let style: NodeStyle;
    export let transform: string = "";
    export let word: string;

    const dispatch = createEventDispatcher<{
        hover: { data: Definition; isHovered: boolean };
        modeChange: { mode: 'preview' | 'detail' };
    }>();

    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        dispatch('hover', { data: definition, isHovered: event.detail.isHovered });
    }

    function handleExpandClick() {
        dispatch('modeChange', { mode: 'detail' });
    }

    // Size calculations
    $: votes = getVoteValue(definition.votes);
    $: textWidth = style.previewSize - (style.padding.preview * 2) - 45; // Added extra padding
    $: maxCharsPerLine = Math.floor(textWidth / 8); // Approximate character width

    // Text wrapping
    $: content = `${word}: ${definition.text}`;
    $: lines = content.split(' ').reduce((acc, word) => {
        const currentLine = acc[acc.length - 1] || '';
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        
        if (!currentLine || testLine.length <= maxCharsPerLine) {
            acc[acc.length - 1] = testLine;
        } else {
            acc.push(word);
        }
        return acc;
    }, ['']);

    // Score display
    $: score = votes;
    $: scoreDisplay = score > 0 ? `+${score}` : score.toString();
</script>

<BasePreviewNode 
    {style}
    {transform}
>
    <svelte:fragment slot="title">
        <text
            y={-style.previewSize/4 - 50}
            class="title centered"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size="12px"
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            {type === 'live' ? 'Live Definition' : 'Alternative Definition'}
        </text>
    </svelte:fragment>

    <svelte:fragment slot="content">
        <text
            y={-style.previewSize/4 + 20}
            x={-style.previewSize/2 + 35}
            class="content left-aligned"
            style:font-family={NODE_CONSTANTS.FONTS.word.family}
            style:font-size={NODE_CONSTANTS.FONTS.word.size}
            style:font-weight={NODE_CONSTANTS.FONTS.word.weight}
        >
            {#each lines as line, i}
                <tspan 
                    x={-style.previewSize/2 + 40}
                    dy={i === 0 ? 0 : "1.2em"}
                >
                    {line}
                </tspan>
            {/each}
        </text>
    </svelte:fragment>

    <svelte:fragment slot="score">
        <text
            y={-style.previewSize/4 + 210}
            class="score"
            style:font-family={NODE_CONSTANTS.FONTS.word.family}
            style:font-size="14px"
            style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
        >
            {scoreDisplay}
        </text>
    </svelte:fragment>

    <svelte:fragment slot="button">
        <g transform="translate(0, {style.previewSize/4 - 190})">
            <ExpandCollapseButton 
                mode="expand"
                on:click={handleExpandClick}
            />
        </g>
    </svelte:fragment>
</BasePreviewNode>

<style>
    text {
        dominant-baseline: middle;
        user-select: none;
    }

    .centered {
        text-anchor: middle;
    }

    .left-aligned {
        text-anchor: start;
    }

    .title {
        fill: rgba(255, 255, 255, 0.7);
    }

    .content {
        fill: white;
    }

    .score {
        fill: rgba(255, 255, 255, 0.7);
    }
</style>