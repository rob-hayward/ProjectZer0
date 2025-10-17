# Universal Graph View - Functionality Refactor Plan

## Document Overview
**Project:** ProjectZer0 Frontend  
**Focus:** Universal Graph View Core Functionality  
**Version:** 1.0  
**Date:** October 16, 2025  
**Status:** Planning Phase - No Implementation  

---

## 1. Executive Summary

This document outlines the comprehensive refactor of the Universal Graph View functionality. The refactor focuses on implementing robust filter/sort capabilities, intelligent node visibility management, user control features, and seamless content expansion.

### Core Objectives
1. Implement default data loading with optimal filter/sort settings
2. Create intelligent node visibility logic based on inclusion votes and user preferences
3. Enable comprehensive user control over individual node visibility and expansion
4. Redesign and enhance the central control node as the primary filter/sort interface
5. Implement node creation workflows (standalone and child nodes)
6. Enable on-demand content expansion (discussions, categories, words, definitions)

---

## 2. Current System Analysis

### 2.1 Existing Infrastructure

**Store Layer:**
- `universalGraphStore`: Manages graph state, filters, sorting, pagination
- `visibilityPreferenceStore`: Tracks user visibility preferences per node
- Existing filter support: node_types, keywords, net_votes, user_id, dates
- Existing sort support: multiple options with direction control

**Service Layer:**
- `UniversalGraphManager`: Transforms API data to enhanced nodes
- `UniversalGraphLayout`: Positions nodes based on consensus/sort values
- Expansion APIs: Already available for discussion, word, category content

**Component Layer:**
- Control node: Exists but needs significant enhancement
- Node components: Have show/hide buttons, need expand/collapse refinement
- NodeRenderer: Routes to appropriate node type components

**API Integration:**
- Backend provides comprehensive filtering and sorting
- User context automatically enriched (vote status, visibility preferences)
- Content vote fallback handled automatically
- Expansion endpoints available and tested

### 2.2 Current Visibility System

**Community Visibility Rules:**
```typescript
communityHidden = inclusionNetVotes < 0;
```

**User Override Logic:**
```typescript
if (userVisibilityPreference !== undefined) {
  isHidden = userVisibilityPreference === 'hidden';
} else {
  isHidden = communityHidden;
}
```

**Limitations:**
- No bulk visibility controls
- Control node doesn't provide visibility management UI
- Expansion eligibility (netVotes > 0) not visually clear

### 2.3 Current Control Node

**Existing Features:**
- Basic dashboard type node
- Center positioned
- Limited UI (needs complete redesign)

**Missing Features:**
- Comprehensive filter UI
- Sort controls
- Visibility management toggles
- Quick action buttons
- Status indicators

---

## 3. Default Data Loading

### 3.1 Default Query Parameters

**Objective:** Load the most valuable initial dataset when user opens universal graph

**Recommended Defaults:**
```typescript
const DEFAULT_QUERY: UniversalGraphQuery = {
  // Node Types: All types to show full ecosystem
  node_types: ['statement', 'openquestion', 'answer', 'quantity', 'evidence'],
  includeNodeTypes: true,
  
  // Sorting: Highest consensus first
  sort_by: 'inclusion_votes', // or 'netVotes' (equivalent)
  sort_direction: 'desc',
  
  // Pagination: Reasonable initial load
  limit: 50,
  offset: 0,
  
  // Relationships: Include for full context
  include_relationships: true,
  relationship_types: ['shared_keyword', 'related_to', 'answers', 'evidence_for', 'shared_category'],
  
  // User Filter: No filtering initially
  userFilterMode: 'all',
  
  // Keywords/Categories: None initially (user can add)
  keywords: [],
  categories: []
};
```

**Rationale:**
- **All node types**: Shows the full picture of the knowledge graph
- **Sort by consensus**: Surfaces highest-quality, most-agreed-upon content first
- **50 nodes**: Enough to be useful, not overwhelming, performant
- **Include relationships**: Enables rich graph visualization
- **No filters**: Start broad, let user narrow down

### 3.2 Initial Load Sequence

```typescript
// In universal graph page component
async function initializeGraph() {
  // 1. Ensure user is authenticated
  if (!$userStore) {
    await waitForAuth();
  }
  
  // 2. Load default dataset
  await universalGraphStore.loadNodes($userStore, DEFAULT_QUERY);
  
  // 3. Wait for graph manager to process data
  await tick();
  
  // 4. Initialize control node with default settings
  updateControlNodeData(DEFAULT_QUERY);
  
  // 5. Apply initial layout
  // (handled automatically by UniversalGraphLayout)
  
  // 6. Mark as ready
  dataInitialized = true;
}
```

### 3.3 Loading States

**Display during load:**
- Loading spinner on control node
- Skeleton nodes (faded preview nodes)
- Loading message: "Loading knowledge graph..."
- Progress indicator if applicable

**Error handling:**
- Show error message on control node
- Retry button
- Fallback to cached data if available
- Clear error messaging for user

---

## 4. Node Visibility Logic

### 4.1 Community-Based Visibility

**Three Visibility States:**

