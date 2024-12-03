<script lang="ts">
    import type { DefinitionPreviewProps } from '$lib/types/layout';
    import type { PreviewNodeStyle } from './styles/previewNodeStyles';
    import BasePreviewNode from './base/BasePreviewNode.svelte';
    import { drawTitle, drawTruncatedText, drawWrappedText } from './base/previewDrawing';
    import { PREVIEW_TEXT_STYLES } from './base/previewNodeCanvas';
    
    export let definition: DefinitionPreviewProps['definition'];
    export let word: DefinitionPreviewProps['word'];
    export let isExpanded: DefinitionPreviewProps['isExpanded'] = false;
    
    function drawContent(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, style: PreviewNodeStyle) {
        const startX = centerX - (style.size / 2) + style.padding;
        let y = centerY - (style.size / 3);
        const maxWidth = style.size - (style.padding * 2);

        drawTitle(ctx, "Alternative", startX, y, style);
        y += style.lineHeight * 1.5;
        
        drawTruncatedText(ctx, word, startX, y, maxWidth, style);
        y += style.lineHeight * 2;
        
        drawWrappedText(ctx, definition.text, startX, y, maxWidth, style);
    }
</script>

<BasePreviewNode 
    nodeType="alternativeDefinition"
    {isExpanded}
    {drawContent}
/>