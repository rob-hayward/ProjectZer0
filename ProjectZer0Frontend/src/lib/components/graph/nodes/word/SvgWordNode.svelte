<!-- src/lib/components/graph/nodes/word/SvgWordNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { WordNode, NodeMode } from '$lib/types/nodes';
    import type { SvgNodePosition } from '$lib/types/svgLayout';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import BaseSvgPreviewNode from '../base/BaseSvgPreviewNode.svelte';
    import BaseSvgZoomedNode from '../base/BaseSvgDetailNode.svelte';
    import SvgWordPreview from '../word/SvgWordPreview.svelte';
    import SvgWordZoomed from './SvgWordDetail.svelte';
    
    export let data: WordNode;
    export let mode: NodeMode = 'preview';
    export let position: SvgNodePosition;

    const style = {
        previewSize: NODE_CONSTANTS.SIZES.WORD.preview,
        zoomedSize: NODE_CONSTANTS.SIZES.WORD.zoomed,
        colors: NODE_CONSTANTS.COLORS.WORD,
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT
    };

    const dispatch = createEventDispatcher();

    function handleZoom() {
        dispatch('modeChange', { mode: mode === 'preview' ? 'zoomed' : 'preview' });
    }
</script>

{#if mode === 'preview'}
    <BaseSvgPreviewNode 
        {style} 
        {position}
        on:zoom={handleZoom}
        let:centerX
        let:centerY
        let:radius
        let:isHovered
    >
        <svelte:fragment slot="default">
            <SvgWordPreview 
                word={data.word}
                {style}
                {centerX}
                {centerY}
                {radius}
                {isHovered}
            />
        </svelte:fragment>
    </BaseSvgPreviewNode>
{:else}
    <BaseSvgZoomedNode 
        {style}
        on:close={handleZoom}
    >
        <SvgWordZoomed 
            {data}
            {style}
        />
    </BaseSvgZoomedNode>
{/if}