```typescript
enum NodeVisibilityState {
  VISIBLE_PREVIEW = 'visible-preview',    // netVotes >= 0, shown as preview
  VISIBLE_DETAIL = 'visible-detail',      // netVotes > 0, can expand to detail
  HIDDEN = 'hidden'                       // netVotes < 0, hidden by default
}
```

**State Determination:**
```typescript
function determineVisibilityState(
  inclusionNetVotes: number,
  userPreference?: 'hidden' | 'visible'
): NodeVisibilityState {
  // User preference always wins
  if (userPreference === 'hidden') {
    return NodeVisibilityState.HIDDEN;
  }
  if (userPreference === 'visible') {
    // User wants it visible, but respect expansion threshold
    return inclusionNetVotes > 0 
      ? NodeVisibilityState.VISIBLE_DETAIL 
      : NodeVisibilityState.VISIBLE_PREVIEW;
  }
  
  // No user preference, use community rules
  if (inclusionNetVotes < 0) {
    return NodeVisibilityState.HIDDEN;
  } else if (inclusionNetVotes === 0) {
    return NodeVisibilityState.VISIBLE_PREVIEW;
  } else {
    return NodeVisibilityState.VISIBLE_DETAIL;
  }
}
```

**Display Rules:**

| State | Display | Expand Button | Reason |
|-------|---------|---------------|--------|
| VISIBLE_DETAIL | Preview mode | ✅ Shown | Can expand (netVotes > 0) |
| VISIBLE_PREVIEW | Preview mode | ❌ Hidden | Cannot expand (netVotes = 0) |
| HIDDEN | Hidden node placeholder | ❌ Hidden | Community consensus negative |

### 4.2 User Visibility Overrides

**Individual Node Override:**
- User clicks show/hide button on any node
- Preference stored in `visibilityPreferenceStore`
- Synced to backend via API (for persistence)
- Takes precedence over community visibility

**API Integration:**
```typescript
// When user toggles visibility
async function setNodeVisibility(
  nodeId: string, 
  isVisible: boolean
) {
  // 1. Update local store immediately (optimistic)
  visibilityPreferenceStore.setPreference(nodeId, isVisible);
  
  // 2. Update graph display
  graphManager.updateNodeVisibility(nodeId, !isVisible, 'user');
  
  // 3. Persist to backend
  try {
    await fetch(`/api/user/preferences/visibility/${nodeId}`, {
      method: 'POST',
      body: JSON.stringify({ visible: isVisible })
    });
  } catch (error) {
    // Revert on failure
    visibilityPreferenceStore.setPreference(nodeId, !isVisible);
    graphManager.updateNodeVisibility(nodeId, isVisible, 'user');
    showError('Failed to save visibility preference');
  }
}
```

### 4.3 Bulk Visibility Controls

**Control Node Options:**

```typescript
interface VisibilityControls {
  // Show/hide all nodes of specific type
  showAllStatements: boolean;
  showAllQuestions: boolean;
  showAllAnswers: boolean;
  showAllQuantity: boolean;
  showAllEvidence: boolean;
  
  // Show/hide by vote threshold
  hideNegativeNodes: boolean;    // Hide all netVotes < 0
  hideZeroNodes: boolean;         // Hide all netVotes = 0
  showOnlyPositive: boolean;      // Show only netVotes > 0
  
  // Respect user overrides
  respectUserOverrides: boolean;  // Default: true
}
```

**Implementation:**
```typescript
function applyBulkVisibility(controls: VisibilityControls) {
  const allNodes = graphStore.getNodes();
  
  allNodes.forEach(node => {
    // Skip if respecting user overrides and user has set preference
    if (controls.respectUserOverrides) {
      const userPref = visibilityPreferenceStore.getPreference(node.id);
      if (userPref !== undefined) {
        return; // User preference takes precedence
      }
    }
    
    // Apply type-based visibility
    let shouldShow = true;
    switch (node.type) {
      case 'statement': shouldShow = controls.showAllStatements; break;
      case 'openquestion': shouldShow = controls.showAllQuestions; break;
      case 'answer': shouldShow = controls.showAllAnswers; break;
      case 'quantity': shouldShow = controls.showAllQuantity; break;
      case 'evidence': shouldShow = controls.showAllEvidence; break;
    }
    
    // Apply vote-based visibility
    const netVotes = node.metadata?.net_votes || 0;
    if (controls.hideNegativeNodes && netVotes < 0) shouldShow = false;
    if (controls.hideZeroNodes && netVotes === 0) shouldShow = false;
    if (controls.showOnlyPositive && netVotes <= 0) shouldShow = false;
    
    // Update node visibility
    graphManager.updateNodeVisibility(node.id, !shouldShow, 'bulk');
  });
}
```

### 4.4 Hidden Node Placeholder

**Visual Design:**
- Small circular placeholder (100 radius)
- Semi-transparent background
- Icon: Eye-slash or similar
- Text: "Hidden by community" or "Hidden by you"
- Show/hide button available

**Information Display:**
- Net votes count (to show why hidden)
- Option to reveal temporarily
- Option to show permanently (user override)

---

## 5. Node Mode Management

### 5.1 Expansion Eligibility

**Rule:** Only nodes with `inclusionNetVotes > 0` can expand to detail mode

