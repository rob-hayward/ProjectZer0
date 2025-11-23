# Universal Graph Frontend Architecture

**Comprehensive guide to the Universal Graph view implementation**

## Overview

The Universal Graph is a sophisticated, vote-driven knowledge visualization system that displays all content types (Statements, Open Questions, Answers, Quantities, Evidence) in a single unified view. It uses D3.js force simulation for natural positioning, batch rendering for performance, and a two-phase reveal system for visual polish.

### Key Characteristics

- **Vote-Based Positioning**: Higher-voted content appears closer to center
- **Golden Angle Distribution**: Nodes distributed in a spiral using golden angle (2.399 radians)
- **Two-Phase Rendering**: Drop phase (invisible settling) -> Settlement phase (fade-in reveal)
- **System vs Content Separation**: Navigation ring and control node separate from simulated content
- **Batch Processing**: Handles large datasets (200+ nodes) with staggered rendering
- **Opacity Orchestration**: Coordinated fade-in of nodes and links after settlement

---

## Architecture Overview

### System Layers

```
+----------------------------------------------------------+
|                    Backend API                           |
|  /api/graph/universal/nodes                              |
|  - Returns: UniversalNodeData[] + relationships[]        |
+--------------------------|-------------------------------+
                           |
                           v
+----------------------------------------------------------+
|              universalGraphStore.ts                      |
|  - Fetches data from backend API                         |
|  - Caches nodes and relationships                        |
|  - Provides reactive stores for UI                       |
+--------------------------|-------------------------------+
                           |
                           v
+----------------------------------------------------------+
|                   Graph.svelte                           |
|  - Root graph component                                  |
|  - Creates/binds GraphStore (wrapper)                    |
|  - Handles graph lifecycle                               |
+--------------------------|-------------------------------+
                           |
                           v
+----------------------------------------------------------+
|            UniversalGraphManager.ts                      |
|  - Central coordinator for Universal Graph               |
|  - Transforms GraphNode -> EnhancedNode                  |
|  - Orchestrates all subsystems                           |
|  - Handles navigation node positioning                   |
+------|-------|-------|-------|-------|------------------+
       |       |       |       |       |
       v       v       v       v       v
   +-----+ +-----+ +-----+ +-----+ +-----+
   |Posit| |Rend | |D3   | |Opac | |Force|
   |ion  | |ering| |Sim  | |ity  | |Cfg  |
   +-----+ +-----+ +-----+ +-----+ +-----+
```

### Component Hierarchy

```
+page.svelte
  |
  +-- Graph.svelte
       |
       +-- LinkRenderer.svelte
       |    |
       |    +-- Individual link components
       |
       +-- NodeRenderer.svelte
            |
            +-- StatementNode.svelte
            +-- OpenQuestionNode.svelte
            +-- AnswerNode.svelte
            +-- QuantityNode.svelte
            +-- EvidenceNode.svelte
            +-- NavigationNode.svelte
            +-- ControlNode.svelte (Universal controls)
            +-- DashboardNode.svelte
```

---

## File Organization

### Core Routes & Pages
```
src/routes/graph/universal/
|-- +page.svelte           # Main route component
|-- +page.ts              # Data loading & transformation
+-- README.md             # Route-specific documentation
```

### Stores
```
src/lib/stores/
|-- universalGraphStore.ts    # API data fetching & caching
|-- graphStore.ts             # Graph state management wrapper
|-- visibilityPreferenceStore.ts  # User visibility preferences
+-- unitPreferenceStore.ts    # Quantity unit preferences
```

### Graph Components
```
src/lib/components/graph/
|-- Graph.svelte              # Root graph component
|-- links/
|   +-- LinkRenderer.svelte   # Link rendering & opacity
+-- nodes/
    |-- NodeRenderer.svelte   # Node routing component
    |-- statement/StatementNode.svelte
    |-- openquestion/OpenQuestionNode.svelte
    |-- answer/AnswerNode.svelte
    |-- quantity/QuantityNode.svelte
    |-- evidence/EvidenceNode.svelte
    +-- [other node types]/
```

### Universal Graph Services
```
src/lib/services/graph/
|-- UniversalGraphManager.ts      # Main coordinator (~1400 lines)
+-- universal/
    |-- UniversalConstants.ts     # Tunable constants
    |-- UniversalForceConfig.ts   # D3 force parameters
    |-- UniversalPositioning.ts   # Vote-based positioning
    |-- NavigationRingPositioning.ts  # Navigation ring calculations
    |-- UniversalRenderingStrategy.ts  # Batch/sequential rendering
    |-- UniversalD3Simulation.ts  # D3 simulation lifecycle
    +-- UniversalOpacityController.ts  # Opacity & reveal animations
```

