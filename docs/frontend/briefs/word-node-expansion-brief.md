# Word & Definition Node Expansion - Implementation Brief

**Date:** November 19, 2025  
**Session Status:** Ready to implement  
**Based on:** Successful category node implementation  
**Estimated Time:** 2-3 hours

---

## 🎯 Objective

Implement word and definition node expansion in the universal graph. When a user clicks a keyword tag on any content node, load the word node and all its associated definition nodes to the graph, positioned proximally to the source node.

---

## 📋 Requirements Summary

### User Experience Flow
1. User clicks keyword tag on a statement/question/answer/etc
2. System checks if word node already exists in graph
3. If exists: center viewport on existing word node
4. If not exists:
   - Fetch word + all definitions from API
   - Position word node near clicked source node
   - Position definition nodes in a ring around word node
   - Add all nodes and relationships to graph
   - Wake simulation to push overlapping nodes apart
   - Center viewport on new word node after settling

### Key Differences from Category Expansion
- **Multiple nodes added**: 1 word node + N definition nodes (typically 1-5)
- **Hierarchical positioning**: Definitions cluster around their parent word
- **Two node types**: WordNode and DefinitionNode (not just one type)
- **Dual voting**: Definitions have BOTH inclusion and content voting

---

## ✅ Prerequisites (Already Complete from Category Work)

The following are already in place from category node implementation:
- ✅ `initialPosition` property in NodeMetadata interface
- ✅ UniversalGraphManager handles initialPosition correctly
- ✅ Graph.svelte has node rendering infrastructure
- ✅ NodeRenderer forwards events correctly
- ✅ Understanding of wake power and simulation reheating
- ✅ Pattern for avoiding gentle sync override

---

## 🔧 Implementation Tasks

### Task 1: Add Word & Definition Constants

**Files to modify:**
- `src/lib/constants/graph/coordinate-space.ts`
- `src/lib/services/graph/UniversalGraphManager.ts`

**What to add:**

#### In coordinate-space.ts:

```typescript
// NODES.SIZES (both already exist, verify they're present)
WORD: {
    DETAIL: 500,
    PREVIEW: 200
},
DEFINITION: {
    DETAIL: 600,
    PREVIEW: 320
},

// CONTENT_BOXES (both already exist, verify they're present)
WORD: {
    DETAIL: 354,
    PREVIEW: 141
},
DEFINITION: {
    DETAIL: 424,
    PREVIEW: 226
},

// PADDING.COLLISION (verify these exist)
WORD: 100,              // Smaller collision for word nodes
DEFINITION: 150,        // Standard collision for definitions

// FORCES.CHARGE.STRENGTH (verify these exist)
WORD: -900,            // Strong repulsion for word nodes
DEFINITION: {
    LIVE: -300,        // May already exist
    ALTERNATIVE: -100  // May already exist
},
```

#### In UniversalGraphManager.ts:

Add `case 'word':` and `case 'definition':` to these 7 methods:
1. `getNodeRadius()`
2. `getNodeColor()`
3. `getNodeBackground()`
4. `getNodeBorder()`
5. `getNodeHover()`
6. `getNodeGradientStart()`
7. `getNodeGradientEnd()`

**Reference:** These likely already exist from earlier work, verify and add if missing.

---

### Task 2: Verify/Fix WordNode.svelte Component

**File:** `src/lib/components/graph/nodes/word/WordNode.svelte`

**Check for these issues (same as CategoryNode had):**

#### Voting Endpoints:
```typescript
// ✅ CORRECT (verify these are used):
getVoteEndpoint: (id) => `/words/${id}/vote-inclusion`,
getRemoveVoteEndpoint: (id) => `/words/${id}/vote`,
getVoteStatusEndpoint: (id) => `/words/${id}/vote-status`,
```

