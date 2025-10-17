# Node Component Refactor - Implementation Plan v3.0

**Version:** 3.0  
**Date:** October 17, 2025  
**Status:** Ready for Implementation  
**Approach:** Comprehensive Refactor with Two-Tier Voting System

---

## Executive Summary

This document provides a comprehensive plan to refactor the node component layer of ProjectZer0's Universal Graph View. The refactor introduces a **two-tier voting system** (inclusion + content), standardizes all nodes to use the "direct pattern", implements missing node types, and adds interactive features.

### Critical Architectural Change: Two-Tier Voting System

**NEW VOTING PARADIGM:**
- **Inclusion Voting** (Backend recently added, Frontend needs implementation)
  - Purpose: "Should this exist in the graph?"
  - Threshold: `netVotes > 0` unlocks detail mode
  - Present in: ALL nodes (both preview & detail modes)
  - UI Component: **InclusionVotingSection.svelte** (NEW - needs creation)

- **Content Voting** (Already exists, may need refinement)
  - Purpose: "Do you agree with this content?" (quality assessment)
  - Present in: Detail mode only, node-type specific
  - Applicable to: Statement, Answer (binary vote), Quantity (special UI), Evidence (multi-criteria)
  - NOT applicable to: Word, OpenQuestion, Definition, Comment, Category
  - UI Component: Existing ContentVotingSection (verify/extract if needed)

**Mode Behavior:**
- **Preview Mode** = Inclusion voting focus (simple, quick "should this exist?" assessment)
- **Detail Mode** = Full node (unlocked when netVotes > 0)
  - Shows: Inclusion votes + Content votes (if applicable) + metadata + interactions
  - If netVotes falls below 0: Node reverts to preview mode (detail mode disabled)

### Goals

1. **Two-Tier Voting Architecture** - Implement inclusion voting UI throughout all nodes
2. **Architectural Consistency** - Standardize all nodes to use "direct pattern"
3. **Complete Node Coverage** - Implement missing Answer, Evidence, and Category nodes
4. **Enhanced Interactivity** - Add clickable categories, keywords, and child creation
5. **Clean Codebase** - Remove behaviour abstractions, create shared utilities
6. **Solid Foundation** - Establish clear patterns for future development

### Scope

**Total Estimated Time:** 50-65 hours (6-8 working days)

**What We're Doing:**
- ✅ Creating InclusionVotingSection UI component (CRITICAL NEW)
- ✅ Refactoring base layer (BasePreviewNode, BaseDetailNode) for two-tier voting
- ✅ Implementing 3 missing node types (Answer, Evidence, Category)
- ✅ Refactoring 6 existing nodes to new pattern (Word, Definition, Statement, OpenQuestion, Quantity, Comment)
- ✅ Creating 3 new UI components (CategoryTags, KeywordTags, NodeMetadata)
- ✅ Building shared utility functions
- ✅ Adding interactive features across all nodes

