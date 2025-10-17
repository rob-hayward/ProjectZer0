# NodeMetadata.svelte - Usage Guide

## Overview

`NodeMetadata.svelte` displays creation and update timestamps for nodes in detail mode. Shows relative time for recent content (<7 days) and absolute dates for older content.

---

## Props

```typescript
export let createdAt: string;  // ISO timestamp (required)
export let updatedAt: string | undefined = undefined;  // ISO timestamp (optional)
export let radius: number;  // For positioning calculations
```

### Props Details

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `createdAt` | `string` | Yes | - | ISO 8601 timestamp of creation |
| `updatedAt` | `string \| undefined` | No | `undefined` | ISO 8601 timestamp of last update |
| `radius` | `number` | Yes | - | Node radius for positioning |

---

## Visual Design

### Appearance

- **Font:** Inter, 10px, weight 400
- **Created text:** White 70% opacity `rgba(255, 255, 255, 0.7)`
- **Updated text:** White 60% opacity `rgba(255, 255, 255, 0.6)`
- **Alignment:** Center-aligned
- **Line spacing:** 12px between created and updated

### Time Formatting

**Relative time** (for dates <7 days old):
- "just now" (< 1 minute)
- "5 minutes ago"
- "2 hours ago"
- "yesterday"
- "3 days ago"

**Absolute date** (for dates ≥7 days old):
- "Oct 16, 2024"
- "Jan 1, 2025"
- "Dec 25, 2024"

### Display Logic

**Created timestamp:**
- Always displayed
- Format: "Created: [formatted time]"

**Updated timestamp:**
- Only displayed if `updatedAt` exists AND is different from `createdAt`
- Format: "Updated: [formatted time]"
- Positioned 12px below created line

---

## Positioning

**Located:** Above CreatorCredits, below ContentBox in detail mode

**Transform:** `translate(0, {radius + 5})`

**In Node Structure:**
```svelte
<BaseDetailNode {node}>
  <ContentBox mode="detail">
    <!-- Content, voting, stats -->
  </ContentBox>
  
  <!-- NodeMetadata positioned here -->
  <NodeMetadata
    createdAt={nodeData.createdAt}
    updatedAt={nodeData.updatedAt}
    radius={node.radius}
  />
  
  <!-- CreatorCredits below metadata -->
  {#if nodeData.createdBy}
    <CreatorCredits ... />
  {/if}
</BaseDetailNode>
```

---

## Usage Example

### In a Node Component

```svelte
<script lang="ts">
  import { NodeMetadata, CreatorCredits } from '../ui';
  import type { RenderableNode } from '$lib/types/graph/enhanced';
  
  export let node: RenderableNode;
  
  const nodeData = node.data as StatementNode;
  
  $: createdAt = nodeData.createdAt;
  $: updatedAt = nodeData.updatedAt;
</script>

{#if node.mode === 'detail'}
  <BaseDetailNode {node} on:modeChange>
    <ContentBox nodeType="statement" mode="detail">
      <!-- Content, voting, stats -->
    </ContentBox>
    
    <!-- NodeMetadata -->
    <NodeMetadata
      {createdAt}
      {updatedAt}
      radius={node.radius}
    />
    
    <!-- CreatorCredits (if applicable) -->
    {#if nodeData.createdBy}
      <CreatorCredits
        createdBy={nodeData.createdBy}
        publicCredit={nodeData.publicCredit}
        radius={node.radius}
      />
    {/if}
  </BaseDetailNode>
{/if}
```

---

## Time Formatting Examples

### Relative Time (Recent)

| Time Ago | Display |
|----------|---------|
| 0 seconds | just now |
| 30 seconds | just now |
| 5 minutes | 5 minutes ago |
| 1 hour | 1 hour ago |
| 6 hours | 6 hours ago |
| 24 hours | yesterday |
| 2 days | 2 days ago |
| 6 days | 6 days ago |

### Absolute Date (Older)

| Date | Display |
|------|---------|
| 2025-10-10 | Oct 10, 2025 |
| 2025-01-01 | Jan 1, 2025 |
| 2024-12-25 | Dec 25, 2024 |

---

## Conditional Rendering

### Only Created (No Updates)

If `updatedAt` is undefined or equals `createdAt`:

```
Created: 2 days ago
```

### Both Created and Updated

If `updatedAt` exists and differs from `createdAt`:

```
Created: Oct 10, 2025
Updated: 2 days ago
```

---

## Node Types That Use NodeMetadata

| Node Type | Uses NodeMetadata | Notes |
|-----------|-------------------|-------|
| Statement | ✅ Yes | In detail mode |
| OpenQuestion | ✅ Yes | In detail mode |
| Answer | ✅ Yes | In detail mode |
| Quantity | ✅ Yes | In detail mode |
| Evidence | ✅ Yes | In detail mode |
| Category | ✅ Yes | In detail mode |
| Word | ✅ Yes | In detail mode |
| Definition | ✅ Yes | In detail mode |
| Comment | ✅ Yes | In detail mode |
| All nodes | ✅ Yes | All nodes have createdAt/updatedAt |

