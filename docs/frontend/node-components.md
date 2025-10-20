# Node Components - Architecture Documentation

**Document:** Node Components Architecture  
**Project:** ProjectZer0 Frontend  
**Version:** 2.0 (Updated)  
**Date:** October 20, 2025  
**Purpose:** Comprehensive guide to node component structure and patterns

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Component Hierarchy](#2-component-hierarchy)
3. [Base Components](#3-base-components)
4. [ContentBox System](#4-contentbox-system)
5. [Node Type Components](#5-node-type-components)
6. [VoteBehaviour System](#6-votebehaviour-system)
7. [UI Components](#7-ui-components)
8. [Data Flow](#8-data-flow)
9. [Separation of Concerns](#9-separation-of-concerns)
10. [Consistency Patterns](#10-consistency-patterns)
11. [Development Patterns](#11-development-patterns)

---

## 1. Architecture Overview

### 1.1 Core Philosophy

The node component architecture is built on **composition**, **reusability**, and **separation of concerns**. Every node type shares common base components and uses a centralized voting system.

### 1.2 Key Architectural Principles

1. **Component Composition**: Nodes built by composing smaller, focused components
2. **Centralized Voting**: All voting logic handled by `voteBehaviour.ts`
3. **Slot-Based Layouts**: Base components use slots for flexible content injection
4. **Standardized UI**: Shared UI components ensure consistency
5. **Context Awareness**: Components detect their context automatically
6. **Data-Driven**: Nodes receive data and render without complex state management

### 1.3 Layer Structure

```
┌─────────────────────────────────────────────────────────┐
│              Specific Node Components                    │
│  (StatementNode, OpenQuestionNode, WordNode, etc.)      │
│                                                           │
│  • Type-specific data extraction                         │
│  • Custom content rendering                              │
│  • VoteBehaviour integration                             │
│  • Event handling                                        │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────────┐
│            Base Layer Components                         │
│   (BaseNode, BasePreviewNode, BaseDetailNode)           │
│                                                           │
│  • Mode switching (preview/detail)                       │
│  • Slot-based layout structure                           │
│  • Edge buttons (expand, show/hide)                      │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────────┐
│          ContentBox & UI Components                      │
│    (ContentBox, VoteButtons, VoteStats, etc.)           │
│                                                           │
│  • Standardized content area layout                      │
│  • Reusable UI elements                                  │
│  • Consistent spacing and sizing                         │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────────┐
│              VoteBehaviour System                        │
│         (voteBehaviour.ts)                               │
│                                                           │
│  • Centralized voting logic                              │
│  • Store management                                      │
│  • API interactions                                      │
│  • Optimistic updates                                    │
│  • Error recovery                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Component Hierarchy

### 2.1 Hierarchy Diagram

```
BaseNode (core SVG structure)
    ├── BasePreviewNode (preview mode wrapper)
    │   ├── ContentBox
    │   │   ├── content slot
    │   │   ├── voting slot
    │   │   └── stats slot
    │   └── ExpandCollapseButton (expand)
    │
    └── BaseDetailNode (detail mode wrapper)
        ├── ContentBox
        │   ├── content slot
        │   ├── voting slot
        │   └── stats slot
        ├── CreatorCredits
        └── ExpandCollapseButton (collapse)

Specific Node Types (e.g., StatementNode)
    ├── Uses BasePreviewNode for preview mode
    ├── Uses BaseDetailNode for detail mode
    └── Integrates VoteBehaviour for voting
```

### 2.2 Component Responsibilities

**BaseNode**: Core SVG structure
- Renders multiple background layers for depth
- Provides decorative rings with glow effects
- Applies vote-based styling
- Exposes slots for child components

**BasePreviewNode**: Preview mode container
- Wraps BaseNode
- Uses ContentBox for standardized layout
- Renders title outside ContentBox
- Includes expand button (conditional on threshold)
- Handles mode change events

**BaseDetailNode**: Detail mode container
- Wraps BaseNode
- Uses ContentBox for standardized layout
- Renders title, tags, metadata outside ContentBox
- Includes collapse button
- Optionally renders creator credits
- Handles mode change events

**ContentBox**: Standardized content area
- Provides three sections: content, voting, stats
- Configurable layout ratios per node type and mode
- Handles spacing, padding, positioning automatically
- Exposes slots with calculated dimensions

---

## 3. Base Components

### 3.1 BaseNode.svelte

**Purpose**: Core SVG structure and decorative elements

**Key Features**:
- Multiple background layers (depth effect)
- Decorative rings with glow
- Vote-based styling (ring width, glow intensity)
- Single default slot for child content

**Usage**: Wrapped by BasePreviewNode and BaseDetailNode, not used directly

### 3.2 BasePreviewNode.svelte

**Purpose**: Container for preview mode rendering

**Slot Interface**:
```typescript
interface Slots {
  title: { radius: number };
  content: { x, y, width, height, layoutConfig };
  voting: { x, y, width, height, layoutConfig };
  stats: { x, y, width, height, layoutConfig };
}
```

**Key Features**:
- Title slot rendered **outside** ContentBox
- ContentBox for content, voting, and stats sections
- Expand button positioned at SE corner (conditional on `canExpand`)
- Forwards mode change events

**Usage Pattern**:
```svelte
<BasePreviewNode {node} {canExpand} on:modeChange>
  <svelte:fragment slot="title" let:radius>
    <NodeHeader title="Statement" {radius} mode="preview" />
  </svelte:fragment>
  
  <svelte:fragment slot="content" let:x let:y let:width let:height>
    <!-- Content here -->
  </svelte:fragment>
  
  <svelte:fragment slot="voting" let:width let:height>
    <InclusionVoteButtons {userVoteStatus} {positiveVotes} {negativeVotes} 
                          availableWidth={width} mode="preview" on:vote />
  </svelte:fragment>
</BasePreviewNode>
```

### 3.3 BaseDetailNode.svelte

**Purpose**: Container for detail mode rendering

**Slot Interface**: Same as BasePreviewNode, plus:
```typescript
interface Slots {
  // ... preview slots ...
  categoryTags: { radius: number };
  keywordTags: { radius: number };
  metadata: { radius: number };
  credits: { radius: number };
  createChild: { radius: number };
}
```

**Usage Pattern**:
```svelte
<BaseDetailNode {node} on:modeChange>
  <svelte:fragment slot="title" let:radius>
    <NodeHeader title="Statement" {radius} mode="detail" />
  </svelte:fragment>
  
  <svelte:fragment slot="categoryTags" let:radius>
    {#if categories.length > 0}
      <CategoryTags {categories} {radius} on:categoryClick />
    {/if}
  </svelte:fragment>
  
  <!-- content, voting, stats slots -->
  
  <svelte:fragment slot="credits" let:radius>
    <CreatorCredits {createdBy} {publicCredit} {radius} />
  </svelte:fragment>
</BaseDetailNode>
```

---

## 4. ContentBox System

### 4.1 Purpose

ContentBox provides a **standardized, configurable layout system** for node content. It handles:
- Section sizing (content, voting, stats)
- Spacing and padding
- Positioning calculations
- Responsive to node type and mode

### 4.2 Layout Configuration

**Per Node Type Configuration**:
```typescript
const LAYOUT_CONFIGS = {
  word: {
    horizontalPadding: 0,
    verticalPadding: 0,
    sectionSpacing: 0,
    contentYOffset: 0,
    votingYOffset: 0,
    statsYOffset: 0
  },
  statement: { /* ... */ },
  // etc.
};
```

**Layout Ratios**:
```typescript
const LAYOUT_RATIOS = {
  statement: {
    detail: { 
      content: 0.60,  // 60% of height
      voting: 0.15,   // 15% of height
      stats: 0.25     // 25% of height
    },
    preview: { 
      content: 0.65,  // 65% of height
      voting: 0.35,   // 35% of height
      stats: 0        // No stats in preview
    }
  }
};
```

### 4.3 Box Sizing

ContentBox sizes are defined in `COORDINATE_SPACE.CONTENT_BOXES`:

```typescript
CONTENT_BOXES: {
  WORD: { DETAIL: 600, PREVIEW: 320 },
  STATEMENT: { DETAIL: 600, PREVIEW: 320 },
  DEFINITION: { DETAIL: 600, PREVIEW: 320 },
  // etc.
}
```

### 4.4 Slot System

ContentBox exposes three named slots with calculated dimensions:

```svelte
<ContentBox nodeType={node.type} mode="preview">
  <svelte:fragment slot="content" let:x let:y let:width let:height>
    <!-- x, y: position within box -->
    <!-- width, height: available dimensions -->
  </svelte:fragment>
  
  <svelte:fragment slot="voting" let:x let:y let:width let:height>
    <!-- Voting UI here -->
  </svelte:fragment>
  
  <svelte:fragment slot="stats" let:x let:y let:width let:height>
    <!-- Stats UI here (detail mode only) -->
  </svelte:fragment>
</ContentBox>
```

---

## 5. Node Type Components

### 5.1 Common Structure

Every node type component follows this structure:

```svelte
<script lang="ts">
  // 1. Imports
  import { onMount, createEventDispatcher } from 'svelte';
  import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
  import BasePreviewNode from '../base/BasePreviewNode.svelte';
  import BaseDetailNode from '../base/BaseDetailNode.svelte';
  import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
  
  // 2. Props
  export let node: RenderableNode;
  
  // 3. Type validation
  if (!isNodeTypeData(node.data)) {
    throw new Error('Invalid node data type');
  }
  
  // 4. Data extraction (CRITICAL: use let not const)
  let nodeData = node.data;
  $: displayContent = nodeData.content;
  
  // 5. Vote data extraction
  $: inclusionPositiveVotes = getNeo4jNumber(nodeData.inclusionPositiveVotes) || 0;
  $: inclusionNegativeVotes = getNeo4jNumber(nodeData.inclusionNegativeVotes) || 0;
  $: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
  
  // 6. VoteBehaviour integration
  let inclusionVoting: VoteBehaviour;
  
  onMount(async () => {
    inclusionVoting = createVoteBehaviour(node.id, 'nodetype', {
      // ... configuration
    });
    
    await inclusionVoting.initialize({
      positiveVotes: inclusionPositiveVotes,
      negativeVotes: inclusionNegativeVotes
    });
  });
  
  // 7. Event handlers
  async function handleInclusionVote(event) {
    if (!inclusionVoting) return;
    await inclusionVoting.handleVote(event.detail.voteType);
  }
  
  // 8. Reactive state
  $: votingState = inclusionVoting?.getCurrentState() || {
    isVoting: false,
    voteSuccess: false,
    lastVoteType: null
  };
</script>

<!-- 9. Conditional rendering based on mode -->
{#if isDetail}
  <BaseDetailNode><!-- slots --></BaseDetailNode>
{:else}
  <BasePreviewNode><!-- slots --></BasePreviewNode>
{/if}
```

### 5.2 Vote Data Extraction Pattern

**Always use `getNeo4jNumber` utility** to handle Neo4j Integer types:

```typescript
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';

// Extract vote counts
$: inclusionPositiveVotes = getNeo4jNumber(nodeData.inclusionPositiveVotes) || 0;
$: inclusionNegativeVotes = getNeo4jNumber(nodeData.inclusionNegativeVotes) || 0;
$: inclusionNetVotes = getNeo4jNumber(nodeData.inclusionNetVotes) || 
    (inclusionPositiveVotes - inclusionNegativeVotes);

// Extract user vote status from metadata
$: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
```

---

## 6. VoteBehaviour System

### 6.1 Overview

**The centralized voting system** - all nodes use `voteBehaviour.ts` for voting logic.

**Benefits**:
- ✅ Eliminated ~800 lines of duplicate code
- ✅ Consistent behavior across all nodes
- ✅ Optimistic updates with automatic rollback
- ✅ Error recovery with retry logic
- ✅ Metadata management
- ✅ Graph store integration

### 6.2 Creation Pattern

```typescript
import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';

let voteBehaviour: VoteBehaviour;

onMount(async () => {
  voteBehaviour = createVoteBehaviour(nodeId, nodeType, {
    apiIdentifier,      // ID for API calls
    dataObject,         // Direct data object to update
    dataProperties: {
      positiveVotesKey: 'inclusionPositiveVotes',
      negativeVotesKey: 'inclusionNegativeVotes'
    },
    getVoteEndpoint,    // Custom endpoint function
    getRemoveVoteEndpoint,
    graphStore,         // For visibility updates
    onDataUpdate: () => {
      nodeData = { ...nodeData }; // Trigger reactivity
    },
    metadataConfig: {
      nodeMetadata: node.metadata,
      voteStatusKey: 'inclusionVoteStatus' // or 'contentVoteStatus'
    }
  });

  await voteBehaviour.initialize({
    positiveVotes: inclusionPositiveVotes,
    negativeVotes: inclusionNegativeVotes,
    skipVoteStatusFetch: false
  });
});
```

### 6.3 State Management

```typescript
interface VoteBehaviourState {
  userVoteStatus: VoteStatus;  // 'agree' | 'disagree' | 'none'
  positiveVotes: number;
  negativeVotes: number;
  netVotes: number;
  totalVotes: number;
  isVoting: boolean;
  voteSuccess: boolean;
  lastVoteType: VoteStatus | null;
  error: string | null;
}
```

**Access state reactively:**
```typescript
$: votingState = voteBehaviour?.getCurrentState() || {
  isVoting: false,
  voteSuccess: false,
  lastVoteType: null
};
```

### 6.4 Vote Handling

```typescript
async function handleVote(event: CustomEvent<{ voteType: VoteStatus }>) {
  if (!voteBehaviour) return;
  await voteBehaviour.handleVote(event.detail.voteType);
}
```

**What happens automatically:**
1. Optimistic UI update
2. API call to backend
3. Update vote counts on success
4. Update metadata
5. Trigger reactivity via `onDataUpdate`
6. Update graph store visibility
7. Rollback on failure (with retry)

---

## 7. UI Components

### 7.1 Voting Components

**InclusionVoteButtons** (Include/Exclude with add/remove icons):
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

**ContentVoteButtons** (Agree/Disagree with thumbs):
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

### 7.2 Display Components

**VoteStats** (Vote breakdown display):
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

**CategoryTags** (Clickable category pills):
```svelte
<CategoryTags
  categories={categories}
  radius={radius}
  maxDisplay={3}
  on:categoryClick={handleCategoryClick}
/>
```

**KeywordTags** (Clickable keyword chips):
```svelte
<KeywordTags
  keywords={keywords}
  radius={radius}
  maxDisplay={8}
  on:keywordClick={handleKeywordClick}
/>
```

**NodeMetadata** (Created/updated timestamps):
```svelte
<NodeMetadata
  createdAt={nodeData.createdAt}
  updatedAt={nodeData.updatedAt}
  radius={radius}
/>
```

**CreatorCredits** (User attribution):
```svelte
<CreatorCredits
  createdBy={nodeData.createdBy}
  publicCredit={nodeData.publicCredit}
  radius={radius}
/>
```

---

## 8. Data Flow

### 8.1 Data Sources

**Node data comes from multiple sources:**

1. **node.data** - Direct node properties
2. **node.metadata** - Enriched user context from backend

```typescript
// Extract from node.data
$: positiveVotes = getNeo4jNumber(nodeData.inclusionPositiveVotes) || 0;

// Extract from node.metadata
$: userVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
```

### 8.2 Reactivity Flow

```
User clicks vote button
    ↓
handleVote() called
    ↓
voteBehaviour.handleVote()
    ↓
Optimistic UI update (instant)
    ↓
API call to backend
    ↓
On success:
  - Update dataObject properties
  - Update node.metadata
  - Trigger onDataUpdate callback
  - Update graph store
    ↓
Reactive statements re-evaluate
    ↓
UI updates with new data
```

### 8.3 Critical Pattern: Data Mutability

**MUST use `let` not `const` for reactivity:**

```typescript
// ❌ WRONG - Cannot trigger reactivity
const nodeData = node.data;

// ✅ CORRECT - Can trigger reactivity
let nodeData = node.data;

// Trigger reactivity in callback
onDataUpdate: () => {
  nodeData = { ...nodeData };
}
```

---

## 9. Separation of Concerns

### 9.1 Layer Responsibilities

**Base Layer** (BaseNode, BasePreviewNode, BaseDetailNode):
- SVG structure and decoration
- Layout and positioning
- Slot management
- Mode switching

**Node Layer** (StatementNode, WordNode, etc.):
- Type-specific data extraction
- VoteBehaviour integration
- Event handling
- Content rendering

**UI Layer** (VoteButtons, VoteStats, etc.):
- Pure presentation components
- Event dispatching
- No business logic

**Behaviour Layer** (voteBehaviour.ts):
- Voting business logic
- API interactions
- State management
- Error recovery

### 9.2 What NOT to Do in Node Components

**❌ Don't:**
- Implement voting logic manually
- Manage vote state with local variables
- Make direct API calls for voting
- Duplicate metadata management
- Create custom vote handlers

**✅ Do:**
- Use voteBehaviour for all voting
- Extract data reactively
- Pass data to UI components
- Handle UI events
- Dispatch events to parent

---

## 10. Consistency Patterns

### 10.1 Naming Conventions

**Vote Variables:**
```typescript
// Inclusion voting
inclusionPositiveVotes
inclusionNegativeVotes
inclusionNetVotes
inclusionUserVoteStatus

// Content voting
contentPositiveVotes
contentNegativeVotes
contentNetVotes
contentUserVoteStatus

// Behaviour instances
inclusionVoting
contentVoting
```

**Event Handlers:**
```typescript
handleInclusionVote()
handleContentVote()
handleModeChange()
handleCategoryClick()
handleKeywordClick()
```

### 10.2 File Organization

```
nodes/
├── base/
│   ├── BaseNode.svelte
│   ├── BasePreviewNode.svelte
│   └── BaseDetailNode.svelte
├── behaviours/
│   ├── voteBehaviour.ts
│   └── index.ts
├── ui/
│   ├── InclusionVoteButtons.svelte
│   ├── ContentVoteButtons.svelte
│   ├── VoteStats.svelte
│   ├── CategoryTags.svelte
│   ├── KeywordTags.svelte
│   ├── NodeHeader.svelte
│   ├── NodeMetadata.svelte
│   ├── CreatorCredits.svelte
│   └── index.ts
└── {nodetype}/
    └── {NodeType}Node.svelte
```

---

## 11. Development Patterns

### 11.1 Standard Implementation Checklist

**When creating/modifying a node:**

- [ ] Use `let nodeData = node.data` (not const)
- [ ] Import and use `getNeo4jNumber` for vote extraction
- [ ] Import and use `createVoteBehaviour`
- [ ] Configure voteBehaviour with proper metadata
- [ ] Implement `onDataUpdate` callback for reactivity
- [ ] Create vote handler function
- [ ] Get reactive state with `getCurrentState()`
- [ ] Pass state to UI components
- [ ] Handle all relevant events
- [ ] Test voting functionality thoroughly

### 11.2 Common Mistakes to Avoid

```typescript
// ❌ MISTAKE 1: Using const
const nodeData = node.data;

// ✅ CORRECT
let nodeData = node.data;

// ❌ MISTAKE 2: Missing onDataUpdate
createVoteBehaviour(node.id, 'word', {
  dataObject: nodeData
  // Missing onDataUpdate callback!
});

// ✅ CORRECT
createVoteBehaviour(node.id, 'word', {
  dataObject: nodeData,
  onDataUpdate: () => { nodeData = { ...nodeData }; }
});

// ❌ MISTAKE 3: Wrong metadata key
metadataConfig: {
  nodeMetadata: node.metadata,
  voteStatusKey: 'userVoteStatus' // Wrong for most nodes!
}

// ✅ CORRECT
metadataConfig: {
  nodeMetadata: node.metadata,
  voteStatusKey: 'inclusionVoteStatus' // Correct for single-voting
}

// ❌ MISTAKE 4: Not extracting Neo4j numbers
$: positiveVotes = nodeData.inclusionPositiveVotes || 0;

// ✅ CORRECT
$: positiveVotes = getNeo4jNumber(nodeData.inclusionPositiveVotes) || 0;
```

### 11.3 Performance Best Practices

**Avoid Unnecessary Reactivity:**
```svelte
<!-- GOOD: Simple extraction -->
$: displayText = nodeData.statement;

<!-- BAD: Complex object creation every tick -->
$: complexObject = {
  text: nodeData.statement,
  votes: { positive: positiveVotes, negative: negativeVotes },
  metadata: processMetadata(node.metadata)
};
```

**Memoize Expensive Calculations:**
```svelte
<script>
  import { derived } from 'svelte/store';
  
  // Only recalculates when dependencies change
  const expensiveResult = derived(
    [positiveVotes, negativeVotes],
    ([pos, neg]) => performExpensiveCalculation(pos, neg)
  );
</script>
```

### 11.4 Testing Patterns

**Manual Testing:**
```typescript
// 1. Vote toggle
// Click agree → should show agreed state
// Click agree again → should remove vote

// 2. Vote switch
// Click agree → Click disagree → should switch to disagree

// 3. Loading state
// During API call → buttons should show loading

// 4. Error recovery
// If API fails → vote should rollback to original state

// 5. Metadata persistence
// After voting → refresh/re-render → vote state should persist
```

---

## Summary

The node component architecture is a **well-structured, consistent system** built on:

1. **Composition**: Base components + Specific node types + Shared UI
2. **Centralized Voting**: All voting via voteBehaviour.ts
3. **Separation of Concerns**: Clear layer boundaries and responsibilities
4. **ContentBox System**: Standardized, configurable layout
5. **Data-Driven**: Extract from props, react to changes
6. **Consistent Patterns**: Naming, structure, slots, events

**For Developers:**
- Follow existing patterns for new node types
- Always use voteBehaviour for voting
- Use data extraction pattern with `getNeo4jNumber`
- Leverage ContentBox for layout
- Reuse shared UI components
- Maintain consistency with other nodes
- Keep logic simple and explicit
- Use `let` not `const` for data

**Key Files to Reference:**
- `BaseNode.svelte`, `BasePreviewNode.svelte`, `BaseDetailNode.svelte`
- `behaviours/voteBehaviour.ts`
- `ContentBox.svelte`
- `StatementNode.svelte`, `WordNode.svelte` (examples)
- `InclusionVoteButtons.svelte`, `ContentVoteButtons.svelte`, `VoteStats.svelte`
- See `node-voting-system.md` for complete voting documentation
- See `node-implementation-guide.md` for step-by-step implementation

---

**End of Node Components Architecture Documentation**