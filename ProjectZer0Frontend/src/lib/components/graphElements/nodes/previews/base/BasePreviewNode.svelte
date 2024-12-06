<!-- ProjectZer0Frontend/src/lib/components/graphElements/nodes/previews/base/BasePreviewNode.svelte -->
<script lang="ts">
    import type { BasePreviewProps } from '$lib/types/graphLayout';
    import type { PreviewNodeStyle, PreviewNodeType } from '../styles/previewNodeStyles';
    import GraphNode from '../../graphNode/GraphNode.svelte';
    import { getNodeStyle } from '../styles/previewNodeStyles';
    import { createEventDispatcher } from 'svelte';
    import { spring } from 'svelte/motion';
    import ZoomNodeCanvas from '../../zoomNode/ZoomNodeCanvas.svelte';

    // Props
    export let nodeType: PreviewNodeType;
    export let isZoomed: BasePreviewProps['isZoomed'] = false;
    export let drawContent: (
        ctx: CanvasRenderingContext2D, 
        centerX: number, 
        centerY: number, 
        style: PreviewNodeStyle,
        isHovered: boolean
    ) => void;

    interface ClickDetail {
        x: number;
        y: number;
        width: number;
        height: number;
    }

    // Internal state
    let isHovered = false;
    let expandedBounds: ClickDetail | null = null;
    const dispatch = createEventDispatcher<{
        expand: { bounds: ClickDetail };
        click: ClickDetail;
    }>();
    const style = getNodeStyle(nodeType);

    // Animation springs
    const scale = spring(1, { stiffness: 0.3, damping: 0.8 });
    const posX = spring(0);
    const posY = spring(0);

    function handleClick({ detail }: { detail: ClickDetail }) {
        expandedBounds = detail;
        dispatch('expand', { bounds: detail });
    }

    function drawWithStyle(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        drawContent(ctx, centerX, centerY, style, isHovered);
    }

    $: if (isZoomed && expandedBounds) {
        // Calculate center of screen
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;
        
        // Calculate required translation
        const dx = screenCenterX - (expandedBounds.x + expandedBounds.width / 2);
        const dy = screenCenterY - (expandedBounds.y + expandedBounds.height / 2);
        
        posX.set(dx);
        posY.set(dy);
        scale.set(3); // Adjust scale factor as needed
    }
</script>

<div 
    class="preview-node" 
    class:zoomed={isZoomed}
    style="
        width: {isZoomed ? '100%' : `${style.size}px`}; 
        height: {isZoomed ? '100%' : `${style.size}px`};
        transform: translate3d({$posX}px, {$posY}px, 0) scale({$scale});
    "
>
    {#if isZoomed}
        <div class="zoomed-container">
            <ZoomNodeCanvas
                width={window.innerWidth}
                height={window.innerHeight}
                draw={drawWithStyle}
                backgroundColor="transparent"
            />
        </div>
    {:else}
        <GraphNode
            width={style.size}
            height={style.size}
            {isHovered}
            {isZoomed}
            drawContent={drawWithStyle}
            on:hover={({ detail }) => isHovered = detail.isHovered}
            on:click={handleClick}
        />
    {/if}
</div>

<style>
    .preview-node {
        position: relative;
        transition: transform 0.3s ease-out;
    }

    .preview-node.zoomed {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 100;
    }

    .zoomed-container {
        width: 100%;
        height: 100%;
        position: relative;
    }
</style>