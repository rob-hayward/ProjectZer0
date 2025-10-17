# KeywordTags.svelte - Usage Guide

## Overview

`KeywordTags.svelte` displays clickable keyword pills on nodes in detail mode. When clicked, loads the word node and all its definition nodes onto the graph. **Replaces the non-clickable keyword display** in existing nodes.

---

## Props

```typescript
export let keywords: Array<{
  word: string;
  frequency?: number;
  source: 'user' | 'ai' | 'both';
}> = [];
export let radius: number;
export let maxDisplay: number = 8;
export let wordColor: string = 'rgba(79, 70, 229, 0.8)'; // INDIGO
```

### Props Details

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `keywords` | `Array<{word, frequency?, source}>` | Yes | `[]` | Array of keyword objects |
| `radius` | `number` | Yes | - | Node radius for positioning calculations |
| `maxDisplay` | `number` | No | `8` | Maximum pills to show before "+N more" |
| `wordColor` | `string` | No | Indigo | RGBA color matching Word nodes (`COLORS.PRIMARY.INDIGO`) |

---

## Events

```typescript
dispatch('keywordClick', { word: string });
```

### Event Details

**`keywordClick`** - Fired when user clicks a keyword pill

**Payload:**
- `word`: The keyword text (e.g., "artificial", "intelligence")

**Expected Handler:**
```typescript
async function handleKeywordClick(event: CustomEvent) {
  const { word } = event.detail;
  
  // 1. Fetch word node + all its definitions from API
  const response = await fetch(`/words/${word}/with-definitions`);
  const { nodes, relationships } = await response.json();
  
  // 2. Add ALL nodes to graph (word + definitions)
  nodes.forEach(node => graphManager.addNode(node));
  relationships.forEach(rel => graphManager.addRelationship(rel));
  
  // 3. Center graph on the word node
  const wordNode = nodes.find(n => n.type === 'word');
  if (wordNode) {
    graphManager.centerOnNode(wordNode.id);
  }
}
```

---

## Visual Design

### Appearance

- **Shape:** Rounded pill (12px border radius)
- **Height:** 24px
- **Color:** Indigo `rgba(79, 70, 229, 0.8)` - matches Word node color
- **Border:** White semi-transparent (0.2 opacity normal, 0.4 on hover)
- **Text:** 11px Inter, weight 500, white

### Source-Based Border Styles

Keywords are styled differently based on their source:

| Source | Border Style | Visual | Meaning |
|--------|--------------|--------|---------|
| `user` | **Solid** | `━━━━━` | User-provided keyword |
| `ai` | **Dashed** | `╌╌╌╌╌` | AI-extracted keyword |
| `both` | **Solid** | `━━━━━` | Both user and AI agreed |

**Border:**
- User/Both: Solid line
- AI: Dashed line (4px dash, 2px gap)

### Hover Effects

- Scale to 1.1x
- Glow filter applied
- Border opacity increases
- Cursor changes to pointer
- Tooltip shows: `word (source)` - e.g., "artificial (AI-extracted)"

### Truncation

- Words longer than 20 characters are truncated with "..."
- Hover shows full word + source in browser tooltip

### Layout

- Pills arranged horizontally
- 8px spacing between pills
- Centered as a group
- "+N more" text after last pill if keywords exceed `maxDisplay`

---

## Positioning

**Located:** Below CategoryTags (if present), above content area in detail mode

**Transform:** `translate(0, -{radius + 50})`

**Spacing:**
- 25px below node title
- 25px below CategoryTags (if they exist)
- 20px above content area