**Visual Indicators:**
- Expand button: Only shown if `netVotes > 0`
- Expand button: Disabled/grayed if `netVotes = 0`
- Tooltip: "Not enough community approval to expand"

**Implementation:**
```typescript
// In node component
$: canExpand = inclusionNetVotes > 0;

// In BasePreviewNode
{#if canExpand}
  <ExpandCollapseButton mode="expand" ... />
{/if}
```

### 5.2 Bulk Mode Controls

**Control Node Options:**

```typescript
interface ModeControls {
  // Expand/collapse all nodes
  expandAll: boolean;
  
  // Expand/collapse by type
  expandStatements: boolean;
  expandQuestions: boolean;
  expandAnswers: boolean;
  expandQuantity: boolean;
  expandEvidence: boolean;
  
  // Conditional expansion
  expandOnlyPositive: boolean;  // Only expand nodes with netVotes > threshold
  expansionThreshold: number;   // Default: 0
}
```

**Implementation:**
```typescript
function applyBulkModeChange(controls: ModeControls) {
  const allNodes = graphStore.getNodes();
  
  allNodes.forEach(node => {
    // Skip hidden nodes
    if (node.isHidden) return;
    
    // Check if node is eligible for expansion
    const netVotes = node.metadata?.net_votes || 0;
    if (netVotes <= controls.expansionThreshold) return;
    
    // Determine if this node type should be expanded
    let shouldExpand = controls.expandAll;
    if (!shouldExpand) {
      switch (node.type) {
        case 'statement': shouldExpand = controls.expandStatements; break;
        case 'openquestion': shouldExpand = controls.expandQuestions; break;
        case 'answer': shouldExpand = controls.expandAnswers; break;
        case 'quantity': shouldExpand = controls.expandQuantity; break;
        case 'evidence': shouldExpand = controls.expandEvidence; break;
      }
    }
    
    // Apply mode change
    const newMode = shouldExpand ? 'detail' : 'preview';
    if (node.mode !== newMode) {
      graphManager.updateNodeMode(node.id, newMode);
    }
  });
}
```

### 5.3 Smart Expansion

**Auto-expand high-value nodes:**
```typescript
function autoExpandHighValueNodes(threshold: number = 10) {
  const allNodes = graphStore.getNodes();
  
  allNodes
    .filter(node => !node.isHidden)
    .filter(node => (node.metadata?.net_votes || 0) >= threshold)
    .forEach(node => {
      graphManager.updateNodeMode(node.id, 'detail');
    });
}
```

**Call on initial load:**
```typescript
// After loading nodes
if (shouldAutoExpand) {
  autoExpandHighValueNodes(DEFAULT_AUTO_EXPAND_THRESHOLD);
}
```

---

## 6. Central Control Node Redesign

### 6.1 Control Node Structure

**Visual Design:**
- Larger than preview nodes (318 radius in detail mode)
- Distinct styling (dashboard color scheme)
- Organized into collapsible sections
- Fixed at center (0, 0)

**Section Organization:**
```
┌─────────────────────────────┐
│   UNIVERSAL GRAPH CONTROLS  │
├─────────────────────────────┤
│  [▼] Filters                │
│  [▼] Sorting                │
│  [▼] Visibility             │
│  [▼] Display Options        │
│  [▼] Quick Actions          │
└─────────────────────────────┘
```

### 6.2 Filters Section

**Node Type Filter:**
```html
☑ Statements (45)
☑ Questions (23)
☑ Answers (67)
☑ Quantity (12)
☑ Evidence (8)

[Select All] [Select None] [Invert]
```

**Keyword Filter:**
```html
Keywords: [____________] [+]
Mode: ○ ANY  ⦿ ALL
Active: 📌 ai  📌 ethics  📌 technology
[Clear All]
```

**Category Filter:**
```html
Categories: [Select from 15 available ▼]
Mode: ○ ANY  ⦿ ALL
Active: 📁 Technology  📁 Science
[Clear All]
```

**Vote Range Filter:**
```html
Net Votes: [-50] ━━●━━━━━━━━ [+50]
Show range: -10 to +50
[Reset Range]
```

**User Content Filter:**
```html
User Filter: [All Content ▼]
Options:
  - All Content
  - My Created Content
  - My Voted Content
  - My Interactions
```

**Date Range Filter:**
```html
From: [MM/DD/YYYY]
To:   [MM/DD/YYYY]
[Last 7 Days] [Last 30 Days] [All Time]
```

### 6.3 Sorting Section

**Sort By:**
```html
Sort by: [Inclusion Votes ▼]
Options:
  - Inclusion Votes (Consensus)
  - Content Votes (Quality)
  - Net Votes (Combined)
  - Chronological (Date)
  - Latest Activity
  - Participants (Engagement)
  - Keyword Relevance

Direction: ⦿ Descending  ○ Ascending
[🔄 Reverse Order]
```

**Visual Feedback:**
```html
Current Sort: Inclusion Votes ↓
Showing 50 of 1,247 nodes
```

### 6.4 Visibility Section