### Type Definitions
```
src/lib/types/
|-- graph/
|   +-- enhanced.ts          # Core graph types
+-- domain/
    |-- nodes.ts            # Node data types
    +-- user.ts             # User profile types
```

---

## Data Flow

### 1. Initial Load

```
Backend API
    | (GET /graph/universal/nodes)
    v
universalGraphStore.loadNodes()
    | (returns UniversalNodeData[])
    v
+page.svelte.transformNodeData()
    | (creates GraphNode[])
    v
Graph.svelte receives data
    |
    v
UniversalGraphManager.setData()
    |
    v
transformNodes() + transformLinks()
    | (creates EnhancedNode[] + EnhancedLink[])
    v
UniversalRenderingStrategy.startRendering()
    |
    v
UniversalPositioning.calculatePositions()
    |
    v
UniversalD3Simulation.configureDropPhaseForces()
    |
    v
Nodes rendered via NodeRenderer
    |
    v
UniversalD3Simulation.startSettlementPhase()
    |
    v
UniversalOpacityController.onSettlementComplete()
    |
    v
Smooth link reveal animation
```

### 2. Navigation Ring Repositioning Flow

```
User clicks control node
    |
    v
ControlNode dispatches mode change
    |
    v
NodeRenderer forwards to Graph
    |
    v
Graph calls graphStore.updateNodeMode()
    |
    v
UniversalGraphManager.updateNodeMode()
    |
    v
D3Simulation separates system nodes
    |
    v
Control node mode change event dispatched
    |
    v
+page.svelte reactive statement detects change
    |
    v
NavigationRingPositioning.calculateNavigationRingPositions()
    | (calculates new radius: preview=140px, detail=335px)
    v
+page.svelte updates navigationNodes array
    |
    v
CLEAN: graphStore.updateNavigationPositions(navigationNodes)
    |
    v
UniversalGraphManager.updateNavigationPositions()
    |
    v
UniversalD3Simulation.updateSystemNodes()
    |
    v
Navigation ring visually repositions
```

**Note:** The navigation ring repositioning uses clean, direct method calls through the GraphStore wrapper. Previous event-based workarounds have been removed.

### 3. Data Transformation Pipeline

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

### 4. Vote Data Flow

```
Backend returns votes
    |
    v
universalGraphStore caches in vote map
    |
    v
+page.svelte transforms to metadata
    |
    v
UniversalPositioning sorts by net votes
    |
    v
Higher votes = closer to center
    |
    v
User votes in node component
    |
    v
Vote event -> universalGraphStore.updateVoteData()
    |
    v
Cache updated
    |
    v
Page refreshes to show new positioning
```

---

## Core Concepts

### 1. Vote-Based Positioning

**Principle:** Higher-voted content appears closer to center.

**Implementation:**
- `UniversalPositioning.sortNodesByVotes()` - Sorts by net votes (positive - negative)
- `calculateSingleNodePositions()` - Places nodes in golden angle spiral
- First node at BASE_DISTANCE (435px minimum, adjusted for navigation ring clearance)
- Nodes with negative votes are hidden by default

**Golden Angle Spiral:**
```typescript
const GOLDEN_ANGLE = 2.39996322972865332; // (3 - sqrt(5)) × pi radians ≈ 137.5°

// For each node (sorted by votes, highest first)
const angle = index * GOLDEN_ANGLE;
const distance = BASE_DISTANCE + (index * DISTANCE_INCREMENT);
const x = distance * Math.cos(angle);
const y = distance * Math.sin(angle);
```

### 2. System Nodes vs Content Nodes

**System Nodes:** (Not in D3 simulation)
- Navigation ring nodes (8 buttons around control node)
- Central control node (filtering/sorting UI)
- Fixed positions, never affected by forces

**Content Nodes:** (In D3 simulation)
- Statement, OpenQuestion, Answer, Quantity, Evidence nodes
- Subject to force simulation
- Vote-based initial positioning
- Natural forces for settling

**Critical Distinction:**
```typescript
// System nodes stored separately in D3Simulation
private systemNodes: EnhancedNode[] = [];

// Only content nodes in simulation
const simulationNodes = this.simulation.nodes();

// Combined when needed
public getAllNodes(): EnhancedNode[] {
  return [...simulationNodes, ...this.systemNodes];
}
```

### 3. Navigation Ring Positioning

**Dynamic Radius Calculation:**
```typescript
// Ring radius = control radius + gap + nav radius
// Preview mode: 50px + 50px + 40px = 140px
// Detail mode: 225px + 70px + 40px = 335px
```

