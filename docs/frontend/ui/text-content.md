# TextContent.svelte - Usage Guide

## Overview

`TextContent.svelte` is a standardized component for displaying 280-character text content in nodes. Ensures consistent typography, sizing, and alignment across all node types.

**Replaces:** Individual `.statement-display`, `.question-display`, etc. classes in each node component.

---

## Props

```typescript
export let text: string;
export let mode: 'preview' | 'detail' = 'detail';
```

### Props Details

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `text` | `string` | Yes | - | The text content to display (max 280 chars) |
| `mode` | `'preview' \| 'detail'` | No | `'detail'` | Display mode (affects font size) |

---

## Design Specifications

### Typography

| Mode | Font Size | Font Weight | Line Height | Font Family |
|------|-----------|-------------|-------------|-------------|
| Detail | 16px | 400 | 1.4 | Inter |
| Preview | 12px | 400 | 1.4 | Inter |

### Styling

- **Color:** White `rgba(255, 255, 255, 0.9)`
- **Alignment:** Center (horizontal + vertical)
- **Text Wrapping:** Enabled (word-wrap, overflow-wrap, hyphens)
- **Overflow:** Handled gracefully (no truncation, full 280 chars displayed)
- **Display:** Flexbox for perfect centering

### Layout

- **Width:** 100% of foreignObject container
- **Height:** 100% of foreignObject container
- **Padding:** 0 (foreignObject handles spacing)
- **Margin:** 0
- **Box Sizing:** border-box

---

## Usage Pattern

### Basic Usage (Detail Mode)

```svelte
<script lang="ts">
  import { TextContent } from '../ui';
  
  const nodeData = node.data as StatementNode;
  $: displayText = nodeData.statement;
</script>

<ContentBox nodeType="statement" mode="detail">
  <svelte:fragment slot="content" let:x let:y let:width let:height>
    <foreignObject {x} {y} {width} {height}>
      <TextContent text={displayText} mode="detail" />
    </foreignObject>
  </svelte:fragment>
</ContentBox>
```

### Preview Mode Usage

```svelte
<ContentBox nodeType="statement" mode="preview">
  <svelte:fragment slot="content" let:x let:y let:width let:height>
    <foreignObject {x} {y} {width} {height}>
      <TextContent text={displayText} mode="preview" />
    </foreignObject>
  </svelte:fragment>
</ContentBox>
```

---

## Migration Guide

### Before (Old Pattern)

**StatementNode.svelte:**
```svelte
<!-- Detail mode -->
<foreignObject x={x} y={y + layoutConfig.titleYOffset} width={width} height={height - 90}>
  <div class="statement-display">
    {displayStatementText}
  </div>
</foreignObject>

<!-- Preview mode -->
<foreignObject x={x} y={y - 55} width={width} height={height - layoutConfig.titleYOffset}>
  <div class="statement-preview">
    {displayStatementText}
  </div>
</foreignObject>

<style>
  .statement-display {
    font-family: Inter;
    font-size: 16px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    line-height: 1.4;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
  }

  .statement-preview {
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    line-height: 1.4;
  }
</style>
```

### After (New Pattern)

**StatementNode.svelte:**
```svelte
<script>
  import { TextContent } from '../ui';
</script>

<!-- Detail mode -->
<foreignObject {x} {y} {width} {height}>
  <TextContent text={displayStatementText} mode="detail" />
</foreignObject>

<!-- Preview mode -->
<foreignObject {x} {y} {width} {height}>
  <TextContent text={displayStatementText} mode="preview" />
</foreignObject>

<!-- Remove all .statement-display and .statement-preview CSS -->
```

**Benefits:**
- ✅ No duplicate CSS
- ✅ Consistent typography
- ✅ Simpler component code
- ✅ Easy to maintain
- ✅ One place to adjust all text styling

---

## Node Types Using TextContent

| Node Type | Content Field | Uses TextContent |
|-----------|---------------|------------------|
| Statement | `statement` | ✅ Yes |
| OpenQuestion | `questionText` | ✅ Yes |
| Answer | `answerText` | ✅ Yes |
| Quantity | `question` | ✅ Yes |
| Evidence | `title` | ✅ Yes |
| Word | `word` | ⚠️ Special (larger display) |
| Definition | `definitionText` | ✅ Yes |
| Comment | `commentText` | ✅ Yes |

**Note:** Word nodes may need larger font size for single-word display. TextContent is optimized for 280-character content.

---

## Complete Node Example

### StatementNode with TextContent

