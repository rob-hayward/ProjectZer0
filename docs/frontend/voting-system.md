# Node Voting System - Architecture & Implementation Guide

**Document:** Node Voting System  
**Project:** ProjectZer0 Frontend  
**Version:** 1.0  
**Date:** October 20, 2025  
**Status:** Current Implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Voting Patterns](#voting-patterns)
3. [Implementation Guide](#implementation-guide)
4. [Metadata Management](#metadata-management)
5. [API Integration](#api-integration)
6. [Testing & Verification](#testing--verification)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### The Centralized Voting System

All node voting in ProjectZer0 uses the **centralized `voteBehaviour.ts` system**. This architecture:

- ✅ **Eliminates ~800 lines** of duplicate voting code
- ✅ **Ensures consistency** across all 9 node types
- ✅ **Provides real-time optimistic updates** with automatic rollback on failure
- ✅ **Handles error recovery** with 3-attempt retry logic
- ✅ **Manages metadata** automatically for UI state persistence
- ✅ **Integrates with graph store** for visibility calculations

### Core Components

**File:** `src/lib/components/graph/nodes/behaviours/voteBehaviour.ts`

**Key Features:**
- Optimistic UI updates (instant feedback)
- Automatic rollback on API failure
- Rate limiting protection
- Reactive state management via Svelte stores
- Direct data object mutation for reactivity
- Graph store integration for visibility
- Metadata synchronization

---

## Voting Patterns

### Pattern Matrix

| Node Type | Inclusion Voting | Content Voting | Metadata Keys |
|-----------|-----------------|----------------|---------------|
| **Word** | ✅ | ❌ | `inclusionVoteStatus` |
| **Category** | ✅ | ❌ | `inclusionVoteStatus` |
| **OpenQuestion** | ✅ | ❌ | `inclusionVoteStatus` |
| **Quantity** | ✅ | ❌ | `inclusionVoteStatus` |
| **Evidence** | ✅ | ❌ | `inclusionVoteStatus` |
| **Comment** | ❌ | ✅ | `contentVoteStatus` |
| **Definition** | ✅ | ✅ | `inclusionVoteStatus` + `contentVoteStatus` |
| **Statement** | ✅ | ✅ | `inclusionVoteStatus` + `contentVoteStatus` |
| **Answer** | ✅ | ✅ | `inclusionVoteStatus` + `contentVoteStatus` |

### Pattern 1: Single-Voting (Inclusion Only)

**Used by:** Word, Category, OpenQuestion, Quantity, Evidence

**Philosophy:** Users vote on whether the content should exist in the knowledge graph.

**UI Component:** `InclusionVoteButtons` (Include/Exclude with add/remove icons)

**Example Implementation:**
```typescript
// WordNode.svelte (simplified)
import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
import { graphStore } from '$lib/stores/graphStore';

let wordData = node.data; // CRITICAL: let not const
let inclusionVoting: VoteBehaviour;

onMount(async () => {
    inclusionVoting = createVoteBehaviour(node.id, 'word', {
        apiIdentifier: displayWord, // Use word text as identifier
        dataObject: wordData,
        dataProperties: {
            positiveVotesKey: 'inclusionPositiveVotes',
            negativeVotesKey: 'inclusionNegativeVotes'
        },
        getVoteEndpoint: (word) => `/nodes/word/${encodeURIComponent(word)}/vote`,
        getRemoveVoteEndpoint: (word) => `/nodes/word/${encodeURIComponent(word)}/vote/remove`,
        graphStore,
        onDataUpdate: () => {
            wordData = { ...wordData }; // Trigger reactivity
        },
        metadataConfig: {
            nodeMetadata: node.metadata,
            voteStatusKey: 'inclusionVoteStatus'
        }
    });

    await inclusionVoting.initialize({
        positiveVotes: inclusionPositiveVotes,
        negativeVotes: inclusionNegativeVotes,
        skipVoteStatusFetch: false
    });
});

// Vote handler
async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
    if (!inclusionVoting) return;
    await inclusionVoting.handleVote(event.detail.voteType);
}

// Get reactive state
$: votingState = inclusionVoting?.getCurrentState() || {
    isVoting: false,
    voteSuccess: false,
    lastVoteType: null
};
```

### Pattern 2: Dual-Voting (Inclusion + Content)

**Used by:** Definition, Statement, Answer

**Philosophy:** 
- **Inclusion voting:** Should this content exist?
- **Content voting:** Is this content accurate/well-written?

**UI Components:** 
- `InclusionVoteButtons` (Include/Exclude)
- `ContentVoteButtons` (Agree/Disagree with thumbs)

**Example Implementation:**
```typescript
// StatementNode.svelte (simplified)
let statementData = node.data; // CRITICAL: let not const
let inclusionVoting: VoteBehaviour;
let contentVoting: VoteBehaviour;

onMount(async () => {
    // INCLUSION voting behaviour
    inclusionVoting = createVoteBehaviour(node.id, 'statement', {
        apiIdentifier: statementData.id,
        dataObject: statementData,
        dataProperties: {
            positiveVotesKey: 'inclusionPositiveVotes',
            negativeVotesKey: 'inclusionNegativeVotes'
        },
        getVoteEndpoint: (id) => `/statements/${id}/inclusion-vote`,
        getRemoveVoteEndpoint: (id) => `/statements/${id}/inclusion-vote/remove`,
        graphStore,
        onDataUpdate: () => {
            statementData = { ...statementData };
        },
        metadataConfig: {
            nodeMetadata: node.metadata,
            voteStatusKey: 'inclusionVoteStatus',
            metadataGroup: 'statement'
        }
    });

    // CONTENT voting behaviour
    contentVoting = createVoteBehaviour(node.id, 'statement', {
        apiIdentifier: statementData.id,
        dataObject: statementData,
        dataProperties: {
            positiveVotesKey: 'contentPositiveVotes',
            negativeVotesKey: 'contentNegativeVotes'
        },
        getVoteEndpoint: (id) => `/statements/${id}/content-vote`,
        getRemoveVoteEndpoint: (id) => `/statements/${id}/content-vote/remove`,
        graphStore,
        onDataUpdate: () => {
            statementData = { ...statementData };
        },
        metadataConfig: {
            nodeMetadata: node.metadata,
            voteStatusKey: 'contentVoteStatus',
            metadataGroup: 'statement'
        }
    });

    // Initialize both in parallel
    await Promise.all([
        inclusionVoting.initialize({
            positiveVotes: inclusionPositiveVotes,
            negativeVotes: inclusionNegativeVotes,
            skipVoteStatusFetch: false
        }),
        contentVoting.initialize({
            positiveVotes: contentPositiveVotes,
            negativeVotes: contentNegativeVotes,
            skipVoteStatusFetch: false
        })
    ]);
});

// Separate vote handlers
async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
    if (!inclusionVoting) return;
    await inclusionVoting.handleVote(event.detail.voteType);
}

async function handleContentVote(event: CustomEvent<{ voteType: VoteStatus }>) {
    if (!contentVoting) return;
    await contentVoting.handleVote(event.detail.voteType);
}

// Get reactive state for each
$: inclusionVotingState = inclusionVoting?.getCurrentState() || {
    isVoting: false,
    voteSuccess: false,
    lastVoteType: null
};

$: contentVotingState = contentVoting?.getCurrentState() || {
    isVoting: false,
    voteSuccess: false,
    lastVoteType: null
};
```

### Pattern 3: Content-Only Voting (Special Case)

**Used by:** Comment

**Philosophy:** Freedom of speech - all comments are included by default, users vote on quality/agreement

**UI Component:** `ContentVoteButtons` (Agree/Disagree)

**Example Implementation:**
```typescript
// CommentNode.svelte (simplified)
let commentData = node.data; // CRITICAL: let not const
let voteBehaviour: VoteBehaviour;

onMount(async () => {
    voteBehaviour = createVoteBehaviour(node.id, 'comment', {
        voteStore: discussionStore,
        graphStore,
        apiIdentifier: node.id,
        dataObject: commentData,
        dataProperties: {
            positiveVotesKey: 'positiveVotes',
            negativeVotesKey: 'negativeVotes'
        },
        getVoteEndpoint: (id) => `/comments/${id}/vote`,
        getRemoveVoteEndpoint: (id) => `/comments/${id}/vote/remove`,
        onDataUpdate: () => {
            commentData = { ...commentData };
        },
        metadataConfig: {
            nodeMetadata: node.metadata,
            voteStatusKey: 'contentVoteStatus' // Content voting only
        }
    });

    await voteBehaviour.initialize({
        positiveVotes: commentData.positiveVotes,
        negativeVotes: commentData.negativeVotes,
        skipVoteStatusFetch: false
    });
});
```

---

## Special Cases

### Evidence Node: Dual System (Inclusion Voting + Peer Review)

**Used by:** Evidence

Evidence nodes use a **dual system** that combines standard inclusion voting with a specialized peer review system:

**Inclusion Voting:**
- Standard include/exclude voting (same as other nodes)
- Determines visibility and graph inclusion
- Uses `InclusionVoteButtons` component

**Peer Review System:**
- **Separate from voting** - not managed by voteBehaviour
- Users rate evidence on three dimensions:
  - **Quality Score** (1-5): Source reliability, methodology rigor
  - **Independence Score** (1-5): Potential bias, funding sources
  - **Relevance Score** (1-5): How well it supports parent node
- Community aggregates displayed as overall score
- Star rating UI for submission

**Why Two Systems?**
- **Inclusion voting** → Community consensus on whether evidence should exist
- **Peer review** → Expert assessment of evidence quality

**Implementation Note:**
The peer review system is implemented separately in `EvidenceNode.svelte` and does NOT use voteBehaviour. It has its own API endpoints (`/evidence/{id}/review`) and state management.

### Quantity Node: Response Submission Beyond Voting

**Used by:** Quantity

Quantity nodes have standard inclusion voting plus specialized response functionality:

**Inclusion Voting:**
- Standard include/exclude voting
- Determines whether question should exist in graph

**Response System:**
- Users submit numerical responses with units
- Statistics calculated from all responses (mean, median, range)
- Unit conversion handled via `unitPreferenceStore`
- Visualization with distribution charts

**Why Different?**
- **Inclusion voting** → Should this quantity question exist?
- **Response submission** → What's your answer to the question?

**Special Considerations:**
- Larger node radius (200 vs 150) requires custom position offsets
- Uses `titleYOffset`, `categoryTagsYOffset` props on BaseDetailNode
- Integrates with `QuantityVisualization` component

**Implementation Note:**
Response submission uses separate API endpoints (`/quantities/{id}/responses`) and is not managed by voteBehaviour. State is managed via `userResponse` and `statistics` variables.

---

## Implementation Guide

### Step 1: Change `const` to `let`

**CRITICAL:** Data must be mutable for reactivity

```typescript
// ❌ WRONG
const nodeData = node.data;

// ✅ CORRECT
let nodeData = node.data;
```

### Step 2: Extract Vote Data

```typescript
// Extract vote counts using getNeo4jNumber utility
$: inclusionPositiveVotes = getNeo4jNumber(nodeData.inclusionPositiveVotes) || 0;
$: inclusionNegativeVotes = getNeo4jNumber(nodeData.inclusionNegativeVotes) || 0;
$: inclusionNetVotes = getNeo4jNumber(nodeData.inclusionNetVotes) || 
    (inclusionPositiveVotes - inclusionNegativeVotes);

// Extract user vote status from metadata
$: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
```

### Step 3: Create VoteBehaviour Instance

```typescript
let inclusionVoting: VoteBehaviour;

onMount(async () => {
    inclusionVoting = createVoteBehaviour(node.id, 'nodetype', {
        // Configuration here
    });

    await inclusionVoting.initialize({
        positiveVotes: inclusionPositiveVotes,
        negativeVotes: inclusionNegativeVotes,
        skipVoteStatusFetch: false
    });
});
```

### Step 4: Create Vote Handler

```typescript
async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
    if (!inclusionVoting) return;
    await inclusionVoting.handleVote(event.detail.voteType);
}
```

### Step 5: Get Reactive State

```typescript
$: votingState = inclusionVoting?.getCurrentState() || {
    isVoting: false,
    voteSuccess: false,
    lastVoteType: null
};
```

### Step 6: Connect to UI Components

```typescript
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

---

## Metadata Management

### Vote Status Tracking

The voting system automatically updates `node.metadata` to persist vote button states:

```typescript
// Single-voting nodes
node.metadata.inclusionVoteStatus = {
    status: 'agree' | 'disagree' | null
}

// Dual-voting nodes
node.metadata.inclusionVoteStatus = {
    status: 'agree' | 'disagree' | null
}
node.metadata.contentVoteStatus = {
    status: 'agree' | 'disagree' | null
}

// Comment (content-only)
node.metadata.contentVoteStatus = {
    status: 'agree' | 'disagree' | null
}
```

### Metadata Configuration

```typescript
metadataConfig: {
    nodeMetadata: node.metadata,           // Reference to metadata object
    voteStatusKey: 'inclusionVoteStatus',  // Which key to update
    metadataGroup: 'statement'             // Optional: for dual-voting nodes
}
```

### Why Metadata Matters

1. **UI State Persistence:** Vote buttons show correct state on re-render
2. **User Context:** Backend enriches metadata with user's vote history
3. **Optimistic Updates:** Immediate UI feedback before API confirmation
4. **Error Recovery:** Automatic rollback if vote fails

---

## API Integration

### Endpoint Patterns

**Single-Voting (Inclusion):**
```
POST   /nodes/{type}/{id}/vote              (cast vote)
DELETE /nodes/{type}/{id}/vote/remove       (remove vote)
```

**Dual-Voting (Inclusion + Content):**
```
POST   /{type}s/{id}/inclusion-vote         (inclusion vote)
DELETE /{type}s/{id}/inclusion-vote/remove  (remove inclusion)
POST   /{type}s/{id}/content-vote           (content vote)
DELETE /{type}s/{id}/content-vote/remove    (remove content)
```

**Content-Only (Comments):**
```
POST   /comments/{id}/vote                  (content vote)
DELETE /comments/{id}/vote/remove           (remove vote)
```

### API Response Format

```typescript
{
    inclusionPositiveVotes: 15,    // Neo4j Integer or number
    inclusionNegativeVotes: 3,     // Neo4j Integer or number
    inclusionNetVotes: 12,         // Calculated
    contentPositiveVotes: 20,      // For dual-voting nodes
    contentNegativeVotes: 5,       // For dual-voting nodes
    contentNetVotes: 15            // Calculated
}
```

### Error Handling

VoteBehaviour includes automatic retry logic:

1. **Attempt 1:** Initial API call
2. **Attempt 2:** Retry after 1 second (if failed)
3. **Attempt 3:** Retry after 2 seconds (if failed)
4. **Rollback:** Revert optimistic update if all attempts fail

---

## Testing & Verification

### Manual Testing Checklist

**For Each Node Type:**

- [ ] **Vote Toggle:** Click agree, click again (should remove vote)
- [ ] **Vote Switch:** Click agree, then disagree (should switch)
- [ ] **Loading State:** Buttons show loading spinner during API call
- [ ] **Success Animation:** Brief success indication after vote
- [ ] **Vote Counts:** Numbers update correctly
- [ ] **Metadata Sync:** Vote status persists on re-render
- [ ] **Error Recovery:** Vote reverts if API fails
- [ ] **Optimistic Update:** UI updates immediately before API response

### Integration Testing

```typescript
// Test vote behaviour
test('should handle vote correctly', async () => {
    const voteBehaviour = createVoteBehaviour('test-node', 'statement', {
        // ... config
    });

    await voteBehaviour.initialize({
        positiveVotes: 10,
        negativeVotes: 2
    });

    const success = await voteBehaviour.handleVote('agree');
    expect(success).toBe(true);

    const state = voteBehaviour.getCurrentState();
    expect(state.userVoteStatus).toBe('agree');
    expect(state.positiveVotes).toBe(11);
});
```

---

## Troubleshooting

### Issue: Votes Not Updating

**Symptom:** Click vote button, nothing happens

**Solutions:**
1. Check `let nodeData = node.data` (not `const`)
2. Verify `onDataUpdate` callback triggers reactivity
3. Check browser console for API errors
4. Verify metadata config is present

### Issue: Vote Status Not Persisting

**Symptom:** Vote button state resets on re-render

**Solutions:**
1. Verify `metadataConfig` is properly configured
2. Check `voteStatusKey` matches node type pattern
3. Ensure `node.metadata` object exists

### Issue: Duplicate API Calls

**Symptom:** Multiple API calls for single vote

**Solutions:**
1. Check for duplicate event handlers
2. Verify `isVoting` guard in vote handler
3. Look for reactive statement triggering re-initialization

### Issue: Graph Store Not Updating

**Symptom:** Node visibility doesn't change after voting

**Solutions:**
1. Verify `graphStore` is passed to voteBehaviour
2. Check `graphStore.recalculateNodeVisibility` exists
3. Ensure inclusion vote threshold logic is correct

### Common Mistakes

```typescript
// ❌ MISTAKE 1: Using const instead of let
const nodeData = node.data;

// ✅ CORRECT
let nodeData = node.data;

// ❌ MISTAKE 2: Forgetting onDataUpdate callback
createVoteBehaviour(node.id, 'word', {
    dataObject: wordData,
    // Missing onDataUpdate!
});

// ✅ CORRECT
createVoteBehaviour(node.id, 'word', {
    dataObject: wordData,
    onDataUpdate: () => { wordData = { ...wordData }; }
});

// ❌ MISTAKE 3: Wrong metadata key
metadataConfig: {
    nodeMetadata: node.metadata,
    voteStatusKey: 'userVoteStatus' // Wrong for most nodes!
}

// ✅ CORRECT (for single-voting)
metadataConfig: {
    nodeMetadata: node.metadata,
    voteStatusKey: 'inclusionVoteStatus'
}
```

---

## Summary

### Key Principles

1. **Centralization:** All voting uses `voteBehaviour.ts`
2. **Consistency:** Same patterns across all nodes
3. **Reactivity:** Use `let` and trigger updates via callback
4. **Metadata:** Automatic vote status persistence
5. **Optimism:** Instant UI updates with rollback on failure

### By The Numbers

- **10 nodes** using centralized voting
- **~800 lines** of duplicate code eliminated
- **3 patterns:** Single, Dual, Content-only
- **100% coverage:** Every node type standardized

### Quick Reference

| Need | Use Pattern |
|------|-------------|
| Inclusion voting only | Pattern 1 (Single) |
| Inclusion + Content | Pattern 2 (Dual) |
| Content only (comments) | Pattern 3 (Content-only) |
| Vote status in metadata | All patterns (automatic) |
| Error recovery | All patterns (automatic) |
| Optimistic updates | All patterns (automatic) |

---

**End of Node Voting System Documentation**