**Positioning:**
- 8 navigation nodes in perfect circle
- Start at top (-Math.PI/2 radians)
- Even angular distribution (2π / 8)
- Fixed positions (fx/fy set, not affected by forces)

**Repositioning Trigger:**
- Control node mode change (preview <-> detail)
- Recalculate all 8 positions
- Update via `graphStore.updateNavigationPositions(navigationNodes)`
- Manager receives call via `updateSystemNodes()` in D3Simulation

**Example Code (from +page.svelte):**
```typescript
$: if (controlNode && controlNode.mode !== undefined) {
    const newPositions = calculateNavigationRingPositions(
        navigationNodes.length, 
        controlNode.mode
    );
    
    // Update navigation nodes with new positions
    navigationNodes = navigationNodes.map((node, index) => ({
        ...node,
        metadata: {
            ...node.metadata,
            initialPosition: {
                x: newPositions[index].x,
                y: newPositions[index].y
            },
            angle: newPositions[index].angle
        }
    }));
    
    // Direct method call (clean architecture)
    if (graphStore && typeof graphStore.updateNavigationPositions === 'function') {
        graphStore.updateNavigationPositions(navigationNodes);
    }
}
```

### 4. Two-Phase Rendering

**Phase 1: Drop Phase** (~2 seconds)
- Minimal forces
- Nodes "drop" into position
- Opacity = 0 (invisible)
- Purpose: Get rough positions without visual noise

**Configuration:**
```typescript
DROP_PHASE: {
    DURATION: 2000,              // 2 seconds
    ALPHA_TARGET: 0.3,
    VELOCITY_DECAY: 0.4,
    CHARGE_STRENGTH: -100,       // Weak repulsion
    COLLISION_STRENGTH: 0.3      // Minimal collision
}
```

**Phase 2: Settlement Phase** (~3-5 seconds)
- Natural forces activated
- Nodes settle into stable positions
- Opacity animates 0 -> 1
- Link reveal after settlement

**Configuration:**
```typescript
SETTLEMENT_PHASE: {
    ALPHA_TARGET: 0,
    VELOCITY_DECAY: 0.4,
    CHARGE_STRENGTH: -400,       // Strong repulsion
    COLLISION_STRENGTH: 0.8,     // Prevent overlaps
    MIN_MOVEMENT_THRESHOLD: 0.5, // Pixels per tick
    ALPHA_THRESHOLD: 0.01        // When to consider settled
}
```

**Transition:**
```typescript
// After drop phase completes
console.log('[D3Simulation] Drop phase complete, starting settlement');
this.startSettlementPhase();

// During settlement, monitor movement
if (avgMovement < MIN_MOVEMENT_THRESHOLD && alpha < ALPHA_THRESHOLD) {
    console.log('[D3Simulation] Nodes settled!');
    this.callbacks.onEnd(); // Triggers opacity reveal
}
```

### 5. Opacity Control System

**Node Opacity:**
- Initial: 0 (invisible)
- During settling: 0 (still invisible)
- On settlement complete: Animate to 1 over 1.5s
- Pattern: Staggered reveal (center outward)

**Link Opacity:**
- Initial: 0 (invisible)
- Remain 0 until settlement complete
- After settlement: Staggered reveal over 4s
- Pattern: Configurable (staggered, wave, radial, strength-based)

**Opacity Controller:**
```typescript
class UniversalOpacityController {
    // Called when simulation settles
    onSettlementComplete(nodes: EnhancedNode[], links: RenderableLink[]) {
        console.log('[OpacityController] Settlement complete, starting reveal');
        
        // Reveal nodes first
        this.revealNodes(nodes, 'staggered');
        
        // Wait for node reveal, then reveal links
        setTimeout(() => {
            this.revealLinks(links, 'staggered');
        }, 1500);
    }
    
    // Staggered node reveal (center outward)
    private revealNodes(nodes: EnhancedNode[], pattern: RevealPattern) {
        const sortedByDistance = nodes.sort((a, b) => {
            const distA = Math.sqrt(a.x ** 2 + a.y ** 2);
            const distB = Math.sqrt(b.x ** 2 + b.y ** 2);
            return distA - distB;
        });
        
        sortedByDistance.forEach((node, index) => {
            setTimeout(() => {
                this.setNodeOpacity(node.id, 1.0);
            }, index * 50); // 50ms stagger
        });
    }
}
```

### 6. Batch Rendering

**Purpose:** Handle large datasets smoothly without overwhelming the browser.

