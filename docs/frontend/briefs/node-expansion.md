# ProjectZer0 Frontend Development Brief

## SYSTEM OVERVIEW

**ProjectZer0** is a graph-based knowledge platform where users create and interact with different types of content nodes (statements, questions, words, categories, etc.) in an interactive force-directed graph visualization.

### Core Technologies
- **Frontend Framework**: SvelteKit
- **Graph Visualization**: D3.js (force simulation)
- **Backend**: NestJS API
- **Database**: Neo4j (graph database)
- **Authentication**: Auth0

### Application Structure
The app has multiple view types:
- **Universal Graph** (`/graph/universal`) - Main view showing all content types
- **Statement Network** - Focused view for statement relationships
- **Word View** - Dictionary/definition focused view
- **Discussion View** - Comment threads for content

---

## PROJECT STRUCTURE

### Key Directories
```
src/
├── lib/
│   ├── components/
│   │   ├── graph/
│   │   │   ├── Graph.svelte (main graph container)
│   │   │   ├── nodes/ (all node type components)
│   │   │   │   ├── base/ (BaseNode, BaseDetailNode)
│   │   │   │   ├── statement/ (StatementNode.svelte)
│   │   │   │   ├── openquestion/ (OpenQuestionNode.svelte)
│   │   │   │   ├── quantity/ (QuantityNode.svelte)
│   │   │   │   ├── answer/ (AnswerNode.svelte)
│   │   │   │   ├── evidence/ (EvidenceNode.svelte)
│   │   │   │   ├── word/ (WordNode.svelte)
│   │   │   │   ├── category/ (CategoryNode.svelte)
│   │   │   │   ├── definition/ (DefinitionNode.svelte)
│   │   │   │   ├── comment/ (CommentNode.svelte)
│   │   │   │   ├── createNode/ (CreateNodeNode.svelte)
│   │   │   │   └── NodeRenderer.svelte (wrapper for all nodes)
│   │   │   └── links/ (LinkRenderer.svelte)
│   │   └── forms/ (node creation forms)
│   │       └── createNode/ (multi-step creation wizards)
│   ├── stores/
│   │   ├── graphStore.ts (main graph state)
│   │   ├── universalGraphStore.ts (universal view data)
│   │   ├── statementNetworkStore.ts
│   │   ├── wordViewStore.ts
│   │   └── visibilityPreferenceStore.ts
│   ├── services/
│   │   ├── api.ts (backend communication)
│   │   ├── graph/ (graph-specific services)
│   │   │   ├── UniversalGraphManager.ts
│   │   │   ├── StatementExpansionService.ts
│   │   │   ├── CategoryExpansionService.ts
│   │   │   └── WordExpansionService.ts
│   │   └── navigation.ts
│   ├── types/
│   │   └── graph/
│   │       └── enhanced.ts (core type definitions)
│   └── constants/
│       ├── graph/ (graph-related constants)
│       └── colors.ts
└── routes/
    └── graph/
        └── universal/
            └── +page.svelte (universal graph page)
```

---

## KEY CONCEPTS

### Node Types
Each content type has its own node component:

1. **Statement** - Declarative claims users make
2. **OpenQuestion** - Open-ended questions 
3. **Quantity** - Questions with measurable/quantifiable answers
4. **Answer** - Responses to OpenQuestions
5. **Evidence** - Supporting/contradicting evidence for statements/answers
6. **Word** - Dictionary entries
7. **Definition** - Definitions of words
8. **Category** - Groupings of words
9. **Comment** - Discussion comments
10. **Navigation** - UI navigation buttons in the graph
11. **Control** - Filter/sort controls node
12. **Dashboard** - User dashboard node
13. **CreateNode** - Multi-step node creation wizard

### Node Modes
Nodes can be in different display modes:
- **preview**: Compact view showing minimal info
- **detail**: Expanded view showing full content

### Node Groups
Nodes are organized into groups for layout:
- **central**: The main focus node (center of view)
- **navigation**: Navigation buttons around central node
- **content**: Regular content nodes (statements, questions, etc.)
- **peripheral**: Supporting nodes (definitions, comments)

---

## ARCHITECTURE PATTERNS

### State Management
**Svelte Stores** are used for reactive state:
- `graphStore`: Main graph simulation state
- `universalGraphStore`: Data specific to universal view
- View-specific stores for different graph types
- `visibilityStore`: User preferences for node visibility

### Component Hierarchy
```
+page.svelte (universal)
└── Graph.svelte (container)
    ├── Background (SVG patterns)
    ├── LinkRenderer (for each link)
    └── NodeRenderer (for each node)
        └── [NodeTypeComponent] (Statement, Question, etc.)
            └── BaseDetailNode or BaseNode
                └── ContentBox (layout helper)
```

