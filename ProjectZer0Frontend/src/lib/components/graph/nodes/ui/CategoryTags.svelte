<!-- src/lib/components/graph/nodes/ui/CategoryTags.svelte -->
<!-- UPDATED: Simple text-based links instead of pills -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { COLORS } from '$lib/constants/colors';

  export let categories: Array<{
    id: string;
    name: string;
  }> = [];
  export let radius: number;
  export let maxDisplay: number = 8;
  
  // Use CATEGORY color from synthwave palette
  export let categoryColor: string = COLORS.PRIMARY.CATEGORY; // #00FFB0

  const dispatch = createEventDispatcher<{
    categoryClick: { categoryId: string; categoryName: string };
  }>();

  // Get approximate content box width for wrapping
  // Statement detail node has ~400px content box, use 75% of that
  $: maxWidth = radius * 1.2; // Approximate width constraint based on circle radius

  $: displayedCategories = categories.slice(0, maxDisplay);
  $: remainingCount = Math.max(0, categories.length - maxDisplay);

  function handleCategoryClick(category: { id: string; name: string }) {
    dispatch('categoryClick', {
      categoryId: category.id,
      categoryName: category.name
    });
  }

  let hoveredId: string | null = null;

  function handleMouseEnter(id: string) {
    hoveredId = id;
  }

  function handleMouseLeave() {
    hoveredId = null;
  }

  // Build formatted text with manual wrapping
  $: formattedText = (() => {
    const titleText = 'Category Tags: ';
    const charWidth = 6; // Approximate character width in pixels
    const titleWidth = titleText.length * charWidth;
    
    let currentLine = titleText;
    let lines = [];
    let currentWidth = titleWidth;
    
    displayedCategories.forEach((category, i) => {
      const separator = i > 0 ? ', ' : '';
      const text = separator + category.name;
      const textWidth = text.length * charWidth;
      
      // Check if adding this text would exceed max width
      if (currentWidth + textWidth > maxWidth && currentLine.length > titleText.length) {
        lines.push({ text: currentLine, isFirstLine: lines.length === 0 });
        currentLine = category.name;
        currentWidth = category.name.length * charWidth;
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

{#if categories.length > 0}
  <g class="category-tags">
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
          >Category Tags: </tspan>
        {/if}
        
        <!-- Parse and render category names with individual hover -->
        {#each line.text.replace('Category Tags: ', '').split(', ') as categoryName, i}
          {#if categoryName.trim()}
            {@const matchingCategory = displayedCategories.find(c => c.name === categoryName.trim())}
            {#if matchingCategory}
              {#if i > 0 || !line.isFirstLine}<tspan style:fill="rgba(255, 255, 255, 0.4)">, </tspan>{/if}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <!-- svelte-ignore a11y-mouse-events-have-key-events -->
              <tspan
                style:fill={categoryColor}
                style:text-decoration={hoveredId === matchingCategory.id ? 'underline' : 'none'}
                style:cursor="pointer"
                style:font-weight={hoveredId === matchingCategory.id ? '500' : '400'}
                on:click={() => handleCategoryClick(matchingCategory)}
                on:mouseenter={() => handleMouseEnter(matchingCategory.id)}
                on:mouseleave={handleMouseLeave}
              >{matchingCategory.name}</tspan>
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