#### Vote Behaviour Config:
```typescript
wordVoting = createVoteBehaviour(node.id, 'word', {
    apiIdentifier: wordData.word,  // Word uses word text, not UUID
    dataObject: wordData,
    dataProperties: {
        positiveVotesKey: 'inclusionPositiveVotes',
        negativeVotesKey: 'inclusionNegativeVotes'
    },
    apiResponseKeys: {  // ✅ Must include this
        positiveVotesKey: 'inclusionPositiveVotes',
        negativeVotesKey: 'inclusionNegativeVotes'
    },
    getVoteEndpoint: (id) => `/words/${id}/vote-inclusion`,
    getRemoveVoteEndpoint: (id) => `/words/${id}/vote`,
    getVoteStatusEndpoint: (id) => `/words/${id}/vote-status`,
    graphStore,
    metadataConfig: {  // ✅ Must include this
        nodeMetadata: node.metadata,
        voteStatusKey: 'userVoteStatus',
        metadataGroup: 'word'
    },
    voteKind: 'INCLUSION'  // ✅ Must include this
});
```

#### Slot Structure (Preview Mode):
```typescript
// ✅ CORRECT slot names:
<BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
    <svelte:fragment slot="title">...</svelte:fragment>
    <svelte:fragment slot="contentText">...</svelte:fragment>
    <svelte:fragment slot="inclusionVoting">...</svelte:fragment>
</BasePreviewNode>

// ❌ WRONG (remove if present):
// slot="content"
// slot="voting"
```

#### BaseDetailNode Props:
```typescript
// ✅ CORRECT:
<BaseDetailNode {node} on:modeChange={handleModeChange}>

// ❌ WRONG (remove if present):
<BaseDetailNode {node} {voteBasedStyles} on:modeChange={handleModeChange}>
```

#### Event Handler:
```typescript
function handleModeChange(event: CustomEvent) {
    console.log('[WordNode] handleModeChange called:', {
        nodeId: node.id,
        eventDetail: event.detail,
        currentMode: node.mode
    });
    
    dispatch('modeChange', {
        ...event.detail,
        nodeId: node.id
    });
    
    console.log('[WordNode] modeChange event dispatched');
}
```

---

### Task 3: Verify/Fix DefinitionNode.svelte Component

**File:** `src/lib/components/graph/nodes/definition/DefinitionNode.svelte`

**Critical differences from WordNode:**
- Definitions have **DUAL voting** (inclusion AND content)
- Need TWO vote behaviours (like StatementNode)

#### Vote Behaviour Config (Two Systems):

```typescript
// Inclusion voting
inclusionVoting = createVoteBehaviour(node.id, 'definition', {
    apiIdentifier: definitionData.id,
    dataObject: definitionData,
    dataProperties: {
        positiveVotesKey: 'inclusionPositiveVotes',
        negativeVotesKey: 'inclusionNegativeVotes'
    },
    apiResponseKeys: {
        positiveVotesKey: 'inclusionPositiveVotes',
        negativeVotesKey: 'inclusionNegativeVotes'
    },
    getVoteEndpoint: (id) => `/definitions/${id}/vote-inclusion`,
    getRemoveVoteEndpoint: (id) => `/definitions/${id}/vote`,
    getVoteStatusEndpoint: (id) => `/definitions/${id}/vote-status`,
    graphStore,
    metadataConfig: {
        nodeMetadata: node.metadata,
        voteStatusKey: 'inclusionVoteStatus',
        metadataGroup: 'definition'
    },
    voteKind: 'INCLUSION'
});

// Content voting
contentVoting = createVoteBehaviour(node.id, 'definition', {
    apiIdentifier: definitionData.id,
    dataObject: definitionData,
    dataProperties: {
        positiveVotesKey: 'contentPositiveVotes',
        negativeVotesKey: 'contentNegativeVotes'
    },
    apiResponseKeys: {
        positiveVotesKey: 'contentPositiveVotes',
        negativeVotesKey: 'contentNegativeVotes'
    },
    getVoteEndpoint: (id) => `/definitions/${id}/vote-content`,
    getRemoveVoteEndpoint: (id) => `/definitions/${id}/vote`,
    getVoteStatusEndpoint: (id) => `/definitions/${id}/vote-status`,
    graphStore,
    metadataConfig: {
        nodeMetadata: node.metadata,
        voteStatusKey: 'contentVoteStatus',
        metadataGroup: 'definition'
    },
    voteKind: 'CONTENT'
});
```