**Bulk Visibility Controls:**
```html
Show Node Types:
☑ Statements  ☑ Questions  ☑ Answers
☑ Quantity    ☑ Evidence

Vote-Based Visibility:
☑ Hide Negative (netVotes < 0)
☐ Hide Zero (netVotes = 0)
☐ Show Only Positive (netVotes > 0)

☑ Respect My Manual Overrides

[Apply] [Reset to Defaults]
```

**Hidden Nodes Summary:**
```html
Currently Hidden: 23 nodes
  - 15 by community
  - 8 by you
[Show All Hidden] [Reveal Temporarily]
```

### 6.5 Display Options Section

**Expansion Controls:**
```html
Node Expansion:
☐ Auto-expand high-value nodes (>10 votes)

Expand By Type:
☐ All Statements   ☐ All Questions
☐ All Answers      ☐ All Quantity
☐ All Evidence

[Expand All] [Collapse All]
```

**Relationship Display:**
```html
Show Relationships:
☑ Shared Keywords
☑ Answers
☑ Evidence For
☑ Related To
☑ Shared Category
☐ Categorized As

[Select All] [Select None]
```

**Layout Options:**
```html
Layout Mode: ⦿ Consensus-based  ○ Force-directed
Node Spacing: ━━━●━━━━
Link Opacity: ━━━━●━━━━
```

### 6.6 Quick Actions Section

**Common Actions:**
```html
[🔍 Find Node by ID]
[➕ Create New Node]
[🔄 Refresh Data]
[💾 Save View Settings]
[📊 View Statistics]
[⚙️ Advanced Settings]
```

### 6.7 Control Node Component Implementation

**New Component: `UniversalControlNode.svelte`**

```typescript
<script lang="ts">
  import { universalGraphStore } from '$lib/stores/universalGraphStore';
  import type { UniversalGraphQuery } from '$lib/types/api';
  
  export let node: EnhancedNode;
  export let onFilterChange: (query: Partial<UniversalGraphQuery>) => void;
  export let onVisibilityChange: (controls: VisibilityControls) => void;
  export let onModeChange: (controls: ModeControls) => void;
  
  // Section collapse states
  let filtersExpanded = true;
  let sortingExpanded = true;
  let visibilityExpanded = false;
  let displayExpanded = false;
  let actionsExpanded = false;
  
  // Filter state (bound to inputs)
  let selectedNodeTypes = ['statement', 'openquestion', 'answer', 'quantity', 'evidence'];
  let keywords = [];
  let keywordMode = 'any';
  let categories = [];
  let categoryMode = 'any';
  let netVotesRange = [-50, 50];
  let userFilterMode = 'all';
  let dateFrom = null;
  let dateTo = null;
  
  // Sort state
  let sortBy = 'inclusion_votes';
  let sortDirection = 'desc';
  
  // Visibility state
  let visibilityControls = {
    showAllStatements: true,
    showAllQuestions: true,
    showAllAnswers: true,
    showAllQuantity: true,
    showAllEvidence: true,
    hideNegativeNodes: false,
    hideZeroNodes: false,
    showOnlyPositive: false,
    respectUserOverrides: true
  };
  
  // Display state
  let modeControls = {
    expandAll: false,
    expandStatements: false,
    expandQuestions: false,
    expandAnswers: false,
    expandQuantity: false,
    expandEvidence: false,
    expandOnlyPositive: false,
    expansionThreshold: 0
  };
  
  // Functions
  function applyFilters() {
    onFilterChange({
      node_types: selectedNodeTypes,
      keywords,
      keywordMode,
      categories,
      categoryMode,
      // ... other filters
    });
  }
  
  function applySorting() {
    onFilterChange({
      sort_by: sortBy,
      sort_direction: sortDirection
    });
  }
  
  function applyVisibility() {
    onVisibilityChange(visibilityControls);
  }
  
  function applyDisplayOptions() {
    onModeChange(modeControls);
  }
</script>

<!-- SVG Control Node UI -->
<g class="control-node">
  <!-- Sections rendered as foreignObject with HTML forms -->
  <!-- Each section collapsible -->
  <!-- Buttons trigger appropriate functions -->
</g>
```

---

## 7. Node Creation Workflows

### 7.1 Standalone Node Creation

**Access Points:**
- Control node quick actions: "Create New Node" button
- Keyboard shortcut: 'C' key
- Navigation menu option

**Flow:**
```
1. User clicks "Create New Node"
   ↓
2. Modal/overlay appears with node type selector
   ↓
3. User selects node type (Statement, Question, Quantity)
   ↓
4. Appropriate form loads
   ↓
5. User fills form (content, categories, keywords, etc.)
   ↓
6. Submit → API call
   ↓
7. New node added to graph
   ↓
8. Graph updates, new node positioned based on sort/filter
   ↓
9. Success notification
```

**Node Type Selector UI:**
```html
┌─────────────────────────────┐
│   Create New Node           │
├─────────────────────────────┤
│ What would you like to add? │
│                             │
│  [📝 Statement]             │
│  [❓ Question]              │
│  [🔢 Quantity Question]     │
│                             │
│  [Cancel]                   │
└─────────────────────────────┘
```

### 7.2 Child Node Creation

**Access Points:**
- Node edge button (NW position): "Create Child" button
- Context menu on node (future)

