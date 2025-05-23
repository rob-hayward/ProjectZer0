<!-- src/lib/components/graph/nodes/ui/TextContent.svelte -->
<script lang="ts">
  import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';

  // Props
  export let text: string;
  export let radius: number;
  export let mode: 'preview' | 'detail' = 'preview';
  export let maxLines: number = 5;
  export let fontSize: string = NODE_CONSTANTS.FONTS.word.size;
  export let fontFamily: string = NODE_CONSTANTS.FONTS.word.family;
  export let color: string = 'white';
  export let alignment: 'left' | 'center' = 'center';

  // Text wrapping logic
  $: textWidth = radius * 2 - 45;
  $: maxCharsPerLine = Math.floor(textWidth / 8); // 8px per character estimate

  $: lines = text.split(' ').reduce((acc, word) => {
    const currentLine = acc[acc.length - 1] || '';
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    
    if (!currentLine || testLine.length <= maxCharsPerLine) {
      acc[acc.length - 1] = testLine;
    } else {
      acc.push(word);
    }
    return acc;
  }, ['']).slice(0, maxLines);

  // Position calculations
  $: startY = mode === 'detail' ? -radius/2 - 55 : -radius/4 - 35;
  $: startX = alignment === 'left' ? -radius + 35 : 0;
  $: textAnchor = alignment === 'left' ? 'start' : 'middle';
</script>

<g class="text-content" class:detail={mode === 'detail'}>
  {#if mode === 'detail'}
    <!-- Detail mode: use foreignObject for better text rendering -->
    <foreignObject 
      x={-radius + 20}
      y={startY}
      width={radius * 2 - 40}
      height="100"
    >
      <div 
        class="detail-text"
        style:font-family={fontFamily}
        style:font-size={fontSize}
        style:color={color}
      >
        {text}
      </div>
    </foreignObject>
  {:else}
    <!-- Preview mode: use SVG text with wrapping -->
    <text
      y={startY}
      x={startX}
      class="preview-text"
      style:font-family={fontFamily}
      style:font-size={fontSize}
      style:fill={color}
      text-anchor={textAnchor}
    >
      {#each lines as line, i}
        <tspan 
          x={startX}
          dy={i === 0 ? 0 : "1.2em"}
        >
          {line}{#if i < lines.length - 1 && lines.length === maxLines}...{/if}
        </tspan>
      {/each}
    </text>
  {/if}
</g>

<style>
  .text-content {
    pointer-events: none;
  }

  .preview-text {
    font-family: 'Orbitron', sans-serif;
    dominant-baseline: middle;
  }

  :global(.detail-text) {
    font-family: 'Orbitron', sans-serif;
    line-height: 1.4;
    text-align: left;
    padding-right: 20px;
    word-wrap: break-word;
    hyphens: auto;
  }
</style>