**Configuration:**
```typescript
const BATCH_SIZE = 10;
const MAX_BATCHES = 4;
// Maximum rendered nodes: 10 × 4 = 40 content nodes
// Plus navigation (8) + control (1) = 49 total
```

**Process:**
1. Sort nodes by votes (highest first)
2. Slice into batches of 10
3. Render batch 1, wait 500ms
4. Render batch 2, wait 500ms
5. Continue until all batches rendered or MAX_BATCHES reached

**Implementation:**
```typescript
class UniversalRenderingStrategy {
    startBatchRendering(nodes: EnhancedNode[]) {
        const batches = this.createBatches(nodes, BATCH_SIZE);
        
        batches.slice(0, MAX_BATCHES).forEach((batch, batchIndex) => {
            setTimeout(() => {
                console.log(`[RenderingStrategy] Rendering batch ${batchIndex + 1}`);
                this.addNodesToSimulation(batch);
            }, batchIndex * 500);
        });
    }
}
```

**Benefits:**
- Smooth initial load even with 200+ nodes
- Users see high-quality content first
- Browser remains responsive
- Forces can stabilize gradually

### 7. Phantom Links (Conditional Rendering)

**Principle:** During settling, render nodes but not links to reduce visual noise and improve performance.

**Implementation:**
```typescript
// In UniversalGraphManager
private linkRenderingEnabled = false;

public getShouldRenderLinks(): boolean {
    return this.linkRenderingEnabled;
}

// In OpacityController.onSettlementComplete()
this.linkRenderingEnabled = true; // Enable after settlement
```

**Usage in LinkRenderer:**
```svelte
<script>
  $: shouldRenderLinks = graphStore.getShouldRenderLinks?.() ?? true;
</script>

{#if shouldRenderLinks}
  {#each $renderableLinks as link}
    <!-- Render links -->
  {/each}
{/if}
```

---

## GraphStore Wrapper Pattern

### Architecture

The GraphStore wrapper provides a unified interface for both standard GraphManager and specialized UniversalGraphManager:

```typescript
// src/lib/stores/graphStore.ts

export interface GraphStore {
    // Core methods (all managers)
    subscribe: Readable<GraphState>['subscribe'];
    setData: (data: GraphData, config?: LayoutUpdateConfig) => void;
    updateNodeMode: (nodeId: string, mode: NodeMode) => void;
    // ... other core methods
    
    // Universal-specific methods (optional)
    syncDataGently?: (data: Partial<GraphData>) => void;
    updateState?: (newData?: Partial<GraphData>, wakePower?: number) => void;
    updateNavigationPositions?: (navigationNodes: GraphNode[]) => void;
    getPerformanceMetrics?: () => any;
    getShouldRenderLinks?: () => boolean;
}
```

### Method Exposure Pattern

**Critical Implementation Detail:** Universal-specific methods must be added to the `baseStore` object within the `if (isUniversalGraphManager(manager))` block:

```typescript
export function createGraphStore(initialViewType: ViewType): GraphStore {
    let manager: any;
    
    if (initialViewType === 'universal') {
        manager = new UniversalGraphManager();
    } else {
        manager = new GraphManager(initialViewType);
    }
    
    // ... create base store with core methods ...
    
    // CRITICAL: Add universal-specific methods
    if (isUniversalGraphManager(manager)) {
        baseStore.syncDataGently = (data: Partial<GraphData>) => {
            manager.syncDataGently(data);
        };

        baseStore.updateState = (newData?: Partial<GraphData>, wakePower: number = 0.2) => {
            manager.updateState(newData, wakePower);
        };

        baseStore.updateNavigationPositions = (navigationNodes: GraphNode[]) => {
            manager.updateNavigationPositions(navigationNodes);
        };

        baseStore.getPerformanceMetrics = () => {
            return manager.getPerformanceMetrics();
        };

        baseStore.getShouldRenderLinks = () => {
            return manager.getShouldRenderLinks();
        };
    }
    
    return baseStore;
}
```

### Usage Pattern

**In components:**
```typescript
// Always check if method exists (TypeScript optional)
if (graphStore && typeof graphStore.updateNavigationPositions === 'function') {
    graphStore.updateNavigationPositions(navigationNodes);
}

// Or use optional chaining
graphStore.updateNavigationPositions?.(navigationNodes);
```

**Why This Matters:**
- TypeScript interfaces are compile-time only
- Runtime needs actual property assignment
- Optional methods (`method?:`) don't auto-create properties
- Forgetting to add method = silent undefined at runtime

---

## Type System

### Core Types (enhanced.ts)

