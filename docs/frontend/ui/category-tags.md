# CategoryTags.svelte - Usage Guide

## Overview

`CategoryTags.svelte` displays clickable category pills on nodes in detail mode. When clicked, loads the category node onto the graph and centers the view on it.

---

## Props

```typescript
export let categories: Array<{
  id: string;
  name: string;
}> = [];
export let radius: number;
export let maxDisplay: number = 3;
export let pillColor: string = 'rgba(156, 89, 182, 0.8)'; // Configurable placeholder
```

### Props Details

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `categories` | `Array<{id, name}>` | Yes | `[]` | Array of category objects (max 3 per node) |
| `radius` | `number` | Yes | - | Node radius for positioning calculations |
| `maxDisplay` | `number` | No | `3` | Maximum pills to show before "+N more" |
| `pillColor` | `string` | No | Purple | RGBA color string (will be updated when category color decided) |

---

## Events

```typescript
dispatch('categoryClick', { 
  categoryId: string;
  categoryName: string;
});
```

### Event Details

**`categoryClick`** - Fired when user clicks a category pill

**Payload:**
- `categoryId`: UUID of the category
- `categoryName`: Display name of the category

**Expected Handler:**
```typescript
async function handleCategoryClick(event: CustomEvent) {
  const { categoryId, categoryName } = event.detail;
  
  // 1. Fetch category node from API
  const response = await fetch(`/categories/${categoryId}/with-contents`);
  const { nodes, relationships } = await response.json();
  
  // 2. Add category node to graph (NOT the word nodes yet)
  const categoryNode = nodes.find(n => n.type === 'category');
  graphManager.addNode(categoryNode);
  
  // 3. Center graph on the new category node
  graphManager.centerOnNode(categoryId);
}
```

---

## Visual Design

### Appearance

- **Shape:** Rounded pill (12px border radius)
- **Height:** 24px
- **Color:** Purple placeholder `rgba(156, 89, 182, 0.8)` (configurable via prop)
- **Border:** White semi-transparent (0.2 opacity normal, 0.4 on hover)
- **Text:** 11px Inter, weight 500, white

### Hover Effects

- Scale to 1.1x
- Glow filter applied
- Border opacity increases
- Cursor changes to pointer
- Tooltip shows full name if truncated

### Truncation

- Names longer than 20 characters are truncated with "..."
- Hover shows full name in browser tooltip

### Layout

- Pills arranged horizontally
- 8px spacing between pills
- Centered as a group
- "+N more" text after last pill if categories exceed `maxDisplay`

---

## Positioning

**Located:** Below node title, above content area in detail mode

**Transform:** `translate(0, -{radius + 25})`

**In Node Structure:**
```svelte
<BaseDetailNode {node}>
  <svelte:fragment slot="title" let:radius>
    <NodeHeader title="Statement" {radius} />
  </svelte:fragment>
  
  <!-- CategoryTags positioned here -->
  {#if nodeData.categories?.length}
    <CategoryTags
      categories={nodeData.categories}
      {radius}
      on:categoryClick={handleCategoryClick}
    />
  {/if}
  
  <!-- KeywordTags would go below (next component) -->
  
  <ContentBox mode="detail">
    <!-- Content, voting, stats -->
  </ContentBox>
</BaseDetailNode>
```

---

## Usage Example

### In a Node Component (e.g., StatementNode.svelte)

