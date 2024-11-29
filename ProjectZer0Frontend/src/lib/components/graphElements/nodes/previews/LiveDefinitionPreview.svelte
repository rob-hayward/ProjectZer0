<!-- src/lib/components/graphElements/nodes/previews/LiveDefinitionPreview.svelte -->
<script lang="ts">
    import type { DefinitionPreviewProps } from '$lib/types/layout';
    import GraphNode from '../graphNode/GraphNode.svelte';
    import { PreviewNodeCanvas, PREVIEW_TEXT_STYLES } from './previewNodeCanvas';
  
    // Props
    export let definition: DefinitionPreviewProps['definition'];
    export let word: DefinitionPreviewProps['word'];
    export let isExpanded: DefinitionPreviewProps['isExpanded'] = false;
  
    // Internal state
    let isHovered = false;
    const NODE_SIZE = 150;
    const PADDING = 15;
    const LINE_HEIGHT = 8;
  
    function drawLiveDefinitionPreview(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        const startX = centerX - (NODE_SIZE / 2) + PADDING;
        let y = centerY - (NODE_SIZE / 3);
        const maxWidth = NODE_SIZE - (PADDING * 2);
  
        // Draw header
        PreviewNodeCanvas.setTextStyle(ctx, PREVIEW_TEXT_STYLES.title);
        ctx.fillText("Live Definition", startX, y);
        y += LINE_HEIGHT * 1.5;
        
        // Draw word reference
        const wordText = word;
        if (ctx.measureText(wordText).width > maxWidth) {
            let truncated = wordText;
            while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1);
            }
            ctx.fillText(truncated + '...', startX, y);
        } else {
            ctx.fillText(wordText, startX, y);
        }
        y += LINE_HEIGHT * 2;
  
        // Draw the definition text
        PreviewNodeCanvas.setTextStyle(ctx, PREVIEW_TEXT_STYLES.value);
        PreviewNodeCanvas.drawWrappedText(
            ctx,
            definition.text,
            startX,
            y,
            maxWidth,
            LINE_HEIGHT
        );
    }
  
    function handleClick() {
        // Dispatch click event to parent
        // To be implemented in graph layout
    }
</script>
  
<div class="live-definition-preview">
    <GraphNode
        width={NODE_SIZE}
        height={NODE_SIZE}
        {isHovered}
        {isExpanded}
        drawContent={drawLiveDefinitionPreview}
        on:hover={({ detail }) => isHovered = detail.isHovered}
        on:click={handleClick}
    />
</div>
  
<style>
    .live-definition-preview {
        width: 150px;
        height: 150px;
    }
</style>