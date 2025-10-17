<!-- src/lib/components/graph/nodes/ui/KeywordTags.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let keywords: Array<{
    word: string;
    frequency?: number;
    source: 'user' | 'ai' | 'both';
  }> = [];
  export let radius: number;
  export let maxDisplay: number = 8;
  export let wordColor: string = 'rgba(79, 70, 229, 0.8)'; // INDIGO - Word node color

  const dispatch = createEventDispatcher<{
    keywordClick: { word: string };
  }>();

  // Pill dimensions and spacing
  const pillHeight = 24;
  const pillPadding = 12;
  const pillSpacing = 8;
  const maxNameLength = 20; // Truncate after 20 chars

  $: displayedKeywords = keywords.slice(0, maxDisplay);
  $: remainingCount = Math.max(0, keywords.length - maxDisplay);

  // Calculate pill width based on text length
  function getPillWidth(word: string): number {
    const displayWord = truncateWord(word);
    // Approximate: 7 pixels per character + padding
    return displayWord.length * 7 + (pillPadding * 2);
  }

  function truncateWord(word: string): string {
    return word.length > maxNameLength 
      ? word.slice(0, maxNameLength) + '...' 
      : word;
  }

  // Get border style based on source
  function getBorderStyle(source: 'user' | 'ai' | 'both'): string {
    switch (source) {
      case 'user':
        return 'solid'; // User-provided keywords
      case 'ai':
        return 'dashed'; // AI-extracted keywords
      case 'both':
        return 'solid'; // Both sources (could use gradient in future)
      default:
        return 'solid';
    }
  }

  // Get stroke-dasharray value
  function getDashArray(source: 'user' | 'ai' | 'both'): string {
    return source === 'ai' ? '4,2' : '0';
  }

  function handleKeywordClick(keyword: { word: string; source: 'user' | 'ai' | 'both' }) {
    dispatch('keywordClick', { word: keyword.word });
  }

  // Calculate cumulative x positions for pills
  $: pillPositions = displayedKeywords.reduce((acc, keyword, i) => {
    const prevX = i > 0 ? acc[i - 1].x + acc[i - 1].width + pillSpacing : 0;
    return [
      ...acc,
      {
        x: prevX,
        width: getPillWidth(keyword.word),
        keyword
      }
    ];
  }, [] as Array<{ x: number; width: number; keyword: typeof displayedKeywords[0] }>);

  // Position for "+N more" text
  $: moreTextX = pillPositions.length > 0 
    ? pillPositions[pillPositions.length - 1].x + pillPositions[pillPositions.length - 1].width + pillSpacing 
    : 0;

  // Center the entire group horizontally
  $: totalWidth = moreTextX + (remainingCount > 0 ? 60 : 0);
  $: groupOffsetX = -totalWidth / 2;

  // Generate unique filter IDs
  const glowFilterId = `keyword-glow-${Math.random().toString(36).slice(2)}`;

  let hoveredIndex: number | null = null;

  function handleMouseEnter(index: number) {
    hoveredIndex = index;
  }

  function handleMouseLeave() {
    hoveredIndex = null;
  }
</script>

<defs>
  <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>
    <feFlood flood-color={wordColor} flood-opacity="0.8" result="color"/>
    <feComposite in="color" in2="blur" operator="in" result="glow"/>
    <feMerge>
      <feMergeNode in="glow"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>

{#if keywords.length > 0}
  <g class="keyword-tags" transform="translate({groupOffsetX}, -{radius + 50})">
    {#each pillPositions as { x, width, keyword }, i}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <!-- svelte-ignore a11y-mouse-events-have-key-events -->
      <g
        class="keyword-pill"
        transform="translate({x}, 0) scale({hoveredIndex === i ? 1.1 : 1})"
        style:transform-origin="center"
        style:cursor="pointer"
        on:click={() => handleKeywordClick(keyword)}
        on:mouseenter={() => handleMouseEnter(i)}
        on:mouseleave={handleMouseLeave}
      >
        <!-- Pill background -->
        <rect
          x="0"
          y="0"
          width={width}
          height={pillHeight}
          rx="12"
          ry="12"
          fill={wordColor}
          stroke={hoveredIndex === i ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)'}
          stroke-width="1"
          stroke-dasharray={getDashArray(keyword.source)}
          filter={hoveredIndex === i ? `url(#${glowFilterId})` : 'none'}
          class:hovered={hoveredIndex === i}
        />

        <!-- Keyword text -->
        <text
          x={width / 2}
          y={pillHeight / 2}
          style:font-family="Inter"
          style:font-size="11px"
          style:font-weight="500"
          style:fill="rgba(255, 255, 255, 0.95)"
          style:text-anchor="middle"
          style:dominant-baseline="middle"
          style:pointer-events="none"
          style:user-select="none"
        >
          {truncateWord(keyword.word)}
        </text>

        <!-- Tooltip for full word if truncated or to show source -->
        {#if hoveredIndex === i}
          <title>{keyword.word} ({keyword.source === 'user' ? 'user-provided' : keyword.source === 'ai' ? 'AI-extracted' : 'both'})</title>
        {/if}
      </g>
    {/each}

    <!-- "+N more" text if keywords exceed maxDisplay -->
    {#if remainingCount > 0}
      <text
        x={moreTextX}
        y={pillHeight / 2}
        style:font-family="Inter"
        style:font-size="11px"
        style:font-weight="400"
        style:fill="rgba(255, 255, 255, 0.6)"
        style:dominant-baseline="middle"
        style:pointer-events="none"
      >
        +{remainingCount} more
      </text>
    {/if}
  </g>
{/if}

<style>
  .keyword-tags {
    transition: transform 0.2s ease-out;
  }

  .keyword-pill {
    transition: transform 0.2s ease-out;
  }

  .keyword-pill rect {
    transition: stroke 0.2s ease-out, filter 0.2s ease-out;
  }

  .keyword-pill:active {
    transform: scale(0.95);
  }
</style>