**In Node Structure:**
```svelte
<BaseDetailNode {node}>
  <svelte:fragment slot="title" let:radius>
    <NodeHeader title="Statement" {radius} />
  </svelte:fragment>
  
  <!-- CategoryTags at -25px -->
  {#if nodeData.categories?.length}
    <CategoryTags
      categories={nodeData.categories}
      {radius}
      on:categoryClick={handleCategoryClick}
    />
  {/if}
  
  <!-- KeywordTags at -50px (below categories) -->
  {#if nodeData.keywords?.length}
    <KeywordTags
      keywords={nodeData.keywords}
      {radius}
      on:keywordClick={handleKeywordClick}
    />
  {/if}
  
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
  import { KeywordTags, CategoryTags } from '../ui';
  import type { RenderableNode } from '$lib/types/graph/enhanced';
  import { COLORS } from '$lib/constants/colors';
  
  export let node: RenderableNode;
  
  const nodeData = node.data as StatementNode;
  
  // Extract keywords from node data
  $: keywords = nodeData.keywords || [];
  $: categories = nodeData.categories || [];
  
  async function handleKeywordClick(event: CustomEvent) {
    const { word } = event.detail;
    
    console.log(`Loading word: ${word} with definitions`);
    
    try {
      // Fetch word node + ALL its definitions
      const response = await fetch(`/words/${word}/with-definitions`);
      const expansion = await response.json();
      
      // Add ALL nodes (word + definitions) to graph
      expansion.nodes.forEach(node => {
        addNodeToGraph(node);
      });
      
      expansion.relationships.forEach(rel => {
        addRelationshipToGraph(rel);
      });
      
      // Center on the word node
      const wordNode = expansion.nodes.find(n => n.type === 'word');
      if (wordNode) {
        centerGraphOnNode(wordNode.id);
      }
    } catch (error) {
      console.error('Failed to load word:', error);
    }
  }
  
  async function handleCategoryClick(event: CustomEvent) {
    // Category handler (from CategoryTags guide)
  }
</script>

{#if node.mode === 'detail'}
  <BaseDetailNode {node} on:modeChange>
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="Statement" {radius} mode="detail" />
    </svelte:fragment>
    
    <!-- CategoryTags (if present) -->
    {#if categories.length > 0}
      <CategoryTags
        {categories}
        radius={node.radius}
        maxDisplay={3}
        on:categoryClick={handleCategoryClick}
      />
    {/if}
    
    <!-- KeywordTags (replaces old non-clickable keywords) -->
    {#if keywords.length > 0}
      <KeywordTags
        {keywords}
        radius={node.radius}
        maxDisplay={8}
        wordColor={COLORS.PRIMARY.INDIGO}
        on:keywordClick={handleKeywordClick}
      />
    {/if}
    
    <ContentBox nodeType="statement" mode="detail">
      <!-- Rest of node content -->
    </ContentBox>
  </BaseDetailNode>
{/if}
```

---

## Replacing Old Keyword Display

### Old Implementation (Non-Clickable)

```svelte
<!-- OLD: foreignObject + HTML divs -->
<foreignObject x={x} y={y} width={width} height="50">
  <div class="keywords-section">
    <div class="keywords-container">
      {#each statementData.keywords as keyword}
        <div class="keyword-chip" 
             class:ai-keyword={keyword.source === 'ai'} 
             class:user-keyword={keyword.source === 'user'}>
          {keyword.word}
        </div>
      {/each}
    </div>
  </div>
</foreignObject>

<style>
  .keyword-chip {
    background: rgba(46, 204, 113, 0.2);
    border: 1px solid rgba(46, 204, 113, 0.3);
    /* ... etc */
  }
</style>
```

### New Implementation (Clickable KeywordTags)

```svelte
<!-- NEW: SVG-based KeywordTags component -->
{#if keywords.length > 0}
  <KeywordTags
    {keywords}
    radius={node.radius}
    maxDisplay={8}
    on:keywordClick={handleKeywordClick}
  />
{/if}

<!-- Remove old keyword-chip CSS styles -->
```

**What to Remove:**
- `foreignObject` containing keywords
- `.keywords-section` CSS
- `.keywords-container` CSS  
- `.keyword-chip` CSS
- `.ai-keyword` CSS
- `.user-keyword` CSS

---

## Node Types That Use KeywordTags