### Manager Pattern
Complex views use a **Manager** class to coordinate:
- `UniversalGraphManager`: Manages universal graph state
  - Extends base graph functionality
  - Handles batch rendering
  - Manages opacity reveal animations
  - Coordinates link rendering

---

## DATA FLOW

### Data Loading Flow
1. **Page Component** (`+page.svelte`) loads initial data
2. **Store** (`universalGraphStore`) fetches from API
3. **Transformer** converts API data to graph format
4. **Graph Component** receives data via props
5. **GraphStore** (D3 simulation) processes nodes/links
6. **Rendering** updates based on simulation ticks

### Node Creation Flow
1. User clicks CreateNode button (navigation node)
2. CreateNodeNode appears at graph center
3. Multi-step form collects data
4. On submit → API POST request
5. Success → Expansion event dispatched
6. New node fetched and added to graph
7. Viewport centers on new node

### Event Flow Pattern
Events bubble up through component hierarchy:
```
NodeComponent 
  → NodeRenderer 
    → Graph 
      → Page Component
```

---

## EVENT PROPAGATION ARCHITECTURE

### Node Expansion Event Chain
When a node is created and needs to be displayed in the graph, events must flow through this complete chain:
```
ReviewComponent (e.g., QuantityReview)
  ↓ dispatches 'expandQuantity'
CreateNodeNode (node creation wizard)
  ↓ forwards with source context
NodeRenderer (node wrapper component)
  ↓ forwards to Graph
Graph.svelte (main container)
  ↓ forwards to parent
Page Component (e.g., universal/+page.svelte)
  ↓ fetches data, adds to graph
Display & center on new node
```

### Critical Pattern - Complete Handler Chain Required

**ALL expansion event types must be present in each layer:**

1. **Event Dispatcher Type Definitions**
   - CreateNodeNode.svelte
   - NodeRenderer.svelte  
   - Graph.svelte
   - Page component (universal/+page.svelte)

2. **Handler Functions**
   - `handleExpandWord()`
   - `handleExpandCategory()`
   - `handleExpandStatement()`
   - `handleExpandOpenQuestion()`
   - `handleExpandQuantity()`

3. **Slot Prop Forwarding**
   - NodeRenderer must pass ALL handlers to child nodes via slot props
```svelte
   <slot 
       {node}
       handleExpandCategory={handleExpandCategory}
       handleExpandWord={handleExpandWord}
       handleExpandStatement={handleExpandStatement}
       handleExpandOpenQuestion={handleExpandOpenQuestion}
       handleExpandQuantity={handleExpandQuantity}
   />
```

4. **Parent Event Listeners**
   - Graph listens to NodeRenderer: `on:expandQuantity={handleExpandQuantity}`
   - Page listens to Graph: `on:expandQuantity={handleExpandQuantity}`

### Special Case: CreateNodeNode Dual-Path Rendering

CreateNodeNode is unique - it's rendered in TWO ways:

1. **Standard Path** (through NodeRenderer)
   - Used for normal node operations (mode changes, visibility)
   - Events flow through NodeRenderer

2. **Direct Path** (in page component slots)
   - Used for expansion events during creation flow
   - Page component must explicitly listen for expansion events

**This means:** Even though other nodes' expansion events come through NodeRenderer → Graph → Page, CreateNodeNode's creation-time expansion events go **directly from CreateNodeNode → Page's slot → Page handler**.

Example from universal/+page.svelte:
```svelte
<Graph>
    <svelte:fragment slot="default" let:node>
        {:else if isCreateNodeNode(node)}
            <CreateNodeNode 
                {node}
                on:expandWord={handleExpandWord}
                on:expandCategory={handleExpandCategory}
                on:expandStatement={handleExpandStatement}
                on:expandOpenQuestion={handleExpandOpenQuestion}
                on:expandQuantity={handleExpandQuantity}  <!-- CRITICAL -->
            />
    </svelte:fragment>
</Graph>
```

### Common Pitfall: Incomplete Event Chain

**Symptom:** Node gets created in database successfully, but doesn't appear in graph until page refresh.

**Cause:** Missing event handler in any link of the chain causes silent event loss.

**How to Debug:**
1. Use emoji logging pattern to trace event flow:
   - 🔍 = Diagnostic checkpoint
   - 🎯 = Function call
   - ✅ = Success
   - ❌ = Failure
   - 📤 = Event dispatched
   - 📥 = Event received

