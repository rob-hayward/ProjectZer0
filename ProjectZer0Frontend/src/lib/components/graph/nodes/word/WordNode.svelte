<!-- src/lib/components/graph/nodes/word/WordNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { WordNode, NodeMode, NodeStyle } from '$lib/types/nodes';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseNode from '../base/BaseNode.svelte';
    import ExpandContractButton from '../common/ExpandCollapseButton.svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    
    export let data: WordNode;
    export let mode: NodeMode = 'preview';
    export let transform: string;
    export let style: NodeStyle;
 
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
    }>();
 
    function handleModeChange() {
        if ($page.params.view === 'alternative-definitions') {
            const newMode = mode === 'preview' ? 'detail' : 'preview';
            dispatch('modeChange', { mode: newMode });
        } else {
            goto(`/graph/word?word=${data.word}`);
        }
    }
</script>

{#if mode === 'preview'}
    <BasePreviewNode 
        {style}
        {transform}
    >
        <svelte:fragment slot="title">
            Word
        </svelte:fragment>

        <svelte:fragment slot="content">
            {data.word}
        </svelte:fragment>

        <svelte:fragment slot="button">
            <ExpandContractButton 
                mode="expand"
                on:click={handleModeChange}
            />
        </svelte:fragment>
    </BasePreviewNode>
{:else}
    <BaseNode 
        {style}
        {transform}
    >
        <text
            y={-10}
            class="title"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size={NODE_CONSTANTS.FONTS.title.size}
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            word
        </text>

        <text
            y={10}
            class="word"
            style:font-family={NODE_CONSTANTS.FONTS.word.family}
            style:font-size={NODE_CONSTANTS.FONTS.word.size}
            style:font-weight={NODE_CONSTANTS.FONTS.word.weight}
        >
            {data.word}
        </text>

        <ExpandContractButton 
            mode="collapse"
            y={style.previewSize/2 - 30}
            on:click={handleModeChange}
        />
    </BaseNode>
{/if}

<style>
    text {
        text-anchor: middle;
        fill: var(--text-color, white);
        user-select: none;
        dominant-baseline: middle;
    }

    .title {
        --text-color: rgba(255, 255, 255, 0.7);
    }

    .word {
        --text-color: white;
    }
</style>