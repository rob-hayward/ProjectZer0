# Node Expansion Complete Guide
*Everything you need to add expansion for any node type*

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [The Pattern Overview](#the-pattern-overview)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Testing & Verification](#testing--verification)
5. [Troubleshooting](#troubleshooting)
6. [Code Templates](#code-templates)

---

## Quick Start

### What You're Building
When a user creates a new node (statement, quantity, answer, etc.), the node should:
1. ✅ Appear in the universal graph immediately
2. ✅ Display with visible content (not blank)
3. ✅ Position near the source node (not at origin)
4. ✅ Center the graph viewport on it

### The Process
Add ~15 lines of code across 5 files following a consistent pattern. After the first implementation (30-45 min), subsequent node types take only 15-20 minutes.

### Before You Start
1. **Check backend controller** - Note the exact field names it returns
2. **Test endpoint** - Verify `/nodes/{type}/{id}` works in browser/Postman
3. **Have working example open** - StatementExpansionService.ts as reference

---

## The Pattern Overview

### The 5 Files (Every Time)

```
1. {NodeType}ExpansionService.ts      [NEW FILE - fetch from API]
2. CreateNodeNode.svelte              [3 changes - type, handler, listener]
3. Graph.svelte                       [3 changes - type, handler, listener]  
4. universal/+page.svelte             [3 changes - import, handler, listener]
5. {NodeType}Review.svelte            [2 changes - type, dispatch]
```

### The Event Chain (9 Steps)

```
Review Component
  ↓ dispatch('expandQuantity', { quantityId })
  
CreateNodeNode
  ↓ on:expandQuantity={handleQuantityCreated}
  ↓ dispatch('expandQuantity', { quantityId, sourceNodeId, sourcePosition })
  
Graph.svelte
  ↓ on:expandQuantity={handleExpandQuantity} [on NodeRenderer]
  ↓ dispatch('expandQuantity', event.detail)
  
universal/+page.svelte
  ↓ on:expandQuantity={handleExpandQuantity} [on Graph]
  ↓ await fetchQuantityExpansion(quantityId)
  ↓ Transform API data → GraphNode
  ↓ updateState(expandedGraphData, 0.6)
  ↓ waitForNodePositionAndCenter()
```

**Key principle:** Each container component receives event from child, adds context (position info), and forwards to parent.

---

## Step-by-Step Implementation

### Step 1: Create Expansion Service

**File:** `src/lib/services/graph/QuantityExpansionService.ts` (new file)

**Purpose:** Fetch node data from backend API

**Template:**
```typescript
// src/lib/services/graph/QuantityExpansionService.ts
import { fetchWithAuth } from '../api';

export interface QuantityExpansionResponse {
    nodes: Array<{
        id: string;
        type: 'quantity';
        question: string;  // ⚠️ CHECK YOUR BACKEND - field name may vary
        unitCategoryId?: string;
        defaultUnitId?: string;
        created_by?: string;
        createdBy?: string;
        public_credit?: boolean;
        publicCredit?: boolean;
        created_at?: string;
        createdAt?: string;
        updated_at?: string;
        updatedAt?: string;
        keywords?: Array<{ word: string; source: string; frequency?: number }>;
        categories?: Array<{ id: string; name: string }>;
        metadata?: {
            votes?: {
                positive: number;
                negative: number;
                net: number;
            };
            responses?: Record<string, any>;
        };
    }>;
    relationships: Array<{
        id: string;
        source: string;
        target: string;
        type: string;
        metadata?: Record<string, any>;
    }>;
}

export async function fetchQuantityExpansion(
    quantityId: string
): Promise<QuantityExpansionResponse> {
    console.log('[QuantityExpansionService] Fetching expansion for quantity:', quantityId);
    
    try {
        const response = await fetchWithAuth(`/nodes/quantity/${quantityId}`);
        
        // DEBUG: Verify field names
        console.log('[QuantityExpansionService] Response fields:', Object.keys(response));
        console.log('[QuantityExpansionService] Question field:', response.question);
        
        return {
            nodes: [response],
            relationships: []
        };
    } catch (error) {
        console.error('[QuantityExpansionService] Failed to fetch quantity expansion:', error);
        throw error;
    }
}
```

**⚠️ CRITICAL:** Replace:
- `quantity` with your node type (lowercase)
- `question` with your main content field name
- `/nodes/quantity/${quantityId}` with your API endpoint

**Troubleshooting:**
- If 404: Check endpoint path matches backend route
- If 401: JWT token issue, check authentication
- If wrong fields: Check backend controller DTO definition

---

### Step 2: Update CreateNodeNode.svelte

**File:** `src/lib/components/graph/nodes/createNode/CreateNodeNode.svelte`

**Purpose:** Forward creation event with source position context

#### Change 1: Add to dispatcher type (~line 35-50)

**Find this block:**
```typescript
const dispatch = createEventDispatcher<{
    modeChange: { mode: NodeMode };
    expandWord: { ... };
    expandCategory: { ... };
    expandStatement: { ... };
}>();
```

**Add this:**
```typescript
    expandQuantity: {
        quantityId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    };
```

#### Change 2: Add handler function (~line 100-120)

**Add after other expand handlers:**
```typescript
function handleQuantityCreated(event: CustomEvent<{ quantityId: string }>) {
    console.log('[CreateNodeNode] Quantity created, forwarding with source context:', {
        quantityId: event.detail.quantityId,
        nodeId: node.id,
        position: node.position
    });
    
    dispatch('expandQuantity', {
        quantityId: event.detail.quantityId,
        sourceNodeId: node.id,
        sourcePosition: {
            x: node.position?.x || 0,
            y: node.position?.y || 0
        }
    });
    
    console.log('[CreateNodeNode] expandQuantity event dispatched to parent');
}
```

#### Change 3: Add event listener (~line 600-800)

**Find where your Review component is rendered:**
```svelte
{:else if currentStep === 7}  <!-- Your step number -->
    <QuantityReview
        bind:this={quantityReviewComponent}
        question={formData.question}
        <!-- other props -->
        on:back={handleBack}
        on:success={e => successMessage = e.detail.message}
        on:error={e => errorMessage = e.detail.message}
    />
{/if}
```

**Add this line:**
```svelte
        on:expandQuantity={handleQuantityCreated}
```

**Troubleshooting:**
- **Event not received:** Check `on:expandQuantity={...}` is on the Review component
- **TypeScript error:** Verify dispatcher type includes `expandQuantity`
- **Logs show received but not dispatched:** Ensure `dispatch('expandQuantity', ...)` is called

---

### Step 3: Update Graph.svelte

**File:** `src/lib/components/graph/Graph.svelte`

**Purpose:** Forward event from CreateNodeNode to parent page

#### Change 1: Add to dispatcher type (~line 70-95)

**Find this block:**
```typescript
const dispatch = createEventDispatcher<{
    modechange: { nodeId: string; mode: NodeMode };
    visibilitychange: { nodeId: string; isHidden: boolean };
    expandCategory: { ... };
    expandWord: { ... };
    expandStatement: { ... };
}>();
```

**Add this:**
```typescript
    expandQuantity: {
        quantityId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    };
```

#### Change 2: Add handler function (~line 680-700)

**Add after other expand handlers:**
```typescript
function handleExpandQuantity(event: CustomEvent<{
    quantityId: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    console.log('[Graph] Quantity expansion event received:', {
        quantityId: event.detail.quantityId,
        sourceNodeId: event.detail.sourceNodeId,
        sourcePosition: event.detail.sourcePosition
    });
    
    dispatch('expandQuantity', event.detail);
    
    console.log('[Graph] Quantity expansion event forwarded to parent page');
}
```

#### Change 3: Add to NodeRenderer (~line 1120-1130)

**Find the NodeRenderer component:**
```svelte
<NodeRenderer 
    {node}
    viewType={viewType}
    on:modeChange={handleModeChange}
    on:visibilityChange={handleVisibilityChange}
    on:expandCategory={handleExpandCategory}
    on:expandWord={handleExpandWord}
    on:expandStatement={handleExpandStatement}
```

**Add this line:**
```svelte
    on:expandQuantity={handleExpandQuantity}
```

**Troubleshooting:**
- **Event stops here:** Check all 3 changes are made (type, handler, listener)
- **Handler not called:** Verify `on:expandQuantity` is on NodeRenderer, not somewhere else
- **TypeScript error:** Ensure dispatcher type matches exactly

---

### Step 4: Update universal/+page.svelte

**File:** `src/routes/universal/+page.svelte`

**Purpose:** Handle expansion - fetch data, transform, add to graph, center viewport

#### Change 1: Add import (~line 45)

**Find import section with other expansion services:**
```typescript
import { fetchWordExpansion } from '$lib/services/graph/WordExpansionService';
import { fetchCategoryExpansion } from '$lib/services/graph/CategoryExpansionService';
import { fetchStatementExpansion } from '$lib/services/graph/StatementExpansionService';
```

**Add this:**
```typescript
import { fetchQuantityExpansion, type QuantityExpansionResponse } from '$lib/services/graph/QuantityExpansionService';
```

#### Change 2: Add handler function (~line 1100-1200)

**Add after other expand handlers:**
```typescript
async function handleExpandQuantity(event: CustomEvent<{
    quantityId: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { quantityId, sourceNodeId, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] Quantity expansion requested:', {
        quantityId, sourceNodeId, sourcePosition
    });
    
    try {
        // Check if already exists
        const existingNode = graphData.nodes.find(n => 
            n.type === 'quantity' && n.id === quantityId
        );
        
        if (existingNode) {
            console.log('[UNIVERSAL-PAGE] Quantity already exists, centering:', quantityId);
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(quantityId, 750);
            }
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Quantity not in graph, fetching expansion data...');
        
        // Fetch data
        const expansionData = await fetchQuantityExpansion(quantityId);
        const quantityApiNode = expansionData.nodes[0];
        
        if (!quantityApiNode) {
            console.error('[UNIVERSAL-PAGE] No quantity node in expansion response');
            return;
        }
        
        // ⚠️ CRITICAL: Extract correct field name
        // Check backend controller to verify field name!
        const questionText = (quantityApiNode as any).question || 
                            (quantityApiNode as any).content || 
                            (quantityApiNode as any).text || 
                            '';
        
        if (!questionText) {
            console.error('[UNIVERSAL-PAGE] No question text found! Available fields:', 
                Object.keys(quantityApiNode));
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Question text extracted:', questionText.substring(0, 50) + '...');
        
        // Calculate position
        const quantityPosition = calculateProximalPosition(
            sourcePosition,
            graphData.nodes as any[],
            150
        );
        
        console.log('[UNIVERSAL-PAGE] Calculated position:', quantityPosition);
        
        // Transform to GraphNode
        const quantityGraphNode: GraphNode = {
            id: quantityApiNode.id,
            type: 'quantity' as NodeType,
            data: {
                id: quantityApiNode.id,
                question: questionText,
                unitCategoryId: (quantityApiNode as any).unitCategoryId || null,
                defaultUnitId: (quantityApiNode as any).defaultUnitId || null,
                responses: (quantityApiNode as any).metadata?.responses || {},
                createdBy: (quantityApiNode as any).created_by || 
                          (quantityApiNode as any).createdBy || '',
                publicCredit: (quantityApiNode as any).public_credit ?? 
                             (quantityApiNode as any).publicCredit ?? true,
                createdAt: (quantityApiNode as any).created_at || 
                          (quantityApiNode as any).createdAt || new Date().toISOString(),
                updatedAt: (quantityApiNode as any).updated_at || 
                          (quantityApiNode as any).updatedAt,
                keywords: (quantityApiNode as any).keywords || [],
                categories: (quantityApiNode as any).categories || [],
                positiveVotes: (quantityApiNode as any).metadata?.votes?.positive || 0,
                negativeVotes: (quantityApiNode as any).metadata?.votes?.negative || 0,
                netVotes: (quantityApiNode as any).metadata?.votes?.net || 0
            },
            group: 'quantity' as NodeGroup,
            mode: 'preview' as NodeMode,
            metadata: {
                group: 'quantity' as any,
                initialPosition: quantityPosition,
                net_votes: (quantityApiNode as any).metadata?.votes?.net || 0,
                participant_count: (quantityApiNode as any).participant_count || 0
            }
        };
        
        console.log('[UNIVERSAL-PAGE] ✅ Created quantity node:', {
            quantityId: quantityGraphNode.id,
            questionText: questionText.substring(0, 50) + '...',
            position: quantityPosition
        });
        
        // Create expanded graph data
        if (graphStore) {
            const expandedGraphData: GraphData = {
                nodes: [...graphData.nodes, quantityGraphNode],
                links: [...graphData.links]
            };
            
            console.log('[UNIVERSAL-PAGE] Adding quantity via updateState...', {
                previousNodeCount: graphData.nodes.length,
                newNodeCount: expandedGraphData.nodes.length
            });
            
            // Use updateState with 0.6 wake power
            if (typeof (graphStore as any).updateState === 'function') {
                console.log('[UNIVERSAL-PAGE] Calling updateState with 0.6 wake power');
                (graphStore as any).updateState(expandedGraphData, 0.6);
            } else {
                console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
                graphStore.setData(expandedGraphData);
            }
        }
        
        // Wait for positioning then center
        waitForNodePositionAndCenter(graphStore, quantityGraphNode.id, 20, 100, 750);
        
        console.log('[UNIVERSAL-PAGE] Quantity expansion complete');
        
    } catch (error) {
        console.error('[UNIVERSAL-PAGE] Error expanding quantity:', error);
    }
}
```

**⚠️ FIELD NAME EXTRACTION - MOST COMMON ISSUE:**
```typescript
const questionText = (quantityApiNode as any).question ||  // ← Backend field name
                    (quantityApiNode as any).content ||    // ← Fallback
                    (quantityApiNode as any).text ||       // ← Fallback
                    '';
```

**How to find correct field name:**
1. Check backend controller DTO
2. Look at expansion service debug logs
3. Check Network tab response

#### Change 3: Add event listener (~line 1460)

**Find the Graph component:**
```svelte
<Graph 
    data={graphData}
    viewType={viewType}
    bind:graphStore={graphStore}
    on:modechange={handleNodeModeChange}
    on:visibilitychange={handleVisibilityChange}
    on:filterchange={handleFilterChange}
    on:expandCategory={handleExpandCategory}
    on:expandWord={handleExpandWord}
    on:expandStatement={handleExpandStatement}
```

**Add this line:**
```svelte
    on:expandQuantity={handleExpandQuantity}
```

**Troubleshooting:**
- **Node invisible:** Wrong field name for main content
- **Node at (0,0):** `calculateProximalPosition` not called
- **Graph doesn't center:** `waitForNodePositionAndCenter` not called
- **API error:** Check endpoint path and authentication

---

### Step 5: Update Review Component

**File:** `src/lib/components/forms/createNode/quantity/QuantityReview.svelte`

**Purpose:** Dispatch expansion event after successful creation

#### Change 1: Add to dispatcher type

**Find dispatcher:**
```typescript
const dispatch = createEventDispatcher<{
    back: void;
    success: { message: string; };
    error: { message: string; };
}>();
```

**Modify to:**
```typescript
const dispatch = createEventDispatcher<{
    back: void;
    success: { message: string; quantityId: string; };  // ← Add ID
    error: { message: string; };
    expandQuantity: { quantityId: string; };  // ← Add this
}>();
```

#### Change 2: Dispatch after successful creation

**Find the `handleSubmit` function, after successful API call:**
```typescript
export async function handleSubmit() {
    // ... validation ...
    
    try {
        const quantityData = {
            question: question.trim(),
            // ... other fields
        };
        
        const createdQuantity = await fetchWithAuth('/nodes/quantity', {
            method: 'POST',
            body: JSON.stringify(quantityData),
        });
        
        if (!createdQuantity?.id) {
            throw new Error('Created quantity data is incomplete');
        }
        
        const successMsg = `Quantity created successfully`;
        dispatch('success', {
            message: successMsg,
            quantityId: createdQuantity.id  // ← Include ID
        });
        
        // ⚠️ ADD THIS:
        setTimeout(() => {
            console.log('[QuantityReview] Dispatching expandQuantity event');
            dispatch('expandQuantity', {
                quantityId: createdQuantity.id
            });
        }, 500);
        
    } catch (e) {
        // ... error handling
    }
}
```

**Troubleshooting:**
- **No expansion:** Check `dispatch('expandQuantity', ...)` is called
- **Timing issue:** 500ms delay allows success message to show first
- **Missing ID:** Verify backend returns node ID in response

---

## Testing & Verification

### Expected Console Logs (Complete Chain)

After creating a node, you should see these logs in order:

```
1. [QuantityReview] Submitting: { question: "...", ... }
2. [QuantityReview] Response: { id: "abc123", ... }
3. [QuantityReview] Dispatching expandQuantity event
4. [CreateNodeNode] Quantity created, forwarding with source context: { quantityId: "abc123", ... }
5. [CreateNodeNode] expandQuantity event dispatched to parent
6. [Graph] Quantity expansion event received: { quantityId: "abc123", ... }
7. [Graph] Quantity expansion event forwarded to parent page
8. [UNIVERSAL-PAGE] Quantity expansion requested: { quantityId: "abc123", ... }
9. [UNIVERSAL-PAGE] Quantity not in graph, fetching expansion data...
10. [QuantityExpansionService] Fetching expansion for quantity: abc123
11. [QuantityExpansionService] Response fields: ['id', 'question', ...]
12. [UNIVERSAL-PAGE] Question text extracted: "..."
13. [UNIVERSAL-PAGE] ✅ Created quantity node: { quantityId: "abc123", ... }
14. [UNIVERSAL-PAGE] Adding quantity via updateState...
15. [UNIVERSAL-PAGE] Calling updateState with 0.6 wake power
16. [UNIVERSAL-PAGE] Waiting for node positioning...
17. [UNIVERSAL-PAGE] ✅ Node positioned after 1 attempts
18. [UNIVERSAL-PAGE] Quantity expansion complete
```

**If logs stop at a certain step, go to Troubleshooting section.**

### Visual Verification Checklist

- [ ] Node appears in graph
- [ ] Node has visible text (not blank circle)
- [ ] Node positioned near source node (not at origin 0,0)
- [ ] Graph viewport centers on new node
- [ ] Can click node to expand to detail mode
- [ ] Can vote on node (if applicable)
- [ ] Can create multiple nodes in sequence without issues

### Quick Test Commands

Paste into browser console:

```javascript
// Verify handlers exist
console.log({
    service: typeof fetchQuantityExpansion,
    pageHandler: typeof handleExpandQuantity,
    createNodeHandler: typeof handleQuantityCreated
});

// Check current graph state
console.log('Nodes:', graphData.nodes.map(n => ({
    id: n.id.substring(0, 8),
    type: n.type,
    hasPosition: !!(n.position?.x)
})));

// Find specific node
const nodeId = 'paste-id-here';
const node = graphData.nodes.find(n => n.id === nodeId);
console.log('Node data:', node?.data);
console.log('Has content:', !!node?.data?.question);
```

---

## Troubleshooting

### Issue: Logs Stop at Step 3 (Review Component)

**Problem:** Event never dispatched from review

**Check:**
1. Dispatcher type includes `expandQuantity`
2. `dispatch('expandQuantity', ...)` is called after successful creation
3. Backend response includes node ID

**Fix:**
```typescript
// Add to dispatcher type
expandQuantity: { quantityId: string };

// Add after successful creation
setTimeout(() => {
    dispatch('expandQuantity', { quantityId: created.id });
}, 500);
```

---

### Issue: Logs Stop at Step 5 (CreateNodeNode Not Receiving)

**Problem:** CreateNodeNode isn't receiving event from review

**Check:**
1. `on:expandQuantity={handleQuantityCreated}` is on the Review component
2. Handler function `handleQuantityCreated` exists
3. Event name spelling matches exactly (case-sensitive)

**Fix:**
```svelte
<QuantityReview
    on:expandQuantity={handleQuantityCreated}
/>
```

---

### Issue: Logs Stop at Step 7 (Graph Not Receiving)

**Problem:** Graph.svelte isn't receiving event

**Check:**
1. All 3 changes made to Graph.svelte (type, handler, listener)
2. `on:expandQuantity` is on NodeRenderer component
3. Handler calls `dispatch('expandQuantity', event.detail)`

**Fix:** Verify all 3 Graph.svelte changes are present

---

### Issue: Logs Stop at Step 9 (Page Not Receiving)

**Problem:** universal/+page not receiving event

**Check:**
1. Handler function `handleExpandQuantity` exists
2. `on:expandQuantity={handleExpandQuantity}` is on Graph component
3. Import statement exists for expansion service

**Fix:**
```svelte
<Graph
    on:expandQuantity={handleExpandQuantity}
/>
```

---

### Issue: Node Appears But Is Invisible

**Problem:** Node exists in graph but renders blank

**Cause:** Wrong field name for main content

**Debug:**
```typescript
console.log('[DEBUG] Available fields:', Object.keys(apiNode));
console.log('[DEBUG] Content in field:', {
    question: apiNode.question,
    content: apiNode.content,
    text: apiNode.text
});
```

**Fix:** Update field extraction with correct backend field name:
```typescript
const text = (apiNode as any).correctFieldName || 
            (apiNode as any).content || 
            (apiNode as any).text || 
            '';
```

---

### Issue: Node Appears at Origin (0,0)

**Problem:** Node renders but positioned at (0, 0)

**Cause:** Position not calculated or not applied

**Check:**
1. `calculateProximalPosition` is called
2. `sourcePosition` is passed from CreateNodeNode
3. `metadata.initialPosition` is set on GraphNode

**Fix:**
```typescript
const position = calculateProximalPosition(
    sourcePosition,
    graphData.nodes as any[],
    150
);

// ... later in GraphNode
metadata: {
    initialPosition: position,  // ← Must be set
    // ...
}
```

---

### Issue: Graph Doesn't Center on Node

**Problem:** Node appears but viewport doesn't move

**Cause:** Centering function not called or node ID mismatch

**Check:**
1. `waitForNodePositionAndCenter` is called
2. Node ID passed to centering function matches created node ID

**Fix:**
```typescript
waitForNodePositionAndCenter(graphStore, quantityGraphNode.id, 20, 100, 750);
```

---

### Issue: API Returns 404

**Problem:** Backend endpoint not found

**Cause:** Wrong endpoint path or controller not registered

**Debug:**
1. Check Network tab for actual request URL
2. Verify backend controller route
3. Test endpoint directly in Postman

**Fix:** Update endpoint in expansion service:
```typescript
const response = await fetchWithAuth(`/correct/path/${nodeId}`);
```

---

## Code Templates

### Quick Copy-Paste: Expansion Service

```typescript
// Replace: Quantity → YourType, question → yourField
import { fetchWithAuth } from '../api';

export interface QuantityExpansionResponse {
    nodes: Array<{
        id: string;
        type: 'quantity';
        question: string;
        // Add your node-specific fields
    }>;
    relationships: Array<{
        id: string;
        source: string;
        target: string;
        type: string;
    }>;
}

export async function fetchQuantityExpansion(
    quantityId: string
): Promise<QuantityExpansionResponse> {
    console.log('[QuantityExpansionService] Fetching:', quantityId);
    const response = await fetchWithAuth(`/nodes/quantity/${quantityId}`);
    console.log('[QuantityExpansionService] Fields:', Object.keys(response));
    return { nodes: [response], relationships: [] };
}
```

---

### Quick Copy-Paste: CreateNodeNode Handler

```typescript
// Add to dispatcher type
expandQuantity: {
    quantityId: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
};

// Add handler function
function handleQuantityCreated(event: CustomEvent<{ quantityId: string }>) {
    console.log('[CreateNodeNode] Quantity created, forwarding');
    dispatch('expandQuantity', {
        quantityId: event.detail.quantityId,
        sourceNodeId: node.id,
        sourcePosition: { x: node.position?.x || 0, y: node.position?.y || 0 }
    });
}

// Add to Review component
<QuantityReview on:expandQuantity={handleQuantityCreated} />
```

---

### Quick Copy-Paste: Graph.svelte Handler

```typescript
// Add to dispatcher type
expandQuantity: {
    quantityId: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
};

// Add handler function
function handleExpandQuantity(event: CustomEvent<{...}>) {
    console.log('[Graph] Quantity expansion received');
    dispatch('expandQuantity', event.detail);
}

// Add to NodeRenderer
<NodeRenderer on:expandQuantity={handleExpandQuantity} />
```

---

### Quick Copy-Paste: Review Component Dispatch

```typescript
// Add to dispatcher type
expandQuantity: { quantityId: string };

// Add after successful creation
const created = await fetchWithAuth('/nodes/quantity', {...});
dispatch('success', { message: '...', quantityId: created.id });
setTimeout(() => {
    dispatch('expandQuantity', { quantityId: created.id });
}, 500);
```

---

## Quick Reference Card

### The 5 Files Checklist

- [ ] **ExpansionService.ts** - Fetch from API, log fields
- [ ] **CreateNodeNode.svelte** - Type, handler, listener
- [ ] **Graph.svelte** - Type, handler, listener on NodeRenderer
- [ ] **universal/+page.svelte** - Import, handler, listener on Graph
- [ ] **Review.svelte** - Type, dispatch after create

### Common Replacements

Replace these in templates:
- `Quantity` → `YourType` (PascalCase)
- `quantity` → `yourtype` (lowercase)
- `question` → `yourContentField`
- `/nodes/quantity/` → `/your/endpoint/`

### Field Name Debug

```typescript
// Add this to see available fields
console.log('Available:', Object.keys(apiNode));

// Use fallback chain
const text = apiNode.yourField || apiNode.content || apiNode.text || '';
```

### Time Estimates

- First implementation: 30-45 minutes
- Subsequent types: 15-20 minutes each
- Debugging stuck issue: Use troubleshooting section

---

## Next Node Types to Implement

Recommended order:
1. ✅ Word - Done
2. ✅ Category - Done
3. ✅ Statement - Done
4. **Quantity** - Use this guide
5. **Answer** - Similar to statement
6. **Evidence** - Similar to statement
7. **OpenQuestion** - May have child answers

Total remaining time: ~1.5 hours for all

---

## Success Criteria

You've successfully implemented expansion when:

✅ All 18 console logs appear in correct order
✅ Node appears with visible content
✅ Node positioned near source
✅ Graph centers on node
✅ Can expand to detail mode
✅ Can vote on node
✅ Can create multiple nodes sequentially

---

*Save this guide - you'll reference it for each new node type!*