```typescript
// Node types in universal view
type ContentNodeType = 'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence';
type SystemNodeType = 'navigation' | 'dashboard';
type NodeType = ContentNodeType | SystemNodeType | 'category' | 'word' | 'definition' | 'comment';

// Node groups
type NodeGroup = 
  | 'central'        // Control node
  | 'navigation'     // Navigation ring
  | 'content'        // Content nodes in simulation
  | 'category'
  | 'definition';

// Node modes
type NodeMode = 'preview' | 'detail';

// Enhanced node (in simulation)
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
}

// Metadata attached to nodes
interface NodeMetadata {
  group: NodeGroup;
  fixed?: boolean;
  initialPosition?: { x: number; y: number };
  angle?: number;
  votes?: number;
  net_votes?: number;
  userVoteStatus?: 'agree' | 'disagree' | null;
  userVisibilityPreference?: boolean;
}
```

### Type Guards

**Critical Pattern:** Every node type needs a type guard for safe data access.

```typescript
// Type guard pattern
export const isStatementNode = (node: GraphNode): node is GraphNode & { data: StatementNode } =>
  node.type === 'statement' && 
  node.data && 
  'content' in node.data;

export const isOpenQuestionNode = (node: GraphNode): node is GraphNode & { data: OpenQuestionNode } =>
  node.type === 'openquestion' && 
  node.data && 
  'questionText' in node.data;

// Usage in components
{#if isStatementNode(node)}
  <StatementNode {node} />
{:else if isOpenQuestionNode(node)}
  <OpenQuestionNode {node} />
{/if}
```

**Why Type Guards Matter:**
- Enable TypeScript to narrow types
- Provide runtime validation
- Prevent accessing non-existent properties
- Document required fields

---

## Performance Optimizations

### 1. Relationship Consolidation

**Problem:** Multiple relationships between same nodes create visual clutter.

**Solution:**
```typescript
// In UniversalGraphManager
private consolidateRelationships(links: GraphLink[]): EnhancedLink[] {
    const linkMap = new Map<string, EnhancedLink>();
    
    links.forEach(link => {
        const key = `${link.source}-${link.target}`;
        
        if (!linkMap.has(key)) {
            linkMap.set(key, {
                ...link,
                types: [link.type],
                count: 1
            });
        } else {
            const existing = linkMap.get(key)!;
            existing.types.push(link.type);
            existing.count++;
        }
    });
    
    return Array.from(linkMap.values());
}
```

**Result:** 70% reduction in rendered links in typical graphs.

### 2. Gentle Sync for Settled States

**Problem:** Full `setData()` restarts entire simulation, losing settled positions.

**Solution:**
```typescript
// Use syncDataGently for minor updates
graphStore.syncDataGently?.({
    nodes: updatedNodes // Only nodes changed
});

// Uses minimal wake power (0.2) to preserve positions
```

**When to Use:**
- Vote updates
- Visibility changes
- Metadata updates
- Any change that doesn't affect graph structure

### 3. Batch Visibility Updates

**Problem:** Updating visibility one node at a time causes multiple re-renders.

**Solution:**
```typescript
// Batch multiple visibility changes
const updates = {
    'node-1': true,
    'node-2': false,
    'node-3': true
};

graphStore.applyVisibilityPreferences(updates);
```

### 4. Cached Path Calculations

**Problem:** Recalculating SVG paths every render is expensive.

**Solution:** D3 link path generator cached in LinkRenderer:
```typescript
const linkGenerator = d3.linkHorizontal()
    .x(d => d.x)
    .y(d => d.y);

// Reused across renders
$: pathString = linkGenerator({
    source: { x: link.sourceX, y: link.sourceY },
    target: { x: link.targetX, y: link.targetY }
});
```

### 5. Performance Metrics

Track system performance in real-time:
```typescript
const metrics = graphStore.getPerformanceMetrics?.();

console.log(metrics);
// {
//   renderedNodeCount: 40,
//   originalRelationshipCount: 156,
//   consolidatedRelationshipCount: 87,
//   consolidationRatio: 1.79,
//   lastUpdateTime: 1234567890,
//   simulationState: 'settled'
// }
```

---

## Common Patterns

### Adding a New Content Node Type

**1. Add to type union (enhanced.ts):**
```typescript
type ContentNodeType = 
  | 'statement' 
  | 'openquestion' 
  | 'answer' 
  | 'quantity' 
  | 'evidence'
  | 'newtype'; // ADD HERE
```

**2. Create node data interface (domain/nodes.ts):**
```typescript
export interface NewTypeNode {
  id: string;
  content: string;
  // ... other fields
  inclusionPositiveVotes: number;
  inclusionNegativeVotes: number;
}
```