```svelte
<script lang="ts">
  import { CategoryTags } from '../ui';
  import type { RenderableNode } from '$lib/types/graph/enhanced';
  
  export let node: RenderableNode;
  
  const nodeData = node.data as StatementNode;
  
  // Extract categories from node data
  $: categories = nodeData.categories || [];
  
  async function handleCategoryClick(event: CustomEvent) {
    const { categoryId, categoryName } = event.detail;
    
    console.log(`Loading category: ${categoryName} (${categoryId})`);
    
    try {
      // Fetch category node (just the category, not words yet)
      const response = await fetch(`/categories/${categoryId}/with-contents`);
      const expansion = await response.json();
      
      // Filter to get just the category node
      const categoryNode = expansion.nodes.find(n => n.type === 'category');
      
      if (categoryNode) {
        // Add to graph and center view
        // (These functions would be provided by graph manager/store)
        await addNodeToGraph(categoryNode);
        centerGraphOnNode(categoryId);
      }
    } catch (error) {
      console.error('Failed to load category:', error);
    }
  }
</script>

{#if node.mode === 'detail'}
  <BaseDetailNode {node} on:modeChange>
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="Statement" {radius} mode="detail" />
    </svelte:fragment>
    
    <!-- CategoryTags (only in detail mode, only if categories exist) -->
    {#if categories.length > 0}
      <CategoryTags
        {categories}
        radius={node.radius}
        maxDisplay={3}
        pillColor="rgba(156, 89, 182, 0.8)"
        on:categoryClick={handleCategoryClick}
      />
    {/if}
    
    <ContentBox nodeType="statement" mode="detail">
      <!-- Rest of node content -->
    </ContentBox>
  </BaseDetailNode>
{/if}
```

---

## Node Types That Use CategoryTags

| Node Type | Uses CategoryTags | Notes |
|-----------|-------------------|-------|
| Statement | ✅ Yes | In detail mode |
| OpenQuestion | ✅ Yes | In detail mode |
| Answer | ✅ Yes | In detail mode |
| Quantity | ✅ Yes | In detail mode |
| Evidence | ✅ Yes | In detail mode |
| Category | ❌ No | Is a category itself |
| Word | ❌ No | No categories assigned |
| Definition | ❌ No | No categories assigned |
| Comment | ❌ No | No categories assigned |

---

## API Integration

### Fetching Category Data

When a category pill is clicked, use this endpoint:

```typescript
GET /categories/:categoryId/with-contents

Response: {
  nodes: [
    // Category node (load this one)
    { type: 'category', id: '...', data: { name: '...' } },
    // Word nodes (don't load yet - only load when word pill clicked)
    { type: 'word', ... },
    { type: 'word', ... },
    // ...
  ],
  relationships: [
    // COMPOSED_OF relationships
  ]
}
```

**Important:** Only add the **category node** to the graph, not the word nodes. The word nodes will be loaded later when/if the user clicks on individual word pills within the category node.

---

## Styling Customization

### Change Pill Color

When category node color is finalized, update all nodes using CategoryTags:

```svelte
<CategoryTags
  {categories}
  {radius}
  pillColor="rgba(NEW_R, NEW_G, NEW_B, 0.8)"
  on:categoryClick={handleCategoryClick}
/>
```

Or define as a constant:

```typescript
// In constants/graph/nodes.ts
export const COLORS = {
  // ... existing colors
  CATEGORY: {
    border: '#9B59B6', // Purple placeholder
    background: 'rgba(155, 89, 182, 0.8)'
  }
};

// Then use:
<CategoryTags
  {categories}
  {radius}
  pillColor={COLORS.CATEGORY.background}
  on:categoryClick={handleCategoryClick}
/>
```

---

## Known Limitations / Future Enhancements

1. **"+N more" is non-interactive** - Currently just displays count, doesn't expand
2. **No wrapping** - Pills remain in single horizontal row (may need wrapping for many categories)
3. **Fixed truncation length** - 20 characters, not responsive to available space
4. **No keyboard navigation** - Only mouse/touch interaction (accessibility enhancement needed)

---

## Testing Checklist

- [ ] Pills render correctly with 1, 2, 3 categories
- [ ] "+N more" appears when categories > maxDisplay
- [ ] Click dispatches correct event with categoryId and categoryName
- [ ] Hover effects work (scale, glow, border)
- [ ] Truncation works for long category names
- [ ] Tooltip shows full name when truncated
- [ ] Pills are centered horizontally
- [ ] Component doesn't render when categories array is empty
- [ ] Color prop changes pill color as expected
- [ ] Position is correct relative to node radius

---

**Component Status:** ✅ Ready for Implementation  
**Dependencies:** None (standalone UI component)  
**Next Component:** KeywordTags.svelte