---

## Data Requirements

All node types must have these fields in their data:

```typescript
interface NodeData {
  // ... other fields
  createdAt: string;  // ISO 8601 timestamp
  updatedAt: string;  // ISO 8601 timestamp
}
```

**Example timestamps:**
```typescript
createdAt: "2025-10-17T14:30:00.000Z"
updatedAt: "2025-10-17T16:45:00.000Z"
```

---

## Error Handling

If timestamp parsing fails:
- Falls back to displaying the raw timestamp string
- Logs error to console for debugging
- Component continues to render without breaking

```typescript
try {
  const date = new Date(timestamp);
  // ... format logic
} catch (error) {
  console.error('Error formatting timestamp:', error);
  return timestamp;  // Fallback to raw string
}
```

---

## Styling Customization

### Change Text Color

```svelte
<!-- Modify the fill styles in NodeMetadata.svelte -->
<text
  style:fill="rgba(255, 255, 255, 0.8)"  <!-- Brighter -->
  <!-- or -->
  style:fill="rgba(255, 255, 255, 0.5)"  <!-- Dimmer -->
>
  Created: {formattedCreatedAt}
</text>
```

### Change Font Size

```svelte
<text
  style:font-size="12px"  <!-- Larger -->
  <!-- or -->
  style:font-size="9px"   <!-- Smaller -->
>
```

### Change Position

```svelte
<script>
  // Adjust yPosition calculation
  $: yPosition = radius + 10;  // Further from ContentBox
  // or
  $: yPosition = radius;       // Closer to ContentBox
</script>
```

---

## Complete Node Example

```svelte
<script lang="ts">
  import { 
    NodeHeader, 
    ContentBox, 
    NodeMetadata, 
    CreatorCredits,
    CategoryTags,
    KeywordTags,
    InclusionVoteButtons,
    ContentVoteButtons,
    VoteStats
  } from '../ui';
  
  export let node: RenderableNode;
  const nodeData = node.data as StatementNode;
</script>

{#if node.mode === 'detail'}
  <BaseDetailNode {node} on:modeChange>
    <!-- Title -->
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="Statement" {radius} mode="detail" />
    </svelte:fragment>
    
    <!-- CategoryTags (above content) -->
    {#if nodeData.categories?.length}
      <CategoryTags
        categories={nodeData.categories}
        radius={node.radius}
        on:categoryClick={handleCategoryClick}
      />
    {/if}
    
    <!-- KeywordTags (above content) -->
    {#if nodeData.keywords?.length}
      <KeywordTags
        keywords={nodeData.keywords}
        radius={node.radius}
        on:keywordClick={handleKeywordClick}
      />
    {/if}
    
    <!-- ContentBox with content and voting -->
    <ContentBox nodeType="statement" mode="detail">
      <svelte:fragment slot="content">
        <!-- Statement text -->
      </svelte:fragment>
      
      <svelte:fragment slot="voting">
        <InclusionVoteButtons ... />
        <ContentVoteButtons ... />
      </svelte:fragment>
      
      <svelte:fragment slot="stats">
        <VoteStats ... />
      </svelte:fragment>
    </ContentBox>
    
    <!-- NodeMetadata (below content, above credits) -->
    <NodeMetadata
      createdAt={nodeData.createdAt}
      updatedAt={nodeData.updatedAt}
      radius={node.radius}
    />
    
    <!-- CreatorCredits (at bottom) -->
    {#if nodeData.createdBy}
      <CreatorCredits
        createdBy={nodeData.createdBy}
        publicCredit={nodeData.publicCredit}
        radius={node.radius}
      />
    {/if}
  </BaseDetailNode>
{/if}
```

---

## Testing Checklist

- [ ] Displays "Created: [time]" for all nodes
- [ ] Shows relative time for recent dates (<7 days)
- [ ] Shows absolute date for old dates (≥7 days)
- [ ] "Updated" line only appears if updatedAt differs from createdAt
- [ ] "Updated" line hidden if updatedAt is undefined
- [ ] "Updated" line hidden if updatedAt equals createdAt
- [ ] Text is center-aligned
- [ ] Positioned correctly above CreatorCredits
- [ ] Handles invalid timestamps gracefully
- [ ] "just now" appears for very recent content
- [ ] "yesterday" appears correctly
- [ ] Hours/minutes formatted with proper pluralization

---

## Known Limitations / Future Enhancements

1. **No timezone display** - Shows local time without timezone indicator
2. **No hover tooltip** - Could show absolute timestamp on hover
3. **Fixed format** - Could allow custom format string via prop
4. **English only** - Date formatting uses 'en-US' locale
5. **No seconds precision** - Minutes is the smallest unit

---

**Component Status:** ✅ Ready for Implementation  
**Dependencies:** None (standalone UI component)  
**Next Component:** Verify CreateLinkedNodeButton and complete Phase 1