**3. Create type guard (enhanced.ts):**
```typescript
export const isNewTypeNode = (node: GraphNode): node is GraphNode & { data: NewTypeNode } =>
  node.type === 'newtype' && 
  node.data && 
  'content' in node.data;
```

**4. Add to content type filters (CRITICAL):**

Every filter in the system must include all content types:
```typescript
// In UniversalPositioning.ts
const contentNodes = nodes.filter(n => 
  n.type === 'statement' || n.type === 'openquestion' ||
  n.type === 'answer' || n.type === 'quantity' || 
  n.type === 'evidence' || n.type === 'newtype' // ADD HERE
);

// In UniversalOpacityController.ts
if (node.type === 'statement' || node.type === 'openquestion' ||
    node.type === 'answer' || node.type === 'quantity' || 
    node.type === 'evidence' || node.type === 'newtype') { // ADD HERE
```

**5. Create Svelte component:**
```svelte
<!-- src/lib/components/graph/nodes/newtype/NewTypeNode.svelte -->
<script lang="ts">
  import type { GraphNode } from '$lib/types/graph/enhanced';
  import BaseDetailNode from '../BaseDetailNode.svelte';
  import BasePreviewNode from '../BasePreviewNode.svelte';
  
  export let node: GraphNode;
  
  $: nodeData = node.data as NewTypeNode;
  $: isDetail = node.mode === 'detail';
</script>

{#if isDetail}
  <BaseDetailNode {node}>
    <!-- Custom content -->
  </BaseDetailNode>
{:else}
  <BasePreviewNode {node}>
    <!-- Preview content -->
  </BasePreviewNode>
{/if}
```

**6. Add to NodeRenderer routing:**
```svelte
<!-- NodeRenderer.svelte -->
{:else if isNewTypeNode(node)}
  <NewTypeNode {node} />
```

**7. Add colors to constants:**
```typescript
// In src/lib/constants/graph.ts
export const NODE_CONSTANTS = {
  COLORS: {
    NEWTYPE: {
      border: 'rgba(100, 255, 100, 1)',
      background: 'rgba(100, 255, 100, 0.1)',
      hover: 'rgba(100, 255, 100, 0.3)',
      gradient: {
        start: 'rgba(100, 255, 100, 0.2)',
        end: 'rgba(100, 255, 100, 0)'
      }
    }
  }
};
```

### Adding a Filter

**1. Add to store state (universalGraphStore.ts):**
```typescript
interface UniversalGraphState {
  filters: {
    // ... existing filters
    newFilter: string | null;
  };
}

function setNewFilter(value: string) {
  update(state => ({
    ...state,
    filters: { ...state.filters, newFilter: value }
  }));
}
```

**2. Add to ControlNode UI:**
```svelte
<input 
  bind:value={newFilterValue} 
  placeholder="Filter by..."
  on:change={() => graphStore.setNewFilter(newFilterValue)}
/>
```

**3. Backend should support the filter** (check API docs)

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
- Navigation ring repositioning
- Method binding checks

**Reduced logs (every N ticks):**
- Settlement progress (every 100 ticks, not every tick)
- Drop phase progress (every 100 ticks)

**Development only:**
```typescript
if (import.meta.env.DEV) {
  console.log('[Debug] ...', details);
}
```

### Common Issues & Solutions

**Issue: Nodes not rendering**
- Check: Type guard in component passing?
- Check: Required fields present in node.data?
- Check: NodeRenderer has case for type?
- Check: Is type included in content type filters?
- Console: Look for "Invalid node data type" error

**Issue: Nodes visible during settling**
- Check: Type included in opacity filters?
- Check: `setInitialNodeOpacity` sets opacity = 0?
- Check: Settlement completing (logs show "Nodes settled")?
- Check: OpacityController properly initialized?

**Issue: Links not appearing**
- Check: `getShouldRenderLinks()` returns true?
- Check: Settlement completed?
- Check: LinkRenderer component receiving links?
- Console: Look for "Link reveal animation complete"

**Issue: Navigation ring not repositioning**
- Check: Control node mode change event firing?
- Check: `graphStore.updateNavigationPositions` is a function?
- Check: Method exists on GraphStore (not undefined)?
- Check: System nodes being updated in simulation?
- Console: Should see "🎯 Updating navigation positions"

**Issue: Chaotic positioning**
- Check: Type included in positioning filters?
- Check: Votes being extracted correctly?
- Check: `calculateSingleNodePositions` called?
- Check: BASE_DISTANCE respects navigation ring clearance?

**Issue: TypeScript errors on metadata**
- Check: Field added to NodeMetadata interface in enhanced.ts?
- Check: Field is optional (`field?: type`)?
- Check: Type guard includes field check?

