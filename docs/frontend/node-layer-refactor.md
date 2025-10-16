# Node Component Refactor - Implementation Plan

**Version:** 2.0  
**Date:** October 16, 2025  
**Status:** Ready for Implementation  
**Approach:** Full Refactor (Clean Foundation)

---

## Executive Summary

This document provides a comprehensive plan to refactor and enhance the node component layer of ProjectZer0's Universal Graph View. The refactor focuses on establishing architectural consistency, implementing missing node types, and adding interactive features while maintaining code quality and developer experience.

### Goals

1. **Architectural Consistency** - Standardize all nodes to use a clear "direct pattern"
2. **Complete Node Coverage** - Implement missing Answer and Evidence node types
3. **Enhanced Interactivity** - Add clickable categories, keywords, and child creation
4. **Clean Codebase** - Remove unnecessary abstractions, create shared utilities
5. **Solid Foundation** - Establish clear patterns for future development

### Scope

**Total Estimated Time:** 48-60 hours (6-8 working days)

**What We're Doing:**
- ✅ Implementing 3 missing node types (Answer, Evidence, Category)
- ✅ Refactoring 4 existing nodes (Word, Definition, Comment, Quantity)
- ✅ Creating 5 new UI components (CategoryTags, KeywordTags, etc.)
- ✅ Building shared utility functions
- ✅ Adding interactive features across all nodes

