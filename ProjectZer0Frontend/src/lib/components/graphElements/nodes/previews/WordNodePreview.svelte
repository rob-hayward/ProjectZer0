<!-- ProjectZer0Frontend/src/lib/components/graphElements/nodes/previews/WordNodePreview.svelte -->
<script lang="ts">
    import type { WordPreviewProps } from '$lib/types/layout';
    import type { PreviewNodeStyle } from './styles/previewNodeStyles';
    import BasePreviewNode from './base/BasePreviewNode.svelte';
    import { drawTitle, drawTruncatedText } from './base/previewDrawing';
    import { PREVIEW_TEXT_STYLES } from './base/previewNodeCanvas';
    
    export let wordData: WordPreviewProps['wordData'];
    export let isExpanded: WordPreviewProps['isExpanded'] = false;
    
    function drawContent(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, style: PreviewNodeStyle) {
        const startX = centerX - (style.size / 2) + style.padding;
        let y = centerY - (style.lineHeight * 2);
        const maxWidth = style.size - (style.padding * 2);

        drawTitle(ctx, "Word Node", startX, y, style);
        y += style.lineHeight * 2;
        
        drawTruncatedText(ctx, wordData.word, startX, y, maxWidth, style);
    }
</script>

<BasePreviewNode 
    nodeType="word"
    {isExpanded}
    {drawContent}
/>