<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { spring } from 'svelte/motion';
    import type { NodeStyle } from '$lib/types/nodes';
    import BaseNode from './BaseNode.svelte';

    export let style: NodeStyle;
    export let drawContent: (
        ctx: CanvasRenderingContext2D, 
        centerX: number, 
        centerY: number, 
        style: NodeStyle,
        isHovered: boolean
    ) => void;

    // Internal state
    let isHovered = false;
    let bounds: DOMRect | null = null;

    const dispatch = createEventDispatcher<{
        zoom: { bounds: DOMRect };
    }>();

    function handleZoom(event: CustomEvent<{ bounds: DOMRect }>) {
        bounds = event.detail.bounds;
        dispatch('zoom', { bounds });
    }

    function drawWithStyle(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        drawContent(ctx, centerX, centerY, style, isHovered);
    }
</script>

<div class="preview-node">
    <BaseNode
        mode="preview"
        width={style.previewSize}
        height={style.previewSize}
        {isHovered}
        drawContent={drawWithStyle}
        on:hover={({ detail }) => isHovered = detail.isHovered}
        on:zoom={handleZoom}
    />
</div>

<style>
    .preview-node {
        position: relative;
    }
</style>