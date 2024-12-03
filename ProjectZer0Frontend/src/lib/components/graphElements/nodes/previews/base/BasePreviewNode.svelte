<script lang="ts">
    import type { BasePreviewProps } from '$lib/types/layout';
    import type { PreviewNodeStyle, PreviewNodeType } from '../styles/previewNodeStyles';
    import GraphNode from '../../graphNode/GraphNode.svelte';
    import { getNodeStyle } from '../styles/previewNodeStyles';
    import { createEventDispatcher } from 'svelte';

    // Props
    export let nodeType: PreviewNodeType;
    export let isExpanded: BasePreviewProps['isExpanded'] = false;
    export let drawContent: (
        ctx: CanvasRenderingContext2D, 
        centerX: number, 
        centerY: number, 
        style: PreviewNodeStyle,
        isHovered: boolean
    ) => void;

    // Internal state
    let isHovered = false;
    const dispatch = createEventDispatcher();
    const style = getNodeStyle(nodeType);

    function handleClick() {
        dispatch('click');
    }

    function drawWithStyle(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        drawContent(ctx, centerX, centerY, style, isHovered);
    }
</script>

<div 
    class="preview-node" 
    style="width: {style.size}px; height: {style.size}px;"
>
    <GraphNode
        width={style.size}
        height={style.size}
        {isHovered}
        {isExpanded}
        drawContent={drawWithStyle}
        on:hover={({ detail }) => isHovered = detail.isHovered}
        on:click={handleClick}
    />
</div>

<style>
    .preview-node {
        position: relative;
    }
</style>