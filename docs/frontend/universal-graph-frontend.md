# Universal Graph - Frontend Architecture & Development Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Organization](#file-organization)
4. [Data Flow](#data-flow)
5. [Core Concepts](#core-concepts)
6. [Type System](#type-system)
7. [Rendering Pipeline](#rendering-pipeline)
8. [Node Types](#node-types)
9. [Configuration](#configuration)
10. [Common Patterns](#common-patterns)
11. [Adding Features](#adding-features)
12. [Debugging](#debugging)
13. [Known Issues & Future Work](#known-issues--future-work)

---

## Overview

The Universal Graph is a sophisticated D3-based force-directed graph visualization that displays all content node types (statements, questions, answers, quantities, evidence) in a single unified view. It features:

- **Vote-based positioning**: Higher-voted content appears closer to center
- **Progressive rendering**: Nodes revealed smoothly after settling
- **Batch/sequential rendering**: Handles large datasets efficiently
- **Smart opacity control**: Smooth reveal animations
- **Consolidated relationships**: Multiple connections represented as single enhanced links

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     +page.svelte                             │
│  - Route handler & orchestrator                              │
│  - Manages filters, sorting, user state                      │
│  - Transforms backend data to graph format                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              universalGraphStore.ts                          │
│  - Fetches data from backend API                             │
│  - Caches nodes and relationships                            │
│  - Provides reactive stores for UI                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Graph.svelte                               │
│  - Root graph component                                      │
│  - Creates/binds GraphStore                                  │
│  - Handles graph lifecycle                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│            UniversalGraphManager.ts                          │
│  - Central coordinator for Universal Graph                   │
│  - Transforms GraphNode → EnhancedNode                       │
│  - Orchestrates all subsystems                               │
└─────┬──────┬──────┬──────┬──────┬───────────────────────────┘
      │      │      │      │      │
      ▼      ▼      ▼      ▼      ▼
  ┌─────┐ ┌────┐ ┌────┐ ┌────┐ ┌─────┐
  │Pos. │ │Ren.│ │D3  │ │Opac│ │Force│
  │ition│ │der │ │Sim │ │ity │ │ Cfg │
  └─────┘ └────┘ └────┘ └────┘ └─────┘
```

### Component Hierarchy

```
+page.svelte
  └── Graph.svelte
       ├── LinkRenderer.svelte
       │    └── Individual link components
       └── NodeRenderer.svelte
            ├── StatementNode.svelte
            ├── OpenQuestionNode.svelte
            ├── AnswerNode.svelte
            ├── QuantityNode.svelte
            ├── EvidenceNode.svelte
            ├── NavigationNode.svelte
            ├── ControlNode.svelte (Universal controls)
            └── DashboardNode.svelte
```

---

## File Organization

### Core Routes & Pages
```
src/routes/universal/
├── +page.svelte           # Main route component
├── +page.ts              # Data loading & transformation
└── README.md             # Route-specific documentation
```

### Stores
```
src/lib/stores/
├── universalGraphStore.ts    # API data fetching & caching
├── graphStore.ts             # Graph state management
├── visibilityPreferenceStore.ts  # User visibility preferences
└── unitPreferenceStore.ts    # Quantity unit preferences
```

### Graph Components
```
src/lib/components/graph/
├── Graph.svelte              # Root graph component
├── links/
│   └── LinkRenderer.svelte   # Link rendering & opacity
└── nodes/
    ├── NodeRenderer.svelte   # Node routing component
    ├── statement/StatementNode.svelte
    ├── openquestion/OpenQuestionNode.svelte
    ├── answer/AnswerNode.svelte
    ├── quantity/QuantityNode.svelte
    ├── evidence/EvidenceNode.svelte
    └── [other node types]/
```

### Universal Graph Services
```
src/lib/services/graph/
├── UniversalGraphManager.ts      # Main coordinator (1787 lines)
└── universal/
    ├── UniversalConstants.ts     # Tunable constants
    ├── UniversalForceConfig.ts   # D3 force parameters
    ├── UniversalPositioning.ts   # Vote-based positioning
    ├── UniversalRenderingStrategy.ts  # Batch/sequential rendering
    ├── UniversalD3Simulation.ts  # D3 simulation lifecycle
    └── UniversalOpacityController.ts  # Opacity & reveal animations
```

### Type Definitions
```
src/lib/types/
├── graph/
│   └── enhanced.ts          # Core graph types
└── domain/
    ├── nodes.ts            # Node data types
    └── user.ts             # User profile types
```

---

## Data Flow

### 1. Initial Load

```
Backend API
    ↓ (GET /graph/universal/nodes)
universalGraphStore.loadNodes()
    ↓ (returns UniversalNodeData[])
+page.svelte.transformNodeData()
    ↓ (creates GraphNode[])
Graph.svelte receives data
    ↓
UniversalGraphManager.setData()
    ↓
transformNodes() + transformLinks()
    ↓ (creates EnhancedNode[] + EnhancedLink[])
UniversalRenderingStrategy.startRendering()
    ↓
UniversalPositioning.calculatePositions()
    ↓
UniversalD3Simulation.configureDropPhaseForces()
    ↓
Nodes rendered via NodeRenderer
    ↓
UniversalD3Simulation.startSettlementPhase()
    ↓
UniversalOpacityController.onSettlementComplete()
    ↓
Smooth link reveal animation
```

### 2. Data Transformation Pipeline

```typescript
// Stage 1: Backend data
interface UniversalNodeData {
  id: string;
  type: 'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence';
  content: string;
  inclusionPositiveVotes: number;
  inclusionNegativeVotes: number;
  // ... more fields
}

// Stage 2: Graph data (in +page.svelte)
interface GraphNode {
  id: string;
  type: NodeType;
  data: StatementNode | OpenQuestionNode | AnswerNode | QuantityNode | EvidenceNode;
  group: NodeGroup;
  metadata?: NodeMetadata;
}

// Stage 3: Enhanced node (in UniversalGraphManager)
interface EnhancedNode extends GraphNode {
  radius: number;
  x: number | null;
  y: number | null;
  vx: number | null;
  vy: number | null;
  fx: number | null;
  fy: number | null;
  opacity?: number;
  isHidden?: boolean;
  // D3 simulation properties
}

// Stage 4: Renderable node (in Graph.svelte)
interface RenderableNode extends EnhancedNode {
  position: NodePosition;  // SVG transform string
  style: NodeStyle;        // Colors, strokes, etc.
}
```

### 3. Critical Field Mappings

**AnswerNode:**
```typescript
// Backend → Manager transformation
{
  content: string              → answerText: string
  metadata.discussionId        → questionId: string (REQUIRED for type guard)
  metadata.votes.inclusion     → inclusionPositiveVotes/negativeVotes/netVotes
  metadata.votes.content       → contentPositiveVotes/negativeVotes/netVotes
  categories: array           → categories: array
  keywords: array             → keywords: array
}
```

**QuantityNode:**
```typescript
{
  content: string              → question: string
  data.unitCategoryId          → unitCategoryId: string (REQUIRED)
  data.defaultUnitId           → defaultUnitId: string (REQUIRED)
  metadata.votes               → vote fields (content falls back to inclusion)
  categories/keywords          → arrays
}
```

**EvidenceNode:**
```typescript
{
  content: string              → title: string
  data.url OR metadata.sourceUrl → url: string (REQUIRED)
  data.parentNodeId OR metadata.parentNode → parentNodeId: string (REQUIRED)
  data.evidenceType OR metadata.evidenceType → evidenceType: string (REQUIRED)
  description/authors/publicationDate → additional fields
  metadata.votes               → vote fields (content falls back to inclusion)
}
```

---

## Core Concepts

### 1. Vote-Based Positioning

**Principle:** Higher-voted content appears closer to center.

**Implementation:**
- `UniversalPositioning.sortNodesByVotes()` - Sorts by net votes (positive - negative)
- `calculateSingleNodePositions()` - Places nodes in golden angle spiral
- Distance formula: `baseDistance + sqrt(index) * distanceIncrement * 2`

**Golden Angle Spiral:**
```typescript
const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.399 radians ≈ 137.5°
angle = index * goldenAngle;
x = cos(angle) * targetDistance;
y = sin(angle) * targetDistance;
```

This creates an even distribution without clustering.

### 2. Two-Phase Rendering

**Phase 1: Drop Phase**
- Nodes pinned to calculated positions (fx/fy set)
- Minimal forces (weak collision, weak charge)
- Fast alpha decay for quick settling
- Nodes hidden (opacity = 0)

**Phase 2: Settlement Phase**
- All pins removed (fx/fy = null)
- Natural forces applied (charge, collision, soft radial, angular)
- Nodes find natural equilibrium
- After settling: smooth opacity reveal

**Why two phases?**
- Drop phase: Fast, predictable placement
- Settlement: Natural spacing, no overlaps
- Users see smooth result, not chaotic simulation

### 3. Progressive Opacity Reveal

**Node Reveal:**
- During drop phase: opacity = 0 (hidden)
- After settlement: gradual fade-in over 2 seconds
- Staggered reveal based on position/votes

**Link Reveal:**
- Links only render AFTER settlement complete
- Sophisticated staggered reveal over 4 seconds
- Individual link progress tracked
- Smooth easing functions for organic feel

**Configuration:**
```typescript
// In UniversalOpacityController
{
  revealDuration: 2000,           // Node reveal duration
  linkRevealDuration: 4000,       // Link reveal duration
  linkRevealDelay: 500,           // Wait after nodes before links
  linkStaggerDuration: 3000       // Stagger links over 3 seconds
}
```

### 4. Batch vs Sequential Rendering

**Sequential (Single-Node) Mode:**
- Renders nodes one at a time
- Each node drops → unpins → next node
- Delay between nodes: 50ms
- Good for: Dramatic reveals, small datasets

**Batch Mode:**
- Renders groups of nodes (10 per batch)
- All nodes in batch drop together
- Delay between batches: 500ms
- Good for: Large datasets, faster loading

**Configuration:**
```typescript
// In +page.svelte or constants
enableBatchRendering: true,      // Enable batch mode
enableSingleNodeMode: true,      // If true, single-node; if false, batch
maxBatchesToRender: 4,           // Max batches to render
```

### 5. Content Node Type Filters

**CRITICAL PATTERN:** All subsystems must include all 5 content types.

**The Filter:**
```typescript
// CORRECT ✅
node.type === 'statement' || node.type === 'openquestion' ||
node.type === 'answer' || node.type === 'quantity' || node.type === 'evidence'

// WRONG ❌ (only 2 types)
node.type === 'statement' || node.type === 'openquestion'
```

**Where it's used:**
- UniversalPositioning: 4 locations
- UniversalRenderingStrategy: 2 locations
- UniversalD3Simulation: 6 locations
- UniversalOpacityController: 3 locations

**Why it matters:**
- Positioning: Only filtered nodes get positioned
- Settlement: Only filtered nodes checked for settling
- Opacity: Only filtered nodes get reveal animation
- Missing types → nodes appear chaotically

---

## Type System

### Core Type Hierarchy

```typescript
// 1. Node Types (what kind of node)
type NodeType = 
  | 'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence'  // Content
  | 'navigation' | 'dashboard' | 'control'                              // System
  | 'word' | 'definition' | 'comment' | 'category';                     // Other

// 2. Node Groups (for layout)
type NodeGroup = 
  | 'central'           // Dashboard at center
  | 'navigation'        // Nav ring around center
  | 'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence'  // Content
  | 'control';          // Control panel

// 3. Node Mode (display state)
type NodeMode = 'preview' | 'detail';

// 4. Link Types
type LinkType = 
  | 'shared_keyword'    // Nodes share keywords
  | 'responds_to'       // Answer → Question
  | 'evidence_for'      // Evidence → Statement/Answer/Quantity
  | 'related_to'        // General relationship
  | 'shared_category'   // Nodes share category
  | 'answers';          // Question → Answer
```

### Node Data Types

Each node type has specific data structure:

```typescript
// StatementNode
interface StatementNode {
  statement: string;
  positiveVotes: number;
  negativeVotes: number;
  netVotes: number;
  categories?: Array<{id: string; name: string}>;
  keywords?: Array<{word: string; frequency: number}>;
}

// OpenQuestionNode
interface OpenQuestionNode {
  questionText: string;
  answerCount: number;
  positiveVotes: number;
  negativeVotes: number;
  netVotes: number;
}

// AnswerNode
interface AnswerNode {
  answerText: string;
  questionId: string;  // REQUIRED for type guard
  inclusionPositiveVotes: number;
  inclusionNegativeVotes: number;
  inclusionNetVotes: number;
  contentPositiveVotes: number;
  contentNegativeVotes: number;
  contentNetVotes: number;
}

// QuantityNode
interface QuantityNode {
  question: string;
  unitCategoryId: string;  // REQUIRED for type guard
  defaultUnitId: string;   // REQUIRED for type guard
  inclusionPositiveVotes: number;
  // ... (content votes fall back to inclusion)
}

// EvidenceNode
interface EvidenceNode {
  title: string;
  url: string;            // REQUIRED for type guard
  evidenceType: string;   // REQUIRED for type guard
  parentNodeId: string;   // REQUIRED for type guard
  description?: string;
  authors?: string[];
  publicationDate?: string;
}
```

### Type Guards

**Purpose:** Validate node data structure at runtime.

```typescript
// In enhanced.ts
export const isAnswerData = (data: any): data is AnswerNode =>
  data && 'answerText' in data && 'questionId' in data;

export const isQuantityData = (data: any): data is QuantityNode =>
  data && 'question' in data && 'unitCategoryId' in data && 'defaultUnitId' in data;

export const isEvidenceData = (data: any): data is EvidenceNode =>
  data && 'title' in data && 'url' in data && 'evidenceType' in data && 'parentNodeId' in data;
```

**Where used:** Each node component validates data on mount:

```typescript
// In AnswerNode.svelte
if (!isAnswerData(node.data)) {
  throw new Error('Invalid node data type for AnswerNode');
}
```

**Critical:** If UniversalGraphManager doesn't provide required fields, type guards fail and nodes don't render.

---

## Rendering Pipeline

### 1. NodeRenderer Routing

```svelte
<!-- NodeRenderer.svelte -->
{#if node.type === 'statement'}
  <StatementNode {node} ... />
{:else if node.type === 'openquestion'}
  <OpenQuestionNode {node} ... />
{:else if node.type === 'answer'}
  <AnswerNode {node} ... />
{:else if node.type === 'quantity'}
  <QuantityNode {node} ... />
{:else if node.type === 'evidence'}
  <EvidenceNode {node} ... />
{:else if node.type === 'navigation'}
  <NavigationNode {node} ... />
<!-- etc -->
{/if}
```

### 2. Link Opacity System

**Three-Layer System:**

1. **Visual Opacity** (sophisticated calculation)
   - Based on relationship type, strength, consolidation
   - Cached in `visualOpacityCache`
   - Calculated once per link

2. **Reveal Factor** (0-1 during animation)
   - Individual per-link progress
   - Smooth easing applied
   - Tracked in `linkRevealProgress`

3. **Final Opacity** (visual × reveal)
   ```typescript
   finalOpacity = visualOpacity * revealFactor;
   ```

**CSS Custom Properties:**
```typescript
// Set per link
root.style.setProperty(`--link-${linkId}-opacity`, opacity.toString());
```

```css
/* In LinkRenderer */
.link {
  opacity: var(--link-{linkId}-opacity, 0);
  transition: opacity 0.3s ease;
}
```

### 3. SVG Transform System

**Coordinate Spaces:**
```typescript
const COORDINATE_SPACE = {
  WORLD: {
    WIDTH: 10000,
    HEIGHT: 10000,
    CENTER_X: 5000,
    CENTER_Y: 5000
  },
  VIEWPORT: {
    // User's screen dimensions
  }
};
```

**Transform Calculation:**
```typescript
// In coordinateSystem.ts
position = {
  x: node.x + COORDINATE_SPACE.WORLD.CENTER_X,
  y: node.y + COORDINATE_SPACE.WORLD.CENTER_Y,
  svgTransform: `translate(${x}, ${y})`
};
```

**Why?**
- D3 simulation uses centered coordinates (0,0 = center)
- SVG needs positive coordinates
- Transform abstracts this away

---

## Node Types

### Content Nodes (Positioned by Votes)

| Type | Color | Icon | Special Features |
|------|-------|------|------------------|
| Statement | Yellow | 💬 | Dual voting (inclusion + content) |
| OpenQuestion | Cyan | ❓ | Shows answer count |
| Answer | Blue | 💡 | Links to parent question, dual voting |
| Quantity | Orange | 📊 | Unit selection, visualization |
| Evidence | Purple | 📄 | Links to source, parent node |

### System Nodes (Fixed Positions)

| Type | Purpose | Position |
|------|---------|----------|
| Dashboard | Central hub | (0, 0) - exact center |
| Navigation | Menu options | Circular ring around center |
| Control | Universal filters | Control panel position |

### Node Component Structure

All content node components follow this pattern:

```svelte
<script lang="ts">
  export let node: RenderableNode;
  
  // Type validation
  if (!isXxxData(node.data)) {
    throw new Error('Invalid node data type');
  }
  
  // Extract data
  let xxxData = node.data;
  $: displayField = xxxData.field;
  
  // Vote handling
  $: inclusionPositiveVotes = getNeo4jNumber(xxxData.inclusionPositiveVotes) || 0;
  // ...
  
  // Mode switching
  $: isDetail = node.mode === 'detail';
</script>

{#if isDetail}
  <BaseDetailNode {node} ...>
    <!-- Detail view content -->
  </BaseDetailNode>
{:else}
  <BasePreviewNode {node} ...>
    <!-- Preview view content -->
  </BasePreviewNode>
{/if}
```

---

## Configuration

### UniversalConstants.ts

**Positioning:**
```typescript
POSITIONING: {
  BASE_DISTANCE: 250,           // First node distance from center
  DISTANCE_INCREMENT: 40,       // Distance per vote rank
  GOLDEN_ANGLE: 2.399...       // Spiral angle
  ANGLE_JITTER: 0.3            // Random variation
}
```

**Timing:**
```typescript
TIMING: {
  NODE_RENDER_DELAY: 50,        // Between individual nodes (ms)
  BATCH_RENDER_DELAY: 500,      // Between batches (ms)
  SETTLEMENT_START_DELAY: 300,  // Before settlement starts
  DOM_UPDATE_THROTTLE: 16       // Minimum between DOM updates
}
```

**Limits:**
```typescript
LIMITS: {
  MAX_NODES_TO_RENDER: 40,      // Single-node mode limit
  NODES_PER_BATCH: 10,          // Batch size
  MAX_BATCHES: 4                // Maximum batches
}
```

### UniversalForceConfig.ts

**Drop Phase:**
```typescript
DROP_PHASE: {
  CHARGE: {
    STRENGTH: -100,             // Weak repulsion
    DISTANCE_MIN: 30,
    DISTANCE_MAX: 400
  },
  COLLISION: {
    STRENGTH: 0.5,              // Weak collision
    ITERATIONS: 1               // Fast performance
  }
}
```

**Settlement Phase:**
```typescript
SETTLEMENT_PHASE: {
  CHARGE: {
    STRENGTH: -400,             // Moderate repulsion
    DISTANCE_MIN: 80,
    DISTANCE_MAX: 1000
  },
  COLLISION: {
    STRENGTH: 0.8,              // Strong collision avoidance
    ITERATIONS: 3               // Better accuracy
  },
  SOFT_RADIAL: {
    STRENGTH_MULTIPLIER: 0.001  // Gentle radial constraint
  }
}
```

**Tuning Tips:**
- Increase CHARGE.STRENGTH (more negative) → More spacing
- Increase COLLISION.STRENGTH → Less overlap
- Increase SOFT_RADIAL → Nodes stick closer to vote-based distance
- Decrease VELOCITY_DECAY → Longer settling time
- Increase ALPHA_DECAY → Faster settling

---

## Common Patterns

### 1. Adding Support for New Node Type

**Required Changes (8 files):**

1. **enhanced.ts** - Add type to unions
```typescript
type NodeType = ... | 'newtype';
type NodeGroup = ... | 'newtype';
```

2. **enhanced.ts** - Add type guard
```typescript
export const isNewTypeData = (data: any): data is NewTypeNode =>
  data && 'requiredField' in data;
```

3. **UniversalGraphManager.ts** - Add data transformation
```typescript
} else if (node.type === 'newtype') {
  nodeData = {
    ...nodeData,
    requiredField: node.data.requiredField,
    // ... all required fields
  };
}
```

4. **UniversalPositioning.ts** - Add to filters (4 locations)
```typescript
node.type === 'statement' || ... || node.type === 'newtype'
```

5. **UniversalRenderingStrategy.ts** - Add to filters (2 locations)

6. **UniversalD3Simulation.ts** - Add to filters (6 locations)

7. **UniversalOpacityController.ts** - Add to filters (3 locations)

8. **Graph.svelte** - Add import and case
```typescript
import NewTypeNode from './nodes/newtype/NewTypeNode.svelte';

<!-- In template -->
{:else if node.type === 'newtype'}
  <NewTypeNode {node} ... />
```

9. **+page.svelte** - Add to transformation
```typescript
case 'newtype':
  nodeData = {
    ...commonProperties,
    requiredField: node.content,
    // ...
  };
```

### 2. Debugging Opacity Issues

**Symptoms:**
- Nodes visible during settling
- No smooth reveal
- Links appear immediately

**Check:**
1. Type filters include all types?
2. `setInitialNodeOpacity` setting opacity = 0?
3. `getSortedContentNodes` including type?
4. Settlement completing correctly?

**Console logs to check:**
```
[OpacityController] Node reveal sequence complete
[OpacityController] Settlement complete, starting smooth link reveal
[D3Simulation] Nodes settled!
```

### 3. Vote Data Access Pattern

**Always use getNeo4jNumber:**
```typescript
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';

const positiveVotes = getNeo4jNumber(votes?.positive) || 0;
```

**Why:** Neo4j returns Integer objects, not JavaScript numbers.

### 4. Reactive Data Pattern

```typescript
// Component receives node
export let node: RenderableNode;

// Extract data reactively
let nodeData = node.data;

// Reactive statements for derived values
$: displayText = nodeData.field;
$: isDetail = node.mode === 'detail';
```

**DON'T:**
```typescript
const nodeData = node.data;  // ❌ Not reactive
```

---

## Adding Features

### Adding a New Filter

**Example: Add "Author" filter**

1. **Add to +page.svelte state:**
```typescript
let filterByAuthor: string = '';
```

2. **Update universalGraphStore call:**
```typescript
await universalGraphStore.loadNodes({
  // ... existing params
  createdBy: filterByAuthor || undefined
});
```

3. **Add to ControlNode UI:**
```svelte
<input bind:value={filterByAuthor} placeholder="Filter by author..." />
```

4. **Backend should support the filter** (check API docs)

### Adding a New Relationship Type

1. **Add to LinkType union in enhanced.ts:**
```typescript
type LinkType = ... | 'new_relationship_type';
```

2. **Add visual properties in UniversalOpacityController:**
```typescript
} else if (link.type === 'new_relationship_type') {
  baseOpacity = 0.8;
}
```

3. **Add to LinkRenderer styling:**
```typescript
case 'new_relationship_type':
  strokeColor = '#FF00FF';
  strokeWidth = 2;
  break;
```

### Adding Node Metadata Display

**Pattern:** Add to BaseDetailNode or BasePreviewNode slots

```svelte
<!-- In your node component -->
<BaseDetailNode {node} ...>
  <svelte:fragment slot="metadata">
    <NodeMetadata
      group={getMetadataGroup()}
      {node}
      additionalInfo={{
        newField: nodeData.newField
      }}
    />
  </svelte:fragment>
</BaseDetailNode>
```

---

## Debugging

### Console Logging Strategy

**Critical logs (always on):**
- Settlement phase transitions
- Dormant state changes
- Reveal completion
- Error conditions

**Reduced logs (every N ticks):**
- Settlement progress (every 100 ticks, not every tick)
- Drop phase progress (every 100 ticks)

**Development only:**
```typescript
if (import.meta.env.DEV) {
  console.log('[Debug] ...');
}
```

### Common Issues & Solutions

**Issue: Nodes not rendering**
- Check: Type guard in component passing?
- Check: Required fields present in node.data?
- Check: NodeRenderer has case for type?
- Console: Look for "Invalid node data type" error

**Issue: Nodes visible during settling**
- Check: Type included in opacity filters?
- Check: `setInitialNodeOpacity` sets opacity = 0?
- Check: Settlement completing (logs show "Nodes settled")?

**Issue: Links not appearing**
- Check: `linkRenderingEnabled = true`?
- Check: Settlement completed?
- Console: Look for "Link reveal animation complete"

**Issue: Chaotic positioning**
- Check: Type included in positioning filters?
- Check: Votes being extracted correctly?
- Check: `calculateSingleNodePositions` called?

**Issue: TypeScript errors on metadata**
- Check: Field added to NodeMetadata interface in enhanced.ts?
- Check: Field is optional (`field?: type`)?

### Debug Tools

**Force reveal all (skip animations):**
```typescript
// In browser console
universalGraphManager.opacityController.forceRevealAll(nodes);
```

**Check rendering stats:**
```typescript
const stats = renderingStrategy.getRenderingStats();
console.log(stats);
// { mode, currentIndex, renderedNodes, totalNodes, ... }
```

**Inspect node data:**
```typescript
// In component
console.log('[ComponentName] Node data:', node.data);
console.log('[ComponentName] Node metadata:', node.metadata);
```

---

## Known Issues & Future Work

### Current Limitations

1. **No dynamic node addition** - All nodes loaded upfront
2. **Limited to 200 nodes** - Performance degrades beyond
3. **No node deletion** - Can only hide nodes
4. **No live updates** - Must refresh to see new content
5. **No multi-select** - Can only interact with one node at a time

### Planned Features

**High Priority:**
- [ ] Infinite scroll / pagination for large datasets
- [ ] Real-time updates via WebSocket
- [ ] Node creation from graph view
- [ ] Link creation between nodes
- [ ] Advanced filtering (date ranges, vote ranges, categories)
- [ ] Export graph as image/SVG

**Medium Priority:**
- [ ] Multiple layout algorithms (grid, hierarchical, etc.)
- [ ] Zoom to node/subgraph
- [ ] Minimap for large graphs
- [ ] Path highlighting between nodes
- [ ] Clustering by category/keyword
- [ ] Search within graph

**Low Priority:**
- [ ] 3D mode
- [ ] Time-based animations (show graph evolution)
- [ ] Collaborative editing
- [ ] Graph comparison view

### Performance Optimization Opportunities

1. **Virtual rendering** - Only render visible nodes
2. **Canvas fallback** - Use canvas for >500 nodes
3. **Web Workers** - Offload force simulation
4. **Link bundling** - Bundle parallel links
5. **LOD (Level of Detail)** - Simplify distant nodes

### Architecture Improvements

1. **Separate concerns** - Split UniversalGraphManager into smaller services
2. **Event bus** - Decouple components
3. **State machine** - Formalize graph lifecycle
4. **Plugin system** - Modular node types
5. **Configuration UI** - User-adjustable constants

---

## Quick Reference

### Essential Files

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| UniversalGraphManager.ts | Main coordinator | 1787 | High |
| UniversalD3Simulation.ts | D3 lifecycle | 655 | High |
| UniversalOpacityController.ts | Opacity/reveal | 812 | Medium |
| UniversalPositioning.ts | Vote positioning | ~250 | Medium |
| UniversalRenderingStrategy.ts | Batch/sequential | ~350 | Medium |
| +page.svelte | Route/filters | ~800 | Medium |
| Graph.svelte | Root component | ~900 | Medium |

### Key Constants

```typescript
// Positioning
BASE_DISTANCE: 250          // First node from center
GOLDEN_ANGLE: 2.399...     // Spiral distribution

// Timing
NODE_RENDER_DELAY: 50ms     // Between nodes
BATCH_RENDER_DELAY: 500ms   // Between batches
SETTLEMENT_DELAY: 300ms     // Before settlement

// Forces
CHARGE_STRENGTH: -400       // Node repulsion
COLLISION_STRENGTH: 0.8     // Overlap prevention
VELOCITY_DECAY: 0.4         // Movement damping

// Limits
MAX_NODES: 40              // Single-node limit
NODES_PER_BATCH: 10        // Batch size
MAX_BATCHES: 4             // Total batches
```

### Content Type Filter

**Copy-paste for any filter location:**
```typescript
node.type === 'statement' || node.type === 'openquestion' ||
node.type === 'answer' || node.type === 'quantity' || node.type === 'evidence'
```

### Type Guard Template

```typescript
export const isXxxData = (data: any): data is XxxNode =>
  data && 'requiredField1' in data && 'requiredField2' in data;
```

---

## Conclusion

The Universal Graph is a sophisticated system with many moving parts. Key principles:

1. **All 5 content types must be included** in all filters
2. **Data transformation is critical** - type guards depend on correct fields
3. **Two-phase rendering** enables smooth aesthetics
4. **Opacity system** controls user experience
5. **Configuration over hardcoding** - use constants

When in doubt:
- Check the type filters
- Verify required fields are extracted
- Look at console logs for lifecycle events
- Compare with working node types (statement/openquestion)

For questions or issues, refer to:
- This document for architecture
- Individual file comments for implementation details
- Type definitions in enhanced.ts for data structures
- Console logs for runtime behavior

---

**Document Version:** 1.0  
**Last Updated:** Session completing 5 node types implementation  
**Status:** Complete and tested  
**Next Review:** When adding new node types or major features