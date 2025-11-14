<!-- src/lib/components/graph/nodes/ui/KeywordTags.svelte -->
<!-- UPDATED: Simple text-based links instead of pills -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { COLORS } from '$lib/constants/colors';

  export let keywords: Array<{
    word: string;
    frequency?: number;
    source: 'user' | 'ai' | 'both';
  }> = [];
  export let radius: number;
  export let maxDisplay: number = 12;
  
  // Use WORD color from synthwave palette
  export let wordColor: string = COLORS.PRIMARY.WORD; // #7B2CBF

  const dispatch = createEventDispatcher<{
    keywordClick: { word: string };
  }>();

  // Get approximate content box width for wrapping
  $: maxWidth = radius * 1.2; // Approximate width constraint based on circle radius

  $: displayedKeywords = keywords.slice(0, maxDisplay);
  $: remainingCount = Math.max(0, keywords.length - maxDisplay);

  function handleKeywordClick(keyword: { word: string; source: 'user' | 'ai' | 'both' }) {
    dispatch('keywordClick', { word: keyword.word });
  }

  let hoveredWord: string | null = null;

  function handleMouseEnter(word: string) {
    hoveredWord = word;
  }

  function handleMouseLeave() {
    hoveredWord = null;
  }

  // Build formatted text with manual wrapping
  $: formattedText = (() => {
    const titleText = 'Keyword Tags: ';
    const charWidth = 6; // Approximate character width in pixels
    const titleWidth = titleText.length * charWidth;
    
    let currentLine = titleText;
    let lines = [];
    let currentWidth = titleWidth;
    
    displayedKeywords.forEach((keyword, i) => {
      const separator = i > 0 ? ', ' : '';
      const text = separator + keyword.word;
      const textWidth = text.length * charWidth;
      
      // Check if adding this text would exceed max width
      if (currentWidth + textWidth > maxWidth && currentLine.length > titleText.length) {
        lines.push({ text: currentLine, isFirstLine: lines.length === 0 });
        currentLine = keyword.word;
        currentWidth = keyword.word.length * charWidth;
      } else {
        currentLine += text;
        currentWidth += textWidth;
      }
    });
    
    if (currentLine.length > 0) {
      lines.push({ text: currentLine, isFirstLine: lines.length === 0 });
    }
    
    return lines;
  })();

</script>

{#if keywords.length > 0}
  <g class="keyword-tags">
    {#each formattedText as line, lineIndex}
      <text
        x="0"
        y={lineIndex * 14}
        style:font-family="Inter"
        style:font-size="10px"
        style:text-anchor="middle"
        style:dominant-baseline="hanging"
      >
        {#if line.isFirstLine}
          <!-- Title on first line -->
          <tspan
            style:fill="rgba(255, 255, 255, 0.5)"
            style:font-size="9px"
            style:font-weight="600"
          >Keyword Tags: </tspan>
        {/if}
        
        <!-- Parse and render keyword names with individual hover -->
        {#each line.text.replace('Keyword Tags: ', '').split(', ') as keywordWord, i}
          {#if keywordWord.trim()}
            {@const matchingKeyword = displayedKeywords.find(k => k.word === keywordWord.trim())}
            {#if matchingKeyword}
              {#if i > 0 || !line.isFirstLine}<tspan style:fill="rgba(255, 255, 255, 0.4)">, </tspan>{/if}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <!-- svelte-ignore a11y-mouse-events-have-key-events -->
              <tspan
                style:fill={wordColor}
                style:text-decoration={hoveredWord === matchingKeyword.word ? 'underline' : 'none'}
                style:cursor="pointer"
                style:font-weight={hoveredWord === matchingKeyword.word ? '500' : '400'}
                style:font-style={matchingKeyword.source === 'ai' ? 'italic' : 'normal'}
                on:click={() => handleKeywordClick(matchingKeyword)}
                on:mouseenter={() => handleMouseEnter(matchingKeyword.word)}
                on:mouseleave={handleMouseLeave}
              >{matchingKeyword.word}</tspan>
            {/if}
          {/if}
        {/each}
      </text>
    {/each}
    
    {#if remainingCount > 0}
      <text
        x="0"
        y={(formattedText.length) * 14}
        style:font-family="Inter"
        style:font-size="9px"
        style:text-anchor="middle"
        style:dominant-baseline="hanging"
      >
        <tspan style:fill="rgba(255, 255, 255, 0.6)">+{remainingCount} more</tspan>
      </text>
    {/if}
  </g>
{/if}