<script lang="ts">
    import type { DefinitionPreviewProps } from '$lib/types/layout';
    import type { PreviewNodeStyle } from './styles/previewNodeStyles';
    import BasePreviewNode from './base/BasePreviewNode.svelte';
    import { drawTitle, drawText, drawWrappedText } from './base/previewDrawing';
    import { PREVIEW_TEXT_STYLES } from './base/previewNodeCanvas';
    
    export let definition: DefinitionPreviewProps['definition'];
    export let word: DefinitionPreviewProps['word'];
    export let isExpanded: DefinitionPreviewProps['isExpanded'] = false;
    
    function drawContent(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, style: PreviewNodeStyle) {
        const startX = centerX - (style.size / 2) + style.padding;
        let y = centerY - (style.size / 3);
        const maxWidth = style.size - (style.padding * 2);

        // Draw title left-aligned
        drawTitle(ctx, "Alternative", startX, y, style, 'left');
        y += style.lineHeight * 1.5;
        
        // Draw word left-aligned
        drawText(ctx, word, startX, y, style, 'left');
        y += style.lineHeight * 2;
        
        // Draw definition text left-aligned and wrapped
        drawWrappedText(ctx, definition.text, startX, y, maxWidth, style, 'left');
    }
</script>

<BasePreviewNode 
    nodeType="alternativeDefinition"
    {isExpanded}
    {drawContent}
/>