2. Check console logs for the complete chain:
```
   ✅ [QuantityReview] handleSubmit called
   ✅ [QuantityReview] API success
   📤 [QuantityReview] Dispatching expandQuantity
   📥 [CreateNodeNode] expandQuantity received
   📤 [CreateNodeNode] Forwarding to parent
   📥 [NodeRenderer] expandQuantity received  ← If missing, check NodeRenderer
   📤 [NodeRenderer] Forwarding to Graph
   📥 [Graph] expandQuantity received  ← If missing, check Graph handlers
   📤 [Graph] Forwarding to parent
   📥 [UNIVERSAL-PAGE] expandQuantity received  ← If missing, check page slot
```

3. If chain stops at any point, check that specific component for:
   - Event type in dispatcher definition
   - Handler function exists
   - Event listener in parent: `on:eventName={handlerFunction}`

### Adding New Expandable Node Types - Checklist

When adding a new node type that can be expanded in the graph:

- [ ] Create expansion service in `services/graph/` (e.g., `NewNodeExpansionService.ts`)
- [ ] Add event type to CreateNodeNode dispatcher
- [ ] Add event type to NodeRenderer dispatcher  
- [ ] Add event type to Graph dispatcher
- [ ] Add event type to page component dispatcher
- [ ] Create `handleExpandNewNode()` in CreateNodeNode
- [ ] Create `handleExpandNewNode()` in NodeRenderer
- [ ] Create `handleExpandNewNode()` in Graph
- [ ] Create `handleExpandNewNode()` in page component
- [ ] Add handler to NodeRenderer slot props
- [ ] Add `on:expandNewNode` listener in Graph to NodeRenderer
- [ ] Add `on:expandNewNode` listener in page to Graph
- [ ] Add `on:expandNewNode` listener in page slot to CreateNodeNode
- [ ] Test complete event chain with emoji logging

---

## RENDERING PIPELINE

### D3 Force Simulation
The graph uses D3's force simulation for layout:
- **Forces Applied**:
  - Charge (repulsion between nodes)
  - Collision (prevents overlap)
  - Link (connections between nodes)
  - Center (pulls toward center)
  - Radial (for specific layouts)

### Rendering Cycle
1. **Simulation Tick**: D3 calculates new positions
2. **Store Update**: Positions written to Svelte store
3. **Reactive Update**: Svelte re-renders affected nodes
4. **Transform Applied**: SVG transform positions nodes

### Batch Rendering (Universal View)
To handle many nodes efficiently:
- Nodes rendered in batches by net votes
- Opacity gradually revealed
- Links rendered after nodes settle
- Configurable in `BATCH_RENDERING` constants

---

## NODE SYSTEM

### Base Components

**BaseNode.svelte**
- Provides core node structure (circle, glow, rings)
- Handles common node styling
- Used by simple preview nodes

**BaseDetailNode.svelte**  
- Extends BaseNode for detail mode
- Provides content layout structure
- Includes ContentBox for organized content
- Handles mode change animations

### Node Component Structure
Each node type (e.g., StatementNode) has:
```svelte
<BaseDetailNode {node} {style}>
    <svelte:fragment slot="title">
        <!-- Node header -->
    </svelte:fragment>
    
    <svelte:fragment slot="categoryTags">
        <!-- Category badges -->
    </svelte:fragment>
    
    <svelte:fragment slot="keywordTags">
        <!-- Keyword badges -->
    </svelte:fragment>
    
    <svelte:fragment slot="contentText">
        <!-- Main content -->
    </svelte:fragment>
    
    <svelte:fragment slot="inclusionVoting">
        <!-- Inclusion vote UI -->
    </svelte:fragment>
    
    <svelte:fragment slot="contentVoting">
        <!-- Content vote UI -->
    </svelte:fragment>
    
    <svelte:fragment slot="metadata">
        <!-- Timestamps, counts -->
    </svelte:fragment>
</BaseDetailNode>
```

### ContentBox Layout System
ContentBox provides standardized layout for node content:
- Automatically calculates positions based on node mode
- Uses positioning configs (fractions of available space)
- Handles different sections (contentText, voting, etc.)
- Mode-aware sizing (preview vs detail)

---

## COORDINATE SYSTEMS

### World Coordinates
- Origin at (0, 0) - center of graph
- Width: 10000 units
- Height: 10000 units
- Used by D3 simulation

### View Coordinates  
- Browser viewport pixels
- Affected by zoom/pan transforms
- Converted via D3 zoom transform

### SVG Coordinates
- ViewBox defines visible area
- PreserveAspectRatio: xMidYMid meet
- Centered on origin

### Coordinate Conversion
Use `coordinateSystem` service:
```javascript
coordinateSystem.worldToView(worldX, worldY)
coordinateSystem.viewToWorld(viewX, viewY)
```

---

## SIMULATION & PHYSICS

