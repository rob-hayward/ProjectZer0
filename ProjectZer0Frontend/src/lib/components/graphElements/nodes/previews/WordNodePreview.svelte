<script lang="ts">
    import type { WordPreviewProps } from '$lib/types/layout';
    import type { PreviewNodeStyle } from './styles/previewNodeStyles';
    import BasePreviewNode from './base/BasePreviewNode.svelte';
    import { drawText } from './base/previewDrawing';
    import { PreviewNodeCanvas, PREVIEW_TEXT_STYLES } from './base/previewNodeCanvas';
    
    export let wordData: WordPreviewProps['wordData'];
    export let isExpanded: WordPreviewProps['isExpanded'] = false;
    
    function drawContent(
        ctx: CanvasRenderingContext2D, 
        centerX: number, 
        centerY: number, 
        style: PreviewNodeStyle,
        isHovered: boolean
    ) {
        // Calculate positions relative to center
        const titleY = centerY - (style.size * 0.25);
        const wordY = centerY + (style.size * 0.05);

        // Draw "Word:" title centered
        drawText(ctx, "word node", centerX, titleY, PREVIEW_TEXT_STYLES.word.title);
        
        // Draw the word centered
        drawText(ctx, wordData.word, centerX, wordY, PREVIEW_TEXT_STYLES.word.value);
        
        // If hovered, draw "Click to view" text
        if (isHovered) {
            drawText(
                ctx, 
                "Click to view", 
                centerX, 
                centerY + (style.size * 0.3),
                PREVIEW_TEXT_STYLES.word.hover
            );
        }
    }
</script>

<BasePreviewNode 
    nodeType="word"
    {isExpanded}
    {drawContent}
/>