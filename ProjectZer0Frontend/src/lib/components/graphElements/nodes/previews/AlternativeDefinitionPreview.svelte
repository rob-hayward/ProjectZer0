<!-- src/lib/components/graphElements/nodes/previews/AlternativeDefinitionPreview.svelte -->
<script lang="ts">
    import type { Definition } from '$lib/types/nodes';
    import GraphNode from '../graphNode/GraphNode.svelte';
    import { PREVIEW_TEXT_STYLES } from '../graphNode/previewStyles';
    import { BaseZoomedCanvas } from '$lib/components/graphElements/layouts/baseZoomedCanvas';
  
    // Props
    export let definition: Definition;
    export let isExpanded = false;
    export let word: string;
  
    // Internal state
    let isHovered = false;
    const NODE_SIZE = 150; // Same size as word preview for consistency
  
    function drawAlternativeDefinitionPreview(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
      const startX = centerX - (NODE_SIZE / 2) + 20; // Add padding
      let y = centerY - 20; // Start above center
  
      // Draw word
      BaseZoomedCanvas.setTextStyle(ctx, PREVIEW_TEXT_STYLES.title);
      ctx.fillText(word, startX, y);
      y += 20;
  
      // Draw alternative definition label
      ctx.fillText("alternative", startX, y);
      ctx.fillText("definition:", startX, y + 20);
      y += 50;
  
      // Draw the definition text
      BaseZoomedCanvas.setTextStyle(ctx, PREVIEW_TEXT_STYLES.value);
      const definitionText = definition.text;
      const maxWidth = NODE_SIZE - 40;
  
      // Truncate definition to fit
      let truncated = definitionText;
      while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
      }
      ctx.fillText(truncated + '...', startX, y);
    }
  
    function handleClick() {
      // Dispatch event to parent to handle expansion
      // This will be implemented in the graph layout
    }
  </script>
  
  <div class="alternative-definition-preview">
    <GraphNode
      width={NODE_SIZE}
      height={NODE_SIZE}
      {isHovered}
      {isExpanded}
      drawContent={drawAlternativeDefinitionPreview}
      on:hover={({ detail }) => isHovered = detail.isHovered}
      on:click={handleClick}
    />
  </div>
  
  <style>
    .alternative-definition-preview {
      width: 150px;
      height: 150px;
    }
  </style>