| Node Type | Uses KeywordTags | Notes |
|-----------|------------------|-------|
| Statement | ✅ Yes | In detail mode, has user/AI keywords |
| OpenQuestion | ✅ Yes | In detail mode, has user/AI keywords |
| Answer | ✅ Yes | In detail mode, has user/AI keywords |
| Quantity | ✅ Yes | In detail mode, has user/AI keywords |
| Evidence | ✅ Yes | In detail mode, has user/AI keywords |
| Category | ✅ Yes | Shows the 1-5 words it's composed of |
| Word | ❌ No | Is a keyword itself |
| Definition | ❌ No | Defines words, doesn't have keywords |
| Comment | ❌ No | No keywords assigned |

---

## API Integration

### Fetching Word + Definitions

When a keyword pill is clicked, use this endpoint:

```typescript
GET /words/:word/with-definitions

Response: {
  nodes: [
    // Word node (1)
    { type: 'word', id: '...', data: { word: 'artificial' } },
    // Definition nodes (1-N)
    { type: 'definition', id: '...', data: { definitionText: '...' } },
    { type: 'definition', id: '...', data: { definitionText: '...' } },
    // ...
  ],
  relationships: [
    // DEFINES relationships
    { type: 'DEFINES', from: 'def-id', to: 'word-id' },
    // ...
  ]
}
```

**Important:** Add **ALL nodes** to the graph (word + all definitions), not just the word.

---

## Color Customization

### Using Constants

```svelte
<script>
  import { COLORS } from '$lib/constants/colors';
</script>

<KeywordTags
  {keywords}
  {radius}
  wordColor={COLORS.PRIMARY.INDIGO}
  on:keywordClick={handleKeywordClick}
/>
```

### Color Reference

From `src/lib/constants/colors.ts`:

```typescript
COLORS.PRIMARY.INDIGO = '#4f46e5' // Word nodes (240°)
// In RGBA: 'rgba(79, 70, 229, 0.8)'
```

---

## Source Indicator Visual Reference

```
User keywords:    [━━ artificial ━━]  (solid border)
AI keywords:      [╌╌ intelligence ╌╌]  (dashed border)
Both sources:     [━━ learning ━━]     (solid border)
```

Hover tooltip shows source explicitly:
- "artificial (AI-extracted)"
- "intelligence (user-provided)"
- "learning (both)"

---

## Known Limitations / Future Enhancements

1. **"+N more" is non-interactive** - Currently just displays count
2. **No wrapping** - Pills remain in single horizontal row
3. **Fixed truncation** - 20 characters, not responsive
4. **Frequency not displayed** - Could add as tooltip or badge
5. **No gradient border** - "both" source uses solid like "user"

---

## Testing Checklist

- [ ] Pills render correctly with various keyword counts (1-8+)
- [ ] "+N more" appears when keywords > maxDisplay (8)
- [ ] Click dispatches correct event with word
- [ ] Hover effects work (scale, glow, border)
- [ ] Truncation works for long words
- [ ] Tooltip shows full word + source
- [ ] Pills are centered horizontally
- [ ] Component doesn't render when keywords array is empty
- [ ] Source-based borders work (solid for user/both, dashed for AI)
- [ ] Color prop changes pill color as expected
- [ ] Position is correct (50px below title, 25px below CategoryTags)
- [ ] Works alongside CategoryTags without overlap

---

## Migration Steps

For each node type (Statement, OpenQuestion, Answer, Quantity, Evidence):

1. **Import KeywordTags**
```svelte
import { KeywordTags, CategoryTags } from '../ui';
import { COLORS } from '$lib/constants/colors';
```

2. **Add event handler**
```svelte
async function handleKeywordClick(event: CustomEvent) {
  const { word } = event.detail;
  const expansion = await fetch(`/words/${word}/with-definitions`);
  // Add nodes to graph, center on word
}
```

3. **Replace old foreignObject keyword display with KeywordTags**
```svelte
{#if keywords.length > 0}
  <KeywordTags
    {keywords}
    radius={node.radius}
    wordColor={COLORS.PRIMARY.INDIGO}
    on:keywordClick={handleKeywordClick}
  />
{/if}
```

4. **Remove old CSS styles** for `.keyword-chip`, `.keywords-section`, etc.

5. **Test** that keywords are clickable and load correctly

---

**Component Status:** ✅ Ready for Implementation  
**Dependencies:** Word node expansion API endpoint  
**Next Component:** NodeMetadata.svelte