**Eligibility:**
- Parent node must have `inclusionNetVotes > 0`
- Button disabled if condition not met

**Flow for Evidence (from Statement/Quantity):**
```
1. User clicks "Create Evidence" button on Statement/Quantity node
   ↓
2. Evidence form modal appears
   - Parent node ID pre-filled (hidden)
   - Parent node content displayed for context
   ↓
3. User fills form:
   - Evidence title
   - Source URL
   - Evidence type dropdown
   - Categories (optional, max 3)
   - Keywords (optional)
   - Initial comment (optional)
   ↓
4. Submit → API call: POST /nodes/evidence
   ↓
5. New evidence node added to graph
   ↓
6. Relationship created: evidence_for (evidence → parent)
   ↓
7. Success notification, option to view new node
```

**Flow for Answer (from OpenQuestion):**
```
1. User clicks "Answer Question" button on OpenQuestion node
   ↓
2. Answer form modal appears
   - Parent question ID pre-filled (hidden)
   - Parent question text displayed for context
   ↓
3. User fills form:
   - Answer text (280 chars)
   - Categories (optional, max 3)
   - Keywords (optional)
   - Initial comment (required)
   ↓
4. Submit → API call: POST /nodes/answer
   ↓
5. New answer node added to graph
   ↓
6. Relationship created: answers (question → answer)
   ↓
7. Success notification, option to view new node
```

### 7.3 Form Components

**Create separate form components:**

1. **StatementCreationForm.svelte**
   - Content input (280 chars)
   - Public credit checkbox
   - Category selector (max 3)
   - Keyword input (optional)
   - Initial comment (optional)

2. **OpenQuestionCreationForm.svelte**
   - Question input (280 chars)
   - Public credit checkbox
   - Category selector (max 3)
   - Keyword input (optional)
   - Initial comment (required)

3. **AnswerCreationForm.svelte**
   - Parent question display (read-only)
   - Answer input (280 chars)
   - Public credit checkbox
   - Category selector (max 3)
   - Keyword input (optional)
   - Initial comment (required)

4. **QuantityCreationForm.svelte**
   - Question input (280 chars)
   - Public credit checkbox
   - Category selector (max 3)
   - Keyword input (optional)
   - Initial comment (required)

5. **EvidenceCreationForm.svelte**
   - Parent node display (read-only)
   - Evidence title (280 chars)
   - Source URL (validated)
   - Evidence type dropdown
   - Public credit checkbox
   - Category selector (max 3)
   - Keyword input (optional)
   - Initial comment (optional)

**Shared Form Features:**
- Character counter
- Real-time validation
- Category search/filter
- Keyword suggestions
- Public credit tooltip/explanation
- Submit button with loading state
- Cancel button
- Error display

### 7.4 Post-Creation Actions

**After successful creation:**
```typescript
async function handleNodeCreated(newNode: UniversalNodeData) {
  // 1. Add node to graph store
  universalGraphStore.addNode(newNode);
  
  // 2. If relationships created, add those too
  if (newNode.relationships) {
    universalGraphStore.addRelationships(newNode.relationships);
  }
  
  // 3. Refresh graph layout
  graphManager.refreshLayout();
  
  // 4. Optionally center on new node
  if (shouldCenterOnNew) {
    graphManager.centerOnNode(newNode.id);
  }
  
  // 5. Flash/highlight new node briefly
  graphManager.highlightNode(newNode.id, 2000);
  
  // 6. Show success notification
  showNotification(`${newNode.type} created successfully!`, 'success');
  
  // 7. Close form modal
  closeCreationForm();
}
```

---

## 8. Content Expansion Features

### 8.1 Discussion Expansion

**Trigger:** User clicks "Discuss" button on node

**Prerequisites:**
- Node must have `discussionId` property
- User must be authenticated

**Flow:**
```
1. User clicks discuss button
   ↓
2. API call: GET /discussions/{discussionId}/with-comments-visibility
   ↓
3. Receive: Discussion node + Comment nodes + relationships
   ↓
4. Add to graph:
   - Discussion node (if not already present)
   - All comment nodes
   - HAS_COMMENT relationships
   - HAS_REPLY relationships (for nested comments)
   ↓
5. Layout discussion thread:
   - Discussion node near parent
   - Comments in thread structure
   - Maintain hierarchy
   ↓
6. Highlight newly added nodes
   ↓
7. Optional: Switch layout to "discussion mode" for that cluster
```

**Discussion Layout:**
```
     [Parent Node]
          ↓
    [Discussion Node]
       ↓        ↓
  [Comment 1] [Comment 2]
       ↓
  [Reply 1.1]
```

**UI Enhancements:**
- Loading state on discuss button during fetch
- Visual connection from parent to discussion
- Collapsible comment thread
- "Hide Discussion" button to remove from graph

### 8.2 Keyword/Word Expansion

**Trigger:** User clicks keyword tag on node