#### Slot Structure (Detail Mode):
```typescript
<BaseDetailNode {node} on:modeChange={handleModeChange}>
    <svelte:fragment slot="title">...</svelte:fragment>
    <svelte:fragment slot="contentText">Definition text here</svelte:fragment>
    <svelte:fragment slot="inclusionVoting">Include/Exclude voting</svelte:fragment>
    <svelte:fragment slot="contentVoting">Agree/Disagree voting</svelte:fragment>
    <svelte:fragment slot="metadata">...</svelte:fragment>
    <svelte:fragment slot="credits">...</svelte:fragment>
</BaseDetailNode>
```

**Reference:** See StatementNode.svelte for complete dual-voting example.

---

### Task 4: Add Graph.svelte Rendering (If Not Present)

**File:** `src/lib/components/graph/Graph.svelte`

**Check if these are already present in the nodes layer:**

```typescript
{:else if node.type === 'word'}
    <WordNode
        {node}
        on:modeChange={handleModeChange}
    />
{:else if node.type === 'definition'}
    <DefinitionNode
        {node}
        on:modeChange={handleModeChange}
    />
```

**If missing, add after the category node block.**

---

### Task 5: Create API Expansion Service

**File:** `src/lib/services/graph/WordExpansionService.ts` (create new file)

```typescript
import { fetchWithAuth } from '../api';

export interface WordExpansionResponse {
    nodes: Array<{
        id: string;
        type: 'word' | 'definition';
        word?: string;  // For word node
        definitionText?: string;  // For definition node
        created_by?: string;
        public_credit?: boolean;
        inclusion_positive_votes: number;
        inclusion_negative_votes: number;
        inclusion_net_votes: number;
        content_positive_votes?: number;  // Only for definitions
        content_negative_votes?: number;
        content_net_votes?: number;
        created_at: string;
        updated_at: string;
        is_api_definition?: boolean;
        is_ai_created?: boolean;
    }>;
    relationships: Array<{
        id: string;
        source: string;
        target: string;
        type: string;
        metadata?: Record<string, any>;
    }>;
}

export async function fetchWordExpansion(word: string): Promise<WordExpansionResponse> {
    console.log('[WordExpansionService] Fetching expansion for word:', word);
    
    try {
        const response = await fetchWithAuth(`/words/${word}/with-definitions`);
        
        console.log('[WordExpansionService] Expansion data received:', {
            nodeCount: response.nodes.length,
            relationshipCount: response.relationships.length
        });
        
        return response;
    } catch (error) {
        console.error('[WordExpansionService] Failed to fetch word expansion:', error);
        throw error;
    }
}
```

---

### Task 6: Implement handleExpandWord in +page.svelte

**File:** `src/routes/graph/universal/+page.svelte`

**Add this function (similar to handleExpandCategory):**

