<!-- src/lib/components/graphElements/nodes/previews/WordNodePreview.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { WordNode, Definition } from '$lib/types/nodes';
    import GraphNode from '../graphNode/GraphNode.svelte';
    import { PREVIEW_TEXT_STYLES } from '../graphNode/previewStyles';
    import { BaseZoomedCanvas } from '$lib/components/graphElements/layouts/baseZoomedCanvas';
  
    // Props
    export let wordData: WordNode;
    export let isExpanded = false;
  
    // Internal state
    let isHovered = false;
    const NODE_SIZE = 150; // Smaller size for preview
  
    function getLiveDefinition(definitions: Definition[]): Definition | null {
      if (!definitions || definitions.length === 0) return null;
  
      const userDefinitions = definitions.filter(d => d.createdBy !== 'FreeDictionaryAPI');
      return userDefinitions.sort((a, b) => 
        getVoteValue(b.votes) - getVoteValue(a.votes)
      )[0] || null;
    }
  
    function getVoteValue(votes: any): number {
      if (typeof votes === 'number') return votes;
      if (votes && typeof votes === 'object' && 'low' in votes) {
        return votes.low;
      }
      return 0;
    }
  
    function drawWordPreview(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
      const startX = centerX - (NODE_SIZE / 2) + 20; // Add padding
      let y = centerY - 20; // Start above center
  
      // Draw word
      BaseZoomedCanvas.setTextStyle(ctx, PREVIEW_TEXT_STYLES.title);
      ctx.fillText("word:", startX, y);
      y += 20;
      
      BaseZoomedCanvas.setTextStyle(ctx, PREVIEW_TEXT_STYLES.value);
      const wordText = wordData.word;
      // Truncate if too long
      const maxWidth = NODE_SIZE - 40;
      if (ctx.measureText(wordText).width > maxWidth) {
        let truncated = wordText;
        while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + '...', startX, y);
      } else {
        ctx.fillText(wordText, startX, y);
      }
      y += 30;
  
      // Draw definition
      const liveDefinition = getLiveDefinition(wordData.definitions);
      if (liveDefinition) {
        BaseZoomedCanvas.setTextStyle(ctx, PREVIEW_TEXT_STYLES.title);
        ctx.fillText("definition:", startX, y);
        y += 20;
  
        BaseZoomedCanvas.setTextStyle(ctx, PREVIEW_TEXT_STYLES.value);
        const definitionText = liveDefinition.text;
        // Truncate definition to fit
        let truncated = definitionText;
        while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + '...', startX, y);
      }
    }
  
    function handleClick() {
      // Dispatch event to parent to handle expansion
      // This will be implemented in the graph layout
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