**Flow:**
```
1. User clicks keyword tag (e.g., "artificial intelligence")
   ↓
2. API call: GET /words/{word}/with-definitions
   ↓
3. Receive: Word node + Definition nodes + DEFINES relationships
   ↓
4. Add to graph:
   - Word node
   - Live definition (primary)
   - Alternative definitions (if any)
   ↓
5. Position near clicked node
   ↓
6. Create visual connection (shared_keyword relationship)
   ↓
7. Highlight newly added nodes
```

**Word Cluster Layout:**
```
    [Word: AI]
      ↓     ↓
  [Def 1] [Def 2]
  (live)  (alt)
```

**Multiple Keywords:**
- If user clicks another keyword on same node
- Add another word cluster
- Connect to parent node
- Don't duplicate if word already in graph

### 8.3 Category Expansion

**Trigger:** User clicks category tag on node

**Flow:**
```
1. User clicks category tag (e.g., "Technology")
   ↓
2. API call: GET /categories/{categoryId}/with-contents
   ↓
3. Receive: Category node + 1-5 Word nodes + COMPOSED_OF relationships
   ↓
4. Add to graph:
   - Category node
   - Composed word nodes (1-5)
   ↓
5. Position near clicked node
   ↓
6. Create visual connection (shared_category or categorized_as)
   ↓
7. Highlight newly added nodes
```

**Category Cluster Layout:**
```
         [Category: Technology]
         ↓    ↓    ↓    ↓    ↓
      [W1] [W2] [W3] [W4] [W5]
```

**Further Expansion:**
- User can click on composed words to see their definitions
- Creates nested expansions
- Track expansion depth to avoid clutter

### 8.4 Expansion Management

**Control Node Integration:**
```html
Expansion Options:
☑ Auto-load discussions on expand
☐ Auto-load keywords on expand
☐ Auto-load categories on expand

Expansion Limits:
Max discussion depth: [3 ▼]
Max keyword definitions: [5 ▼]
Max category words: [5 ▼]

[Clear All Expansions]
[Collapse All Expansions]
```

**Expansion State Tracking:**
```typescript
interface ExpansionState {
  [nodeId: string]: {
    discussionExpanded: boolean;
    keywordsExpanded: string[];  // Which keywords loaded
    categoriesExpanded: string[]; // Which categories loaded
  };
}
```

**Collapse Expansion:**
- Button to remove expanded content
- Preserves parent node
- Removes added nodes and relationships
- Updates expansion state

---

## 9. State Management

### 9.1 Universal Graph Store Enhancement

**Additional Store Properties:**
```typescript
interface UniversalGraphStoreState {
  // Existing properties
  nodes: UniversalNodeData[];
  relationships: UniversalRelationshipData[];
  loading: boolean;
  error: string | null;
  
  // NEW: Control state
  controls: {
    filters: FilterState;
    sorting: SortState;
    visibility: VisibilityControls;
    display: ModeControls;
  };
  
  // NEW: Expansion tracking
  expansions: ExpansionState;
  
  // NEW: View settings
  viewSettings: {
    autoExpandHighValue: boolean;
    autoLoadDiscussions: boolean;
    autoLoadKeywords: boolean;
    autoLoadCategories: boolean;
    expansionThreshold: number;
  };
  
  // NEW: Statistics
  stats: {
    visibleCount: number;
    hiddenCount: number;
    detailCount: number;
    previewCount: number;
    byType: Record<NodeType, number>;
  };
}
```

**New Store Methods:**
```typescript
// Control state
setFilters(filters: FilterState): void;
setSorting(sort: SortState): void;
setVisibilityControls(controls: VisibilityControls): void;
setDisplayOptions(options: ModeControls): void;

// Expansion management
addExpansion(nodeId: string, type: ExpansionType, content: any): void;
removeExpansion(nodeId: string, type: ExpansionType): void;
clearAllExpansions(): void;

// Statistics
updateStats(): void;
getStatsByType(type: NodeType): number;
```

### 9.2 Visibility Preference Store Enhancement

**Enhanced Persistence:**
```typescript
interface VisibilityPreference {
  nodeId: string;
  isVisible: boolean;
  setAt: string; // ISO timestamp
  reason?: string; // Optional user note
}

interface VisibilityPreferenceStore {
  preferences: Map<string, VisibilityPreference>;
  
  // Methods
  setPreference(nodeId: string, isVisible: boolean, reason?: string): void;
  getPreference(nodeId: string): boolean | undefined;
  removePreference(nodeId: string): void;
  clearAllPreferences(): void;
  syncWithBackend(): Promise<void>;
  loadFromBackend(): Promise<void>;
}
```

**Backend Sync:**
- Periodic sync (every 5 minutes)
- On page unload
- On explicit user action (save settings button)

### 9.3 Control Node State

**Dedicated store for control node UI state:**
```typescript
interface ControlNodeStore {
  isExpanded: boolean;
  activeSections: {
    filters: boolean;
    sorting: boolean;
    visibility: boolean;
    display: boolean;
    actions: boolean;
  };
  
  // Methods
  toggleSection(section: string): void;
  expandAll(): void;
  collapseAll(): void;
  resetToDefaults(): void;
}
```

---

## 10. Performance Optimization

### 10.1 Lazy Loading