```typescript
/**
 * Handle keyword tag click - expand word and definitions in graph
 * 
 * Process:
 * 1. Check if word node already exists
 * 2. If exists: center on existing word node
 * 3. If not exists: fetch word + definitions, add to graph, center on word
 * 4. Reheat simulation to push overlapping nodes apart
 */
async function handleExpandWord(event: CustomEvent<{
    word: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { word, sourceNodeId, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] Word expansion requested:', {
        word, sourceNodeId, sourcePosition
    });
    
    try {
        // Check if word node already exists
        const existingWordNode = graphData.nodes.find(n => 
            n.type === 'word' && 
            (n.data as any).word === word
        );
        
        if (existingWordNode) {
            console.log('[UNIVERSAL-PAGE] Word already exists, centering:', word);
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(existingWordNode.id, 750);
            }
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Word not in graph, fetching expansion data...');
        
        // Fetch word + definitions
        const expansionData = await fetchWordExpansion(word);
        
        console.log('[UNIVERSAL-PAGE] Word expansion data received:', {
            totalNodeCount: expansionData.nodes.length,
            definitionCount: expansionData.nodes.filter(n => n.type === 'definition').length
        });
        
        // Extract word node and definition nodes
        const wordApiNode = expansionData.nodes.find(n => n.type === 'word');
        const definitionApiNodes = expansionData.nodes.filter(n => n.type === 'definition');
        
        if (!wordApiNode) {
            console.error('[UNIVERSAL-PAGE] No word node in expansion response');
            return;
        }
        
        // Calculate position for word node (near source)
        const wordPosition = calculateProximalPosition(
            sourcePosition,
            graphData.nodes as any[],
            150
        );
        
        console.log('[UNIVERSAL-PAGE] Calculated word position:', wordPosition);
        
        // Calculate positions for definitions (ring around word)
        const definitionPositions = calculateDefinitionRing(
            wordPosition,
            definitionApiNodes.length,
            200  // Radius of ring around word
        );
        
        // Transform word node to GraphNode
        const wordGraphNode: GraphNode = {
            id: wordApiNode.id || word,
            type: 'word' as NodeType,
            data: {
                id: wordApiNode.id || word,
                word: wordApiNode.word || word,
                createdBy: wordApiNode.created_by || wordApiNode.createdBy,
                publicCredit: wordApiNode.public_credit ?? wordApiNode.publicCredit ?? true,
                inclusionPositiveVotes: wordApiNode.inclusion_positive_votes,
                inclusionNegativeVotes: wordApiNode.inclusion_negative_votes,
                inclusionNetVotes: wordApiNode.inclusion_net_votes,
                contentPositiveVotes: 0,
                contentNegativeVotes: 0,
                contentNetVotes: 0,
                createdAt: wordApiNode.created_at,
                updatedAt: wordApiNode.updated_at
            },
            group: 'word' as NodeGroup,
            mode: 'preview' as NodeMode,
            metadata: {
                group: 'word',
                initialPosition: wordPosition,  // ✅ CRITICAL
                net_votes: wordApiNode.inclusion_net_votes
            }
        };
        
        // Transform definition nodes to GraphNode
        const definitionGraphNodes: GraphNode[] = definitionApiNodes.map((defNode, index) => ({
            id: defNode.id,
            type: 'definition' as NodeType,
            data: {
                id: defNode.id,
                word: word,
                definitionText: defNode.definitionText,
                createdBy: defNode.created_by || defNode.createdBy,
                publicCredit: defNode.public_credit ?? defNode.publicCredit ?? true,
                isApiDefinition: defNode.is_api_definition ?? false,
                isAICreated: defNode.is_ai_created ?? false,
                inclusionPositiveVotes: defNode.inclusion_positive_votes,
                inclusionNegativeVotes: defNode.inclusion_negative_votes,
                inclusionNetVotes: defNode.inclusion_net_votes,
                contentPositiveVotes: defNode.content_positive_votes || 0,
                contentNegativeVotes: defNode.content_negative_votes || 0,
                contentNetVotes: defNode.content_net_votes || 0,
                createdAt: defNode.created_at,
                updatedAt: defNode.updated_at
            },
            group: 'definition' as NodeGroup,
            mode: 'preview' as NodeMode,
            metadata: {
                group: 'definition',
                initialPosition: definitionPositions[index],  // ✅ CRITICAL
                net_votes: defNode.inclusion_net_votes
            }
        }));
        
        // Get existing node IDs for relationship filtering
        const existingNodeIds = new Set(graphData.nodes.map(n => n.id));
        existingNodeIds.add(wordGraphNode.id);
        definitionGraphNodes.forEach(n => existingNodeIds.add(n.id));
        
        // Transform relationships
        const relevantLinks: GraphLink[] = expansionData.relationships
            .filter(rel => {
                const sourceExists = existingNodeIds.has(rel.source);
                const targetExists = existingNodeIds.has(rel.target);
                return sourceExists && targetExists;
            })
            .map(rel => ({
                id: rel.id,
                source: rel.source,
                target: rel.target,
                type: rel.type as LinkType,
                metadata: rel.metadata
            }));
        
        console.log('[UNIVERSAL-PAGE] Adding word + definitions to graph:', {
            wordNodeId: wordGraphNode.id,
            definitionCount: definitionGraphNodes.length,
            relevantLinks: relevantLinks.length
        });
        
        // Add to store arrays
        nodes = [...nodes, wordApiNode, ...definitionApiNodes];
        relationships = [...relationships, ...expansionData.relationships.filter(rel => {
            const sourceExists = existingNodeIds.has(rel.source);
            const targetExists = existingNodeIds.has(rel.target);
            return sourceExists && targetExists;
        })];
        
        // Create expanded graph data
        if (graphStore) {
            const expandedGraphData: GraphData = {
                nodes: [...graphData.nodes, wordGraphNode, ...definitionGraphNodes],
                links: [...graphData.links, ...relevantLinks]
            };
            
            console.log('[UNIVERSAL-PAGE] Adding nodes via updateState...', {
                previousNodeCount: graphData.nodes.length,
                newNodeCount: expandedGraphData.nodes.length,
                addedNodes: 1 + definitionGraphNodes.length,
                previousLinkCount: graphData.links.length,
                newLinkCount: expandedGraphData.links.length
            });
            
            // ✅ CRITICAL: Use updateState with 0.6 wake power
            if (typeof (graphStore as any).updateState === 'function') {
                console.log('[UNIVERSAL-PAGE] Calling updateState with 0.6 wake power');
                (graphStore as any).updateState(expandedGraphData, 0.6);
                
                // ✅ CRITICAL: DON'T update graphData here - prevents gentle sync override
                // graphData = expandedGraphData;  // ❌ NO!
            }
            else {
                console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
                graphStore.setData(expandedGraphData);
                graphData = expandedGraphData;  // Only in fallback
            }
        }
        
        // Center on word node after delay
        setTimeout(() => {
            console.log('[UNIVERSAL-PAGE] Centering on word node...');
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(wordGraphNode.id, 750);
            }
        }, 500);  // ✅ 500ms delay for settling
        
        console.log('[UNIVERSAL-PAGE] Word expansion complete');
        
    } catch (error) {
        console.error('[UNIVERSAL-PAGE] Error expanding word:', error);
    }
}

/**
 * Calculate positions for definitions in a ring around word node
 */
function calculateDefinitionRing(
    centerPosition: { x: number; y: number },
    count: number,
    radius: number
): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const angleStep = (2 * Math.PI) / count;
    
    for (let i = 0; i < count; i++) {
        const angle = i * angleStep;
        positions.push({
            x: centerPosition.x + Math.cos(angle) * radius,
            y: centerPosition.y + Math.sin(angle) * radius
        });
    }
    
    return positions;
}
```