```svelte
<script lang="ts">
  import {
    TextContent,
    NodeHeader,
    ContentBox,
    CategoryTags,
    KeywordTags,
    InclusionVoteButtons,
    ContentVoteButtons,
    VoteStats,
    NodeMetadata,
    CreatorCredits
  } from '../ui';
  
  export let node: RenderableNode;
  const nodeData = node.data as StatementNode;
  
  $: displayText = nodeData.statement;
</script>

{#if node.mode === 'detail'}
  <BaseDetailNode {node} on:modeChange>
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="Statement" {radius} mode="detail" />
    </svelte:fragment>
    
    {#if nodeData.categories?.length}
      <CategoryTags
        categories={nodeData.categories}
        radius={node.radius}
        on:categoryClick={handleCategoryClick}
      />
    {/if}
    
    {#if nodeData.keywords?.length}
      <KeywordTags
        keywords={nodeData.keywords}
        radius={node.radius}
        on:keywordClick={handleKeywordClick}
      />
    {/if}
    
    <ContentBox nodeType="statement" mode="detail">
      <svelte:fragment slot="content" let:x let:y let:width let:height>
        <foreignObject {x} {y} {width} {height}>
          <TextContent text={displayText} mode="detail" />
        </foreignObject>
      </svelte:fragment>
      
      <svelte:fragment slot="voting" let:width let:height>
        <InclusionVoteButtons ... />
        <ContentVoteButtons ... />
      </svelte:fragment>
      
      <svelte:fragment slot="stats" let:width>
        <VoteStats ... />
      </svelte:fragment>
    </ContentBox>
    
    <NodeMetadata
      createdAt={nodeData.createdAt}
      updatedAt={nodeData.updatedAt}
      radius={node.radius}
    />
    
    {#if nodeData.createdBy}
      <CreatorCredits
        createdBy={nodeData.createdBy}
        publicCredit={nodeData.publicCredit}
        radius={node.radius}
      />
    {/if}
  </BaseDetailNode>
{:else}
  <BasePreviewNode {node} on:modeChange>
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="Statement" {radius} mode="preview" />
    </svelte:fragment>
    
    <ContentBox nodeType="statement" mode="preview">
      <svelte:fragment slot="content" let:x let:y let:width let:height>
        <foreignObject {x} {y} {width} {height}>
          <TextContent text={displayText} mode="preview" />
        </foreignObject>
      </svelte:fragment>
      
      <svelte:fragment slot="voting" let:width let:height>
        <InclusionVoteButtons ... />
      </svelte:fragment>
    </ContentBox>
  </BasePreviewNode>
{/if}
```

---

## Text Wrapping Behavior

TextContent handles long text automatically:

### Word Wrapping
- Breaks at word boundaries (`word-wrap: break-word`)
- Breaks within words if necessary (`overflow-wrap: break-word`)
- Uses automatic hyphenation (`hyphens: auto`)

### Line Height
- 1.4 multiplier ensures comfortable reading
- Works well for multi-line content
- Balanced for both preview and detail modes

### Example with 280 Characters

```
Detail mode (16px):
Lorem ipsum dolor sit amet, consectetur 
adipiscing elit. Sed do eiusmod tempor 
incididunt ut labore et dolore magna 
aliqua. Ut enim ad minim veniam, quis 
nostrud exercitation ullamco laboris nisi 
ut aliquip ex ea commodo consequat.
```

```
Preview mode (12px):
Lorem ipsum dolor sit amet, consectetur adipiscing 
elit. Sed do eiusmod tempor incididunt ut labore 
et dolore magna aliqua. Ut enim ad minim veniam, 
quis nostrud exercitation ullamco laboris nisi ut 
aliquip ex ea commodo consequat. Duis aute irure 
dolor in reprehenderit.
```

---

## Why Center Alignment?

**Optimal for circular nodes:**
1. **Symmetry** - Matches circular shape
2. **Visual Balance** - Text flows from center outward
3. **Eye Flow** - Natural focal point
4. **Readability** - Equal margins maintain consistent line lengths
5. **Scalability** - Works at any node radius

---

## Styling Customization

### Change Text Color

If you need to adjust the text color globally:

```svelte
<!-- In TextContent.svelte -->
<style>
  .text-content {
    color: rgba(255, 255, 255, 0.95); /* Brighter */
    /* or */
    color: rgba(255, 255, 255, 0.85); /* Dimmer */
  }
</style>
```

### Adjust Line Height

```svelte
<style>
  .text-content {
    line-height: 1.5; /* More spacious */
    /* or */
    line-height: 1.3; /* Tighter */
  }
</style>
```

### Font Weight

```svelte
<style>
  .text-content {
    font-weight: 500; /* Medium weight */
    /* or */
    font-weight: 300; /* Light weight */
  }
</style>
```

**Note:** Changes apply to ALL nodes using TextContent.

---

## Testing Checklist

- [ ] Displays text correctly in detail mode (16px)
- [ ] Displays text correctly in preview mode (12px)
- [ ] Text is center-aligned horizontally
- [ ] Text is center-aligned vertically
- [ ] Long text (280 chars) wraps properly
- [ ] Line breaks at word boundaries
- [ ] No text overflow or clipping
- [ ] Works with all node types
- [ ] Consistent with design specifications
- [ ] foreignObject positioning handled by parent

---

## CSS Classes to Remove

When migrating to TextContent, remove these node-specific classes:

- `.statement-display`
- `.statement-preview`
- `.question-display`
- `.question-preview`
- `.answer-display`
- `.answer-preview`
- `.quantity-display`
- `.quantity-preview`
- `.definition-display`
- `.definition-preview`
- `.comment-display`
- `.comment-preview`

**All replaced by:** `TextContent` component

---

## Advantages Over Old Pattern

| Aspect | Old Pattern | TextContent Component |
|--------|-------------|----------------------|
| **Consistency** | Each node has own CSS | Single source of truth |
| **Maintenance** | Update 9+ files | Update 1 file |
| **Code Size** | ~30 lines CSS per node | 2 lines per node |
| **Typography** | Risk of inconsistency | Guaranteed consistency |
| **Positioning** | Manual calculations | ContentBox handles it |
| **Readability** | CSS scattered | Clean component usage |

---

**Component Status:** ✅ Complete and Ready  
**Dependencies:** None (standalone UI component)  
**Impact:** Simplifies all text-based nodes (9 node types)