### Force Configuration
Defined in constants:
```javascript
COORDINATE_SPACE.FORCES = {
    CHARGE: {
        STRENGTH: -800,
        DISTANCE_MAX: 1000
    },
    COLLISION: {
        RADIUS_MULTIPLIER: 1.2,
        STRENGTH: 0.9
    },
    LINK: {
        DISTANCE: 200,
        STRENGTH: 0.3
    }
}
```

### Simulation States
- **Cold**: Simulation at rest
- **Warm**: Light activity (alpha < 0.3)
- **Hot**: Active layout changes (alpha > 0.3)

### Manual Control
```javascript
graphStore.forceTick(n)  // Run n ticks
graphStore.reheat(alpha)  // Set simulation activity
graphStore.fixNodePositions()  // Lock positions
```

---

## USER INTERACTION

### Node Interactions
- **Click**: Select/focus node
- **Expand**: Switch to detail mode
- **Collapse**: Return to preview mode
- **Hide**: Hide node from view
- **Vote**: Up/down vote on content

### Graph Interactions
- **Pan**: Drag background to move view
- **Zoom**: Scroll to zoom in/out
- **Reset**: Return to initial view

### Tag Interactions
- **Category Tags**: Click to expand category node
- **Keyword Tags**: Click to expand word node

---

## STYLING & THEMING

### Color System
Primary colors per node type:
```javascript
COLORS.PRIMARY = {
    WORD: '#4A90E2',
    STATEMENT: '#E74C3C',
    OPEN_QUESTION: '#9B59B6',
    QUANTITY: '#48E0C2',
    CATEGORY: '#FF8A3D',
    // ... etc
}
```

### Node Styling
- Gradient backgrounds
- Glowing rings on hover
- Opacity-based depth
- Font: 'Orbitron' for headers, 'Inter' for content

### Responsive Design
- Viewport-aware sizing
- Touch-friendly hit areas
- Mobile-optimized controls

---

## PERFORMANCE & OPTIMIZATION

### Batch Rendering
Universal view uses batch rendering:
- Nodes added in groups of 10
- Highest voted nodes first
- Configurable batch count
- Prevents UI blocking

### Opacity Reveal
Smooth entrance animations:
- Nodes fade in gradually
- Links appear after nodes settle
- Configurable timing

### Phantom Links
Links created but not rendered initially:
- Reduces initial render load
- Revealed on demand
- Maintains graph structure data

---

## DEBUGGING & TROUBLESHOOTING

### Debug Mode
Enable via `DEBUG_MODE` constant:
- Shows coordinate axes
- Displays node IDs
- Performance metrics
- Transform information

### Console Logging Pattern
Use emoji prefixes for clarity:
- 🔍 Diagnostic checkpoint
- ✅ Success
- ❌ Error
- 🎯 Function call
- 📤 Data sent
- 📥 Data received
- 🚀 Event dispatched

### Common Issues

**Nodes not appearing:**
- Check event chain (see Event Propagation section)
- Verify data transformation
- Check visibility preferences
- Confirm API response

**Layout problems:**
- Verify force configuration
- Check collision detection
- Confirm node radius values

**Performance issues:**
- Enable batch rendering
- Reduce visible node count
- Check for infinite loops
- Profile simulation ticks

---

## DEVELOPMENT WORKFLOW

### Adding New Node Type
1. Create node component in `lib/components/graph/nodes/[type]/`
2. Add type to `enhanced.ts` types
3. Create expansion service if expandable
4. **Complete event chain (see Event Propagation checklist)**
5. Add to Graph.svelte rendering
6. Add to NodeRenderer slot handling
7. Update stores if needed
8. Add styling/colors
9. Test in all view modes

### Testing Checklist
- [ ] Node renders in preview mode
- [ ] Node expands to detail mode
- [ ] Mode transitions smoothly
- [ ] Click/hover interactions work
- [ ] Tags expand correctly (category/keyword)
- [ ] Voting functions properly
- [ ] Visibility toggle works
- [ ] Event chain complete (if expandable)
- [ ] Mobile responsive
- [ ] Accessibility (keyboard nav)

### Code Style
- TypeScript for type safety
- Svelte stores for reactivity
- D3 for graph physics
- Emoji logging for debugging
- Comments for complex logic

---

## QUICK REFERENCE

### Key Files
- `Graph.svelte` - Main graph container
- `NodeRenderer.svelte` - Node wrapper & event routing
- `UniversalGraphManager.ts` - Universal view logic
- `graphStore.ts` - Core graph state
- `enhanced.ts` - Type definitions

### Key Concepts
- Nodes have modes (preview/detail)
- Events bubble up component tree
- D3 handles physics, Svelte handles rendering
- Stores connect data to UI
- ContentBox handles layout

### Common Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run check        # Type checking
```

---

**Last Updated**: December 2024
**Version**: 2.0 (Updated with Event Propagation Architecture)