**Also add to the event handler mapping:**

```typescript
on:expandWord={handleExpandWord}
```

---

### Task 7: Update Content Nodes to Dispatch expandWord Event

**Files to modify:**
- `src/lib/components/graph/nodes/statement/StatementNode.svelte`
- `src/lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte`
- `src/lib/components/graph/nodes/answer/AnswerNode.svelte`
- `src/lib/components/graph/nodes/quantity/QuantityNode.svelte`
- `src/lib/components/graph/nodes/evidence/EvidenceNode.svelte`

**Add event dispatcher:**

```typescript
const dispatch = createEventDispatcher<{
    modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
    expandCategory: { categoryId: string; categoryName: string; sourceNodeId: string; sourcePosition: { x: number; y: number } };
    expandWord: { word: string; sourceNodeId: string; sourcePosition: { x: number; y: number } };  // ✅ ADD THIS
    // ... other events
}>();
```

**Add keyword click handler:**

```typescript
function handleKeywordClick(event: CustomEvent<{ word: string }>) {
    const { word } = event.detail;
    
    console.log('[StatementNode] Keyword clicked:', {
        word,
        sourceNodeId: node.id,
        sourcePosition: node.position
    });
    
    dispatch('expandWord', {
        word,
        sourceNodeId: node.id,
        sourcePosition: {
            x: node.position?.x || 0,
            y: node.position?.y || 0
        }
    });
}
```

