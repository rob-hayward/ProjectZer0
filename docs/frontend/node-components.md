# Node Components - Architecture Documentation

## Document Overview
**Project:** ProjectZer0 Frontend  
**Focus:** Node Component Architecture  
**Version:** 1.0  
**Date:** October 16, 2025  
**Purpose:** Comprehensive guide to understanding node component structure, patterns, and separation of concerns

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Component Hierarchy](#2-component-hierarchy)
3. [Base Components](#3-base-components)
4. [ContentBox System](#4-contentbox-system)
5. [Node Type Components](#5-node-type-components)
6. [Behaviour System](#6-behaviour-system)
7. [UI Components](#7-ui-components)
8. [Data Flow](#8-data-flow)
9. [Separation of Concerns](#9-separation-of-concerns)
10. [Consistency Patterns](#10-consistency-patterns)
11. [Development Patterns](#11-development-patterns)

---

## 1. Architecture Overview

### 1.1 Core Philosophy

The node component architecture is built on **composition**, **reusability**, and **separation of concerns**. Every node type shares common base components and behaviours while maintaining flexibility for type-specific features.

### 1.2 Key Architectural Principles

1. **Component Composition**: Nodes are built by composing smaller, focused components
2. **Behaviour Abstraction**: Common logic (voting, visibility, mode, data) is abstracted into reusable behaviours
3. **Slot-Based Layouts**: Base components use slots to allow node types to inject custom content
4. **Standardized UI**: Shared UI components ensure visual and functional consistency
5. **Context Awareness**: Components detect their context (view type, stores) automatically
6. **Data-Driven**: Nodes receive data and render without managing complex state internally

### 1.3 Layer Structure

```
┌─────────────────────────────────────────────────────┐
│              Specific Node Components                │
│  (StatementNode, OpenQuestionNode, WordNode, etc.)  │
│                                                       │
│  • Type-specific data extraction                     │
│  • Custom content rendering                          │
│  • Event handling                                    │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────┐
│            Base Layer Components                     │
│   (BaseNode, BasePreviewNode, BaseDetailNode)       │
│                                                       │
│  • Mode switching (preview/detail)                   │
│  • Slot-based layout structure                       │
│  • Edge buttons (expand, show/hide)                  │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────┐
│          ContentBox & UI Components                  │
│    (ContentBox, VoteButtons, VoteStats, etc.)       │
│                                                       │
│  • Standardized content area layout                  │
│  • Reusable UI elements                              │
│  • Consistent spacing and sizing                     │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────┐
│              Behaviour System                        │
│  (voteBehaviour, visibilityBehaviour, etc.)         │
│                                                       │
│  • Isolated business logic                           │
│  • Store management                                  │
│  • API interactions                                  │
└─────────────────────────────────────────────────────┘
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
    └── Uses BaseDetailNode for detail mode
```

### 2.2 Component Responsibilities

**BaseNode**: Core SVG structure
- Renders multiple background layers for depth
- Provides decorative rings with glow effects
- Applies vote-based styling (ring width, glow intensity)
- Exposes slots for child components

**BasePreviewNode**: Preview mode container
- Wraps BaseNode
- Always uses ContentBox for standardized layout
- Renders title outside ContentBox (consistency with detail mode)
- Includes expand button (SE position)
- Handles mode change events

**BaseDetailNode**: Detail mode container
- Wraps BaseNode
- Always uses ContentBox for standardized layout
- Renders title outside ContentBox
- Includes collapse button (SE position)
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

**Purpose**: Foundational SVG structure for all nodes

**Key Features**:
```svelte
<script lang="ts">
  export let node: RenderableNode;
  export let voteBasedStyles = {
    glow: { intensity: 8, opacity: 0.6 },
    ring: { width: 6, opacity: 0.5 }
  };
  
  $: radius = node.radius;
  $: highlightColor = node.style?.highlightColor || '#FFFFFF';
</script>
```

**Rendering Structure**:
```xml
<g class="base-node">
  <defs>
    <!-- Filters for glow effects -->
  </defs>
  
  <!-- 4 background layers for depth -->
  <circle class="background-layer-1" /> <!-- 50% opacity -->
  <circle class="background-layer-2" /> <!-- 80% opacity -->
  <circle class="background-layer-3" /> <!-- 90% opacity -->
  <circle class="content-background" />  <!-- 95% opacity -->
  
  <!-- Decorative rings -->
  <circle class="outer-ring" />   <!-- With glow filter -->
  <circle class="middle-ring" />  <!-- Subtle white ring -->
  
  <!-- Slot for child content -->
  <slot {radius} {filterId} {gradientId} />
</g>
```

**Vote-Based Styling**:
- Ring width adjusts based on vote status
- Glow intensity reflects community engagement
- Styling is consistent, not purely vote-driven

### 3.2 BasePreviewNode.svelte

**Purpose**: Container for preview mode rendering

**Slot Interface**:
```typescript
interface $Slots {
  title: { radius: number };
  content: { x, y, width, height, layoutConfig };
  voting: { x, y, width, height, layoutConfig };
  stats: { x, y, width, height, layoutConfig };
  default: { radius, filterId, gradientId };
}
```

**Key Features**:
- Title slot rendered **outside** ContentBox (consistency)
- ContentBox **always used** for layout (recent refactor)
- Expand button positioned at SE corner (radius * 0.7071)
- Forwards mode change events with node position data

**Usage Pattern**:
```svelte
<BasePreviewNode {node} {nodeX} {nodeY} on:modeChange>
  <svelte:fragment slot="title" let:radius>
    <NodeHeader title="Statement" {radius} mode="preview" />
  </svelte:fragment>
  
  <svelte:fragment slot="content" let:x let:y let:width let:height>
    <!-- Content rendering -->
  </svelte:fragment>
  
  <svelte:fragment slot="voting" let:width let:height>
    <VoteButtons {userVoteStatus} {positiveVotes} {negativeVotes} 
                 availableWidth={width} mode="preview" on:vote />
  </svelte:fragment>
</BasePreviewNode>
```

### 3.3 BaseDetailNode.svelte

**Purpose**: Container for detail mode rendering

**Slot Interface**: Same as BasePreviewNode

**Key Features**:
- Title slot rendered **outside** ContentBox
- ContentBox for content, voting, and stats sections
- Collapse button positioned at SE corner
- Optional CreatorCredits component
- Forwards mode change events with node position data

**Usage Pattern**:
```svelte
<BaseDetailNode {node} on:modeChange>
  <svelte:fragment slot="default" let:radius>
    <NodeHeader title="Statement" {radius} mode="detail" />
    
    <ContentBox nodeType="statement" mode="detail">
      <!-- Slots for content, voting, stats -->
    </ContentBox>
    
    {#if statementData.createdBy}
      <CreatorCredits {createdBy} {publicCredit} {radius} />
    {/if}
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
    statsYOffset: 0,
    titleYOffset: 0,
    mainTextYOffset: 0
  },
  statement: { /* ... */ },
  openquestion: { /* ... */ },
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
  },
  // Similar for other node types
};
```

### 4.3 Box Sizing

**Size Calculation**:
```typescript
function getContentBoxSize(type: NodeType, mode: 'preview' | 'detail'): number {
  const sizeMap = COORDINATE_SPACE.CONTENT_BOXES;
  
  switch(type) {
    case 'word': 
      return mode === 'detail' ? sizeMap.WORD.DETAIL : sizeMap.WORD.PREVIEW;
    case 'statement': 
      return mode === 'detail' ? sizeMap.STATEMENT.DETAIL : sizeMap.STATEMENT.PREVIEW;
    // etc.
  }
}
```

**Example Sizes** (from COORDINATE_SPACE):
- Statement Detail: 600px box
- Statement Preview: 320px box
- Word Detail: 600px box
- Word Preview: 320px box

### 4.4 Slot System

ContentBox exposes three named slots with calculated dimensions:

```svelte
<ContentBox nodeType={node.type} mode="preview">
  <svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
    <!-- Content goes here -->
    <!-- x, y: position within box -->
    <!-- width, height: available dimensions -->
    <!-- layoutConfig: access to padding, offsets -->
  </svelte:fragment>
  
  <svelte:fragment slot="voting" let:x let:y let:width let:height>
    <!-- Voting UI here -->
  </svelte:fragment>
  
  <svelte:fragment slot="stats" let:x let:y let:width let:height>
    <!-- Stats UI here (detail mode only) -->
  </svelte:fragment>
</ContentBox>
```

### 4.5 Position Calculations

**Y Positioning** (single source of truth):
```typescript
// Base positions
$: contentBaseY = -halfBox;
$: votingBaseY = contentBaseY + contentHeight + sectionSpacing;
$: statsBaseY = votingBaseY + votingHeight + sectionSpacing;

// Final positions with offsets
$: contentY = contentBaseY;
$: votingY = votingBaseY + votingYOffset;
$: statsY = statsBaseY;

// X positioning
$: sectionX = -halfBox + horizontalPadding;
$: sectionWidth = boxSize - (horizontalPadding * 2);
```

**Key Insight**: ContentBox handles all positioning math, child components just render at provided coordinates.

---

## 5. Node Type Components

### 5.1 Common Structure

Every node type component follows this structure:

```svelte
<script lang="ts">
  // 1. Imports
  import { createEventDispatcher } from 'svelte';
  import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
  import BasePreviewNode from '../base/BasePreviewNode.svelte';
  import BaseDetailNode from '../base/BaseDetailNode.svelte';
  // UI components
  import VoteButtons from '../ui/VoteButtons.svelte';
  import VoteStats from '../ui/VoteStats.svelte';
  import NodeHeader from '../ui/NodeHeader.svelte';
  import ContentBox from '../ui/ContentBox.svelte';
  
  // 2. Props
  export let node: RenderableNode;
  export let nodeX: number | undefined = undefined;
  export let nodeY: number | undefined = undefined;
  
  // 3. Type validation
  if (!isNodeTypeData(node.data)) {
    throw new Error('Invalid node data type');
  }
  
  // 4. Data extraction
  const nodeData = node.data as NodeTypeData;
  $: displayContent = nodeData.content;
  
  // 5. Vote data extraction (from node.data and node.metadata)
  $: positiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
  $: negativeVotes = getNeo4jNumber(nodeData.negativeVotes) || 0;
  $: netVotes = positiveVotes - negativeVotes;
  $: userVoteStatus = node.metadata?.userVoteStatus?.status || 'none';
  
  // 6. Voting state (for UI feedback)
  let isVoting = false;
  let voteSuccess = false;
  let lastVoteType = null;
  
  // 7. Event dispatcher
  const dispatch = createEventDispatcher<{
    modeChange: { mode: NodeMode; position: { x, y }; nodeId: string };
    visibilityChange: { isHidden: boolean };
  }>();
  
  // 8. Vote handler
  async function updateVoteState(voteType: VoteStatus) {
    // API call
    // Update local state
    // Dispatch events
  }
  
  // 9. Event handlers
  function handleModeChange(event) {
    dispatch('modeChange', { 
      nodeId: node.id, 
      mode: event.detail.mode,
      position: event.detail.position 
    });
  }
  
  function handleVote(event) {
    updateVoteState(event.detail.voteType);
  }
</script>

<!-- 10. Rendering -->
{#if node.mode === 'detail'}
  <BaseDetailNode {node} on:modeChange={handleModeChange}>
    <!-- Detail mode content -->
  </BaseDetailNode>
{:else}
  <BasePreviewNode {node} on:modeChange={handleModeChange}>
    <!-- Preview mode content -->
  </BasePreviewNode>
{/if}
```

### 5.2 Node Type Catalog

| Node Type | Purpose | Content Voting | Special Features |
|-----------|---------|----------------|------------------|
| **StatementNode** | Declarative statements | ✅ Yes | Related statements count |
| **OpenQuestionNode** | Open-ended questions | ❌ No (fallback) | Answer count, Answer button |
| **AnswerNode** | Answers to questions | ✅ Yes | Parent question context |
| **QuantityNode** | Quantitative questions | ❌ No (special UI) | Unit category, quantity interface |
| **EvidenceNode** | Evidence citations | ❌ No (fallback) | Parent node, source URL, evidence type |
| **WordNode** | Keywords | ❌ No (inclusion only) | Simple text display |
| **DefinitionNode** | Word definitions | ❌ No (inclusion only) | Word + definition, live vs alternative |
| **CommentNode** | Discussion comments | ❌ No (inclusion only) | Thread depth, reply functionality |
| **ControlNode** | Filter/sort controls | N/A | Complex form interface |

### 5.3 Data Extraction Pattern

**Core Pattern**:
```typescript
// Extract from node.data
const nodeData = node.data as NodeTypeData;

// Extract voting data (handles Neo4j integers)
function getNeo4jNumber(value: any): number {
  return value && typeof value === 'object' && 'low' in value 
    ? Number(value.low) 
    : Number(value || 0);
}

$: dataPositiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
$: dataNegativeVotes = getNeo4jNumber(nodeData.negativeVotes) || 0;

// Extract from node.metadata (universal graph enrichment)
$: metadataVotes = (() => {
  if (node.metadata?.votes) {
    const votesObj = node.metadata.votes;
    return {
      positive: getNeo4jNumber(votesObj.positive) || 0,
      negative: getNeo4jNumber(votesObj.negative) || 0,
      net: getNeo4jNumber(votesObj.net)
    };
  }
  return null;
})();

// Use metadata if available, otherwise use data
$: positiveVotes = metadataVotes?.positive ?? dataPositiveVotes;
$: negativeVotes = metadataVotes?.negative ?? dataNegativeVotes;
$: netVotes = metadataVotes?.net ?? (positiveVotes - negativeVotes);

// User vote status from metadata (universal graph)
$: userVoteStatus = node.metadata?.userVoteStatus?.status || 'none';
```

**Key Insight**: Vote data can come from two sources:
1. `node.data` - Direct from node properties
2. `node.metadata` - Enriched data from universal graph API

Always check metadata first, fall back to data.

---

## 6. Behaviour System

### 6.1 Overview

Behaviours encapsulate reusable logic patterns into composable functions. They return objects with:
- **Readable stores**: Reactive state
- **Methods**: Functions to interact with state
- **Lifecycle**: Initialize, update, reset, destroy

### 6.2 Available Behaviours

**Behaviour Modules**:
```typescript
import {
  createVoteBehaviour,
  createVisibilityBehaviour,
  createModeBehaviour,
  createDataBehaviour
} from './behaviours';
```

### 6.3 VoteBehaviour

**Purpose**: Manages voting state and API interactions

**Creation**:
```typescript
const voteBehaviour = createVoteBehaviour(nodeId, nodeType, {
  voteStore,          // Optional store for caching
  graphStore,         // For visibility updates
  apiIdentifier,      // ID for API calls (may differ from nodeId)
  dataObject,         // Direct data object to update
  getVoteEndpoint,    // Custom endpoint function
  getRemoveVoteEndpoint,  // Custom remove endpoint
  onDataUpdate,       // Callback after updates
  initialVoteData     // Pre-loaded batch data
});
```

**State**:
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

**Methods**:
```typescript
// Initialize with data
await voteBehaviour.initialize({
  positiveVotes: 10,
  negativeVotes: 2,
  skipVoteStatusFetch: false
});

// Handle vote action
const success = await voteBehaviour.handleVote('agree');

// Update from external source
voteBehaviour.updateFromExternalSource({ positiveVotes: 11 });

// Get current state
const state = voteBehaviour.getCurrentState();
```

**Usage Pattern** (Legacy - mostly replaced by direct data extraction):
```svelte
<script>
  let voteBehaviour;
  let behavioursInitialized = false;
  
  $: if (node.id && !behavioursInitialized) {
    voteBehaviour = createVoteBehaviour(node.id, 'statement', {
      voteStore: statementNetworkStore,
      graphStore,
      dataObject: statementData
    });
    behavioursInitialized = true;
  }
  
  // Access state
  $: behaviorState = voteBehaviour?.getCurrentState() || {};
  $: userVoteStatus = behaviorState.userVoteStatus || 'none';
  
  // Handle vote
  async function handleVote(voteType) {
    if (voteBehaviour) {
      await voteBehaviour.handleVote(voteType);
    }
  }
</script>
```

**Current Pattern** (StatementNode, OpenQuestionNode):
Most node components now use **direct data extraction** and **direct API calls** instead of behaviours. This simpler approach:
- Reduces abstraction layers
- Makes data flow more explicit
- Avoids complexity when not needed

**When to Use Behaviours**:
- Multiple nodes sharing complex logic
- Need for centralized state management
- Testing isolation required

**When to Use Direct Approach**:
- Simple, one-off logic
- Node-specific requirements
- Maximum clarity and performance

### 6.4 VisibilityBehaviour

**Purpose**: Manages node visibility based on votes and user preference

**Creation**:
```typescript
const visibilityBehaviour = createVisibilityBehaviour(nodeId, {
  communityThreshold: 0,  // Hide if netVotes < 0
  graphStore              // For updating graph visibility
});
```

**State**:
```typescript
interface VisibilityBehaviourState {
  isHidden: boolean;
  hiddenReason: 'user' | 'community';
  userPreference?: boolean;
  communityHidden: boolean;
}
```

**Methods**:
```typescript
await visibilityBehaviour.initialize(netVotes);
visibilityBehaviour.updateCommunityVisibility(newNetVotes);
await visibilityBehaviour.setUserPreference(isVisible);
```

**Usage** (less common now - mostly handled directly):
```svelte
<script>
  let visibilityBehaviour;
  
  $: if (node.id && !behavioursInitialized) {
    visibilityBehaviour = createVisibilityBehaviour(node.id, {
      graphStore
    });
  }
  
  onMount(async () => {
    await visibilityBehaviour.initialize(netVotes);
  });
</script>
```

### 6.5 ModeBehaviour

**Purpose**: Manages node mode (preview/detail) state

**Note**: Largely **deprecated** in current architecture. Mode is now controlled directly by the graph manager and passed via `node.mode`. Components simply react to this prop.

**Why Deprecated**:
- Mode state belongs to graph layer, not individual nodes
- Manager handles all mode changes centrally
- Simpler to just read `node.mode` prop

### 6.6 DataBehaviour

**Purpose**: Manages node data state, loading, and transformations

**Note**: Also **rarely used** in current architecture. Most components extract data directly from `node.data` using reactive statements.

**Why Rarely Used**:
- Data already provided via props
- Transformations done inline with reactive statements
- Simpler to avoid extra abstraction

---

## 7. UI Components

### 7.1 Shared UI Library

**Location**: `src/lib/components/graph/nodes/ui/`

**Purpose**: Reusable UI components for consistent node rendering

### 7.2 Component Catalog

#### VoteButtons.svelte

**Purpose**: Standardized voting interface

**Props**:
```typescript
export let userVoteStatus: VoteStatus = 'none';
export let positiveVotes: number = 0;
export let negativeVotes: number = 0;
export let isVoting: boolean = false;
export let lastVoteType: VoteStatus | null = null;
export let voteSuccess: boolean = false;
export let availableWidth: number = 400;
export let containerY: number = 0;
export let mode: 'preview' | 'detail' = 'detail';
```

**Features**:
- Thumbs up/down icons (Material Symbols)
- Net vote score display
- Visual feedback on user's vote status
- Hover text ("Agree" / "Disagree")
- Loading spinner during vote submission
- Success animation on vote
- Toggle behavior (click same button removes vote)

**Events**:
```typescript
dispatch('vote', { voteType: VoteStatus });
```

**Usage**:
```svelte
<VoteButtons
  {userVoteStatus}
  {positiveVotes}
  {negativeVotes}
  {isVoting}
  {voteSuccess}
  {lastVoteType}
  availableWidth={width}
  containerY={height}
  mode="detail"
  on:vote={handleVote}
/>
```

#### VoteStats.svelte

**Purpose**: Detailed vote breakdown display

**Props**:
```typescript
export let userVoteStatus: VoteStatus = 'none';
export let positiveVotes: number = 0;
export let negativeVotes: number = 0;
export let userName: string = 'Anonymous';
export let showUserStatus: boolean = true;
export let availableWidth: number = 400;
export let containerY: number = 0;
export let showBackground: boolean = false;
```

**Features**:
- Displays "Total Agree", "Total Disagree", "Net Votes"
- Shows user's vote status ("You agreed", "You disagreed", "Not voted")
- Color-coded values (green for positive, red for negative)
- Compact, centered layout

**Usage**:
```svelte
<VoteStats
  {userVoteStatus}
  {positiveVotes}
  {negativeVotes}
  {userName}
  showUserStatus={true}
  availableWidth={width}
  containerY={30}
  showBackground={false}
/>
```

#### NodeHeader.svelte

**Purpose**: Node type title display

**Props**:
```typescript
export let title: string;
export let radius: number;
export let size: 'small' | 'medium' | 'large' = 'medium';
export let position: 'top' | 'center' = 'top';
export let color: string = 'rgba(255, 255, 255, 0.7)';
export let y: number | undefined = undefined;
export let mode: 'preview' | 'detail' = 'detail';
```

**Features**:
- Standardized positioning (automatically calculated from radius)
- Three size options
- Mode-aware offset (different for preview vs detail)
- Customizable color

**Usage**:
```svelte
<NodeHeader 
  title="Statement" 
  radius={radius} 
  size="small" 
  mode="preview" 
/>
```

#### CreatorCredits.svelte

**Purpose**: Display node creator attribution

**Props**:
```typescript
export let createdBy: string;
export let publicCredit: boolean;
export let creatorDetails: any;
export let radius: number;
export let prefix: string = "created by:";
```

**Features**:
- Only displays if `publicCredit === true`
- Shows creator username or handle
- Positioned at bottom of node
- Customizable prefix ("created by:", "asked by:", "defined by:")
- Fetches user details if available

**Usage**:
```svelte
{#if nodeData.createdBy}
  <CreatorCredits
    createdBy={nodeData.createdBy}
    publicCredit={nodeData.publicCredit}
    creatorDetails={creatorDetails}
    radius={radius}
    prefix="created by:"
  />
{/if}
```

#### ExpandCollapseButton.svelte

**Purpose**: Mode switching button on node edge

**Props**:
```typescript
export let mode: 'expand' | 'collapse';
export let y: number = 0;
export let x: number = -20;
export let nodeX: number | undefined;
export let nodeY: number | undefined;
export let nodeId: string | undefined;
```

**Features**:
- Positioned at node edge (typically SE: `radius * 0.7071`)
- Glow effect on hover
- Dispatches mode change event with position data
- Hover text ("expand" / "collapse")
- Scale animation on hover

**Events**:
```typescript
dispatch('click', void);
dispatch('modeChange', { 
  mode: NodeMode, 
  position: { x, y }, 
  nodeId 
});
```

**Usage**:
```svelte
<ExpandCollapseButton
  mode="expand"
  y={radius * 0.7071}
  x={-radius * 0.7071}
  {nodeX}
  {nodeY}
  nodeId={node.id}
  on:click={handleButtonClick}
  on:modeChange={handleModeChange}
/>
```

#### ShowHideButton.svelte

**Purpose**: User visibility override button

**Props**:
```typescript
export let isHidden: boolean;
export let y: number;
export let x: number;
```

**Features**:
- Eye icon (visible) or eye-slash icon (hidden)
- Positioned at node edge (typically SW)
- Dispatches visibility change event
- Hover text ("show" / "hide")

**Events**:
```typescript
dispatch('visibilityChange', { isHidden: boolean });
```

### 7.3 Component Consistency

All UI components follow these patterns:
- Use Inter font family
- Consistent color scheme (defined in COLORS constants)
- SVG-based for scalability
- Responsive to available width
- Emit custom events, not direct actions
- Accept mode prop where relevant (preview/detail)

---

## 8. Data Flow

### 8.1 Data Sources

Nodes receive data from multiple sources:

```
Backend API
    ↓
Universal Graph Store / View-Specific Store
    ↓
UniversalGraphManager / Graph Manager
    ↓
Enhanced Node (node.data + node.metadata)
    ↓
Node Component (extracts and displays)
```

### 8.2 Data Structure

**Enhanced Node**:
```typescript
interface EnhancedNode extends SimulationNodeDatum {
  id: string;
  type: NodeType;
  data: NodeData;           // Node-specific data
  mode: NodeMode;           // 'preview' | 'detail'
  radius: number;
  group: NodeGroup;
  metadata?: {              // Enriched data
    votes?: {
      positive: number;
      negative: number;
      net: number;
    };
    userVoteStatus?: {
      status: VoteStatus;
      inclusionVote: 'positive' | 'negative' | null;
      contentVote: 'positive' | 'negative' | null;
    };
    userVisibilityPreference?: string;
    net_votes?: number;
    participant_count?: number;
    // ... more metadata
  };
  // D3 simulation properties
  x, y, vx, vy, fx, fy: number | null;
}
```

**Node Data** (example for Statement):
```typescript
interface StatementNode {
  id: string;
  statement: string;
  createdBy: string;
  publicCredit: boolean;
  positiveVotes: number;
  negativeVotes: number;
  createdAt: string;
  updatedAt: string;
  discussionId?: string;
  relatedStatements?: any[];
  // ... other properties
}
```

### 8.3 Extraction Pattern

**Step 1: Type Guard**:
```typescript
if (!isStatementData(node.data)) {
  throw new Error('Invalid node data type');
}
```

**Step 2: Type Assertion**:
```typescript
const statementData = node.data as StatementNode;
```

**Step 3: Reactive Extraction**:
```typescript
// Simple extraction
$: displayText = statementData.statement;
$: createdBy = statementData.createdBy;

// Neo4j number handling
$: positiveVotes = getNeo4jNumber(statementData.positiveVotes) || 0;

// Metadata extraction with fallback
$: metadataVotes = node.metadata?.votes || null;
$: positiveVotes = metadataVotes?.positive ?? dataPositiveVotes;
```

### 8.4 Vote Data Flow

**Two Paths**:

**Path 1: Direct from node.data**:
```
Backend → Node Properties → node.data → Extract → Display
```

**Path 2: Enriched from universal graph**:
```
Backend → Universal Graph API → Enrichment → node.metadata → Extract → Display
```

**Fallback Strategy**:
```typescript
// Try metadata first (universal graph)
$: metadataVotes = (() => {
  if (node.metadata?.votes) {
    return {
      positive: getNeo4jNumber(node.metadata.votes.positive),
      negative: getNeo4jNumber(node.metadata.votes.negative),
      net: getNeo4jNumber(node.metadata.votes.net)
    };
  }
  return null;
})();

// Fall back to data
$: positiveVotes = metadataVotes?.positive ?? dataPositiveVotes;
$: negativeVotes = metadataVotes?.negative ?? dataNegativeVotes;
$: netVotes = metadataVotes?.net ?? (positiveVotes - negativeVotes);
```

**Why This Pattern?**:
- Universal graph provides enriched, consistent data
- Node properties may be stale or incomplete
- Fallback ensures robustness across views

### 8.5 Event Flow

**Upward Events**:
```
User Interaction (click vote button)
    ↓
VoteButtons component (emits 'vote' event)
    ↓
Node component (handleVote function)
    ↓ API call
Backend (updates database)
    ↓
Response
    ↓
Node component (updates local state)
    ↓
Store update (if applicable)
    ↓
Graph manager (recalculates visibility)
```

**Mode Change Events**:
```
User Click (expand button)
    ↓
ExpandCollapseButton (emits 'modeChange')
    ↓
BasePreviewNode/BaseDetailNode (forwards event)
    ↓
Node Component (forwards event with nodeId)
    ↓
NodeRenderer (forwards event)
    ↓
Graph Component (receives event)
    ↓
Graph Manager (updateNodeMode)
    ↓
Layout Recalculation
    ↓
Node re-rendered with new mode
```

**Key Insight**: Events bubble up through component hierarchy until reaching the graph manager, which has authority over all state changes.

---

## 9. Separation of Concerns

### 9.1 Architectural Layers

**Layer 1: Presentation (Node Components)**
- **Responsibility**: Render UI based on props
- **Does**: Extract data, display content, emit events
- **Does NOT**: Manage state, make decisions, mutate data

**Layer 2: Base Components**
- **Responsibility**: Provide structure and layout
- **Does**: Mode switching UI, slot management, edge buttons
- **Does NOT**: Know about specific node types or business logic

**Layer 3: ContentBox & UI Components**
- **Responsibility**: Standardized UI elements
- **Does**: Layout calculation, consistent styling, user interaction
- **Does NOT**: Know about node types or data structure

**Layer 4: Behaviours** (optional)
- **Responsibility**: Encapsulate reusable logic
- **Does**: State management, API calls, store updates
- **Does NOT**: Render UI or emit DOM events

**Layer 5: Stores**
- **Responsibility**: Application state
- **Does**: Cache data, provide reactive subscriptions
- **Does NOT**: Render UI or make API calls directly

**Layer 6: Graph Manager**
- **Responsibility**: Graph-level orchestration
- **Does**: Node positioning, mode management, visibility control
- **Does NOT**: Render individual nodes or handle voting

### 9.2 Responsibility Matrix

| Concern | Component Layer | Base Layer | UI Layer | Behaviour Layer | Store Layer | Manager Layer |
|---------|----------------|------------|----------|----------------|-------------|---------------|
| **Data Extraction** | ✅ Primary | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Rendering** | ✅ Primary | ✅ Structure | ✅ UI Elements | ❌ | ❌ | ❌ |
| **User Interaction** | ✅ Handlers | ✅ Buttons | ✅ Buttons | ❌ | ❌ | ❌ |
| **API Calls** | ✅ Direct | ❌ | ❌ | ✅ Optional | ❌ | ❌ |
| **State Management** | ❌ | ❌ | ❌ | ✅ Optional | ✅ Primary | ✅ Graph State |
| **Layout Calculation** | ❌ | ❌ | ✅ ContentBox | ❌ | ❌ | ✅ Positioning |
| **Mode Control** | ❌ | ✅ UI | ❌ | ❌ | ❌ | ✅ Authority |
| **Visibility Logic** | ❌ | ❌ | ❌ | ✅ Optional | ❌ | ✅ Authority |

### 9.3 Data vs Behavior

**Data Pattern** (current preference):
```svelte
<script>
  // Extract data reactively
  $: positiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
  $: negativeVotes = getNeo4jNumber(nodeData.negativeVotes) || 0;
  $: netVotes = positiveVotes - negativeVotes;
  $: userVoteStatus = node.metadata?.userVoteStatus?.status || 'none';
  
  // Handle vote directly
  async function updateVoteState(voteType) {
    isVoting = true;
    try {
      const result = await fetchWithAuth(`/nodes/statement/${node.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ isPositive: voteType === 'agree' })
      });
      
      positiveVotes = result.positiveVotes;
      negativeVotes = result.negativeVotes;
      netVotes = positiveVotes - negativeVotes;
      userVoteStatus = voteType;
    } finally {
      isVoting = false;
    }
  }
</script>
```

**Pros**:
- Simple, clear data flow
- Easy to understand and debug
- Less abstraction overhead
- Direct connection between UI and API

**Cons**:
- Some code duplication across node types
- Harder to test in isolation

**Behavior Pattern** (optional, for complex cases):
```svelte
<script>
  let voteBehaviour;
  
  $: if (node.id && !behavioursInitialized) {
    voteBehaviour = createVoteBehaviour(node.id, 'statement');
    behavioursInitialized = true;
  }
  
  $: behaviorState = voteBehaviour?.getCurrentState() || {};
  $: positiveVotes = behaviorState.positiveVotes;
  $: negativeVotes = behaviorState.negativeVotes;
  
  async function handleVote(voteType) {
    await voteBehaviour.handleVote(voteType);
  }
</script>
```

**Pros**:
- Encapsulated, testable logic
- Shared across multiple components
- Centralized state management

**Cons**:
- Additional abstraction layer
- Harder to trace data flow
- More setup code

**Guideline**: Use **data pattern by default**. Use **behavior pattern** when:
- Logic is complex and shared
- Need to test in isolation
- Managing multiple interdependent states

---

## 10. Consistency Patterns

### 10.1 Structural Consistency

**Every Node Type Component**:
1. ✅ Uses `BasePreviewNode` for preview mode
2. ✅ Uses `BaseDetailNode` for detail mode
3. ✅ Always uses `ContentBox` for layout (recent refactor)
4. ✅ Title rendered **outside** ContentBox (for consistency)
5. ✅ Imports shared UI components (VoteButtons, VoteStats, NodeHeader)
6. ✅ Handles mode change events
7. ✅ Handles vote events (where applicable)
8. ✅ Follows reactive data extraction pattern

### 10.2 Naming Consistency

**Component Names**:
- Base components: `Base[Name]Node.svelte`
- Node types: `[NodeType]Node.svelte`
- UI components: `[Feature][Type].svelte` (e.g., VoteButtons, NodeHeader)
- Behaviours: `[name]Behaviour.ts`

**Variable Names**:
- Node data: `[nodeType]Data` (e.g., `statementData`, `wordData`)
- Display values: `display[PropertyName]` (e.g., `displayText`, `displayWord`)
- User state: `user[PropertyName]` (e.g., `userVoteStatus`, `userName`)
- Voting state: `[type]Votes` (e.g., `positiveVotes`, `negativeVotes`, `netVotes`)
- Loading state: `is[Action]ing` (e.g., `isVoting`, `isLoading`)
- Success state: `[action]Success` (e.g., `voteSuccess`)

**Function Names**:
- Event handlers: `handle[EventName]` (e.g., `handleVote`, `handleModeChange`)
- Update functions: `update[StateName]` (e.g., `updateVoteState`)
- Fetch functions: `fetch[DataName]` or `get[DataName]`

### 10.3 Slot Consistency

**All Base Components Provide**:
```typescript
interface CommonSlots {
  title: { radius: number };
  content: { x, y, width, height, layoutConfig };
  voting: { x, y, width, height, layoutConfig };
  stats: { x, y, width, height, layoutConfig };
}
```

**Usage Pattern** (consistent across all node types):
```svelte
<BasePreviewNode {node}>
  <svelte:fragment slot="title" let:radius>
    <NodeHeader title="[Type]" {radius} mode="preview" />
  </svelte:fragment>
  
  <svelte:fragment slot="content" let:x let:y let:width let:height>
    <!-- Content here -->
  </svelte:fragment>
  
  <svelte:fragment slot="voting" let:width let:height>
    <VoteButtons {...props} mode="preview" on:vote />
  </svelte:fragment>
</BasePreviewNode>
```

### 10.4 Styling Consistency

**Colors** (from COLORS constant):
- Primary Green: `#2ECC71` (positive votes, agreement)
- Primary Red: `#E74C3C` (negative votes, disagreement)
- Primary Blue: `#3498DB` (question nodes)
- Primary Purple: `#9B59B6` (alternative definitions)
- Text Primary: White with varying opacity

**Typography** (Inter font):
- Title: 14px, weight 500
- Content (detail): 16px, weight 400
- Content (preview): 12px, weight 400
- Stats: 12px, weight 400-600
- Metadata: 10px, weight 400

**Spacing**:
- ContentBox padding: 0-15px (node type specific)
- Section spacing: 0-10px (node type specific)
- Button positioning: `radius * 0.7071` (45° angle from center)

### 10.5 Event Consistency

**All Node Components Dispatch**:
```typescript
dispatch('modeChange', { 
  nodeId: string, 
  mode: NodeMode, 
  position: { x: number, y: number } 
});

dispatch('visibilityChange', { 
  isHidden: boolean 
});
```

**Voting Components Dispatch**:
```typescript
dispatch('vote', { 
  voteType: VoteStatus 
});
```

**Button Components Dispatch**:
```typescript
dispatch('click', void);

dispatch('modeChange', { 
  mode: NodeMode, 
  position: { x, y }, 
  nodeId: string 
});
```

---

## 11. Development Patterns

### 11.1 Adding a New Node Type

**Step 1: Define Data Type**
```typescript
// In src/lib/types/domain/nodes.ts
export interface NewNodeType {
  id: string;
  content: string;
  createdBy: string;
  publicCredit: boolean;
  positiveVotes: number;
  negativeVotes: number;
  // ... other properties
}
```

**Step 2: Add Type Guard**
```typescript
// In src/lib/types/graph/enhanced.ts
export function isNewNodeData(data: any): data is NewNodeType {
  return data && 
    typeof data === 'object' && 
    'content' in data &&
    // ... other checks
}
```

**Step 3: Create Component**
```svelte
<!-- NewNodeNode.svelte -->
<script lang="ts">
  import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
  import { isNewNodeData } from '$lib/types/graph/enhanced';
  import BasePreviewNode from '../base/BasePreviewNode.svelte';
  import BaseDetailNode from '../base/BaseDetailNode.svelte';
  import VoteButtons from '../ui/VoteButtons.svelte';
  import VoteStats from '../ui/VoteStats.svelte';
  import NodeHeader from '../ui/NodeHeader.svelte';
  import ContentBox from '../ui/ContentBox.svelte';
  
  export let node: RenderableNode;
  
  if (!isNewNodeData(node.data)) {
    throw new Error('Invalid node data type');
  }
  
  const nodeData = node.data as NewNodeType;
  
  // ... standard extraction pattern
</script>

{#if node.mode === 'detail'}
  <BaseDetailNode {node} on:modeChange>
    <!-- Detail implementation -->
  </BaseDetailNode>
{:else}
  <BasePreviewNode {node} on:modeChange>
    <!-- Preview implementation -->
  </BasePreviewNode>
{/if}
```

**Step 4: Add to NodeRenderer**
```svelte
<!-- In NodeRenderer.svelte -->
{#if node.type === 'new-type'}
  <NewNodeNode {node} on:modeChange on:visibilityChange />
{:else if ...}
```

**Step 5: Configure ContentBox**
```typescript
// In ContentBox.svelte LAYOUT_CONFIGS
'new-type': {
  horizontalPadding: 10,
  verticalPadding: 15,
  sectionSpacing: 8,
  // ... other config
}

// In LAYOUT_RATIOS
'new-type': {
  detail: { content: 0.60, voting: 0.25, stats: 0.15 },
  preview: { content: 0.65, voting: 0.35, stats: 0 }
}
```

**Step 6: Add Size Constants**
```typescript
// In COORDINATE_SPACE constant
CONTENT_BOXES: {
  NEW_TYPE: {
    DETAIL: 600,
    PREVIEW: 320
  }
}
```

### 11.2 Modifying Existing Node Type

**Golden Rule**: Maintain consistency with other node types

**Checklist**:
- ✅ Does it use BasePreviewNode/BaseDetailNode?
- ✅ Does it use ContentBox?
- ✅ Does it follow the slot pattern?
- ✅ Does it use shared UI components?
- ✅ Does it extract data reactively?
- ✅ Does it handle events correctly?
- ✅ Is styling consistent with other nodes?

**Common Modifications**:

**Adding a new field**:
```svelte
<script>
  // Extract from nodeData
  $: newField = nodeData.newField;
</script>

<!-- Display in appropriate slot -->
<svelte:fragment slot="content" let:x let:y let:width let:height>
  <foreignObject {x} {y} {width} {height}>
    <div class="new-field">{newField}</div>
  </foreignObject>
</svelte:fragment>
```

**Changing layout proportions**:
```typescript
// In ContentBox.svelte LAYOUT_RATIOS
'node-type': {
  detail: { 
    content: 0.55,  // Changed from 0.60
    voting: 0.25,   // Same
    stats: 0.20     // Changed from 0.15
  }
}
```

### 11.3 Debugging Patterns

**Enable ContentBox Borders**:
```svelte
<script>
  const DEBUG_SHOW_BORDERS = true;
</script>

<ContentBox nodeType={node.type} mode="detail" showBorder={DEBUG_SHOW_BORDERS}>
```

**Log Data Extraction**:
```svelte
<script>
  $: {
    console.log('[NodeType] Data:', {
      nodeData,
      positiveVotes,
      negativeVotes,
      netVotes,
      userVoteStatus
    });
  }
</script>
```

**Trace Event Flow**:
```svelte
<script>
  function handleModeChange(event) {
    console.log('[NodeType] Mode change:', event.detail);
    dispatch('modeChange', event.detail);
  }
</script>
```

### 11.4 Testing Patterns

**Component Testing**:
```typescript
import { render } from '@testing-library/svelte';
import StatementNode from './StatementNode.svelte';

test('renders preview mode', () => {
  const node = {
    id: 'test-1',
    type: 'statement',
    mode: 'preview',
    radius: 226,
    data: {
      statement: 'Test statement',
      positiveVotes: 5,
      negativeVotes: 2
    }
  };
  
  const { getByText } = render(StatementNode, { props: { node } });
  expect(getByText('Test statement')).toBeInTheDocument();
});
```

**Behaviour Testing**:
```typescript
import { createVoteBehaviour } from './behaviours';

test('handles vote correctly', async () => {
  const behaviour = createVoteBehaviour('test-node', 'statement');
  
  await behaviour.initialize({ 
    positiveVotes: 5, 
    negativeVotes: 2 
  });
  
  const success = await behaviour.handleVote('agree');
  expect(success).toBe(true);
  
  const state = behaviour.getCurrentState();
  expect(state.userVoteStatus).toBe('agree');
});
```

### 11.5 Performance Patterns

**Avoid Unnecessary Reactivity**:
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

**Memoize Expensive Calculations**:
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

**Debounce User Input**:
```svelte
<script>
  let searchTimeout;
  
  function handleSearchInput(value) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(value);
    }, 300);
  }
</script>
```

---

## Summary

The node component architecture is a **well-structured, consistent system** built on:

1. **Composition**: Base components + Specific node types + Shared UI
2. **Separation of Concerns**: Clear layer boundaries and responsibilities
3. **ContentBox System**: Standardized, configurable layout
4. **Data-Driven**: Extract from props, react to changes
5. **Behaviour Abstraction**: Optional, for complex shared logic
6. **Consistent Patterns**: Naming, structure, slots, events

**For Developers**:
- Follow existing patterns for new node types
- Use data extraction pattern by default
- Leverage ContentBox for layout
- Reuse shared UI components
- Maintain consistency with other nodes
- Keep logic simple and explicit

**Key Files to Reference**:
- `BaseNode.svelte`, `BasePreviewNode.svelte`, `BaseDetailNode.svelte`
- `ContentBox.svelte`
- `StatementNode.svelte`, `OpenQuestionNode.svelte` (examples)
- `VoteButtons.svelte`, `VoteStats.svelte` (UI components)
- `behaviours/index.ts` (optional behaviours)

---

**End of Node Components Architecture Documentation**