<!-- src/lib/components/graph/nodes/ui/CategoryTags.svelte -->
<!-- UPDATED: Using DEFINITION color from new color scheme -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { COLORS } from '$lib/constants/colors';

  export let categories: Array<{
    id: string;
    name: string;
  }> = [];
  export let radius: number;
  export let maxDisplay: number = 3;
  
  // UPDATED: Use DEFINITION color from new synthwave palette
  export let pillColor: string = `${COLORS.PRIMARY.DEFINITION}CC`; // #9D4EDD with 80% opacity

  const dispatch = createEventDispatcher<{
    categoryClick: { categoryId: string; categoryName: string };
  }>();

  // Pill dimensions and spacing
  const pillHeight = 24;
  const pillPadding = 12;
  const pillSpacing = 8;
  const maxNameLength = 20; // Truncate after 20 chars

  $: displayedCategories = categories.slice(0, maxDisplay);
  $: remainingCount = Math.max(0, categories.length - maxDisplay);

  // Calculate pill width based on text length
  function getPillWidth(name: string): number {
    const displayName = truncateName(name);
    // Approximate: 7 pixels per character + padding
    return displayName.length * 7 + (pillPadding * 2);
  }

  function truncateName(name: string): string {
    return name.length > maxNameLength 
      ? name.slice(0, maxNameLength) + '...' 
      : name;
  }

  function handleCategoryClick(category: { id: string; name: string }) {
    dispatch('categoryClick', {
      categoryId: category.id,
      categoryName: category.name
    });
  }

  // Calculate cumulative x positions for pills
  $: pillPositions = displayedCategories.reduce((acc, category, i) => {
    const prevX = i > 0 ? acc[i - 1].x + acc[i - 1].width + pillSpacing : 0;
    return [
      ...acc,
      {
        x: prevX,
        width: getPillWidth(category.name),
        category
      }
    ];
  }, [] as Array<{ x: number; width: number; category: typeof displayedCategories[0] }>);

  // Position for "+N more" text
  $: moreTextX = pillPositions.length > 0 
    ? pillPositions[pillPositions.length - 1].x + pillPositions[pillPositions.length - 1].width + pillSpacing 
    : 0;

  // Center the entire group horizontally
  $: totalWidth = moreTextX + (remainingCount > 0 ? 60 : 0);
  $: groupOffsetX = -totalWidth / 2;

  // Generate unique filter IDs
  const glowFilterId = `category-glow-${Math.random().toString(36).slice(2)}`;

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
    <feFlood flood-color={pillColor} flood-opacity="0.8" result="color"/>
    <feComposite in="color" in2="blur" operator="in" result="glow"/>
    <feMerge>
      <feMergeNode in="glow"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>

{#if categories.length > 0}
  <g class="category-tags" transform="translate({groupOffsetX}, -{radius + 25})">
    {#each pillPositions as { x, width, category }, i}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <!-- svelte-ignore a11y-mouse-events-have-key-events -->
      <g
        class="category-pill"
        transform="translate({x}, 0) scale({hoveredIndex === i ? 1.1 : 1})"
        style:transform-origin="center"
        style:cursor="pointer"
        on:click={() => handleCategoryClick(category)}
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
          fill={pillColor}
          stroke={hoveredIndex === i ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)'}
          stroke-width="1"
          filter={hoveredIndex === i ? `url(#${glowFilterId})` : 'none'}
          class:hovered={hoveredIndex === i}
        />

        <!-- Category name text -->
        <text
          x={width / 2}
          y={pillHeight / 2}
          style:font-family="Orbitron"
          style:font-size="11px"
          style:font-weight="500"
          style:fill="rgba(255, 255, 255, 0.95)"
          style:text-anchor="middle"
          style:dominant-baseline="middle"
          style:pointer-events="none"
          style:user-select="none"
        >
          {truncateName(category.name)}
        </text>

        <!-- Tooltip for full name if truncated -->
        {#if hoveredIndex === i && category.name.length > maxNameLength}
          <title>{category.name}</title>
        {/if}
      </g>
    {/each}

    <!-- "+N more" text if categories exceed maxDisplay -->
    {#if remainingCount > 0}
      <text
        x={moreTextX}
        y={pillHeight / 2}
        style:font-family="Orbitron"
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
  .category-tags {
    transition: transform 0.2s ease-out;
  }

  .category-pill {
    transition: transform 0.2s ease-out;
  }

  .category-pill rect {
    transition: stroke 0.2s ease-out, filter 0.2s ease-out;
  }

  .category-pill:active {
    transform: scale(0.95);
  }
</style>