**Large Graph Handling:**
- Load initial 50 nodes
- Infinite scroll or pagination
- Load more on user action (scroll to edge, "Load More" button)
- Virtualization for hidden nodes (don't render)

### 10.2 Expansion Optimization

**Smart Loading:**
- Don't re-fetch already loaded content
- Cache expansion results
- Debounce rapid expansion requests
- Limit concurrent expansion requests

### 10.3 Rendering Optimization

**D3 Performance:**
- Use canvas for large graphs (>200 nodes)
- Simplify nodes when zoomed out
- Reduce link rendering at distance
- Batch DOM updates

**Svelte Reactivity:**
- Minimize reactive statements
- Use derived stores efficiently
- Avoid unnecessary re-renders
- Memoize expensive computations

---

## 11. User Experience Enhancements

### 11.1 Visual Feedback

**Loading States:**
- Skeleton screens
- Progress indicators
- Loading text
- Smooth transitions

**Success States:**
- Green flash on success
- Success notification toast
- Checkmark animation
- Celebratory micro-interactions

**Error States:**
- Red flash on error
- Clear error messages
- Retry options
- Helpful suggestions

### 11.2 Keyboard Shortcuts

**Global Shortcuts:**
- `C`: Create new node
- `F`: Focus filter section
- `S`: Focus sort section
- `V`: Toggle visibility panel
- `E`: Expand all eligible nodes
- `Shift+E`: Collapse all nodes
- `H`: Toggle hidden nodes view
- `R`: Refresh/reload graph
- `Escape`: Close modals/panels

**Node-specific shortcuts:**
- `Click`: Select node
- `Double-click`: Expand/collapse
- `Shift+Click`: Toggle visibility
- `Ctrl+Click`: Add to selection
- `Delete`: Hide selected node(s)

### 11.3 Tooltips and Help

**Contextual Help:**
- Tooltip on control node sections
- Help icons with explanations
- Tour/walkthrough for first-time users
- Link to documentation

**Information Display:**
- Node stats on hover
- Filter criteria summary
- Sort explanation
- Visibility rules explanation

### 11.4 Mobile Responsiveness

**Adapted UI:**
- Simplified control node for mobile
- Touch-friendly buttons
- Swipe gestures for node actions
- Responsive layout adjustments
- Bottom sheet for forms

---

## 12. Testing Strategy

### 12.1 Unit Tests

**Store Tests:**
```typescript
describe('UniversalGraphStore', () => {
  test('loads nodes with default parameters', async () => {
    // Test default load
  });
  
  test('applies filters correctly', async () => {
    // Test filter application
  });
  
  test('handles expansion state', () => {
    // Test expansion tracking
  });
});
```

**Component Tests:**
```typescript
describe('UniversalControlNode', () => {
  test('renders all sections', () => {
    // Test rendering
  });
  
  test('applies filters on submit', () => {
    // Test filter application
  });
  
  test('saves settings', () => {
    // Test persistence
  });
});
```

### 12.2 Integration Tests

**API Integration:**
- Test default load
- Test filtering
- Test sorting
- Test expansion endpoints
- Test node creation
- Test error handling

**State Integration:**
- Test store coordination
- Test visibility persistence
- Test expansion management

### 12.3 E2E Tests

**User Workflows:**
- Load universal graph
- Apply filters and sort
- Toggle node visibility
- Expand/collapse nodes
- Create new nodes
- Expand discussions/keywords/categories
- Save and restore view settings

---

## 13. Implementation Phases

### Phase 1: Foundation (Week 1)
**Priority: HIGH**

1. **Default Data Loading**
   - Implement default query parameters
   - Set up initial load sequence
   - Add loading states
   - Error handling

2. **Node Visibility Logic**
   - Implement three-state visibility
   - Community-based hiding
   - User override system
   - Hidden node placeholder component

3. **Store Enhancements**
   - Add control state to universal graph store
   - Enhance visibility preference store
   - Add expansion state tracking

**Deliverable:** Graph loads with sensible defaults, nodes show/hide based on votes with user override capability

---

### Phase 2: Control Node (Week 2)
**Priority: HIGH**

1. **Control Node Component**
   - Create UniversalControlNode.svelte
   - Implement collapsible sections
   - Wire up to store

2. **Filters Section**
   - Node type filter UI
   - Keyword filter UI
   - Category filter UI
   - Vote range filter UI
   - User content filter UI
   - Date range filter UI

3. **Sorting Section**
   - Sort by dropdown
   - Direction toggle
   - Visual feedback

**Deliverable:** Fully functional control node with comprehensive filter and sort UI

---

### Phase 3: Visibility & Display (Week 3)
**Priority: MEDIUM**

1. **Visibility Controls**
   - Bulk visibility toggles
   - Hidden nodes summary
   - Respect user overrides setting

2. **Display Options**
   - Expansion controls
   - Bulk expand/collapse
   - Relationship display toggles
   - Layout options

3. **Mode Management**
   - Expansion eligibility checks
   - Bulk mode application
   - Smart auto-expansion

**Deliverable:** Complete visibility management system with bulk controls

---

### Phase 4: Node Creation (Week 4)
**Priority: MEDIUM**

1. **Form Components**
   - Create all 5 form components
   - Shared form utilities
   - Validation logic

2. **Creation Workflows**
   - Standalone creation flow
   - Child node creation flow
   - Form modal system

3. **Post-Creation**
   - Graph update logic
   - Success notifications
   - Node highlighting

**Deliverable:** Full node creation system with all forms functional

---

### Phase 5: Content Expansion (Week 5)
**Priority: MEDIUM**

1. **Expansion Handlers**
   - Discussion expansion
   - Keyword expansion
   - Category expansion

2. **Expansion UI**
   - Loading states
   - Expansion management
   - Collapse functionality

3. **Layout Integration**
   - Position expanded content
   - Manage expanded clusters
   - Avoid overlap

**Deliverable:** Complete content expansion system

---

### Phase 6: Polish & Optimization (Week 6)
**Priority: LOW**

1. **Performance**
   - Lazy loading
   - Rendering optimization
   - Caching

2. **UX Enhancements**
   - Keyboard shortcuts
   - Tooltips and help
   - Mobile responsiveness

3. **Testing**
   - Unit tests
   - Integration tests
   - E2E tests

**Deliverable:** Polished, optimized, tested universal graph view

---

## 14. Success Criteria

This refactor will be considered successful when:

1. ✅ Graph loads with optimal default dataset
2. ✅ Nodes display correctly based on inclusion vote thresholds
3. ✅ Users can override visibility for individual nodes
4. ✅ Bulk visibility and mode controls work as expected
5. ✅ Control node provides comprehensive filter/sort interface
6. ✅ All filters apply correctly and update graph
7. ✅ All sort options work with proper direction control
8. ✅ Users can create new nodes (standalone and child)
9. ✅ All 5 node creation forms work correctly
10. ✅ Discussion expansion loads and displays correctly
11. ✅ Keyword expansion loads and displays correctly
12. ✅ Category expansion loads and displays correctly
13. ✅ Performance remains smooth with 200+ nodes
14. ✅ All user preferences persist across sessions
15. ✅ Code is well-tested and documented

---

## 15. Future Enhancements

### Beyond Initial Implementation

**Advanced Features:**
- Saved view presets ("My Favorites", "High Quality", "Recent Activity")
- Graph analytics dashboard (trends, insights, patterns)
- Collaborative filtering (see what others are viewing)
- AI-powered content recommendations
- Advanced search within graph
- Export/import graph views
- Annotation system (user notes on nodes)
- Custom node coloring and styling
- Multiple graph tabs/workspaces
- Real-time collaboration indicators

**Integration Improvements:**
- Slack/Discord notifications for new high-value content
- Email digests of graph activity
- Browser extension for external content addition
- Mobile app with native graph experience
- API for third-party integrations

---

## 16. Dependencies and Prerequisites

**Required Before Implementation:**
- ✅ Node redesign completed (from previous plan)
- ✅ Backend universal graph API stable
- ✅ All expansion endpoints tested and working
- ✅ User authentication system functional
- ⚠️ Evidence node backend implementation (if not yet complete)

**External Dependencies:**
- D3.js for graph visualization
- Svelte for reactivity
- Backend API availability
- User session management

---

## 17. Known Risks and Mitigation

### Risk 1: Performance with Large Graphs
**Mitigation:**
- Implement lazy loading early
- Use canvas rendering for large graphs
- Optimize D3 simulation parameters
- Add virtualization for off-screen nodes

### Risk 2: Complex State Management
**Mitigation:**
- Use well-structured stores
- Document state flow clearly
- Implement thorough testing
- Keep state changes predictable

### Risk 3: User Confusion with Visibility Rules
**Mitigation:**
- Clear tooltips and help text
- Visual indicators for why nodes are hidden
- Easy reset to defaults
- Onboarding walkthrough

### Risk 4: API Rate Limiting on Expansions
**Mitigation:**
- Cache expansion results
- Limit concurrent requests
- Debounce rapid clicks
- Clear rate limit messaging

---

## 18. Documentation Requirements

**Code Documentation:**
- JSDoc comments on all public methods
- Inline comments for complex logic
- Type definitions for all interfaces
- Examples in component comments

**User Documentation:**
- Control node feature guide
- Filter and sort tutorial
- Visibility system explanation
- Node creation workflows
- Expansion features guide
- Keyboard shortcuts reference
- FAQ for common issues

**Developer Documentation:**
- Architecture overview
- State flow diagrams
- Component interaction maps
- API integration guide
- Testing approach
- Performance optimization tips

---

## 19. Next Steps

**Immediate Actions:**

1. Review and refine this plan
2. Confirm backend API readiness (especially Evidence endpoints)
3. Set up project structure for new components
4. Create implementation checklist from Phase 1
5. Begin default loading implementation
6. Set up testing infrastructure

**Week 1 Goals:**
- Complete Phase 1 (Foundation)
- Basic graph loading with defaults
- Visibility logic working
- Store enhancements complete

---

## Document Control

**Version History:**
- v1.0 (Oct 16, 2025): Initial comprehensive plan

**Related Documents:**
- Node Redesign Plan
- Backend Universal Graph API Documentation
- Frontend Component Style Guide
- Form Check Plan (upcoming)

---

**End of Universal Graph Functionality Refactor Plan**