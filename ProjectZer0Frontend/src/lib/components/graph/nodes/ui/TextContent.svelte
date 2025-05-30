<!-- src/lib/components/graph/nodes/ui/TextContent.svelte -->
<script lang="ts">
  import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';

  // Props - support both radius-based and dimension-based usage
  export let text: string;
  export let radius: number | undefined = undefined;
  export let width: number | undefined = undefined;
  export let height: number | undefined = undefined;
  export let x: number | undefined = undefined;
  export let y: number | undefined = undefined;
  export let mode: 'preview' | 'detail' = 'preview';
  export let maxLines: number = 5;
  export let fontSize: string = '14px';
  export let fontFamily: string = 'Inter';
  export let fontWeight: string = '400';
  export let color: string = 'white';
  export let alignment: 'left' | 'center' = 'center';
  export let verticalAlign: 'top' | 'center' | 'bottom' = 'center';

  // Calculate dimensions based on what's provided
  $: effectiveWidth = width !== undefined ? width : radius !== undefined ? radius * 2 - 20 : 200;
  $: effectiveHeight = height !== undefined ? height : 100;
  $: effectiveX = x !== undefined ? x : radius !== undefined ? -radius + 10 : 0;
  $: effectiveY = y !== undefined ? y : -20;

  // Less aggressive text wrapping - adjust character width estimation
  $: charWidth = fontSize === '12px' ? 6 : fontSize === '14px' ? 7 : fontSize === '16px' ? 8 : 7;
  $: maxCharsPerLine = Math.floor(effectiveWidth / charWidth);

  // Text wrapping logic
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

  // Position calculations for preview mode
  $: lineHeight = parseInt(fontSize) * 1.4;
  $: totalTextHeight = lines.length * lineHeight;
  $: startY = mode === 'preview' ? effectiveY : effectiveY + lineHeight;
  $: startX = alignment === 'left' ? effectiveX : 0;
  $: textAnchor = alignment === 'left' ? 'start' : 'middle';
</script>

<g class="text-content" class:detail={mode === 'detail'}>
  {#if mode === 'detail'}
    <!-- Detail mode: use foreignObject for better text rendering -->
    <foreignObject 
      x={effectiveX}
      y={effectiveY}
      width={effectiveWidth}
      height={effectiveHeight}
    >
      <div 
        class="detail-text"
        class:center-aligned={alignment === 'center'}
        style:font-family={fontFamily}
        style:font-size={fontSize}
        style:font-weight={fontWeight}
        style:color={color}
        style:text-align={alignment}
      >
        {text}
      </div>
    </foreignObject>
  {:else}
    <!-- Preview mode: use SVG text with wrapping -->
    {#each lines as line, i}
      <text
        x={startX}
        y={startY + (i * lineHeight)}
        class="preview-text"
        style:font-family={fontFamily}
        style:font-size={fontSize}
        style:font-weight={fontWeight}
        style:fill={color}
        text-anchor={textAnchor}
        dominant-baseline="middle"
      >
        {line}{#if i === lines.length - 1 && lines.length === maxLines && text.split(' ').length > lines.join(' ').split(' ').length}...{/if}
      </text>
    {/each}
  {/if}
</g>

<style>
  .text-content {
    pointer-events: none;
  }

  .preview-text {
    font-family: 'Inter', sans-serif;
    dominant-baseline: middle;
  }

  :global(.detail-text) {
    font-family: 'Inter', sans-serif;
    line-height: 1.4;
    word-wrap: break-word;
    hyphens: auto;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    padding: 0 10px;
    box-sizing: border-box;
  }

  :global(.detail-text.center-aligned) {
    justify-content: center;
  }
</style>