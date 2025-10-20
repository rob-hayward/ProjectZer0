# Node Implementation Guide

**Document:** Node Implementation Guide  
**Project:** ProjectZer0 Frontend  
**Version:** 1.0  
**Date:** October 20, 2025  
**Status:** Current Standard

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Node Architecture](#node-architecture)
3. [Standard Node Structure](#standard-node-structure)
4. [Base Components](#base-components)
5. [VoteBehaviour Integration](#votebehaviour-integration)
6. [Common Patterns](#common-patterns)
7. [UI Components](#ui-components)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Creating a New Node Type

**Time:** ~2-4 hours for a standard node

**Steps:**
1. Define TypeScript interfaces
2. Create node component file
3. Implement voting pattern
4. Add to NodeRenderer
5. Test thoroughly

**Quick Checklist:**
- [ ] TypeScript types defined in `types/domain/nodes.ts`
- [ ] Node component created in `nodes/{type}/{Type}Node.svelte`
- [ ] VoteBehaviour integrated (see patterns below)
- [ ] Preview mode implemented
- [ ] Detail mode implemented
- [ ] Added to `NodeRenderer.svelte`
- [ ] Tested voting functionality
- [ ] Tested mode switching

---

## Node Architecture

### Component Hierarchy

```
YourNode.svelte
├── BasePreviewNode (preview mode)
│   ├── NodeHeader
│   ├── Content area
│   ├── InclusionVoteButtons
│   └── ExpandCollapseButton
│
└── BaseDetailNode (detail mode)
    ├── NodeHeader
    ├── CategoryTags (optional)
    ├── KeywordTags (optional)
    ├── Content area
    ├── InclusionVoteButtons
    ├── ContentVoteButtons (if dual-voting)
    ├── VoteStats
    ├── NodeMetadata
    ├── CreatorCredits
    ├── CreateLinkedNodeButton (optional)
    └── ExpandCollapseButton
```

### Slot System

Base components use **named slots** for flexible layout:

**BasePreviewNode Slots:**
- `title` - Node type header
- `content` - Main content area
- `voting` - Vote buttons section
- `stats` - Vote statistics (usually unused in preview)

**BaseDetailNode Slots:**
- `title` - Node type header
- `categoryTags` - Category pills (positioned above ContentBox)
- `keywordTags` - Keyword chips (positioned above ContentBox)
- `content` - Main content area
- `voting` - Vote buttons section
- `stats` - Vote statistics section
- `metadata` - Created/updated timestamps
- `credits` - Creator information
- `createChild` - Button to create linked nodes

---

## Standard Node Structure

### File Template

```svelte
<!-- src/lib/components/graph/nodes/{type}/{Type}Node.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
    import { is{Type}Data } from '$lib/types/graph/enhanced';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import NodeHeader from '../ui/NodeHeader.svelte';
    import InclusionVoteButtons from '../ui/InclusionVoteButtons.svelte';
    import VoteStats from '../ui/VoteStats.svelte';
    import CategoryTags from '../ui/CategoryTags.svelte';
    import KeywordTags from '../ui/KeywordTags.svelte';
    import NodeMetadata from '../ui/NodeMetadata.svelte';
    import CreatorCredits from '../ui/CreatorCredits.svelte';
    import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
    import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
    import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
    import { graphStore } from '$lib/stores/graphStore';

    export let node: RenderableNode;

    // Type validation
    if (!is{Type}Data(node.data)) {
        throw new Error('Invalid node data type for {Type}Node');
    }

    // CRITICAL: Use let (not const) for reactivity
    let nodeData = node.data;

    // Data extraction
    $: displayContent = nodeData.content;

    // Vote data extraction
    $: inclusionPositiveVotes = getNeo4jNumber(nodeData.inclusionPositiveVotes) || 0;
    $: inclusionNegativeVotes = getNeo4jNumber(nodeData.inclusionNegativeVotes) || 0;
    $: inclusionNetVotes = getNeo4jNumber(nodeData.inclusionNetVotes) || 
        (inclusionPositiveVotes - inclusionNegativeVotes);
    $: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;

    // Threshold check
    $: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

    // Categories and keywords
    $: categories = nodeData.categories || [];
    $: keywords = nodeData.keywords || [];

    // Voting behaviour instance
    let inclusionVoting: VoteBehaviour;

    // Mode state
    $: isDetail = node.mode === 'detail';

    // Event dispatcher
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
        visibilityChange: { isHidden: boolean };
        categoryClick: { categoryId: string; categoryName: string };
        keywordClick: { word: string };
    }>();

    // Initialize voting on mount
    onMount(async () => {
        inclusionVoting = createVoteBehaviour(node.id, '{type}', {
            apiIdentifier: nodeData.id,
            dataObject: nodeData,
            dataProperties: {
                positiveVotesKey: 'inclusionPositiveVotes',
                negativeVotesKey: 'inclusionNegativeVotes'
            },
            getVoteEndpoint: (id) => `/{type}s/${id}/vote`,
            getRemoveVoteEndpoint: (id) => `/{type}s/${id}/vote/remove`,
            graphStore,
            onDataUpdate: () => {
                nodeData = { ...nodeData };
            },
            metadataConfig: {
                nodeMetadata: node.metadata,
                voteStatusKey: 'inclusionVoteStatus'
            }
        });

        await inclusionVoting.initialize({
            positiveVotes: inclusionPositiveVotes,
            negativeVotes: inclusionNegativeVotes,
            skipVoteStatusFetch: false
        });
    });

    // Vote handler
    async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
        if (!inclusionVoting) return;
        await inclusionVoting.handleVote(event.detail.voteType);
    }

    // Get reactive state
    $: votingState = inclusionVoting?.getCurrentState() || {
        isVoting: false,
        voteSuccess: false,
        lastVoteType: null
    };

    // Event handlers
    function handleModeChange(event: CustomEvent) {
        dispatch('modeChange', {
            ...event.detail,
            nodeId: node.id
        });
    }

    function handleCategoryClick(event: CustomEvent<{ categoryId: string; categoryName: string }>) {
        dispatch('categoryClick', event.detail);
    }

    function handleKeywordClick(event: CustomEvent<{ word: string }>) {
        dispatch('keywordClick', event.detail);
    }
</script>

{#if isDetail}
    <!-- DETAIL MODE -->
    <BaseDetailNode {node} on:modeChange={handleModeChange}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="{Type}" {radius} mode="detail" />
        </svelte:fragment>

        <svelte:fragment slot="categoryTags" let:radius>
            {#if categories.length > 0}
                <CategoryTags
                    {categories}
                    {radius}
                    maxDisplay={3}
                    on:categoryClick={handleCategoryClick}
                />
            {/if}
        </svelte:fragment>

        <svelte:fragment slot="keywordTags" let:radius>
            {#if keywords.length > 0}
                <KeywordTags
                    {keywords}
                    {radius}
                    maxDisplay={8}
                    on:keywordClick={handleKeywordClick}
                />
            {/if}
        </svelte:fragment>

        <svelte:fragment slot="content" let:x let:y let:width let:height>
            <foreignObject {x} {y} {width} {height}>
                <div class="content-display">
                    {displayContent}
                </div>
            </foreignObject>
        </svelte:fragment>

        <svelte:fragment slot="voting" let:x let:y let:width let:height>
            <InclusionVoteButtons
                userVoteStatus={inclusionUserVoteStatus}
                positiveVotes={inclusionPositiveVotes}
                negativeVotes={inclusionNegativeVotes}
                isVoting={votingState.isVoting}
                voteSuccess={votingState.voteSuccess}
                lastVoteType={votingState.lastVoteType}
                availableWidth={width}
                containerY={y + height / 2}
                mode="detail"
                on:vote={handleInclusionVote}
            />
        </svelte:fragment>

        <svelte:fragment slot="stats" let:x let:y let:width let:height>
            <VoteStats
                userVoteStatus={inclusionUserVoteStatus}
                positiveVotes={inclusionPositiveVotes}
                negativeVotes={inclusionNegativeVotes}
                availableWidth={width}
                containerY={y}
                positiveLabel="Include"
                negativeLabel="Exclude"
            />
        </svelte:fragment>

        <svelte:fragment slot="metadata" let:radius>
            <NodeMetadata
                createdAt={nodeData.createdAt}
                updatedAt={nodeData.updatedAt}
                {radius}
            />
        </svelte:fragment>

        <svelte:fragment slot="credits" let:radius>
            <CreatorCredits
                createdBy={nodeData.createdBy}
                publicCredit={nodeData.publicCredit}
                {radius}
            />
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="{Type}" {radius} size="small" mode="preview" />
        </svelte:fragment>

        <svelte:fragment slot="content" let:x let:y let:width let:height>
            <foreignObject {x} {y} {width} {height}>
                <div class="content-preview">
                    {displayContent}
                </div>
            </foreignObject>
        </svelte:fragment>

        <svelte:fragment slot="voting" let:x let:y let:width let:height>
            <InclusionVoteButtons
                userVoteStatus={inclusionUserVoteStatus}
                positiveVotes={inclusionPositiveVotes}
                negativeVotes={inclusionNegativeVotes}
                isVoting={votingState.isVoting}
                voteSuccess={votingState.voteSuccess}
                lastVoteType={votingState.lastVoteType}
                availableWidth={width}
                containerY={y + height / 2}
                mode="preview"
                on:vote={handleInclusionVote}
            />
        </svelte:fragment>
    </BasePreviewNode>
{/if}

<style>
    .content-display {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.9);
        text-align: center;
        line-height: 1.4;
    }

    .content-preview {
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.9);
        text-align: center;
        line-height: 1.3;
    }
</style>
```

---

## Base Components

### BasePreviewNode

**Purpose:** Container for preview mode (collapsed state)

**Key Features:**
- Positions title above ContentBox
- Manages expand button visibility based on `canExpand` prop
- Simple, consistent layout
- No category tags or metadata (keep it minimal)

**Props:**
```typescript
export let node: RenderableNode;
export let canExpand: boolean = true; // Set based on vote threshold
export let showContentBoxBorder: boolean = false; // Debug mode
```

**Positioning:**
- **Title:** `-radius * 0.85` (above ContentBox)
- **ContentBox:** `(0, 0)` (centered)
- **Expand Button:** `(radius * 0.7071, -radius * 0.7071)` (SE corner)

### BaseDetailNode

**Purpose:** Container for detail mode (expanded state)

**Key Features:**
- Full node information display
- Supports all optional slots (tags, metadata, credits)
- Positioned collapse button
- Optional create child button

**Props:**
```typescript
export let node: RenderableNode;
export let showContentBoxBorder: boolean = false; // Debug mode
```

**Positioning:**
- **Title:** `-radius * 0.90` (above ContentBox)
- **CategoryTags:** `-radius * 0.78` (above ContentBox, below title)
- **KeywordTags:** `-radius * 0.66` (above ContentBox, below categories)
- **ContentBox:** `(0, 0)` (centered)
- **Metadata:** `+radius * 0.78` (below ContentBox)
- **Credits:** `+radius * 0.90` (below ContentBox, below metadata)
- **CreateChild Button:** `(+radius * 0.7071, -radius * 0.7071)` (NE corner)
- **Collapse Button:** `(-radius * 0.7071, +radius * 0.7071)` (SE corner)

---

## VoteBehaviour Integration

### Single-Voting Pattern

For nodes with **inclusion voting only** (Word, Category, OpenQuestion, Quantity, Evidence):

```typescript
let inclusionVoting: VoteBehaviour;

onMount(async () => {
    inclusionVoting = createVoteBehaviour(node.id, 'nodetype', {
        apiIdentifier: nodeData.id,
        dataObject: nodeData,
        dataProperties: {
            positiveVotesKey: 'inclusionPositiveVotes',
            negativeVotesKey: 'inclusionNegativeVotes'
        },
        getVoteEndpoint: (id) => `/nodetypes/${id}/vote`,
        getRemoveVoteEndpoint: (id) => `/nodetypes/${id}/vote/remove`,
        graphStore,
        onDataUpdate: () => {
            nodeData = { ...nodeData };
        },
        metadataConfig: {
            nodeMetadata: node.metadata,
            voteStatusKey: 'inclusionVoteStatus'
        }
    });

    await inclusionVoting.initialize({
        positiveVotes: inclusionPositiveVotes,
        negativeVotes: inclusionNegativeVotes,
        skipVoteStatusFetch: false
    });
});
```

### Dual-Voting Pattern

For nodes with **inclusion AND content voting** (Definition, Statement, Answer):

```typescript
let inclusionVoting: VoteBehaviour;
let contentVoting: VoteBehaviour;

onMount(async () => {
    // INCLUSION voting
    inclusionVoting = createVoteBehaviour(node.id, 'nodetype', {
        apiIdentifier: nodeData.id,
        dataObject: nodeData,
        dataProperties: {
            positiveVotesKey: 'inclusionPositiveVotes',
            negativeVotesKey: 'inclusionNegativeVotes'
        },
        getVoteEndpoint: (id) => `/nodetypes/${id}/inclusion-vote`,
        getRemoveVoteEndpoint: (id) => `/nodetypes/${id}/inclusion-vote/remove`,
        graphStore,
        onDataUpdate: () => {
            nodeData = { ...nodeData };
        },
        metadataConfig: {
            nodeMetadata: node.metadata,
            voteStatusKey: 'inclusionVoteStatus',
            metadataGroup: 'nodetype'
        }
    });

    // CONTENT voting
    contentVoting = createVoteBehaviour(node.id, 'nodetype', {
        apiIdentifier: nodeData.id,
        dataObject: nodeData,
        dataProperties: {
            positiveVotesKey: 'contentPositiveVotes',
            negativeVotesKey: 'contentNegativeVotes'
        },
        getVoteEndpoint: (id) => `/nodetypes/${id}/content-vote`,
        getRemoveVoteEndpoint: (id) => `/nodetypes/${id}/content-vote/remove`,
        graphStore,
        onDataUpdate: () => {
            nodeData = { ...nodeData };
        },
        metadataConfig: {
            nodeMetadata: node.metadata,
            voteStatusKey: 'contentVoteStatus',
            metadataGroup: 'nodetype'
        }
    });

    // Initialize both in parallel
    await Promise.all([
        inclusionVoting.initialize({
            positiveVotes: inclusionPositiveVotes,
            negativeVotes: inclusionNegativeVotes,
            skipVoteStatusFetch: false
        }),
        contentVoting.initialize({
            positiveVotes: contentPositiveVotes,
            negativeVotes: contentNegativeVotes,
            skipVoteStatusFetch: false
        })
    ]);
});
```

---

## Common Patterns

### Pattern 1: Data Reactivity

```typescript
// ✅ CORRECT - Use let for mutability
let nodeData = node.data;

// Trigger reactivity in onDataUpdate callback
onDataUpdate: () => {
    nodeData = { ...nodeData };
}
```

### Pattern 2: Vote Data Extraction

```typescript
// Extract with Neo4j number handling
$: inclusionPositiveVotes = getNeo4jNumber(nodeData.inclusionPositiveVotes) || 0;
$: inclusionNegativeVotes = getNeo4jNumber(nodeData.inclusionNegativeVotes) || 0;
$: inclusionNetVotes = getNeo4jNumber(nodeData.inclusionNetVotes) || 
    (inclusionPositiveVotes - inclusionNegativeVotes);

// Extract user vote status from metadata
$: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
```

### Pattern 3: Threshold Check

```typescript
import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';

$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);
```

### Pattern 4: Category/Keyword Extraction

```typescript
// Handle both string[] and enriched object[] formats
$: categories = (() => {
    const cats = nodeData.categories || [];
    if (cats.length === 0) return [];
    
    // Check if already enriched with id/name
    if (typeof cats[0] === 'object' && 'id' in cats[0]) {
        return cats as Array<{ id: string; name: string }>;
    }
    
    // If just string IDs, can't display without names
    return [];
})();

$: keywords = nodeData.keywords || [];
```

### Pattern 5: Event Dispatching

```typescript
const dispatch = createEventDispatcher<{
    modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
    visibilityChange: { isHidden: boolean };
    categoryClick: { categoryId: string; categoryName: string };
    keywordClick: { word: string };
}>();

function handleModeChange(event: CustomEvent) {
    dispatch('modeChange', {
        ...event.detail,
        nodeId: node.id
    });
}
```

### Pattern 6: Reactive Voting State

```typescript
$: votingState = inclusionVoting?.getCurrentState() || {
    isVoting: false,
    voteSuccess: false,
    lastVoteType: null
};

// Use in UI components
<InclusionVoteButtons
    isVoting={votingState.isVoting}
    voteSuccess={votingState.voteSuccess}
    lastVoteType={votingState.lastVoteType}
    on:vote={handleInclusionVote}
/>
```

---

## UI Components

### InclusionVoteButtons

**Purpose:** Vote on whether content should exist

**Usage:**
```svelte
<InclusionVoteButtons
    userVoteStatus={inclusionUserVoteStatus}
    positiveVotes={inclusionPositiveVotes}
    negativeVotes={inclusionNegativeVotes}
    isVoting={votingState.isVoting}
    voteSuccess={votingState.voteSuccess}
    lastVoteType={votingState.lastVoteType}
    availableWidth={width}
    containerY={y}
    mode="detail"
    on:vote={handleInclusionVote}
/>
```

### ContentVoteButtons

**Purpose:** Vote on content quality/agreement

**Usage:**
```svelte
<ContentVoteButtons
    userVoteStatus={contentUserVoteStatus}
    positiveVotes={contentPositiveVotes}
    negativeVotes={contentNegativeVotes}
    isVoting={contentVotingState.isVoting}
    voteSuccess={contentVotingState.voteSuccess}
    lastVoteType={contentVotingState.lastVoteType}
    availableWidth={width}
    containerY={y}
    mode="detail"
    on:vote={handleContentVote}
/>
```

### VoteStats

**Purpose:** Display vote breakdown

**Usage:**
```svelte
<VoteStats
    userVoteStatus={inclusionUserVoteStatus}
    positiveVotes={inclusionPositiveVotes}
    negativeVotes={inclusionNegativeVotes}
    availableWidth={width}
    containerY={y}
    positiveLabel="Include"
    negativeLabel="Exclude"
    netLabel="Net Votes"
/>
```

### CategoryTags

**Purpose:** Clickable category pills

**Usage:**
```svelte
<CategoryTags
    categories={categories}
    radius={radius}
    maxDisplay={3}
    on:categoryClick={handleCategoryClick}
/>
```

### KeywordTags

**Purpose:** Clickable keyword chips

**Usage:**
```svelte
<KeywordTags
    keywords={keywords}
    radius={radius}
    maxDisplay={8}
    on:keywordClick={handleKeywordClick}
/>
```

---

## Testing

### Manual Testing Checklist

**Basic Functionality:**
- [ ] Node renders in preview mode
- [ ] Node renders in detail mode
- [ ] Mode switching works (preview ↔ detail)
- [ ] Expand button only shown when `canExpand = true`

**Voting:**
- [ ] Inclusion vote buttons work
- [ ] Content vote buttons work (if dual-voting)
- [ ] Vote toggle (click same button removes vote)
- [ ] Vote switch (click opposite button changes vote)
- [ ] Loading state shows during API call
- [ ] Success animation appears
- [ ] Vote counts update correctly

**Metadata & UI:**
- [ ] Vote status persists on re-render
- [ ] Categories display and are clickable
- [ ] Keywords display and are clickable
- [ ] Timestamps formatted correctly
- [ ] Creator credits show correctly

**Edge Cases:**
- [ ] Node with no categories
- [ ] Node with no keywords
- [ ] Node with zero votes
- [ ] Node with negative net votes
- [ ] API error handling (vote rollback)

---

## Troubleshooting

### Issue: Node Not Rendering

**Check:**
1. Type validation function exists
2. Node component added to `NodeRenderer.svelte`
3. Type guards return true for node data
4. No TypeScript errors

### Issue: Voting Not Working

**Check:**
1. `let nodeData` (not `const`)
2. `onDataUpdate` callback present
3. `metadataConfig` properly configured
4. Vote handler connected to button event
5. API endpoints correct

### Issue: Mode Switch Not Working

**Check:**
1. `isDetail` reactive statement present
2. Both preview and detail modes implemented
3. `canExpand` prop passed to BasePreviewNode
4. Mode change events dispatched correctly

### Issue: Categories/Keywords Not Showing

**Check:**
1. Data extraction logic handles both formats
2. Array not empty
3. Slot properly implemented in detail mode
4. Event handlers connected

---

## Summary

### Key Principles

1. **Use `let` not `const`** for node data
2. **Always use voteBehaviour** for voting logic
3. **Extract vote data** with `getNeo4jNumber`
4. **Check threshold** with `hasMetInclusionThreshold`
5. **Trigger reactivity** in `onDataUpdate` callback
6. **Use named slots** for flexible layouts
7. **Test thoroughly** before integration

### Quick Reference

| Task | Solution |
|------|----------|
| Single voting | Pattern 1 (InclusionVoteButtons only) |
| Dual voting | Pattern 2 (Inclusion + ContentVoteButtons) |
| Data reactivity | `let nodeData` + `onDataUpdate` callback |
| Vote extraction | `getNeo4jNumber` utility |
| Threshold check | `hasMetInclusionThreshold` |
| Category display | CategoryTags component |
| Keyword display | KeywordTags component |

---

**End of Node Implementation Guide**