**Update KeywordTags component binding:**

```typescript
<KeywordTags 
    {keywords}
    {radius}
    maxDisplay={8}
    on:keywordClick={handleKeywordClick}
/>
```

---

### Task 8: Add Event Forwarding in NodeRenderer and Graph

**File:** `src/lib/components/graph/nodes/NodeRenderer.svelte`

**Add to event dispatcher:**

```typescript
const dispatch = createEventDispatcher<{
    modeChange: { nodeId: string; mode: NodeMode; position?: { x: number; y: number } };
    expandCategory: { categoryId: string; categoryName: string; sourceNodeId: string; sourcePosition: { x: number; y: number } };
    expandWord: { word: string; sourceNodeId: string; sourcePosition: { x: number; y: number } };  // ✅ ADD THIS
    // ... other events
}>();
```

**Add event handler:**

```typescript
function handleExpandWord(event: CustomEvent<{
    word: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    console.log('[NodeRenderer] Word expansion event received:', event.detail);
    dispatch('expandWord', event.detail);
    console.log('[NodeRenderer] Word expansion event forwarded to Graph');
}
```

**Add to node component bindings:**

```typescript
{#if isStatementNode(node)}
    <StatementNode 
        {node}
        on:modeChange={handleModeChange}
        on:expandCategory={handleExpandCategory}
        on:expandWord={handleExpandWord}  // ✅ ADD THIS
    />
{/if}
```

**File:** `src/lib/components/graph/Graph.svelte`

**Add to event dispatcher and forwarding:**

```typescript
const dispatch = createEventDispatcher<{
    modeChange: { nodeId: string; mode: NodeMode; position?: { x: number; y: number } };
    expandCategory: { categoryId: string; categoryName: string; sourceNodeId: string; sourcePosition: { x: number; y: number } };
    expandWord: { word: string; sourceNodeId: string; sourcePosition: { x: number; y: number } };  // ✅ ADD THIS
    // ... other events
}>();

function handleExpandWord(event: CustomEvent) {
    console.log('[Graph] Word expansion event received:', event.detail);
    dispatch('expandWord', event.detail);
    console.log('[Graph] Word expansion event forwarded to parent page');
}
```

**Add to NodeRenderer binding:**

```typescript
<NodeRenderer 
    {node}
    viewType={viewType}
    on:modeChange={handleModeChange}
    on:expandCategory={handleExpandCategory}
    on:expandWord={handleExpandWord}  // ✅ ADD THIS
/>
```

---

## 🐛 Known Issues to Avoid

### Issue 1: Gentle Sync Override
**Problem:** Setting `graphData = expandedGraphData` after `updateState()` triggers a reactive update that calls `syncDataGently()`, overriding the wake.

**Solution:** Don't update `graphData` after calling `updateState()`. The manager handles it internally.

```typescript
// ✅ CORRECT:
(graphStore as any).updateState(expandedGraphData, 0.6);
// Don't set graphData here

// ❌ WRONG:
(graphStore as any).updateState(expandedGraphData, 0.6);
graphData = expandedGraphData;  // This triggers gentle sync!
```

### Issue 2: voteBasedStyles Prop
**Problem:** `<BaseNode>` doesn't accept `voteBasedStyles` prop.

**Solution:** Remove this prop from `BaseDetailNode` and `BasePreviewNode` in node components.

### Issue 3: Wrong Slot Names
**Problem:** Using old slot names (`content`, `voting`) instead of new semantic structure.

**Solution:** Use `contentText` and `inclusionVoting` (and `contentVoting` for dual-voting nodes).