**What We're NOT Doing:**
- ❌ Rewriting base components (they're excellent as-is)
- ❌ Changing ContentBox system (it's perfect)
- ❌ Modifying graph manager integration
- ❌ Redesigning UI components that work well

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Architecture & Patterns](#2-architecture--patterns)
3. [Implementation Phases](#3-implementation-phases)
4. [Component Specifications](#4-component-specifications)
5. [API Integration](#5-api-integration)
6. [Testing & Quality](#6-testing--quality)
7. [Success Criteria](#7-success-criteria)

---

## 1. Current State Analysis

### 1.1 Node Implementation Status

| Node Type | Status | Pattern | Priority | Notes |
|-----------|--------|---------|----------|-------|
| **StatementNode** | ✅ Complete | Direct | Reference | Template for others |
| **OpenQuestionNode** | ✅ Complete | Direct | Reference | Template for others |
| **WordNode** | ⚠️ Needs Work | Behaviour | Medium | Refactor to direct pattern |
| **DefinitionNode** | ⚠️ Needs Work | Behaviour | Medium | Refactor to direct pattern |
| **CommentNode** | ⚠️ Needs Work | Behaviour | Medium | Refactor to direct pattern |
| **QuantityNode** | ⚠️ Needs Work | Mixed | Medium | Review and enhance |
| **AnswerNode** | ❌ Missing | N/A | **HIGH** | Must create |
| **EvidenceNode** | ❌ Missing | N/A | **HIGH** | Must create |
| **CategoryNode** | ❌ Missing | N/A | **HIGH** | Must create |

### 1.2 UI Component Status

**Existing (Keep As-Is):**
- ✅ VoteButtons.svelte
- ✅ VoteStats.svelte
- ✅ NodeHeader.svelte
- ✅ CreatorCredits.svelte
- ✅ ContentBox.svelte
- ✅ ExpandCollapseButton.svelte
- ✅ ShowHideButton.svelte

**Missing (Must Create):**
- ❌ CategoryTags.svelte - Clickable category pills
- ❌ KeywordTags.svelte - Clickable keyword pills
- ❌ CreateChildButton.svelte - For Evidence/Answer creation
- ❌ NodeMetadata.svelte - Date display
- ❌ ContentVotingSection.svelte - Optional dual voting UI

### 1.3 Architecture Assessment

**Current Patterns:**

**✅ Good: "Direct Pattern"** (StatementNode, OpenQuestionNode)
```svelte
<script>
  // 1. Extract data directly from props
  const nodeData = node.data as NodeType;
  
  // 2. Reactive declarations
  $: positiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
  $: userVoteStatus = node.metadata?.userVoteStatus?.status || 'none';
  
  // 3. Direct API calls
  async function updateVoteState(voteType: VoteStatus) {
    const result = await fetchWithAuth(`/nodes/${type}/${id}/vote`, {...});
    positiveVotes = result.positiveVotes;
    userVoteStatus = voteType;
  }
</script>
```

**⚠️ Problematic: "Behaviour Pattern"** (WordNode, DefinitionNode, CommentNode)
```svelte
<script>
  // Creates abstraction layers that add complexity
  let voteBehaviour = createVoteBehaviour(...);
  $: behaviorState = voteBehaviour?.getCurrentState() || {};
  $: positiveVotes = behaviorState.positiveVotes;
</script>
```

**Decision:** Standardize on the Direct Pattern for simplicity and maintainability.

---

## 2. Architecture & Patterns

### 2.1 The Direct Pattern (Standard)

**Principles:**
1. Extract data directly from `node.data` and `node.metadata`
2. Use reactive declarations (`$:`) for derived state
3. Make API calls directly in component functions
4. Compose small, focused UI components
5. Keep logic explicit and traceable

**Template:**
```svelte
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { RenderableNode } from '$lib/types/graph/enhanced';
  
  // Base components
  import BasePreviewNode from '../base/BasePreviewNode.svelte';
  import BaseDetailNode from '../base/BaseDetailNode.svelte';
  
  // UI components
  import VoteButtons from '../ui/VoteButtons.svelte';
  import VoteStats from '../ui/VoteStats.svelte';
  import NodeHeader from '../ui/NodeHeader.svelte';
  import CreatorCredits from '../ui/CreatorCredits.svelte';
  import ContentBox from '../ui/ContentBox.svelte';
  import CategoryTags from '../ui/CategoryTags.svelte';
  import KeywordTags from '../ui/KeywordTags.svelte';
  import CreateChildButton from '../ui/CreateChildButton.svelte';
  import NodeMetadata from '../ui/NodeMetadata.svelte';
  
  // Utilities
  import { handleNodeVote } from '$lib/utils/nodeVoting';
  import { updateVisibilityPreference } from '$lib/utils/nodeVisibility';
  import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
  
  // Props
  export let node: RenderableNode;
  export let nodeX: number | undefined = undefined;
  export let nodeY: number | undefined = undefined;
  
  // Type validation
  if (!isNodeTypeData(node.data)) {
    throw new Error('Invalid node data type');
  }
  
  // Data extraction
  const nodeData = node.data as NodeTypeData;
  
  // Reactive data
  $: displayContent = nodeData.content;
  $: positiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
  $: negativeVotes = getNeo4jNumber(nodeData.negativeVotes) || 0;
  $: netVotes = positiveVotes - negativeVotes;
  $: userVoteStatus = node.metadata?.userVoteStatus?.status || 'none';
  $: categories = nodeData.categories || [];
  $: keywords = nodeData.keywords || [];
  
  // Voting state
  let isVoting = false;
  let voteSuccess = false;
  let lastVoteType = null;
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Handlers
  async function updateVoteState(voteType: VoteStatus) {
    if (isVoting) return;
    isVoting = true;
    try {
      const result = await handleNodeVote(node.id, 'nodetype', voteType, userVoteStatus);
      if (result.success) {
        positiveVotes = result.positiveVotes;
        negativeVotes = result.negativeVotes;
        netVotes = result.netVotes;
        userVoteStatus = result.userVoteStatus;
        voteSuccess = true;
      }
    } finally {
      isVoting = false;
    }
  }
  
  function handleModeChange(event) {
    dispatch('modeChange', {
      nodeId: node.id,
      mode: event.detail.mode,
      position: event.detail.position || { x: node.position.x, y: node.position.y }
    });
  }
</script>

{#if node.mode === 'detail'}
  <BaseDetailNode {node} on:modeChange={handleModeChange}>
    <svelte:fragment slot="default" let:radius>
      <NodeHeader title="Node Type" {radius} mode="detail" />
      
      {#if categories.length > 0}
        <CategoryTags {categories} {radius} on:categoryClick />
      {/if}
      
      {#if keywords.length > 0}
        <KeywordTags {keywords} {radius} on:keywordClick />
      {/if}
      
      <ContentBox nodeType="nodetype" mode="detail">
        <svelte:fragment slot="content">
          <!-- Content rendering -->
        </svelte:fragment>
        
        <svelte:fragment slot="voting">
          <VoteButtons
            {userVoteStatus}
            {positiveVotes}
            {negativeVotes}
            {isVoting}
            {voteSuccess}
            {lastVoteType}
            mode="detail"
            on:vote={handleVote}
          />
        </svelte:fragment>
        
        <svelte:fragment slot="stats">
          <VoteStats
            {userVoteStatus}
            {positiveVotes}
            {negativeVotes}
            mode="detail"
          />
        </svelte:fragment>
      </ContentBox>
      
      <NodeMetadata createdAt={nodeData.createdAt} {radius} />
      <CreatorCredits {...nodeData} {radius} />
    </svelte:fragment>
  </BaseDetailNode>
{:else}
  <BasePreviewNode {node} on:modeChange={handleModeChange}>
    <!-- Preview mode rendering -->
  </BasePreviewNode>
{/if}
```

### 2.2 Shared Utilities

Rather than behaviour abstractions, we'll create simple utility functions:

**`$lib/utils/nodeVoting.ts`** - Voting API calls
```typescript
export async function handleNodeVote(
  nodeId: string,
  nodeType: string,
  voteType: VoteStatus,
  currentStatus: VoteStatus
): Promise<VoteResult>
```

**`$lib/utils/nodeVisibility.ts`** - Visibility preferences
```typescript
export async function updateVisibilityPreference(
  nodeId: string,
  isVisible: boolean
): Promise<boolean>
```

**`$lib/utils/nodeExpansion.ts`** - Graph expansion
```typescript
export async function expandCategory(categoryId: string): Promise<ExpansionResult>
export async function expandKeyword(word: string): Promise<ExpansionResult>
export async function expandDiscussion(discussionId: string): Promise<ExpansionResult>
```

### 2.3 Data Flow

```
Backend API
    ↓
Universal Graph Store
    ↓
Graph Manager (adds metadata)
    ↓
NodeRenderer (routes by type)
    ↓
Specific Node Component
    ↓ (extracts from node.data and node.metadata)
Base Components + UI Components
    ↓
User sees rendered node
```

**Key Points:**
- Vote data comes from `node.data` (direct) and `node.metadata` (enriched)
- Always check metadata first, fall back to data
- User vote status ONLY from `node.metadata.userVoteStatus`
- Neo4j integers must be converted with `getNeo4jNumber()`

---

## 3. Implementation Phases

### Phase 1: Foundation & Utilities
**Time:** 6-8 hours | **Priority:** 🔴 CRITICAL

Create the foundation that all other work depends on.

**Tasks:**
1. Create `$lib/utils/nodeVoting.ts` (3h)
   - `handleNodeVote()` - Generic voting
   - `handleWordVote()` - Word-specific
   - `handleDefinitionVote()` - Definition-specific
   - `handleCommentVote()` - Comment-specific

2. Create `$lib/utils/nodeVisibility.ts` (1h)
   - `updateVisibilityPreference()` - Set user preference

3. Create `$lib/utils/nodeExpansion.ts` (2h)
   - `expandCategory()` - Fetch category + words
   - `expandKeyword()` - Fetch word + definitions
   - `expandDiscussion()` - Fetch discussion + comments

4. Add type definitions (1-2h)
   - Add Answer type to `$lib/types/domain/nodes.ts`
   - Add Evidence type to `$lib/types/domain/nodes.ts`
   - Add type guards to `$lib/types/graph/enhanced.ts`
   - Add ContentBox configs for Answer & Evidence

**Deliverables:**
- [ ] nodeVoting.ts with all functions
- [ ] nodeVisibility.ts complete
- [ ] nodeExpansion.ts complete
- [ ] Answer & Evidence types defined
- [ ] Type guards added
- [ ] All utilities tested with mock data

---

### Phase 2: New UI Components
**Time:** 8-10 hours | **Priority:** 🟡 HIGH

Build the UI components needed for enhanced features.

**Tasks:**
1. **CategoryTags.svelte** (2h)
   - SVG pill-style tags
   - Click handler dispatches event
   - Responsive layout (wraps if needed)
   - Hover effects
   - Max 3 displayed, "+N more" for extras

2. **KeywordTags.svelte** (2h)
   - SVG pill-style tags
   - Source indicators (user/AI/both styling)
   - Click handler dispatches event
   - Responsive layout

3. **CreateChildButton.svelte** (2h)
   - Two variants: "Add Evidence" and "Answer"
   - Material icons
   - Positioned at NW corner
   - Disabled state when netVotes ≤ 0
   - Hover effects and glow

4. **NodeMetadata.svelte** (1.5h)
   - Format dates (relative or absolute)
   - Show created/updated
   - Positioned above creator credits

5. **ContentVotingSection.svelte** (1.5h) *OPTIONAL*
   - For Statement/Answer dual voting
   - Can be deferred if time-constrained

6. Update UI component index (0.5h)
   - Export all new components
   - Update documentation

**Deliverables:**
- [ ] CategoryTags.svelte complete and tested
- [ ] KeywordTags.svelte complete and tested
- [ ] CreateChildButton.svelte complete and tested
- [ ] NodeMetadata.svelte complete and tested
- [ ] ContentVotingSection.svelte (optional)
- [ ] All components exported from index

---

### Phase 3: Implement Missing Nodes
**Time:** 14-18 hours | **Priority:** 🔴 CRITICAL

Create the three missing node types using the direct pattern.

#### 3.1 AnswerNode.svelte (5-6h)

**Template Source:** Use OpenQuestionNode as reference  
**Key Features:**
- Parent question context in header
- Standard voting (inclusion + content)
- CreateChildButton (for Evidence)
- CategoryTags, KeywordTags, NodeMetadata

**Data Structure (from API):**
```typescript
interface AnswerData {
  id: string;
  answerText: string;
  questionId: string;
  createdBy: string;
  publicCredit: boolean;
  positiveVotes: number;
  negativeVotes: number;
  contentPositiveVotes: number;
  contentNegativeVotes: number;
  createdAt: string;
  updatedAt: string;
  discussionId?: string;
  keywords?: KeywordData[];
  categories?: CategoryData[];
}
```

**Unique Elements:**
- Display parent question context: "Answer to: [question text]..."
- Two voting sections: inclusion + content quality
- Can have Evidence children (show CreateChildButton)

**Implementation Steps:**
1. Create AnswerNode.svelte from OpenQuestionNode template
2. Add parent question context display
3. Add content voting section
4. Add CategoryTags, KeywordTags, NodeMetadata
5. Add CreateChildButton (Evidence)
6. Add to NodeRenderer routing
7. Test with mock data

#### 3.2 EvidenceNode.svelte (5-6h)

**Template Source:** Use AnswerNode as reference (both have parent relationships)  
**Key Features:**
- Parent node context in header
- Evidence-specific UI (source URL, type badge)
- Single voting (inclusion only, no content voting)
- CategoryTags, KeywordTags, NodeMetadata
- NO CreateChildButton (Evidence can't have children)

**Data Structure (from API):**
```typescript
interface EvidenceData {
  id: string;
  title: string;
  sourceUrl: string;
  evidenceType: 'peer_reviewed_study' | 'government_report' | 'news_article' | 
                 'expert_opinion' | 'dataset' | 'video' | 'image' | 'other';
  parentNodeId: string;
  parentNodeType: 'StatementNode' | 'AnswerNode' | 'QuantityNode';
  createdBy: string;
  publicCredit: boolean;
  positiveVotes: number;
  negativeVotes: number;
  createdAt: string;
  updatedAt: string;
  discussionId?: string;
  keywords?: KeywordData[];
  categories?: CategoryData[];
}
```

**Unique Elements:**
- Display parent context: "Evidence for: [parent content]..."
- Source URL as prominent clickable link
- Evidence type badge (color-coded)
- Single voting section (inclusion only)
- No CreateChildButton

**Implementation Steps:**
1. Create EvidenceNode.svelte from AnswerNode template
2. Add parent node context display
3. Add source URL link
4. Add evidence type badge
5. Add CategoryTags, KeywordTags, NodeMetadata
6. Remove content voting section
7. Add to NodeRenderer routing
8. Add to ContentBox configs
9. Add Evidence colors to NODE_CONSTANTS
10. Test with mock data

**Deliverables:**
- [ ] AnswerNode.svelte complete
- [ ] EvidenceNode.svelte complete
- [ ] CategoryNode.svelte complete
- [ ] CategoryNode.svelte complete
- [ ] All three added to NodeRenderer
- [ ] ContentBox configs updated
- [ ] NODE_CONSTANTS updated
- [ ] Type definitions complete
- [ ] All tested with mock data

---

### Phase 4: Standardize Existing Nodes
**Time:** 8-10 hours | **Priority:** 🟡 HIGH

Refactor existing nodes to use the direct pattern.

#### 4.1 WordNode.svelte (2h)

**Current:** Uses voteBehaviour, dataBehaviour  
**Target:** Direct pattern like StatementNode

**Steps:**
1. Remove behaviour imports and initialization
2. Add utility imports (handleWordVote)
3. Replace behaviour voting with direct API calls
4. Update data extraction to reactive declarations
5. Simplify onMount (only fetch creator details)
6. Add CategoryTags (if word has categories)
7. Add KeywordTags (if applicable)
8. Add NodeMetadata

#### 4.2 DefinitionNode.svelte (2h)

**Current:** Uses voteBehaviour, dataBehaviour  
**Target:** Direct pattern

**Steps:**
1. Remove behaviour setup
2. Use handleDefinitionVote utility
3. Direct data extraction
4. Simplified onMount
5. Add CategoryTags (if applicable)
6. Add KeywordTags (if applicable)
7. Add NodeMetadata

#### 4.3 CommentNode.svelte (2h)

**Current:** Uses voteBehaviour  
**Target:** Direct pattern

**Steps:**
1. Remove behaviour setup
2. Use handleCommentVote utility
3. Direct data extraction
4. Maintain reply functionality
5. Add NodeMetadata

#### 4.4 QuantityNode.svelte (2-3h)

**Current:** Mixed pattern, needs review  
**Target:** Direct pattern + enhancements

**Steps:**
1. Verify/apply direct pattern
2. Add CategoryTags
3. Add KeywordTags
4. Add CreateChildButton (Evidence)
5. Add NodeMetadata
6. Review quantity submission UI

#### 4.5 Update StatementNode & OpenQuestionNode (1h)

**Current:** Already using direct pattern  
**Target:** Add new components

**Steps:**
1. Add CategoryTags
2. Add KeywordTags
3. Add CreateChildButton
4. Add NodeMetadata

**Deliverables:**
- [ ] WordNode refactored and tested
- [ ] DefinitionNode refactored and tested
- [ ] CommentNode refactored and tested
- [ ] QuantityNode reviewed and enhanced
- [ ] StatementNode enhanced
- [ ] OpenQuestionNode enhanced
- [ ] All nodes use identical pattern
- [ ] No behaviour files in use

---

### Phase 5: Interactive Features
**Time:** 6-8 hours | **Priority:** 🟢 MEDIUM

Make the new components functional throughout the application.

**Tasks:**
1. **Implement expansion handlers** (3-4h)
   - Add handlers in Universal Graph page component
   - Category click → expandCategory() → update graph store
   - Keyword click → expandKeyword() → update graph store
   - Discussion click → expandDiscussion() → update graph store
   - Event bubbling from components through NodeRenderer

2. **Implement CreateChildButton handlers** (2-3h)
   - Statement/Quantity: Open Evidence creation modal
   - OpenQuestion: Open Answer creation modal
   - Wire up to existing node creation forms
   - Pre-fill parent information

3. **Test all interactions** (1-2h)
   - Click category tags
   - Click keyword tags
   - Click create child buttons
   - Verify graph updates correctly
   - Verify modals open with correct data

**Deliverables:**
- [ ] Category expansion working
- [ ] Keyword expansion working
- [ ] Discussion expansion working
- [ ] Create child buttons functional
- [ ] All events properly bubbled
- [ ] Graph store updated correctly

---

### Phase 6: Testing & Polish
**Time:** 6-8 hours | **Priority:** 🟢 MEDIUM

Ensure quality and fix issues.

**Tasks:**
1. **Visual QA** (2-3h)
   - Test all nodes in preview mode
   - Test all nodes in detail mode
   - Verify mode switching smooth
   - Check button positioning
   - Verify hover states
   - Test at different zoom levels
   - Check on different screen sizes

2. **Functional Testing** (2-3h)
   - Voting on all node types
   - Visibility toggles
   - Category expansion
   - Keyword expansion
   - Create child forms
   - Discussion expansion
   - Edge cases (no categories, no keywords, etc.)

3. **Documentation** (1-2h)
   - Update node architecture docs
   - Create "How to add a new node type" guide
   - Document standard pattern
   - Add troubleshooting guide
   - Update component catalog

4. **Code Cleanup** (1h)
   - Remove console.logs (keep critical ones)
   - Remove commented code
   - Consistent formatting
   - Add JSDoc comments to utilities
   - Verify all imports used

**Deliverables:**
- [ ] All nodes visually correct
- [ ] All interactions working
- [ ] Documentation complete
- [ ] Code cleaned up
- [ ] No console errors
- [ ] Performance acceptable

---

### CategoryNode Component Summary

**What CategoryNode HAS:**
- ✅ KeywordTags - The composed words (clickable, expand to word + definitions)
- ✅ CreateChildButton - Opens node creation form with this category pre-assigned
- ✅ NodeMetadata - Creation/update dates
- ✅ Single Voting - Inclusion only ("should this category exist?")
- ✅ Creator Credits

**What CategoryNode DOES NOT have:**
- ❌ NO CategoryTags - Categories don't have parent categories
- ❌ NO Content Voting - Only inclusion voting
- ❌ NO Parent Context - Categories are top-level organizational nodes

**Special Behavior:**
- CreateChildButton opens generic form where user selects node type
- New node automatically gets this category assigned
- Creates `categorized_as` relationship
- Composed words display as clickable KeywordTags (1-5 words)

---

## 4. Component Specifications

### 4.1 CategoryTags Component

**Purpose:** Display and handle category tag interactions

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
- Pill-shaped tags with rounded corners
- Blue color scheme (rgba(52, 152, 219, ...))
- 📁 emoji prefix
- Hover effect: scale up 1.1x
- Shows first 3 categories, "+N more" for extras
- Positioned below node title

### 4.2 KeywordTags Component

**Purpose:** Display and handle keyword tag interactions

**Props:**
```typescript
export let keywords: Array<{
  word: string;
  frequency: number;
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
- Pill-shaped tags with rounded corners
- Different border styles by source:
  - User: Solid border
  - AI: Dashed border
  - Both: Gradient border
- Hover effect: scale up 1.1x
- Shows first 5 keywords, "+N more" for extras
- Positioned below CategoryTags

### 4.3 CreateChildButton Component

**Purpose:** Button to open child node creation form

**Props:**
```typescript
export let y: number;
export let x: number;
export let nodeId: string;
export let nodeType: 'statement' | 'openquestion' | 'quantity';
export let canCreateChild: boolean = true; // based on netVotes > 0
```

**Events:**
```typescript
dispatch('createChild', { 
  nodeId: string; 
  nodeType: string 
});
```

**Visual Design:**
- Positioned at NW corner (top-left)
- Material icon: 'add_circle' for Evidence, 'question_answer' for Answer
- Green color when enabled
- Gray when disabled (netVotes ≤ 0)
- Glow effect on hover
- Tooltip: "Add Evidence" or "Answer Question"

### 4.4 NodeMetadata Component

**Purpose:** Display creation and update timestamps

**Props:**
```typescript
export let createdAt: string; // ISO timestamp
export let updatedAt?: string; // ISO timestamp
export let radius: number;
```

**Visual Design:**
- Small text (10-11px)
- Semi-transparent white
- Format: "Created: Oct 16, 2025" or "Created: 2 days ago"
- Show updated if different from created
- Positioned above creator credits

---

## 5. API Integration

### 5.1 Vote Endpoints

**Vote (Add/Change):**
```
POST /nodes/{nodeType}/{nodeId}/vote
Body: { isPositive: boolean }
Response: { positiveVotes: number, negativeVotes: number }
```

**Remove Vote:**
```
POST /nodes/{nodeType}/{nodeId}/vote/remove
Response: { positiveVotes: number, negativeVotes: number }
```

**Node Types:** `statement`, `openquestion`, `answer`, `quantity`, `evidence`, `word`

**Special Cases:**
- Words: Use word text as identifier `/nodes/word/{wordText}/vote`
- Definitions: Use definition ID `/definitions/{definitionId}/vote`
- Comments: Use comment ID `/comments/{commentId}/vote`

### 5.2 Expansion Endpoints

**Category Expansion:**
```
GET /categories/{categoryId}/with-contents
Response: { nodes: [], relationships: [] }
Returns: Category node + 1-5 word nodes + COMPOSED_OF relationships
```

**Use Cases:**
- User clicks category tag on a Statement/Question/etc. → Expands to show the category structure
- Shows the category node + the words that compose it
- Example: Click "basic human needs" tag → See Category node + Word nodes for [basic], [human], [needs]

**Keyword Expansion:**
```
GET /words/{word}/with-definitions
Response: { nodes: [], relationships: [] }
Returns: Word node + definition nodes + DEFINES relationships
```

**Use Cases:**
- User clicks keyword tag on any node (including CategoryNode) → Expands to show word + definitions
- Example: On "basic human needs" category, click [human] tag → See Word node "human" + its definitions

**Important:** CategoryNode has TWO expansion behaviors:
1. **Category tag clicked** (on other nodes) → Show category + composed words
2. **Keyword tag clicked** (on category itself) → Show word + definitions (same as any other node)

**Discussion Expansion:**
```
GET /discussions/{discussionId}/with-comments-visibility
Response: { nodes: [], relationships: [] }
```

### 5.3 Visibility Preferences

```
POST /users/visibility-preferences
Body: { 
  [nodeId]: { 
    isVisible: boolean,
    source: 'user',
    timestamp: number
  }
}
```

### 5.4 Universal Graph

```
GET /graph/universal/nodes?[params]
Response: {
  nodes: UniversalNodeData[],
  relationships: UniversalRelationshipData[],
  total_count: number,
  has_more: boolean
}
```

**Key Fields in Node Data:**
- `node.data` - Direct node properties (votes, content, etc.)
- `node.metadata` - Enriched data (userVoteStatus, visibility, etc.)
- Always check `metadata` first, fall back to `data`

---

## 6. Testing & Quality

### 6.1 Component Testing Checklist

For each node type:
- [ ] Renders correctly in preview mode
- [ ] Renders correctly in detail mode
- [ ] Displays all data fields accurately
- [ ] Handles missing/null data gracefully
- [ ] Vote buttons work correctly
- [ ] Edge buttons dispatch correct events
- [ ] Mode switching works smoothly
- [ ] CategoryTags clickable (if present)
- [ ] KeywordTags clickable (if present)
- [ ] CreateChildButton functional (if applicable)
- [ ] NodeMetadata displays correctly

### 6.2 Interaction Testing

- [ ] Voting updates counts immediately
- [ ] Vote status reflected in UI
- [ ] Category click triggers expansion
- [ ] Keyword click triggers expansion
- [ ] Discussion button opens discussion
- [ ] Create child opens correct form
- [ ] Show/Hide toggles visibility
- [ ] Expand/Collapse switches modes

### 6.3 Data Flow Testing

- [ ] Backend data correctly parsed
- [ ] Neo4j numbers handled properly (getNeo4jNumber)
- [ ] Metadata extracted correctly
- [ ] User context displays accurately
- [ ] Fallback voting data works (OpenQuestion/Quantity/Evidence)

### 6.4 Edge Cases

- [ ] No categories: Don't show CategoryTags
- [ ] No keywords: Don't show KeywordTags
- [ ] No discussion: Disable discuss button
- [ ] netVotes ≤ 0: Disable CreateChildButton
- [ ] Invalid timestamps: Show fallback or hide
- [ ] Missing parent (Answer/Evidence): Show generic title
- [ ] Vote API failure: Show error, revert state
- [ ] Expansion API failure: Show notification

---

## 7. Success Criteria

### 7.1 Architectural Success

- [ ] All 9 node types use identical direct pattern
- [ ] Zero behaviour files in use for core features
- [ ] All nodes use shared utility functions
- [ ] Clear, documented standard pattern exists
- [ ] No pattern confusion or ambiguity

### 7.2 Feature Completeness

- [ ] AnswerNode fully functional
- [ ] EvidenceNode fully functional
- [ ] CategoryNode fully functional
- [ ] All nodes have clickable category tags (where applicable)
- [ ] All nodes have clickable keyword tags (where applicable)
- [ ] Eligible nodes have create child button
- [ ] All nodes display metadata
- [ ] Voting works correctly on all nodes

### 7.3 Quality Metrics

- [ ] No visual regressions
- [ ] All interactions work smoothly
- [ ] Performance acceptable with 50+ nodes
- [ ] Code is maintainable and clear
- [ ] Documentation is complete and accurate

### 7.4 Developer Experience

- [ ] Can add new node type in <2 hours using template
- [ ] Pattern is self-documenting
- [ ] Utilities are intuitive to use
- [ ] Components are easy to compose
- [ ] Debugging is straightforward

---

## 8. Implementation Timeline

### Day-by-Day Breakdown

**Day 1 (8 hours):**
- Morning: Phase 1 - Foundation & Utilities (6-8h)
- Afternoon: Start Phase 2 - CategoryTags component

**Day 2 (8 hours):**
- Complete Phase 2 - All UI components

**Day 3 (8 hours):**
- Phase 3 - AnswerNode implementation

**Day 4 (8 hours):**
- Phase 3 - EvidenceNode implementation

**Day 5 (8 hours):**
- Phase 3 - CategoryNode implementation
- Start Phase 4 - WordNode refactor

**Day 6 (8 hours):**
- Complete Phase 4 - All node standardization

**Day 7 (8 hours):**
- Phase 5 - Interactive features
- Start Phase 6 - Testing

**Day 8 (8 hours):**
- Complete Phase 6 - Testing & polish
- Final documentation

### Checkpoints

**After Day 2:**
- ✅ All utilities created and tested
- ✅ All UI components created
- ✅ Can proceed to node implementation

**After Day 5:**
- ✅ Answer, Evidence, and Category nodes complete
- ✅ Most critical gaps filled
- ✅ Can proceed to standardization

**After Day 7:**
- ✅ All nodes standardized
- ✅ Interactive features working
- ✅ Ready for final polish

---

## 9. Risk Mitigation

### 9.1 Low Risk Factors ✅

- Not rewriting architecture, just standardizing
- Base components remain unchanged (proven solid)
- Changes are additive and iterative
- Can test incrementally
- Easy to roll back individual changes
- Have working examples (Statement, OpenQuestion)

### 9.2 Potential Issues & Mitigation

**Issue: Behaviour dependencies**
- **Risk:** Low
- **Mitigation:** Search for imports before removing, keep for reference initially

**Issue: Quantity node complexity**
- **Risk:** Low-Medium  
- **Mitigation:** Review carefully, maintain existing submission logic

**Issue: Expansion API integration**
- **Risk:** Medium
- **Mitigation:** Implement handlers in graph page, not individual nodes

**Issue: Time constraints**
- **Risk:** Medium
- **Mitigation:** Can defer Phase 5 (interactions) and Phase 6 (polish) if needed

---

## 10. Quick Reference

### Node Type Quick Facts

| Type | Content Voting | Parent | Can Have Children | Max Length |
|------|----------------|--------|-------------------|------------|
| Statement | ✅ Yes | ❌ No | ✅ Evidence | 280 |
| OpenQuestion | ❌ No | ❌ No | ✅ Answer | 280 |
| Answer | ✅ Yes | ✅ Question | ✅ Evidence | 280 |
| Quantity | ❌ No | ❌ No | ✅ Evidence | 280 |
| Evidence | ❌ No | ✅ Statement/Answer/Quantity | ❌ No | 280 |
| Category | ❌ No | ❌ No | ✅ Any (via categorized_as) | - |
| Word | ❌ No | ❌ No | ❌ No | - |
| Definition | ❌ No | ✅ Word | ❌ No | - |
| Comment | ❌ No | ✅ Discussion | ✅ Reply | 280 |

### Voting Quick Reference

**All Nodes:** Inclusion voting (agree/disagree on whether to include)  
**Statement & Answer Only:** Content voting (agree/disagree on quality)  
**Others:** Use inclusion votes as content votes (backend fallback)

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

**UI Components:** `src/lib/components/graph/nodes/ui/`  
**UI Components:** `src/lib/components/graph/nodes/ui/`  
**Base Components:** `src/lib/components/graph/nodes/base/`  
**Utilities:** `src/lib/utils/`  
**Types:** `src/lib/types/domain/nodes.ts` and `src/lib/types/graph/enhanced.ts`  
**Constants:** `src/lib/constants/graph/nodes.ts`

---

## Appendix: Code Examples

### Example: Vote Utility Function

```typescript
// src/lib/utils/nodeVoting.ts
import { fetchWithAuth } from '$lib/services/api';
import type { VoteStatus } from '$lib/types/domain/nodes';

export interface VoteResult {
  success: boolean;
  positiveVotes: number;
  negativeVotes: number;
  netVotes: number;
  userVoteStatus: VoteStatus;
  error?: string;
}

export async function handleNodeVote(
  nodeId: string,
  nodeType: string,
  voteType: VoteStatus,
  currentStatus: VoteStatus
): Promise<VoteResult> {
  try {
    // Toggle: if voting same type, remove vote
    const actualVoteType = currentStatus === voteType ? 'none' : voteType;
    
    // Determine endpoint
    const endpoint = actualVoteType === 'none'
      ? `/nodes/${nodeType}/${nodeId}/vote/remove`
      : `/nodes/${nodeType}/${nodeId}/vote`;
    
    // Make API call
    const result = await fetchWithAuth(endpoint, {
      method: 'POST',
      body: actualVoteType !== 'none' 
        ? JSON.stringify({ isPositive: actualVoteType === 'agree' })
        : undefined
    });
    
    return {
      success: true,
      positiveVotes: result.positiveVotes,
      negativeVotes: result.negativeVotes,
      netVotes: result.positiveVotes - result.negativeVotes,
      userVoteStatus: actualVoteType
    };
  } catch (error) {
    console.error('[nodeVoting] Error:', error);
    return {
      success: false,
      positiveVotes: 0,
      negativeVotes: 0,
      netVotes: 0,
      userVoteStatus: currentStatus,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### Example: CategoryTags Component

```svelte
<!-- src/lib/components/graph/nodes/ui/CategoryTags.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let categories: Array<{
    id: string;
    name: string;
    description?: string;
  }> = [];
  export let radius: number;
  export let maxDisplay: number = 3;
  
  const dispatch = createEventDispatcher();
  
  $: yPosition = -radius + 60;
  $: displayCategories = categories.slice(0, maxDisplay);
  $: hasMore = categories.length > maxDisplay;
  
  function handleClick(category: { id: string; name: string }) {
    dispatch('categoryClick', { 
      categoryId: category.id, 
      categoryName: category.name 
    });
  }
</script>

<g class="category-tags" transform="translate(0, {yPosition})">
  {#each displayCategories as category, i}
    <g 
      class="category-tag"
      transform="translate({(i - (displayCategories.length - 1) / 2) * 80}, 0)"
      on:click={() => handleClick(category)}
      on:keypress
    >
      <rect
        x="-35" y="-8"
        width="70" height="16"
        rx="8"
        fill="rgba(52, 152, 219, 0.2)"
        stroke="rgba(52, 152, 219, 0.6)"
        stroke-width="1"
      />
      <text
        x="0" y="0"
        style:font-family="Inter"
        style:font-size="10px"
        style:fill="rgba(52, 152, 219, 0.9)"
        style:text-anchor="middle"
        style:dominant-baseline="middle"
      >
        📁 {category.name}
      </text>
    </g>
  {/each}
  
  {#if hasMore}
    <text
      x={(displayCategories.length / 2) * 80 + 30}
      y="0"
      style:font-size="9px"
      style:fill="rgba(255, 255, 255, 0.5)"
    >
      +{categories.length - maxDisplay}
    </text>
  {/if}
</g>

<style>
  .category-tag {
    cursor: pointer;
    transition: transform 0.2s ease;
  }
  
  .category-tag:hover {
    transform: scale(1.1);
  }
</style>
```

---

**END OF IMPLEMENTATION PLAN**

This document is the single source of truth for the node refactor. Follow the phases sequentially, test incrementally, and refer back to this plan as needed. Good luck! 🚀

src/lib/components/graph/nodes/
├── statement/StatementNode.svelte          ⭐ CRITICAL - Our template
├── openquestion/OpenQuestionNode.svelte    ⭐ CRITICAL - Our template
├── word/WordNode.svelte                    (needs refactoring)
├── definition/DefinitionNode.svelte        (needs refactoring)
├── comment/CommentNode.svelte              (needs refactoring)
├── quantity/QuantityNode.svelte            (needs review)
└── NodeRenderer.svelte                     ⭐ CRITICAL - Routes all nodes
```

### 2. **Base Components** (staying as-is, need to see their API)
```
src/lib/components/graph/nodes/base/
├── BaseNode.svelte
├── BasePreviewNode.svelte
└── BaseDetailNode.svelte
```

### 3. **UI Components** (staying as-is, need to see their props)
```
src/lib/components/graph/nodes/ui/
├── ContentBox.svelte                       ⭐ CRITICAL - All nodes use this
├── VoteButtons.svelte
├── VoteStats.svelte
├── NodeHeader.svelte
├── CreatorCredits.svelte
├── ExpandCollapseButton.svelte
├── ShowHideButton.svelte
└── index.ts                                (component exports)
```

### 4. **Type Definitions**
```
src/lib/types/
├── domain/nodes.ts                         ⭐ CRITICAL - Node data types
└── graph/enhanced.ts                       ⭐ CRITICAL - RenderableNode, type guards
```

### 5. **Constants**
```
src/lib/constants/graph/
├── nodes.ts                                ⭐ CRITICAL - NODE_CONSTANTS
└── index.ts                                (if exists)
```

### 6. **Utilities & Services**
```
src/lib/utils/
├── neo4j-utils.ts                          (getNeo4jNumber function)
└── (any other utility files you think relevant)

src/lib/services/
├── api.ts                                  (fetchWithAuth function)
└── userLookup.ts                           (getUserDetails function)
```

### 7. **Behaviour System** (to understand what we're replacing)
```
src/lib/components/graph/nodes/behaviours/
├── voteBehaviour.ts
├── visibilityBehaviour.ts
├── modeBehaviour.ts                        (to be removed)
├── dataBehaviour.ts                        (to be removed)
└── index.ts
```

---

## 📁 Nice to Have (If Time Permits)

### 8. **Stores** (to understand data flow)
```
src/lib/stores/
├── graphStore.ts
├── universalGraphStore.ts                  (if separate)
└── (any vote-related stores being used)
```

### 9. **Example Node Creation Form** (for CategoryNode CreateChildButton)
```
src/lib/components/forms/createNode/
└── (any one example form to see the pattern)
```

### 10. **ContentBox Configuration** (if separate file)
```
src/lib/constants/graph/
└── contentBoxConfig.ts                     (if ContentBox configs are separate)