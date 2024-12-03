<script lang="ts">
    import type { WordPreviewProps } from '$lib/types/layout';
    import type { PreviewNodeStyle } from './styles/previewNodeStyles';
    import BasePreviewNode from './base/BasePreviewNode.svelte';
    import { drawTitle, drawText } from './base/previewDrawing';
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
        drawTitle(ctx, "Word:", centerX, titleY, style);
        
        // Draw the word centered
        drawText(ctx, wordData.word, centerX, wordY, style);
        
        // If hovered, draw "Click to view" text
        if (isHovered) {
            PreviewNodeCanvas.setTextStyle(ctx, {
                font: PREVIEW_TEXT_STYLES.hover.font,
                color: PREVIEW_TEXT_STYLES.hover.color,
                align: 'center',
                baseline: 'middle'
            });
            ctx.fillText("Click to view", centerX, centerY + (style.size * 0.3));
        }
    }
</script>

<BasePreviewNode 
    nodeType="word"
    {isExpanded}
    {drawContent}
/>