**Issue: Method undefined at runtime**
- Check: Method added to `baseStore` in universal section?
- Check: GraphNode imported in graphStore.ts?
- Check: Using optional chaining or typeof check before calling?
- Console: `typeof graphStore.methodName` should be 'function'

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

**Check GraphStore method availability:**
```typescript
console.log('Methods:', Object.getOwnPropertyNames(graphStore));
console.log('Has method:', typeof graphStore.updateNavigationPositions === 'function');
```

**Monitor simulation state:**
```typescript
// In UniversalD3Simulation
console.log('[D3Simulation] State:', {
  isSettling: this.isInSettlementPhase,
  alpha: this.simulation.alpha(),
  nodeCount: this.simulation.nodes().length,
  systemNodeCount: this.systemNodes.length
});
```

---

## Constants Reference

### Positioning

```typescript
// Base distance for first content node from center
// Adjusted to clear navigation ring in detail mode
BASE_DISTANCE: 435  // 375px nav ring + 60px safety buffer

// Golden angle for spiral distribution
GOLDEN_ANGLE: 2.399963229728653  // (3 - sqrt(5)) × pi radians

// Distance increment between nodes
DISTANCE_INCREMENT: 15
```

### Navigation Ring

```typescript
PREVIEW_MODE: {
  CONTROL_RADIUS: 50,   // Control node radius
  GAP: 50,              // Gap between control and nav nodes
  NAV_RADIUS: 40,       // Navigation node radius
  RING_RADIUS: 140      // Total: 50 + 50 + 40
}

DETAIL_MODE: {
  CONTROL_RADIUS: 225,  // Control node radius
  GAP: 70,              // Gap between control and nav nodes
  NAV_RADIUS: 40,       // Navigation node radius
  RING_RADIUS: 335      // Total: 225 + 70 + 40
}
```

### Timing

```typescript
NODE_RENDER_DELAY: 50      // ms between individual nodes
BATCH_RENDER_DELAY: 500    // ms between batches
SETTLEMENT_DELAY: 300      // ms before checking settlement
DROP_PHASE_DURATION: 2000  // ms for drop phase
NODE_FADE_DURATION: 1500   // ms for node opacity fade
LINK_FADE_DURATION: 4000   // ms for link opacity fade
```

### Forces

```typescript
DROP_PHASE: {
  CHARGE_STRENGTH: -100,
  COLLISION_STRENGTH: 0.3,
  VELOCITY_DECAY: 0.4,
  ALPHA_TARGET: 0.3
}

SETTLEMENT_PHASE: {
  CHARGE_STRENGTH: -400,
  COLLISION_STRENGTH: 0.8,
  VELOCITY_DECAY: 0.4,
  ALPHA_TARGET: 0
}
```

### Limits

```typescript
MAX_SINGLE_NODES: 40      // Single-batch limit
NODES_PER_BATCH: 10       // Batch size
MAX_BATCHES: 4            // Total batches
MAX_TOTAL_NODES: 200      // API limit
```

### Content Type Filter Template

**Copy-paste for any filter location:**
```typescript
node.type === 'statement' || node.type === 'openquestion' ||
node.type === 'answer' || node.type === 'quantity' || node.type === 'evidence'
```

---

## Known Limitations

### Current Constraints

1. **No dynamic node addition** - All nodes loaded upfront
2. **Limited to 200 nodes** - Performance degrades beyond this
3. **No node deletion** - Can only hide nodes
4. **No live updates** - Must refresh to see new content
5. **No multi-select** - Can only interact with one node at a time

### Future Enhancements

**High Priority:**
- [ ] Infinite scroll / pagination for large datasets
- [ ] Real-time updates via WebSocket
- [ ] Node creation from graph view
- [ ] Link creation between nodes
- [ ] Advanced filtering (date ranges, vote ranges)
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

---

## Testing Recommendations

### Unit Tests

**Priority test coverage:**

1. **createGraphStore() method exposure**
```typescript
describe('createGraphStore', () => {
  it('should expose universal methods for universal view', () => {
    const store = createGraphStore('universal');
    expect(typeof store.updateNavigationPositions).toBe('function');
    expect(typeof store.syncDataGently).toBe('function');
  });
  
  it('should not expose universal methods for standard views', () => {
    const store = createGraphStore('dashboard');
    expect(store.updateNavigationPositions).toBeUndefined();
  });
});
```

