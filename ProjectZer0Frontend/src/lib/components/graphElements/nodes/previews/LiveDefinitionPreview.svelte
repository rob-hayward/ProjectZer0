<!-- ProjectZer0Frontend/src/lib/components/graphElements/nodes/previews/LiveDefinitionPreview.svelte -->
<script lang="ts">
    import type { DefinitionPreviewProps } from '$lib/types/layout';
    import type { PreviewNodeStyle } from './styles/previewNodeStyles';
    import BasePreviewNode from './base/BasePreviewNode.svelte';
    import { drawText, drawWrappedText } from './base/previewDrawing';
    import { PreviewNodeCanvas, PREVIEW_TEXT_STYLES } from './base/previewNodeCanvas';
    
    export let definition: DefinitionPreviewProps['definition'];
    export let word: DefinitionPreviewProps['word'];
    export let isZoomed: DefinitionPreviewProps['isZoomed'] = false;
    
    function drawContent(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, style: PreviewNodeStyle) {
        const startX = centerX - (style.size / 2) + style.padding;
        let y = centerY - (style.size / 3);
        const maxWidth = style.size - (style.padding * 2);

        // Draw title
        drawText(ctx, "Live Definition", startX, y, PREVIEW_TEXT_STYLES.definition.title);
        y += style.lineHeight * 1.5;
        
        // Draw word
        drawText(ctx, word, startX, y, PREVIEW_TEXT_STYLES.definition.value);
        y += style.lineHeight * 2;
        
        // Draw definition text wrapped
        drawWrappedText(ctx, definition.text, startX, y, maxWidth, style, 'left');
    }
</script>

<BasePreviewNode 
    nodeType="liveDefinition"
    {isZoomed}
    {drawContent}
/>