### Issue 4: Missing Vote Config Properties
**Problem:** Vote behaviour not working without `apiResponseKeys`, `metadataConfig`, and `voteKind`.

**Solution:** Always include all three in `createVoteBehaviour()` config.

### Issue 5: Centering Too Early
**Problem:** Centering before simulation settles causes viewport to move while nodes are still pushing apart.

**Solution:** Use 500ms delay before centering.

---

## ✅ Testing Checklist

After implementation:

### Visual Tests
- [ ] Word node displays with correct color (golden: #FFD86E)
- [ ] Word node displays with correct size (500px detail, 200px preview)
- [ ] Definition nodes display with correct color (amber: #FFB447)
- [ ] Definition nodes display with correct size (600px detail, 320px preview)
- [ ] Nodes position near source node (not at origin)
- [ ] Definitions cluster around word node in a ring
- [ ] Nodes push apart and don't overlap severely

### Functional Tests
- [ ] Click keyword tag on statement
- [ ] Word node and definitions appear in graph
- [ ] Click same keyword again - centers on existing word (doesn't duplicate)
- [ ] Click Include/Exclude on word node - vote registers
- [ ] Click Agree/Disagree on definition node - vote registers
- [ ] Expand word to detail mode - works correctly
- [ ] Collapse back to preview mode - works correctly
- [ ] Simulation settles after ~2-3 seconds

### Console Tests
- [ ] No TypeScript errors about initialPosition
- [ ] No Svelte warnings about unknown props
- [ ] No 404 errors on voting endpoints
- [ ] No "gentle sync" override logs after updateState
- [ ] Simulation wakes with 0.6 energy
- [ ] Centering happens after 500ms delay

---

## 📊 Backend API Specification

### Endpoint
```
GET /words/{word}/with-definitions
```

### Expected Response
```typescript
{
    nodes: [
        {
            id: "artificial",
            type: "word",
            word: "artificial",
            created_by: "google-oauth2|123",
            public_credit: true,
            inclusion_positive_votes: 10,
            inclusion_negative_votes: 2,
            inclusion_net_votes: 8,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z"
        },
        {
            id: "def-uuid-1",
            type: "definition",
            word: "artificial",
            definitionText: "Made by humans rather than occurring naturally",
            created_by: "google-oauth2|456",
            public_credit: true,
            is_api_definition: false,
            is_ai_created: false,
            inclusion_positive_votes: 15,
            inclusion_negative_votes: 1,
            inclusion_net_votes: 14,
            content_positive_votes: 12,
            content_negative_votes: 2,
            content_net_votes: 10,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z"
        }
        // ... more definitions
    ],
    relationships: [
        {
            id: "rel-1",
            source: "artificial",
            target: "def-uuid-1",
            type: "has_definition",
            metadata: {}
        }
        // ... more relationships
    ]
}
```

---

## 📝 Implementation Order

1. ✅ Verify constants in coordinate-space.ts (5 min)
2. ✅ Verify UniversalGraphManager cases (10 min)
3. 🔧 Fix WordNode.svelte voting and slots (20 min)
4. 🔧 Fix DefinitionNode.svelte voting and slots (30 min)
5. 🔧 Create WordExpansionService.ts (10 min)
6. 🔧 Implement handleExpandWord in +page.svelte (30 min)
7. 🔧 Add expandWord event to content nodes (20 min)
8. 🔧 Add event forwarding in NodeRenderer/Graph (15 min)
9. 🧪 Test and debug (30 min)

**Total Estimated Time:** 2-3 hours

---

## 🎯 Success Criteria

Implementation is complete when:
1. Clicking keyword tag loads word + definitions to graph
2. Nodes position correctly (word near source, definitions around word)
3. No TypeScript errors or Svelte warnings
4. Voting works on both word and definition nodes
5. Expand/collapse mode switching works
6. Nodes don't overlap after simulation settles
7. Clicking same keyword twice centers on existing node (no duplication)

---

**END OF BRIEF**