**What We're NOT Doing:**
- ❌ Rewriting BaseNode.svelte core structure (just slots/behavior updates)
- ❌ Changing backend API (it's ready, we're implementing frontend)
- ❌ Modifying graph manager integration (preserve existing)
- ❌ Redesigning UI components that work well

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Implementation Order](#2-implementation-order)
3. [Phase 1: UI Components](#3-phase-1-ui-components)
4. [Phase 2: Base Layer Refactor](#4-phase-2-base-layer-refactor)
5. [Phase 3: Individual Nodes](#5-phase-3-individual-nodes)
6. [API Integration](#6-api-integration)
7. [Testing & Quality](#7-testing--quality)
8. [Success Criteria](#8-success-criteria)

---

## 1. Architecture Overview

### 1.1 Two-Tier Voting System

```
┌─────────────────────────────────────────────────────────────┐
│                    PREVIEW MODE                              │
│                                                               │
│  Focus: Inclusion Voting ("Should this exist?")             │
│  Display:                                                     │
│    - Node type title                                         │
│    - Content (truncated/simplified)                          │
│    - Inclusion vote buttons & stats (PRIMARY)                │
│    - Expand button (disabled if netVotes ≤ 0)                │
│                                                               │
│  Available for: ALL node types                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
              (netVotes > 0 threshold met)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    DETAIL MODE                               │
│                                                               │
│  Focus: Full node features + Content voting (if applicable) │
│  Display:                                                     │
│    - Node type title                                         │
│    - CategoryTags (clickable)                                │
│    - KeywordTags (clickable)                                 │
│    - Full content                                            │
│    - Inclusion vote buttons & stats (SECONDARY)              │
│    - Content vote section (if applicable to node type)       │
│    - NodeMetadata (created/updated timestamps)               │
│    - CreatorCredits                                          │
│    - CreateLinkedNodeButton (if applicable)                  │
│    - Collapse button                                         │
│                                                               │
│  Available for: ALL node types (when netVotes > 0)           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Node Type Voting Matrix

| Node Type | Inclusion Voting | Content Voting | Content Vote Type |
|-----------|------------------|----------------|-------------------|
| **Statement** | ✅ Yes (all nodes) | ✅ Yes | Binary agree/disagree |
| **OpenQuestion** | ✅ Yes | ❌ No | N/A - opens for answers |
| **Answer** | ✅ Yes | ✅ Yes | Binary agree/disagree |
| **Quantity** | ✅ Yes | ✅ Yes | Quantity-specific UI |
| **Evidence** | ✅ Yes | ✅ Yes | Multi-criteria evaluation |
| **Category** | ✅ Yes | ❌ No | N/A - organizational |
| **Word** | ✅ Yes | ❌ No | N/A - vocabulary |
| **Definition** | ✅ Yes | ❌ No | N/A - word definitions |
| **Comment** | ✅ Yes | ❌ No | N/A - discussion |
| **Hidden** | N/A | N/A | Special display node |

### 1.3 The Direct Pattern (Standard)

**Principles:**
1. Extract data directly from `node.data` and `node.metadata`
2. Use reactive declarations (`$:`) for derived state
3. Make direct API calls (no behaviour layer abstractions)
4. Handle voting, visibility, and mode changes directly
5. Dispatch events for graph-level actions

**Example:**
```svelte
<script lang="ts">
  // 1. Props & imports
  export let node: RenderableNode;
  import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
  
  // 2. Data extraction
  const nodeData = node.data as NodeTypeData;
  $: displayContent = nodeData.content;
  
  // 3. Inclusion vote data (from metadata + data)
  $: inclusionPositiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
  $: inclusionNegativeVotes = getNeo4jNumber(nodeData.negativeVotes) || 0;
  $: inclusionNetVotes = inclusionPositiveVotes - inclusionNegativeVotes;
  $: inclusionUserVoteStatus = node.metadata?.userVoteStatus?.status || 'none';
  
  // 4. Content vote data (if applicable)
  $: contentPositiveVotes = getNeo4jNumber(nodeData.contentPositiveVotes) || 0;
  $: contentNegativeVotes = getNeo4jNumber(nodeData.contentNegativeVotes) || 0;
  $: contentUserVoteStatus = node.metadata?.contentVoteStatus?.status || 'none';
  
  // 5. Detail mode unlock logic
  $: canShowDetail = inclusionNetVotes > 0;
  $: effectiveMode = canShowDetail ? node.mode : 'preview';
  
  // 6. Voting handlers (direct API calls)
  async function handleInclusionVote(voteType: VoteStatus) {
    const endpoint = voteType === 'none' 
      ? `/nodes/${nodeType}/${node.id}/vote/remove`
      : `/nodes/${nodeType}/${node.id}/vote`;
    // ... make API call, update local state
  }
  
  async function handleContentVote(voteType: VoteStatus) {
    // Similar pattern for content voting
  }
</script>

{#if effectiveMode === 'detail'}
  <BaseDetailNode {node} on:modeChange>
    <!-- Full detail view with both voting sections -->
  </BaseDetailNode>
{:else}
  <BasePreviewNode {node} on:modeChange>
    <!-- Preview view with inclusion voting only -->
  </BasePreviewNode>
{/if}
```

### 1.4 Layer Structure

```
┌─────────────────────────────────────────────────────────────┐
│           Individual Node Components (9 types)               │
│  (StatementNode, AnswerNode, CategoryNode, etc.)            │
│                                                               │
│  • Type-specific data extraction                             │
│  • Inclusion voting (all nodes)                              │
│  • Content voting (type-specific)                            │
│  • Detail mode unlock logic (netVotes > 0)                   │
│  • Event handling                                            │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────────────┐
│              Base Layer Components                           │
│   (BaseNode, BasePreviewNode, BaseDetailNode)               │
│                                                               │
│  • BasePreviewNode - Inclusion vote focus                    │
│  • BaseDetailNode - Full features + content voting           │
│  • Mode switching with threshold awareness                   │
│  • Slot-based layout structure                               │
│  • Edge buttons (expand/collapse with threshold logic)       │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────────────┐
│          UI Components & ContentBox                          │
│                                                               │
│  NEW:                                                         │
│  • InclusionVotingSection - Vote on existence (all nodes)    │
│  • CategoryTags - Clickable category pills                   │
│  • KeywordTags - Clickable keyword pills                     │
│  • NodeMetadata - Timestamp display                          │
│                                                               │
│  EXISTING:                                                    │
│  • ContentVotingSection - Content quality votes (verify)     │
│  • VoteButtons, VoteStats                                    │
│  • ContentBox - Layout system                                │
│  • CreateLinkedNodeButton - Child creation                   │
│  • CreatorCredits, ShowHideButton, etc.                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Implementation Order

**CRITICAL:** We follow this exact order to ensure dependencies are met.

### Phase 1: UI Components (8-10 hours)
Create/adapt all UI components needed for the refactor.

### Phase 2: Base Layer Refactor (10-12 hours)
Update BasePreviewNode and BaseDetailNode for two-tier voting.

### Phase 3: Individual Nodes (32-43 hours)
Refactor/create nodes in this specific order:
1. Word → Definition → Category (foundational nodes)
2. Statement → OpenQuestion → Answer (content flow)
3. Quantity → Evidence (special cases)
4. Comment → Hidden (supporting nodes)

---

## 3. Phase 1: UI Components

**Time:** 8-10 hours | **Priority:** 🔴 CRITICAL

Create all UI components needed for the refactor with full documentation.

### 3.1 InclusionVotingSection.svelte (3-4h) ⭐ CRITICAL NEW

**Purpose:** Display inclusion voting (primary voting system for all nodes)

**Props:**
```typescript
export let userVoteStatus: VoteStatus;  // 'agree' | 'disagree' | 'none'
export let positiveVotes: number;
export let negativeVotes: number;
export let isVoting: boolean = false;
export let voteSuccess: boolean = false;
export let lastVoteType: VoteStatus | null = null;
export let mode: 'preview' | 'detail';
export let availableWidth: number;
export let containerY: number = 0;
```

**Events:**
```typescript
dispatch('vote', { voteType: VoteStatus });
```

**Visual Design:**
- Similar to existing VoteButtons but with distinct styling
- Label: "Include in graph?" or "Inclusion:"
- Green (agree) / Red (disagree) buttons
- Shows net votes prominently
- In preview mode: Larger, more prominent (primary focus)
- In detail mode: Smaller, less prominent (secondary, but still visible)
- Positioned appropriately in ContentBox voting slot

**Implementation Notes:**
- Can adapt existing VoteButtons.svelte code
- Needs distinct visual identity from content voting
- Must work in both preview and detail modes
- Include threshold indicator (e.g., "Needs X more votes to unlock details")

### 3.2 CategoryTags.svelte (2h)

**Purpose:** Display clickable category pill tags

**Props:**
```typescript
export let categories: Array<{
  id: string;
  name: string;
  description?: string;
}>;
export let radius: number;
export let maxDisplay: number = 3;
```

**Events:**
```typescript
dispatch('categoryClick', { 
  categoryId: string; 
  categoryName: string 
});
```

**Visual Design:**
- Pill-shaped SVG tags with rounded corners
- Blue color scheme (rgba(52, 152, 219, 0.8))
- 📁 emoji or icon prefix
- Hover: Scale 1.1x + glow effect
- Shows first 3, then "+N more" pill
- Positioned below node title in detail mode
- Responsive wrapping if needed

### 3.3 KeywordTags.svelte (2h)

**Purpose:** Display clickable keyword pill tags

**Props:**
```typescript
export let keywords: Array<{
  word: string;
  frequency?: number;
  source: 'user' | 'ai' | 'both';
}>;
export let radius: number;
export let maxDisplay: number = 5;
```

**Events:**
```typescript
dispatch('keywordClick', { word: string });
```

**Visual Design:**
- Pill-shaped SVG tags with rounded corners
- Source-based styling:
  - User: Solid border (rgba(46, 204, 113, 0.8))
  - AI: Dashed border (rgba(155, 89, 182, 0.8))
  - Both: Gradient border
- Hover: Scale 1.1x + glow effect
- Shows first 5, then "+N more" pill
- Positioned below CategoryTags
- Responsive wrapping if needed

### 3.4 NodeMetadata.svelte (1-1.5h)

**Purpose:** Display creation and update timestamps

**Props:**
```typescript
export let createdAt: string;  // ISO timestamp
export let updatedAt?: string; // ISO timestamp
export let radius: number;
```

**Visual Design:**
- Small text (10-11px)
- Semi-transparent white (rgba(255, 255, 255, 0.7))
- Format: "Created: Oct 16, 2025" or "Created: 2 days ago"
- If updated differs from created: "Updated: 2 days ago"
- Positioned above CreatorCredits in detail mode
- Uses relative time for recent dates (<7 days), absolute for older

### 3.5 Verify/Extract ContentVotingSection (1-1.5h)

**Purpose:** Verify existing content voting UI or extract from nodes

**Tasks:**
1. Check if ContentVotingSection.svelte exists as separate component
2. If not, extract from Statement/Answer node implementations
3. Ensure it's distinct from InclusionVotingSection
4. Document props and usage

**Expected Props:**
```typescript
export let userVoteStatus: VoteStatus;
export let positiveVotes: number;
export let negativeVotes: number;
export let isVoting: boolean;
export let mode: 'detail'; // Only used in detail mode
export let label?: string; // "Content quality:" or custom
```

### 3.6 Verify CreateLinkedNodeButton (0.5h)

**Purpose:** Confirm existing button meets our needs

**Tasks:**
1. Review existing CreateLinkedNodeButton.svelte
2. Verify it supports:
   - Evidence creation (from Statement/Answer/Quantity)
   - Answer creation (from OpenQuestion)
   - Proper disabled state (netVotes ≤ 0)
3. Document usage pattern

### 3.7 Component Documentation (1h)

**Deliverable:** `docs/frontend/node-ui-components.md`

Document all UI components with:
- Purpose and use cases
- Props and events
- Visual design specs
- Code examples
- Integration patterns

**Deliverables:**
- [ ] InclusionVotingSection.svelte created and tested
- [ ] CategoryTags.svelte created and tested
- [ ] KeywordTags.svelte created and tested
- [ ] NodeMetadata.svelte created and tested
- [ ] ContentVotingSection verified/extracted
- [ ] CreateLinkedNodeButton verified
- [ ] All components exported from ui/index.ts
- [ ] node-ui-components.md documentation complete

---

## 4. Phase 2: Base Layer Refactor

**Time:** 10-12 hours | **Priority:** 🔴 CRITICAL

Update base components to support two-tier voting while preserving what works.

### 4.1 BaseNode.svelte Review (1h)

**Purpose:** Core SVG structure - likely needs minimal changes

**Tasks:**
1. Review current implementation
2. Verify slot system accommodates new components
3. Check if any style updates needed for threshold states
4. Document current API

**Likely Changes:** Minimal to none (it's just the container)

### 4.2 BasePreviewNode.svelte Refactor (4-5h)

**Purpose:** Transform into inclusion-vote-focused preview

**Current State:** Shows content + voting in preview mode
**Target State:** Inclusion voting primary focus, simpler layout

**Changes Needed:**

1. **Slot Structure Update:**
```svelte
<slot name="title" {radius} />
<ContentBox {nodeType} mode="preview">
  <svelte:fragment slot="content">
    <!-- Simplified content display -->
    <slot name="content" {x} {y} {width} {height} {layoutConfig} />
  </svelte:fragment>
  
  <svelte:fragment slot="voting">
    <!-- PRIMARY: Inclusion voting section -->
    <slot name="inclusionVoting" {x} {y} {width} {height} />
  </svelte:fragment>
  
  <!-- NO stats slot in preview -->
</ContentBox>

<!-- Expand button with threshold awareness -->
<ExpandCollapseButton 
  mode="expand" 
  {x} {y}
  disabled={!canExpand}
  tooltip={canExpand ? "Expand" : "Needs more votes"}
/>
```

2. **Add Threshold Logic:**
```svelte
export let node: RenderableNode;
$: netVotes = (node.metadata?.net_votes ?? 0);
$: canExpand = netVotes > 0;
```

3. **Update ContentBox Config:**
- Preview mode layout: More space for inclusion voting
- Simplified content area (just enough to understand what's being voted on)

4. **Visual Polish:**
- Clear visual hierarchy: Inclusion voting is the main action
- Content is supporting context for the vote
- Disabled expand button has clear visual feedback

### 4.3 BaseDetailNode.svelte Refactor (4-5h)

**Purpose:** Support both inclusion + content voting sections

**Current State:** Shows full content + single voting section
**Target State:** Dual voting sections + full metadata

**Changes Needed:**

1. **Slot Structure Update:**
```svelte
<slot name="title" {radius} />

<!-- Tags positioned above content box -->
<g transform="translate(0, -{radius + 20})">
  <slot name="categoryTags" {radius} />
</g>
<g transform="translate(0, -{radius + 40})">
  <slot name="keywordTags" {radius} />
</g>

<ContentBox {nodeType} mode="detail">
  <svelte:fragment slot="content">
    <slot name="content" {x} {y} {width} {height} {layoutConfig} />
  </svelte:fragment>
  
  <svelte:fragment slot="voting">
    <!-- SECTION 1: Inclusion voting (secondary in detail) -->
    <slot name="inclusionVoting" {x} {y} {width} {height} />
    
    <!-- SECTION 2: Content voting (if applicable) -->
    <slot name="contentVoting" {x} {y} {width} {height} />
  </svelte:fragment>
  
  <svelte:fragment slot="stats">
    <!-- Vote statistics -->
    <slot name="stats" {x} {y} {width} {height} />
  </svelte:fragment>
</ContentBox>

<!-- Metadata & credits below content box -->
<slot name="metadata" {radius} />
<slot name="credits" {radius} />

<!-- Collapse button -->
<ExpandCollapseButton mode="collapse" {x} {y} />

<!-- Create child button (if applicable) -->
<slot name="createChild" {radius} />
```

2. **ContentBox Layout Updates:**
- Detail mode now needs space for dual voting sections
- Adjust height ratios in LAYOUT_RATIOS config
- Content section slightly smaller to accommodate

3. **Support Node Types Without Content Voting:**
- If no content voting slot filled, voting section shows only inclusion
- Flexible layout that works for all node types

### 4.4 ContentBox Config Updates (1-2h)

**Purpose:** Update layout configurations for two-tier voting

**File:** `src/lib/components/graph/nodes/ui/ContentBox.svelte`

**Tasks:**
1. Review LAYOUT_RATIOS for each node type
2. Adjust detail mode ratios to accommodate dual voting:
```typescript
const LAYOUT_RATIOS = {
  statement: {
    detail: { 
      content: 0.55,  // Slightly less for dual voting
      voting: 0.25,   // More space for two vote sections
      stats: 0.20 
    },
    preview: { 
      content: 0.55,  // Supporting context
      voting: 0.45,   // Inclusion voting prominence
      stats: 0 
    }
  },
  // ... adjust for each node type
};
```

3. Add/update spacing configs for new components
4. Test with mock data

### 4.5 Base Layer Documentation (1h)

**Deliverable:** Update `docs/frontend/node-components.md` base layer section

Document:
- New slot structure for both preview and detail
- Threshold logic integration
- Dual voting section layout
- How node types use the updated base

**Deliverables:**
- [ ] BaseNode.svelte reviewed (minimal changes)
- [ ] BasePreviewNode.svelte refactored with threshold logic
- [ ] BaseDetailNode.svelte refactored for dual voting
- [ ] ContentBox configs updated for all node types
- [ ] Base layer documentation updated
- [ ] All changes tested with mock nodes

---

## 5. Phase 3: Individual Nodes

**Time:** 32-43 hours | **Priority:** 🔴 CRITICAL

Refactor/create all 10 node types in optimal dependency order.

### 5.1 WordNode.svelte (3-4h)

**Current:** Uses behaviour pattern
**Target:** Direct pattern + new UI components
**Voting:** Inclusion only (no content voting)

**Key Changes:**
1. Remove voteBehaviour and dataBehaviour
2. Add direct inclusion vote handling
3. Add KeywordTags (if word appears in categories)
4. Add NodeMetadata
5. Update to use InclusionVotingSection
6. Ensure preview focuses on inclusion vote
7. Detail shows full word + definitions list

**Detail Mode Elements:**
- Title: "Word"
- KeywordTags (if applicable)
- Word display (large, centered)
- Definitions list (clickable to expand definition nodes)
- InclusionVotingSection
- NodeMetadata
- CreatorCredits

**Preview Mode Elements:**
- Title: "Word"
- Word display (smaller)
- InclusionVotingSection (prominent)

### 5.2 DefinitionNode.svelte (3-4h)

**Current:** Uses behaviour pattern
**Target:** Direct pattern + new UI components
**Voting:** Inclusion only (no content voting)
**Parent:** Word node

**Key Changes:**
1. Remove behaviour abstractions
2. Add direct inclusion vote handling
3. Add parent word context display
4. Add NodeMetadata
5. Update to use InclusionVotingSection

**Detail Mode Elements:**
- Title: "Definition" or "Definition: [word]"
- Word context: "Defines: [word]" (clickable)
- Definition text
- InclusionVotingSection
- NodeMetadata
- CreatorCredits

**Preview Mode Elements:**
- Title: "Definition"
- Brief definition text
- InclusionVotingSection (prominent)

### 5.3 CategoryNode.svelte (5-6h) ⭐ NEW

**Create from scratch**
**Voting:** Inclusion only (no content voting)
**Special:** Composed of 1-5 words, displayed as KeywordTags

**Key Elements:**

**Data Structure:**
```typescript
interface CategoryData {
  id: string;
  name: string;  // Category name (e.g., "basic human needs")
  description?: string;
  createdBy: string;
  publicCredit: boolean;
  positiveVotes: number;
  negativeVotes: number;
  createdAt: string;
  updatedAt: string;
  composedWords?: string[];  // [basic, human, needs]
  discussionId?: string;
}
```

**Detail Mode Elements:**
- Title: "Category"
- Category name (large, bold)
- Description (if present)
- KeywordTags: The composed words (clickable to expand word nodes)
- InclusionVotingSection
- CreateLinkedNodeButton: Generic "Create Node" (opens form with category pre-assigned)
- NodeMetadata
- CreatorCredits

**Preview Mode Elements:**
- Title: "Category"
- Category name
- Composed words (simple text list)
- InclusionVotingSection (prominent)

**Implementation Steps:**
1. Create CategoryNode.svelte structure
2. Implement data extraction for category info
3. Add KeywordTags for composed words (with word expansion handler)
4. Add inclusion voting
5. Add CreateLinkedNodeButton (unique: opens generic node creation)
6. Add NodeMetadata and CreatorCredits
7. Style according to category visual identity
8. Test with mock data

### 5.4 StatementNode.svelte (4-5h)

**Current:** Direct pattern (good!)
**Target:** Add new UI components + dual voting
**Voting:** Inclusion + Content (both)

**Key Changes:**
1. Add CategoryTags (if assigned categories)
2. Add KeywordTags
3. Split voting into InclusionVotingSection + ContentVotingSection
4. Add NodeMetadata
5. Add CreateLinkedNodeButton (Evidence)
6. Update threshold logic (detail only if inclusionNetVotes > 0)

**Detail Mode Elements:**
- Title: "Statement"
- CategoryTags (clickable)
- KeywordTags (clickable)
- Statement text (full)
- InclusionVotingSection (secondary)
- ContentVotingSection (quality vote)
- VoteStats (for both voting types)
- CreateLinkedNodeButton: "Add Evidence"
- NodeMetadata
- CreatorCredits

**Preview Mode Elements:**
- Title: "Statement"
- Statement text (truncated if needed)
- InclusionVotingSection (prominent)
- Expand button (disabled if inclusionNetVotes ≤ 0)

### 5.5 OpenQuestionNode.svelte (4-5h)

**Current:** Direct pattern (good!)
**Target:** Add new UI components + REMOVE content voting
**Voting:** Inclusion only (answers will have content votes)

**Key Changes:**
1. Add CategoryTags
2. Add KeywordTags
3. **REMOVE any content voting** (if present)
4. Update to use InclusionVotingSection only
5. Add NodeMetadata
6. Add CreateLinkedNodeButton: "Answer Question"
7. Show answer count
8. Threshold: Answers only appear if question's inclusionNetVotes > 0

**Detail Mode Elements:**
- Title: "Question"
- CategoryTags (clickable)
- KeywordTags (clickable)
- Question text (full)
- Answer count display: "X answers" (if any)
- InclusionVotingSection (only voting type)
- CreateLinkedNodeButton: "Answer Question" (disabled if inclusionNetVotes ≤ 0)
- NodeMetadata
- CreatorCredits

**Preview Mode Elements:**
- Title: "Question"
- Question text (truncated if needed)
- Answer count (if any)
- InclusionVotingSection (prominent)
- Expand button (disabled if inclusionNetVotes ≤ 0)

### 5.6 AnswerNode.svelte (5-6h) ⭐ NEW

**Create from scratch**
**Voting:** Inclusion + Content (both)
**Parent:** OpenQuestion node

**Data Structure:**
```typescript
interface AnswerData {
  id: string;
  answerText: string;
  questionId: string;
  questionText?: string;  // For display context
  createdBy: string;
  publicCredit: boolean;
  
  // Inclusion votes
  positiveVotes: number;
  negativeVotes: number;
  
  // Content votes
  contentPositiveVotes: number;
  contentNegativeVotes: number;
  
  createdAt: string;
  updatedAt: string;
  discussionId?: string;
  keywords?: KeywordData[];
  categories?: CategoryData[];
}
```

**Detail Mode Elements:**
- Title: "Answer"
- Parent context: "Answer to: [question text]..." (clickable to expand question)
- CategoryTags (clickable)
- KeywordTags (clickable)
- Answer text (full)
- InclusionVotingSection (secondary)
- ContentVotingSection (quality vote)
- VoteStats (for both voting types)
- CreateLinkedNodeButton: "Add Evidence"
- NodeMetadata
- CreatorCredits

**Preview Mode Elements:**
- Title: "Answer"
- Parent context: "Answer to: [question]..."
- Answer text (truncated if needed)
- InclusionVotingSection (prominent)
- Expand button (disabled if inclusionNetVotes ≤ 0)

**Implementation Steps:**
1. Create AnswerNode.svelte from OpenQuestionNode template
2. Add parent question context display (clickable)
3. Implement dual voting (inclusion + content)
4. Add CategoryTags, KeywordTags, NodeMetadata
5. Add CreateLinkedNodeButton for Evidence
6. Handle parent question expansion on click
7. Style according to answer visual identity
8. Test with mock data

### 5.7 QuantityNode.svelte (4-5h)

**Current:** Mixed pattern, needs review
**Target:** Standardize to direct pattern + dual voting
**Voting:** Inclusion + Quantity-specific content vote

**Key Changes:**
1. Verify/apply direct pattern throughout
2. Add CategoryTags
3. Add KeywordTags
4. Split voting into InclusionVotingSection + quantity submission UI
5. Add NodeMetadata
6. Add CreateLinkedNodeButton: "Add Evidence"
7. Maintain existing quantity submission logic

**Detail Mode Elements:**
- Title: "Quantity Question"
- CategoryTags (clickable)
- KeywordTags (clickable)
- Quantity question text
- Unit display (e.g., "in meters", "in dollars")
- InclusionVotingSection (secondary)
- Quantity submission UI (content interaction - special)
- Response count display
- CreateLinkedNodeButton: "Add Evidence"
- NodeMetadata
- CreatorCredits

**Preview Mode Elements:**
- Title: "Quantity"
- Question text (truncated if needed)
- Unit display
- InclusionVotingSection (prominent)
- Expand button (disabled if inclusionNetVotes ≤ 0)

### 5.8 EvidenceNode.svelte (5-6h) ⭐ NEW

**Create from scratch**
**Voting:** Inclusion + Multi-criteria evaluation
**Parent:** Statement, Answer, or Quantity node

**Data Structure:**
```typescript
interface EvidenceData {
  id: string;
  title: string;
  sourceUrl: string;
  evidenceType: 'peer_reviewed_study' | 'government_report' | 
                'news_article' | 'expert_opinion' | 'dataset' | 
                'video' | 'image' | 'other';
  parentNodeId: string;
  parentNodeType: 'StatementNode' | 'AnswerNode' | 'QuantityNode';
  parentContent?: string;  // For display context
  createdBy: string;
  publicCredit: boolean;
  
  // Inclusion votes
  positiveVotes: number;
  negativeVotes: number;
  
  // Evidence quality criteria (details to be provided)
  // Multi-criteria evaluation system
  
  createdAt: string;
  updatedAt: string;
  discussionId?: string;
  keywords?: KeywordData[];
  categories?: CategoryData[];
}
```

**Detail Mode Elements:**
- Title: "Evidence"
- Parent context: "Evidence for: [parent content]..." (clickable)
- Evidence type badge (color-coded by type)
- CategoryTags (clickable)
- KeywordTags (clickable)
- Evidence title (bold)
- Source URL (prominent clickable link with icon)
- InclusionVotingSection (secondary)
- Evidence quality evaluation UI (multi-criteria - to be designed)
- NodeMetadata
- CreatorCredits
- NO CreateLinkedNodeButton (evidence is terminal - can't have children)

**Preview Mode Elements:**
- Title: "Evidence"
- Evidence type badge
- Parent context: "For: [parent]..."
- Evidence title (truncated)
- InclusionVotingSection (prominent)
- Expand button (disabled if inclusionNetVotes ≤ 0)

**Implementation Steps:**
1. Create EvidenceNode.svelte from AnswerNode template
2. Add parent node context display (clickable)
3. Add evidence type badge component
4. Add source URL as prominent clickable link
5. Implement inclusion voting
6. Add placeholder for evidence quality evaluation UI
7. Add CategoryTags, KeywordTags, NodeMetadata
8. NO CreateLinkedNodeButton (evidence can't have children)
9. Style according to evidence visual identity
10. Test with mock data

**Note:** Evidence quality evaluation UI details to be provided later.

### 5.9 CommentNode.svelte (3-4h)

**Current:** Uses behaviour pattern
**Target:** Direct pattern + new UI components
**Voting:** Inclusion only (no content voting)
**Parent:** Discussion node

**Key Changes:**
1. Remove behaviour abstractions
2. Add direct inclusion vote handling
3. Add NodeMetadata
4. Maintain reply functionality
5. Update to use InclusionVotingSection
6. Handle thread depth display

**Detail Mode Elements:**
- Title: "Comment"
- Thread depth indicator (if nested reply)
- Comment text (full)
- Reply button (if applicable)
- InclusionVotingSection
- NodeMetadata
- CreatorCredits

**Preview Mode Elements:**
- Title: "Comment"
- Comment text (truncated)
- InclusionVotingSection (prominent)
- Reply indicator (if has replies)

### 5.10 HiddenNode.svelte (2-3h)

**Current:** Special display node for below-threshold content
**Target:** Update for new voting system if needed

**Purpose:** Display nodes that fall below voting threshold (netVotes < 0)

**Key Elements:**
- Shows node is hidden
- Displays net votes
- Shows reason: "Hidden by community" or "Hidden by user"
- ShowHideButton (to override and reveal)
- Minimal visual (small, red-tinted)

**Tasks:**
1. Review current implementation
2. Update if needed for new threshold logic
3. Ensure it displays inclusion vote status correctly
4. Test transitions (node falls below threshold → becomes hidden)
5. Test user override (show hidden node → reveal full node)

**Note:** This is a special node type that wraps other nodes when they're hidden. Detailed implementation to be discussed when reached.

---

## 6. API Integration

### 6.1 Voting Endpoints

**Inclusion Vote:**
```
POST /nodes/{nodeType}/{nodeId}/vote
Body: { isPositive: boolean }
Response: { positiveVotes: number, negativeVotes: number }

POST /nodes/{nodeType}/{nodeId}/vote/remove
Response: { positiveVotes: number, negativeVotes: number }
```

**Content Vote (Statement, Answer only):**
```
POST /nodes/{nodeType}/{nodeId}/content-vote
Body: { isPositive: boolean }
Response: { contentPositiveVotes: number, contentNegativeVotes: number }

POST /nodes/{nodeType}/{nodeId}/content-vote/remove
Response: { contentPositiveVotes: number, contentNegativeVotes: number }
```

**Node Types:** `statement`, `openquestion`, `answer`, `quantity`, `evidence`, `word`, `category`

**Special Cases:**
- Words: Use word text as identifier `/nodes/word/{wordText}/vote`
- Definitions: Use definition ID `/definitions/{definitionId}/vote`
- Comments: Use comment ID `/comments/{commentId}/vote`

**Note:** See `docs/frontend/API-cheatsheet.md` for complete API documentation.

### 6.2 Expansion Endpoints

**Category Expansion:**
```
GET /categories/{categoryId}/with-contents
Response: { nodes: [], relationships: [] }
Returns: Category node + 1-5 word nodes + COMPOSED_OF relationships
```

**Keyword Expansion:**
```
GET /words/{word}/with-definitions
Response: { nodes: [], relationships: [] }
Returns: Word node + definition nodes + DEFINES relationships
```

**Discussion Expansion:**
```
GET /discussions/{discussionId}/with-comments-visibility
Response: { nodes: [], relationships: [] }
```

### 6.3 Data Structure Notes

**Node Metadata (from Universal Graph):**
```typescript
node.metadata = {
  userVoteStatus: { status: 'agree' | 'disagree' | 'none' },
  contentVoteStatus: { status: 'agree' | 'disagree' | 'none' }, // If applicable
  userVisibilityPreference: { isVisible: boolean },
  net_votes: number,
  answer_count: number, // For questions
  // ... other enriched metadata
}
```

**Always check `metadata` first, fall back to `node.data`.**

---

## 7. Testing & Quality

### 7.1 Component Testing Checklist

For each node type:
- [ ] Renders correctly in preview mode
- [ ] Renders correctly in detail mode
- [ ] Preview shows inclusion voting prominently
- [ ] Detail shows both voting types (if applicable)
- [ ] Threshold logic works (netVotes > 0 unlocks detail)
- [ ] Falls back to preview if netVotes drops below 0
- [ ] Displays all data fields accurately
- [ ] Handles missing/null data gracefully
- [ ] CategoryTags clickable and functional (if present)
- [ ] KeywordTags clickable and functional (if present)
- [ ] CreateLinkedNodeButton functional (if applicable)
- [ ] NodeMetadata displays correctly
- [ ] Vote buttons work correctly (both types)
- [ ] Edge buttons dispatch correct events
- [ ] Mode switching works smoothly

### 7.2 Two-Tier Voting Testing

- [ ] Inclusion votes update immediately
- [ ] Content votes update immediately (separate from inclusion)
- [ ] User can vote on inclusion without voting on content
- [ ] User can vote on both independently
- [ ] Vote statuses reflected correctly in UI
- [ ] Threshold transitions work smoothly (preview ↔ detail)
- [ ] "Needs more votes" messaging clear in preview mode
- [ ] Expand button disabled state clear

### 7.3 Interaction Testing

- [ ] Category click triggers expansion
- [ ] Keyword click triggers expansion
- [ ] Parent node context click triggers expansion
- [ ] Discussion button opens discussion
- [ ] Create child opens correct form with context
- [ ] Show/Hide toggles visibility
- [ ] Expand/Collapse switches modes (when allowed)

### 7.4 Data Flow Testing

- [ ] Backend inclusion vote data correctly parsed
- [ ] Backend content vote data correctly parsed (if applicable)
- [ ] Neo4j numbers handled properly (getNeo4jNumber)
- [ ] Metadata extracted correctly
- [ ] Threshold calculated correctly from votes
- [ ] User context displays accurately

### 7.5 Edge Cases

- [ ] No categories: Don't show CategoryTags
- [ ] No keywords: Don't show KeywordTags
- [ ] No discussion: Disable discuss button
- [ ] inclusionNetVotes = 0: Expand button disabled
- [ ] inclusionNetVotes < 0: Node hidden or preview locked
- [ ] Missing parent (Answer/Evidence): Show generic context
- [ ] Vote API failure: Show error, revert state
- [ ] Expansion API failure: Show notification
- [ ] Node transitions from visible to hidden (netVotes drops)

---

## 8. Success Criteria

### 8.1 Architectural Success

- [ ] All 10 node types use identical direct pattern
- [ ] Zero behaviour files in use for core features
- [ ] All nodes use shared utility functions
- [ ] Two-tier voting implemented throughout
- [ ] Threshold logic works consistently
- [ ] Clear, documented standard pattern exists

### 8.2 Feature Completeness

- [ ] InclusionVotingSection implemented and used by all nodes
- [ ] AnswerNode fully functional
- [ ] EvidenceNode fully functional
- [ ] CategoryNode fully functional
- [ ] All nodes have clickable category tags (where applicable)
- [ ] All nodes have clickable keyword tags (where applicable)
- [ ] Eligible nodes have create child button
- [ ] All nodes display metadata
- [ ] Inclusion voting works correctly on all nodes
- [ ] Content voting works correctly on applicable nodes
- [ ] Threshold unlocking works correctly

### 8.3 Quality Metrics

- [ ] No visual regressions
- [ ] All interactions work smoothly
- [ ] Performance acceptable with 50+ nodes
- [ ] Code is maintainable and clear
- [ ] Documentation is complete and accurate
- [ ] Voting transitions are smooth and intuitive
- [ ] Threshold states are clearly communicated

### 8.4 Developer Experience

- [ ] Can add new node type in <2 hours using template
- [ ] Pattern is self-documenting
- [ ] Utilities are intuitive to use
- [ ] Components are easy to compose
- [ ] Debugging is straightforward
- [ ] Two-tier voting pattern is clear and consistent

---

## 9. Implementation Timeline

### Realistic Day-by-Day Breakdown

**Day 1 (8 hours):**
- Phase 1: UI Components
  - Morning: InclusionVotingSection.svelte (4h)
  - Afternoon: CategoryTags.svelte, KeywordTags.svelte (4h)

**Day 2 (8 hours):**
- Phase 1 continued: UI Components
  - Morning: NodeMetadata.svelte, verify ContentVotingSection (2h)
  - Morning: Component documentation (2h)
- Phase 2: Base Layer Refactor
  - Afternoon: BasePreviewNode.svelte refactor (4h)

**Day 3 (8 hours):**
- Phase 2 continued: Base Layer Refactor
  - Morning: BaseDetailNode.svelte refactor (4h)
  - Afternoon: ContentBox config updates, documentation (4h)

**Day 4 (8 hours):**
- Phase 3: Individual Nodes
  - WordNode.svelte (4h)
  - DefinitionNode.svelte (4h)

**Day 5 (8 hours):**
- Phase 3 continued:
  - CategoryNode.svelte (6h)
  - Start StatementNode.svelte (2h)

**Day 6 (8 hours):**
- Phase 3 continued:
  - Complete StatementNode.svelte (2h)
  - OpenQuestionNode.svelte (4h)
  - Start AnswerNode.svelte (2h)

**Day 7 (8 hours):**
- Phase 3 continued:
  - Complete AnswerNode.svelte (3h)
  - QuantityNode.svelte (5h)

**Day 8 (8 hours):**
- Phase 3 continued:
  - EvidenceNode.svelte (6h)
  - CommentNode.svelte (2h)

**Day 9 (if needed) (4-8 hours):**
- Phase 3 final:
  - Complete CommentNode.svelte (2h)
  - HiddenNode.svelte review (2h)
- Testing & Polish:
  - Integration testing (4h)

### Checkpoints

**After Day 2:**
- ✅ All UI components created and documented
- ✅ BasePreviewNode refactored
- ✅ Ready for individual node work

**After Day 4:**
- ✅ Base layer completely refactored
- ✅ First 2 nodes (Word, Definition) complete
- ✅ Pattern proven and working

**After Day 6:**
- ✅ 5 nodes complete (Word, Definition, Category, Statement, OpenQuestion)
- ✅ Both new and refactored nodes working
- ✅ Two-tier voting proven

**After Day 8:**
- ✅ All 9 primary nodes complete
- ✅ Ready for final testing and polish

---

## 10. Quick Reference

### Node Type Quick Facts

| Type | Inclusion Vote | Content Vote | Content Vote Type | Parent | Can Have Children |
|------|----------------|--------------|-------------------|--------|-------------------|
| Statement | ✅ Yes | ✅ Yes | Binary agree/disagree | ❌ No | ✅ Evidence |
| OpenQuestion | ✅ Yes | ❌ No | N/A | ❌ No | ✅ Answer |
| Answer | ✅ Yes | ✅ Yes | Binary agree/disagree | ✅ Question | ✅ Evidence |
| Quantity | ✅ Yes | ✅ Yes | Quantity submission | ❌ No | ✅ Evidence |
| Evidence | ✅ Yes | ✅ Yes | Multi-criteria eval | ✅ Statement/Answer/Quantity | ❌ No |
| Category | ✅ Yes | ❌ No | N/A | ❌ No | ✅ Any (via tag) |
| Word | ✅ Yes | ❌ No | N/A | ❌ No | ❌ No |
| Definition | ✅ Yes | ❌ No | N/A | ✅ Word | ❌ No |
| Comment | ✅ Yes | ❌ No | N/A | ✅ Discussion | ✅ Reply |
| Hidden | N/A | N/A | N/A | N/A | N/A |

### Threshold Quick Reference

- **Preview Mode Available:** Always (all nodes)
- **Detail Mode Unlocks:** When `inclusionNetVotes > 0`
- **Detail Mode Locks:** If `inclusionNetVotes` drops to ≤ 0
- **Hidden Node Displays:** When `inclusionNetVotes < 0` (configurable)

### File Locations

**Node Components:** `src/lib/components/graph/nodes/[type]/[Type]Node.svelte`
- answer/AnswerNode.svelte (NEW)
- evidence/EvidenceNode.svelte (NEW)
- category/CategoryNode.svelte (NEW)
- statement/StatementNode.svelte
- openquestion/OpenQuestionNode.svelte
- quantity/QuantityNode.svelte
- word/WordNode.svelte
- definition/DefinitionNode.svelte
- comment/CommentNode.svelte
- hidden/HiddenNode.svelte

**UI Components:** `src/lib/components/graph/nodes/ui/`
- InclusionVotingSection.svelte (NEW)
- CategoryTags.svelte (NEW)
- KeywordTags.svelte (NEW)
- NodeMetadata.svelte (NEW)
- ContentVotingSection.svelte (verify/extract)
- VoteButtons.svelte, VoteStats.svelte
- ContentBox.svelte
- CreateLinkedNodeButton.svelte
- etc.

**Base Components:** `src/lib/components/graph/nodes/base/`
- BaseNode.svelte
- BasePreviewNode.svelte
- BaseDetailNode.svelte

**Utilities:** `src/lib/utils/`
**Types:** `src/lib/types/domain/nodes.ts` and `src/lib/types/graph/enhanced.ts`
**Constants:** `src/lib/constants/graph/nodes.ts`

---

## Appendix: Code Examples

### Example: Two-Tier Voting Pattern

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { RenderableNode, VoteStatus } from '$lib/types';
  import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
  import { fetchWithAuth } from '$lib/services/api';
  
  // Base components
  import BasePreviewNode from '../base/BasePreviewNode.svelte';
  import BaseDetailNode from '../base/BaseDetailNode.svelte';
  import ContentBox from '../ui/ContentBox.svelte';
  
  // UI components
  import NodeHeader from '../ui/NodeHeader.svelte';
  import InclusionVotingSection from '../ui/InclusionVotingSection.svelte';
  import ContentVotingSection from '../ui/ContentVotingSection.svelte';
  import CategoryTags from '../ui/CategoryTags.svelte';
  import KeywordTags from '../ui/KeywordTags.svelte';
  import NodeMetadata from '../ui/NodeMetadata.svelte';
  import CreatorCredits from '../ui/CreatorCredits.svelte';
  import CreateLinkedNodeButton from '../ui/CreateLinkedNodeButton.svelte';
  
  export let node: RenderableNode;
  
  // Data extraction
  const nodeData = node.data as StatementNodeData;
  $: displayContent = nodeData.statement;
  
  // INCLUSION VOTES (primary voting system)
  $: inclusionPositiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
  $: inclusionNegativeVotes = getNeo4jNumber(nodeData.negativeVotes) || 0;
  $: inclusionNetVotes = inclusionPositiveVotes - inclusionNegativeVotes;
  $: inclusionUserVoteStatus = (node.metadata?.userVoteStatus?.status || 'none') as VoteStatus;
  
  // CONTENT VOTES (quality assessment - Statement has this)
  $: contentPositiveVotes = getNeo4jNumber(nodeData.contentPositiveVotes) || 0;
  $: contentNegativeVotes = getNeo4jNumber(nodeData.contentNegativeVotes) || 0;
  $: contentUserVoteStatus = (node.metadata?.contentVoteStatus?.status || 'none') as VoteStatus;
  
  // THRESHOLD LOGIC
  $: canShowDetail = inclusionNetVotes > 0;
  $: effectiveMode = canShowDetail ? node.mode : 'preview';
  
  // Voting state
  let isVotingInclusion = false;
  let isVotingContent = false;
  
  const dispatch = createEventDispatcher();
  
  // INCLUSION VOTE HANDLER
  async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
    if (isVotingInclusion) return;
    isVotingInclusion = true;
    
    const { voteType } = event.detail;
    
    try {
      const endpoint = voteType === 'none'
        ? `/nodes/statement/${node.id}/vote/remove`
        : `/nodes/statement/${node.id}/vote`;
      
      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: voteType !== 'none' ? JSON.stringify({ 
          isPositive: voteType === 'agree' 
        }) : undefined
      });
      
      // Update local state
      inclusionPositiveVotes = response.positiveVotes;
      inclusionNegativeVotes = response.negativeVotes;
      inclusionUserVoteStatus = voteType;
      
      // If we dropped below threshold, force preview mode
      if (inclusionNetVotes <= 0 && effectiveMode === 'detail') {
        dispatch('modeChange', { mode: 'preview' });
      }
    } catch (error) {
      console.error('Inclusion vote failed:', error);
    } finally {
      isVotingInclusion = false;
    }
  }
  
  // CONTENT VOTE HANDLER
  async function handleContentVote(event: CustomEvent<{ voteType: VoteStatus }>) {
    if (isVotingContent) return;
    isVotingContent = true;
    
    const { voteType } = event.detail;
    
    try {
      const endpoint = voteType === 'none'
        ? `/nodes/statement/${node.id}/content-vote/remove`
        : `/nodes/statement/${node.id}/content-vote`;
      
      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: voteType !== 'none' ? JSON.stringify({ 
          isPositive: voteType === 'agree' 
        }) : undefined
      });
      
      contentPositiveVotes = response.contentPositiveVotes;
      contentNegativeVotes = response.contentNegativeVotes;
      contentUserVoteStatus = voteType;
    } catch (error) {
      console.error('Content vote failed:', error);
    } finally {
      isVotingContent = false;
    }
  }
</script>

{#if effectiveMode === 'detail'}
  <BaseDetailNode {node} on:modeChange>
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="Statement" {radius} mode="detail" />
    </svelte:fragment>
    
    <svelte:fragment slot="categoryTags" let:radius>
      {#if nodeData.categories?.length}
        <CategoryTags 
          categories={nodeData.categories} 
          {radius}
          on:categoryClick 
        />
      {/if}
    </svelte:fragment>
    
    <svelte:fragment slot="keywordTags" let:radius>
      {#if nodeData.keywords?.length}
        <KeywordTags 
          keywords={nodeData.keywords} 
          {radius}
          on:keywordClick 
        />
      {/if}
    </svelte:fragment>
    
    <ContentBox nodeType="statement" mode="detail">
      <svelte:fragment slot="content" let:width let:height>
        <!-- Statement text -->
        <text>{displayContent}</text>
      </svelte:fragment>
      
      <svelte:fragment slot="voting" let:width let:height>
        <!-- Inclusion voting (secondary in detail) -->
        <InclusionVotingSection
          userVoteStatus={inclusionUserVoteStatus}
          positiveVotes={inclusionPositiveVotes}
          negativeVotes={inclusionNegativeVotes}
          isVoting={isVotingInclusion}
          mode="detail"
          {width}
          on:vote={handleInclusionVote}
        />
        
        <!-- Content voting (primary in detail for Statement) -->
        <ContentVotingSection
          userVoteStatus={contentUserVoteStatus}
          positiveVotes={contentPositiveVotes}
          negativeVotes={contentNegativeVotes}
          isVoting={isVotingContent}
          mode="detail"
          {width}
          on:vote={handleContentVote}
        />
      </svelte:fragment>
      
      <svelte:fragment slot="stats" let:width>
        <!-- Vote statistics -->
      </svelte:fragment>
    </ContentBox>
    
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
    
    <svelte:fragment slot="createChild" let:radius>
      <CreateLinkedNodeButton
        nodeId={node.id}
        nodeType="statement"
        childType="evidence"
        canCreate={inclusionNetVotes > 0}
        {radius}
        on:createChild
      />
    </svelte:fragment>
  </BaseDetailNode>
{:else}
  <BasePreviewNode {node} on:modeChange canExpand={canShowDetail}>
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="Statement" {radius} mode="preview" />
    </svelte:fragment>
    
    <ContentBox nodeType="statement" mode="preview">
      <svelte:fragment slot="content" let:width let:height>
        <!-- Simplified statement text -->
        <text>{displayContent}</text>
      </svelte:fragment>
      
      <svelte:fragment slot="voting" let:width let:height>
        <!-- Inclusion voting (PRIMARY in preview) -->
        <InclusionVotingSection
          userVoteStatus={inclusionUserVoteStatus}
          positiveVotes={inclusionPositiveVotes}
          negativeVotes={inclusionNegativeVotes}
          isVoting={isVotingInclusion}
          mode="preview"
          {width}
          on:vote={handleInclusionVote}
        />
      </svelte:fragment>
    </ContentBox>
  </BasePreviewNode>
{/if}
```

---

## Final Notes

### Critical Success Factors

1. **InclusionVotingSection** must be implemented first and work flawlessly
2. **Threshold logic** must be consistent across all nodes
3. **Base layer** updates must preserve existing functionality
4. **Direct pattern** must be applied uniformly
5. **Testing** at each checkpoint prevents cascade failures

### Flexibility Points

- Evidence quality evaluation UI can be refined later
- Some visual polish can be deferred
- Interactive features (expansions) can be added after core voting works
- Documentation can be enhanced incrementally

### Communication

- Use this document as single source of truth
- Update checkboxes as work progresses
- Flag any deviations or issues immediately
- Celebrate checkpoint completions!

---

**End of Node Layer Refactor Plan v3.0**