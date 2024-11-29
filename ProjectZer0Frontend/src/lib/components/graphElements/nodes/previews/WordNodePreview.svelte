<!-- src/lib/components/graphElements/nodes/previews/WordNodePreview.svelte -->
<script lang="ts">
    import type { WordPreviewProps } from '$lib/types/layout';
    import GraphNode from '../graphNode/GraphNode.svelte';
    import { PreviewNodeCanvas, PREVIEW_TEXT_STYLES } from './previewNodeCanvas';
  
    // Props
    export let wordData: WordPreviewProps['wordData'];
    export let isExpanded: WordPreviewProps['isExpanded'] = false;
  
    // Internal state
    let isHovered = false;
    const NODE_SIZE = 150;
    const PADDING = 15;
    const LINE_HEIGHT = 8;
  
    function drawWordPreview(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        const startX = centerX - (NODE_SIZE / 2) + PADDING;
        let y = centerY - (LINE_HEIGHT * 2);  // Start slightly higher
        const maxWidth = NODE_SIZE - (PADDING * 2);
  
        // Draw title
        PreviewNodeCanvas.setTextStyle(ctx, PREVIEW_TEXT_STYLES.title);
        ctx.fillText("Word Node", startX, y);
        y += LINE_HEIGHT * 2;  // Add extra space between title and word
      
        // Draw word value
        PreviewNodeCanvas.setTextStyle(ctx, PREVIEW_TEXT_STYLES.value);
        const text = wordData.word;
        
        // Handle long words
        if (ctx.measureText(text).width > maxWidth) {
            let truncated = text;
            while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1);
            }
            ctx.fillText(truncated + '...', startX, y);
        } else {
            ctx.fillText(text, startX, y);
        }
    }
  
    function handleClick() {
        // Dispatch click event to parent
        // To be implemented in graph layout
    }
</script>
  
<div class="word-node-preview">
    <GraphNode
        width={NODE_SIZE}
        height={NODE_SIZE}
        {isHovered}
        {isExpanded}
        drawContent={drawWordPreview}
        on:hover={({ detail }) => isHovered = detail.isHovered}
        on:click={handleClick}
    />
</div>
  
<style>
    .word-node-preview {
        width: 150px;
        height: 150px;
    }
</style>