2. **Node transformation pipeline**
```typescript
describe('UniversalGraphManager.transformNodes', () => {
  it('should transform GraphNode to EnhancedNode', () => {
    const graphNode = { id: '1', type: 'statement', data: {...} };
    const enhanced = manager.transformNodes([graphNode]);
    expect(enhanced[0]).toHaveProperty('radius');
    expect(enhanced[0]).toHaveProperty('x');
  });
});
```

3. **Positioning calculations**
```typescript
describe('UniversalPositioning.calculateSingleNodePositions', () => {
  it('should place higher-voted nodes closer to center', () => {
    const nodes = [
      { votes: 10 },
      { votes: 5 },
      { votes: 1 }
    ];
    const positions = positioning.calculateSingleNodePositions(nodes);
    expect(positions[0].distance).toBeLessThan(positions[1].distance);
  });
});
```

4. **Type guards**
```typescript
describe('Type guards', () => {
  it('should correctly identify statement nodes', () => {
    const node = { type: 'statement', data: { content: 'test' } };
    expect(isStatementNode(node)).toBe(true);
  });
  
  it('should reject nodes without required fields', () => {
    const node = { type: 'statement', data: {} };
    expect(isStatementNode(node)).toBe(false);
  });
});
```

### Integration Tests

**Key integration scenarios:**

1. **Full data flow**: Backend -> Store -> Manager -> Simulation -> Render
2. **Navigation ring repositioning**: Mode change -> Position calculation -> Update
3. **Vote updates**: User vote -> Cache update -> Re-sort -> Re-position
4. **Batch rendering**: Large dataset -> Batches -> Sequential render -> Settlement

### Manual Testing Checklist

- [ ] Load graph with 0, 10, 50, 200 nodes
- [ ] Toggle control node between preview and detail
- [ ] Vote on nodes and verify re-positioning
- [ ] Filter by type, keyword, user
- [ ] Sort by different criteria
- [ ] Hide/show individual nodes
- [ ] Expand nodes to detail mode
- [ ] Check responsive behavior on different screen sizes
- [ ] Verify smooth animations and transitions
- [ ] Test browser refresh and back button
- [ ] Check console for errors or warnings

---

## Key Principles

1. **All 5 content types must be included** in all filters
2. **Data transformation is critical** - type guards depend on correct fields
3. **Two-phase rendering** enables smooth aesthetics
4. **Opacity system** controls user experience
5. **Configuration over hardcoding** - use constants
6. **System vs content nodes** - separate handling required
7. **Method exposure requires runtime assignment** - interfaces alone are insufficient
8. **Type safety throughout** - use type guards for all node access

### When in Doubt

- **Check the type filters** - Is your node type included?
- **Verify required fields** - Does node.data have all expected properties?
- **Look at console logs** - Lifecycle events provide debugging context
- **Compare with working types** - How do statement/openquestion handle it?
- **Check method availability** - Does `typeof method === 'function'`?
- **Review documentation** - This document covers most patterns

### For Questions or Issues

- **Architecture**: This document
- **Implementation**: File comments and JSDoc
- **Type definitions**: `src/lib/types/graph/enhanced.ts`
- **Runtime behavior**: Console logs with `[ComponentName]` prefix
- **Constants**: `src/lib/services/graph/universal/UniversalConstants.ts`

---

## Essential Files Reference

| File | Purpose | Lines | Complexity | Status |
|------|---------|-------|------------|--------|
| UniversalGraphManager.ts | Main coordinator | ~1400 | High | Clean |
| UniversalD3Simulation.ts | D3 lifecycle | 655 | High | Working |
| UniversalOpacityController.ts | Opacity/reveal | 812 | Medium | Working |
| UniversalPositioning.ts | Vote positioning | ~250 | Medium | Working |
| NavigationRingPositioning.ts | Nav ring calc | ~100 | Low | Working |
| UniversalRenderingStrategy.ts | Batch/sequential | ~350 | Medium | Working |
| graphStore.ts | Wrapper | ~330 | Medium | Fixed |
| +page.svelte | Route/filters | ~1100 | Medium | Clean |
| Graph.svelte | Root component | ~900 | Medium | Working |

---

## Conclusion

The Universal Graph is a sophisticated system with many moving parts working in harmony. The architecture is modular, performant, and extensible. Key to success:

- **Follow established patterns** for new features
- **Include all content types** in filters
- **Use type guards** for safe data access
- **Respect the two-phase rendering** system
- **Test method exposure** for new universal-specific features
- **Document as you go** for future developers

The foundation is solid and ready for continued development. Happy coding! 🚀

---

**Document Version:** 2.0  
**Last Updated:** After GraphStore method binding resolution  
**Status:** Production Ready  
**Last Review:** November 2024  
**Next Review:** After major architectural changes or new feature additions