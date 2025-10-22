# Node Layer Testing Plan

## Overview

This document outlines a comprehensive, prioritized testing strategy for the Project Zero node layer. The plan follows a bottom-up approach: test foundational behaviors first, then components, then integrations.

**Total Estimated Duration:** 2-3 weeks (9 sessions, 1-2 per day)  
**Primary Goal:** Ensure voting, visibility, and reactivity systems work reliably across all node types  
**Testing Framework:** Vitest + @testing-library/svelte + MSW

---

## Table of Contents

1. [Testing Priorities](#testing-priorities)
2. [Coverage Requirements](#coverage-requirements)
3. [Session-by-Session Plan](#session-by-session-plan)
4. [Required Files](#required-files)
5. [Testing Stack Setup](#testing-stack-setup)
6. [Testing Patterns](#testing-patterns)
7. [Success Criteria](#success-criteria)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Testing Priorities

### Tier 1: Critical Infrastructure (Test First)
**Impact:** If these fail, everything fails.

| Priority | Component | Reason | LOC | Complexity |
|----------|-----------|--------|-----|------------|
| 🔴 1 | `voteBehaviour.ts` | Powers ALL voting (9 node types) | ~800 | High |
| 🔴 2 | `visibilityBehaviour.ts` | New feature, needs validation | ~200 | Medium |
| 🔴 3 | `BaseNode.svelte` | Parent of all nodes | ~100 | Medium |
| 🔴 4 | `NodeRenderer.svelte` | Integration hub | ~300 | High |

### Tier 2: Core Voting Patterns (Test Second)
**Impact:** Validates each voting pattern works correctly.

| Priority | Component | Pattern | Example |
|----------|-----------|---------|---------|
| 🟡 5 | `WordNode.svelte` | Single-voting | Inclusion only |
| 🟡 6 | `StatementNode.svelte` | Dual-voting | Inclusion + Content |
| 🟡 7 | `CommentNode.svelte` | Content-only | Content voting only |

### Tier 3: UI Components (Test Third)
**Impact:** Shared across all nodes, must be reliable.

| Priority | Component | Users |
|----------|-----------|-------|
| 🟢 8 | `ContentVoteButtons.svelte` | 5 node types |
| 🟢 9 | `InclusionVoteButtons.svelte` | 8 node types |
| 🟢 10 | `ShowHideButton.svelte` | 8 node types |
| 🟢 11 | `VoteStats.svelte` | All votable nodes |

### Tier 4: Remaining Nodes (Test Fourth)
**Impact:** Coverage completeness.

| Priority | Component | Pattern | Notes |
|----------|-----------|---------|-------|
| 🔵 12 | `DefinitionNode.svelte` | Dual-voting | Like Statement |
| 🔵 13 | `QuantityNode.svelte` | Single-voting | Larger radius |
| 🔵 14 | `EvidenceNode.svelte` | Single-voting | Standard |
| 🔵 15 | `CategoryNode.svelte` | Single-voting | Standard |
| 🔵 16 | `AnswerNode.svelte` | Dual-voting | Like Statement |
| 🔵 17 | `OpenQuestionNode.svelte` | Single-voting | Standard |

### Tier 5: Integration Tests (Test Last)
**Impact:** Catches edge cases and cross-component issues.

| Priority | Test Suite | Scope |
|----------|------------|-------|
| ⚪ 18 | Full voting flow | UI → API → Store → Render |
| ⚪ 19 | Full visibility flow | Hide → Persist → Refresh |
| ⚪ 20 | Mode transitions | Preview ↔ Detail |
| ⚪ 21 | Cross-view consistency | Universal → Word → Statement |

---

## Coverage Requirements

### Critical Behaviors to Test

#### **1. Voting System**

**Must Cover:**
- ✅ Vote submission (agree/disagree)
- ✅ Vote toggling (agree → none, disagree → none)
- ✅ Vote switching (agree → disagree, disagree → agree)
- ✅ Optimistic updates (immediate UI change before API response)
- ✅ Rollback on failure (API error → revert to previous state)
- ✅ Metadata persistence (vote status survives re-render)
- ✅ Dual voting independence (inclusion + content separate)
- ✅ Vote count updates (positiveVotes, negativeVotes, netVotes)
- ✅ Graph store coordination (visibility recalculation)
- ✅ Store-specific handling (universal vs word vs statement stores)

**Edge Cases:**
- ✅ Rapid clicking (debouncing)
- ✅ Network failures (retry logic)
- ✅ Invalid data (Neo4j integers, null values)
- ✅ Missing metadata (graceful fallback)
- ✅ Multiple simultaneous votes
- ✅ Vote while node is hidden

#### **2. Visibility System**

**Must Cover:**
- ✅ Community hiding (netVotes < 0 → hidden)
- ✅ Community showing (netVotes >= 0 → visible)
- ✅ User override - hide (manual hide → persists)
- ✅ User override - show (show hidden → persists)
- ✅ Precedence (user > community ALWAYS)
- ✅ Persistence (localStorage + backend sync)
- ✅ Cross-session (refresh → preference holds)
- ✅ Hidden reason tracking ('user' vs 'community')
- ✅ HiddenNode rendering (correct message, net votes display)
- ✅ ShowHideButton state (icon, text, position)

**Edge Cases:**
- ✅ Toggle hide/show rapidly
- ✅ Vote changes while user override active
- ✅ Clear localStorage and reload
- ✅ Backend sync failure (offline mode)
- ✅ Multiple tabs with same node

#### **3. Reactivity System**

**Must Cover:**
- ✅ Vote count updates trigger re-render
- ✅ `let nodeData` mutability works (not const)
- ✅ `onDataUpdate` callback triggers
- ✅ Svelte reactive statements execute ($:)
- ✅ Store subscriptions fire correctly
- ✅ Derived stores update properly
- ✅ Event dispatching works
- ✅ Event bubbling (Node → NodeRenderer → Graph)

**Edge Cases:**
- ✅ Nested reactive statements
- ✅ Circular dependencies
- ✅ Subscription memory leaks
- ✅ Unsubscribe on destroy

#### **4. Mode Transitions**

**Must Cover:**
- ✅ Preview → Detail (expand)
- ✅ Detail → Preview (collapse)
- ✅ Position preservation during transition
- ✅ Data preservation during transition
- ✅ Centering animation on expand
- ✅ Vote state preservation during transition

**Edge Cases:**
- ✅ Mode change while voting
- ✅ Mode change while hidden
- ✅ Rapid mode toggling

---

## Session-by-Session Plan

### **Session 1: voteBehaviour.ts** ⭐ HIGHEST PRIORITY

**Why First:** Powers all voting across 9 node types. ~800 LOC of critical logic. If this breaks, everything breaks.

**Duration:** 4-6 hours

**Files Needed:**
- ✅ `voteBehaviour.ts` (already have)
- 📄 `types/domain/nodes.ts` (VoteStatus, Keyword types)
- 📄 `utils/neo4j-utils.ts` (getNeo4jNumber function)
- 📄 `services/api.ts` (fetchWithAuth mock)

**Test Suite Structure:**

```typescript
describe('voteBehaviour', () => {
    describe('initialization', () => {
        test('initializes with zero votes')
        test('initializes with existing votes')
        test('loads user vote status from API')
        test('handles API failure during init')
        test('skips vote status fetch with skipVoteStatusFetch flag')
        test('initializes with batch vote data')
    });
    
    describe('vote submission', () => {
        test('agree vote updates state optimistically')
        test('disagree vote updates state optimistically')
        test('API call includes correct vote type')
        test('positive votes increment on agree')
        test('negative votes increment on disagree')
        test('success animation triggers')
        test('metadata updates after successful vote')
    });
    
    describe('vote removal', () => {
        test('clicking agree twice removes vote')
        test('clicking disagree twice removes vote')
        test('calls remove vote endpoint')
        test('vote counts decrement correctly')
    });
    
    describe('vote switching', () => {
        test('agree → disagree switches correctly')
        test('disagree → agree switches correctly')
        test('counts update correctly on switch')
    });
    
    describe('optimistic updates', () => {
        test('UI updates immediately before API response')
        test('rollback on API failure')
        test('rollback on network error')
        test('rollback on validation error')
        test('preserves original state on rollback')
    });
    
    describe('data reactivity', () => {
        test('dataObject updates trigger onDataUpdate callback')
        test('store updates propagate to voteStore')
        test('graphStore visibility recalculates')
        test('metadata object updates correctly')
    });
    
    describe('dual voting', () => {
        test('inclusion and content votes are independent')
        test('both vote types can be active simultaneously')
        test('separate API endpoints called')
        test('separate metadata keys used')
    });
    
    describe('error handling', () => {
        test('prevents duplicate votes while isVoting=true')
        test('handles malformed API responses')
        test('handles null/undefined vote counts')
        test('handles Neo4j integer objects')
        test('retries on network failure')
        test('gives up after max retries')
    });
    
    describe('store coordination', () => {
        test('updates voteStore when available')
        test('updates graphStore when available')
        test('works without stores (fallback mode)')
    });
});
```

**Success Criteria:**
- ✅ All vote submission flows work
- ✅ API mocking functional
- ✅ State management validated
- ✅ Rollback logic proven
- ✅ Reactivity triggers confirmed
- ✅ No memory leaks (subscriptions cleaned up)

**Mocks Required:**
```typescript
// Mock fetchWithAuth
vi.mock('$lib/services/api', () => ({
    fetchWithAuth: vi.fn()
}));

// Mock graphStore
const mockGraphStore = {
    recalculateNodeVisibility: vi.fn(),
    updateNodeVisibility: vi.fn()
};

// Mock voteStore
const mockVoteStore = {
    updateVoteData: vi.fn(),
    getVoteData: vi.fn()
};
```

**Expected Output:**
- 40+ tests passing
- 100% coverage of voteBehaviour.ts
- Clear understanding of vote flow
- Confidence in rollback mechanism

---

### **Session 2: visibilityBehaviour.ts**

**Why Second:** New feature introduced in this chat. Needs validation before Node integration.

**Duration:** 3-4 hours

**Files Needed:**
- ✅ `visibilityBehaviour.ts` 
- ✅ `visibilityPreferenceStore.ts` 
- 📄 `types/domain/nodes.ts`

**Test Suite Structure:**

```typescript
describe('visibilityBehaviour', () => {
    describe('initialization', () => {
        test('initializes with positive netVotes (visible)')
        test('initializes with negative netVotes (hidden)')
        test('loads user preference from visibilityStore')
        test('loads user preference from graphStore.user_data')
        test('handles missing preferences gracefully')
    });
    
    describe('community visibility', () => {
        test('hides when netVotes < 0')
        test('shows when netVotes >= 0')
        test('updates on vote changes')
        test('calls graphStore.updateNodeVisibility')
        test('sets hiddenReason to "community"')
    });
    
    describe('user override - hide', () => {
        test('user hides positive-vote node')
        test('saves to visibilityStore')
        test('saves to graphStore if available')
        test('sets hiddenReason to "user"')
        test('preference persists across initialize() calls')
    });
    
    describe('user override - show', () => {
        test('user shows negative-vote node')
        test('saves to visibilityStore')
        test('sets hiddenReason to "user"')
        test('node stays visible despite negative votes')
    });
    
    describe('precedence logic', () => {
        test('user preference overrides community (show on negative)')
        test('user preference overrides community (hide on positive)')
        test('community applies when no user preference')
        test('community updates ignored when user preference set')
        test('removing user preference reverts to community')
    });
    
    describe('persistence', () => {
        test('saves to localStorage via visibilityStore')
        test('calls backend API via visibilityStore')
        test('handles API failure gracefully')
        test('preference survives page refresh (mock)')
    });
    
    describe('store coordination', () => {
        test('updates graphStore.updateNodeVisibility')
        test('updates graphStore.updateUserVisibilityPreference')
        test('works without graphStore (fallback)')
    });
    
    describe('derived states', () => {
        test('isHidden derives correctly from user + community')
        test('hiddenReason derives correctly')
        test('reactive updates trigger subscribers')
    });
});
```

**Success Criteria:**
- ✅ Precedence logic proven (user > community)
- ✅ Persistence mechanism validated
- ✅ Community vs user hiding clear
- ✅ Store coordination works
- ✅ Derived states update correctly

**Mocks Required:**
```typescript
// Mock visibilityStore
vi.mock('$lib/stores/visibilityPreferenceStore', () => ({
    visibilityStore: {
        initialize: vi.fn(),
        getPreference: vi.fn(),
        setPreference: vi.fn()
    }
}));

// Mock graphStore (same as Session 1)
```

**Expected Output:**
- 30+ tests passing
- 100% coverage of visibilityBehaviour.ts
- Precedence logic clearly validated
- Confidence in persistence mechanism

---

### **Session 3: Base Components**

**Why Third:** Foundation for all nodes. Must be rock-solid.

**Duration:** 3-4 hours

**Files Needed:**
- ✅ `BaseNode.svelte` (already have)
- ✅ `BasePreviewNode.svelte` (already have)
- ✅ `BaseDetailNode.svelte` (already have)
- 📄 `types/graph/enhanced.ts` (RenderableNode, NodeMode)
- 📄 `constants/graph/nodes.ts` (NODE_CONSTANTS)
- 📄 `constants/graph/coordinate-space.ts` (COORDINATE_SPACE)

**Test Suite Structure:**

```typescript
describe('BaseNode', () => {
    describe('rendering', () => {
        test('renders with minimal props')
        test('renders slot content correctly')
        test('applies correct radius')
        test('generates unique filter/gradient IDs')
        test('applies vote-based styling')
    });
    
    describe('visibility recalculation', () => {
        test('calls graphStore.recalculateNodeVisibility on vote change')
        test('uses getNeo4jNumber for vote extraction')
        test('only recalculates for nodes with inclusion votes')
        test('reactive statement triggers on vote updates')
    });
    
    describe('event handling', () => {
        test('dispatches click events')
        test('dispatches modeChange events')
        test('event bubbling works')
    });
});

describe('BasePreviewNode', () => {
    describe('layout', () => {
        test('positions title above ContentBox')
        test('positions content in ContentBox')
        test('positions voting section correctly')
        test('no stats section in preview mode')
    });
    
    describe('expand button', () => {
        test('renders expand button at SE corner')
        test('expand button only shows if canExpand=true')
        test('clicking expand dispatches modeChange')
        test('includes position data in modeChange event')
    });
    
    describe('slots', () => {
        test('title slot receives radius')
        test('content slot receives layout info')
        test('voting slot receives layout info')
    });
});

describe('BaseDetailNode', () => {
    describe('layout', () => {
        test('positions title above ContentBox')
        test('positions categoryTags below title')
        test('positions keywordTags below categoryTags')
        test('positions content in ContentBox')
        test('positions voting in ContentBox')
        test('positions stats in ContentBox')
        test('positions metadata below ContentBox')
        test('positions credits below metadata')
    });
    
    describe('collapse button', () => {
        test('renders collapse button at SE corner')
        test('clicking collapse dispatches modeChange')
        test('includes position data in modeChange event')
    });
    
    describe('createChild slot', () => {
        test('renders createChild at NE corner when provided')
        test('empty when slot not provided')
    });
    
    describe('opacity animation', () => {
        test('fades in on mount')
        test('spring animation works')
    });
});
```

**Success Criteria:**
- ✅ Slots render correctly
- ✅ Position calculations verified
- ✅ Events bubble properly
- ✅ Vote recalculation triggers
- ✅ Layout ratios correct

**Expected Output:**
- 25+ tests passing
- Base layer stable
- Confidence in slot system
- Layout math validated

---

### **Session 4: Vote UI Components**

**Why Fourth:** Shared across all votable nodes. Must be bulletproof.

**Duration:** 4-5 hours

**Files Needed:**
- ✅ `ContentVoteButtons.svelte` 
- ✅ `InclusionVoteButtons.svelte` 
- ✅ `VoteStats.svelte` 
- 📄 `constants/colors.ts` (COLORS)

**Test Suite Structure:**

```typescript
describe('ContentVoteButtons', () => {
    describe('rendering', () => {
        test('renders with no vote')
        test('renders with agree vote')
        test('renders with disagree vote')
        test('shows correct vote count')
        test('displays +/- prefix on net votes')
    });
    
    describe('interactions', () => {
        test('clicking agree dispatches vote event')
        test('clicking disagree dispatches vote event')
        test('hover shows tooltip text')
        test('hover applies glow effect')
        test('disabled state prevents clicks')
    });
    
    describe('states', () => {
        test('loading state shows spinner')
        test('success state shows animation')
        test('voted state highlights button')
        test('removing vote shows "Remove vote" text')
    });
    
    describe('colors', () => {
        test('agree button uses green')
        test('disagree button uses red')
        test('neutral state uses white')
        test('voted state uses solid color')
        test('hover state transitions correctly')
    });
    
    describe('accessibility', () => {
        test('has proper ARIA labels')
        test('keyboard navigation works')
        test('focus states visible')
    });
});

describe('InclusionVoteButtons', () => {
    // Similar structure to ContentVoteButtons
    // Key difference: add/remove icons instead of thumbs
    
    describe('icon differences', () => {
        test('include button shows add icon')
        test('exclude button shows remove icon')
        test('hover text says "Include" / "Exclude"')
    });
});

describe('VoteStats', () => {
    describe('rendering', () => {
        test('displays user vote status')
        test('displays total agree votes')
        test('displays total disagree votes')
        test('displays net votes')
        test('shows correct colors for positive/negative')
    });
    
    describe('configurable labels', () => {
        test('uses custom positiveLabel')
        test('uses custom negativeLabel')
        test('uses custom netLabel')
        test('defaults work correctly')
    });
    
    describe('layout', () => {
        test('background renders when showBackground=true')
        test('user status hidden when showUserStatus=false')
        test('sections spaced correctly')
    });
});
```

**Success Criteria:**
- ✅ All button states work
- ✅ Events dispatch correctly
- ✅ Animations don't break tests
- ✅ Accessibility requirements met
- ✅ Color theming works

**Expected Output:**
- 40+ tests passing
- UI components stable
- Interaction patterns clear
- Accessibility validated

---

### **Session 5: ShowHideButton + HiddenNode**

**Why Fifth:** Visibility system UI. Recently implemented, needs validation.

**Duration:** 2-3 hours

**Files Needed:**
- ✅ `ShowHideButton.svelte` (already have)
- ✅ `HiddenNode.svelte` (already have)

**Test Suite Structure:**

```typescript
describe('ShowHideButton', () => {
    describe('rendering', () => {
        test('renders with isHidden=false (visibility_off icon)')
        test('renders with isHidden=true (visibility icon)')
        test('shows "hide" text on hover when visible')
        test('shows "show" text on hover when hidden')
        test('positions correctly at given x/y')
    });
    
    describe('interactions', () => {
        test('clicking visible button dispatches isHidden=true')
        test('clicking hidden button dispatches isHidden=false')
        test('hover triggers scale animation')
        test('hover shows glow effect')
    });
    
    describe('states', () => {
        test('disabled state prevents clicks')
        test('scale animation on hover')
        test('glow filter applies on hover')
    });
});

describe('HiddenNode', () => {
    describe('rendering', () => {
        test('renders compact node')
        test('displays "Hidden" label')
        test('shows "by community" when hiddenBy=community')
        test('shows "by you" when hiddenBy=user')
        test('displays net votes value')
        test('shows ShowHideButton at bottom center')
    });
    
    describe('styling', () => {
        test('uses red glow color')
        test('uses correct radius (HIDDEN size)')
        test('applies dull red theme')
        test('glow effect renders')
    });
    
    describe('interactions', () => {
        test('clicking show button forwards visibilityChange event')
        test('mode change events forward correctly')
    });
});
```

**Success Criteria:**
- ✅ Button toggles correctly
- ✅ HiddenNode shows right info
- ✅ Events forward properly
- ✅ Icons switch correctly
- ✅ Position calculations work

**Expected Output:**
- 15+ tests passing
- Visibility UI validated
- Event forwarding proven
- Styling verified

---

### **Session 6: Representative Node Components**

**Why Sixth:** Validates each voting pattern works in real nodes.

**Duration:** 5-6 hours

**Files Needed:**
- ✅ `WordNode.svelte` (already have)
- ✅ `StatementNode.svelte` (already have)
- 📄 `CommentNode.svelte` (need for content-only pattern)
- 📄 `types/graph/enhanced.ts` (type guards)

**Test Suite Structure:**

```typescript
describe('WordNode (single-voting pattern)', () => {
    describe('rendering', () => {
        test('displays word text prominently')
        test('shows "Word" header')
        test('renders in preview mode')
        test('renders in detail mode')
        test('displays keywords/categories')
    });
    
    describe('voting', () => {
        test('shows inclusion voting buttons only')
        test('no content voting buttons')
        test('vote counts update correctly')
        test('visibility recalculates on vote')
    });
    
    describe('expansion', () => {
        test('expand button hidden when netVotes < 0')
        test('expand button visible when netVotes >= 0')
        test('canExpand based on inclusion threshold')
    });
    
    describe('data extraction', () => {
        test('extracts word from node.data')
        test('extracts inclusion votes correctly')
        test('handles Neo4j integers')
        test('calculates netVotes correctly')
    });
    
    describe('behaviour integration', () => {
        test('creates inclusionVoting behaviour on mount')
        test('initializes with current vote data')
        test('updates on vote changes')
        test('cleans up on destroy')
    });
});

describe('StatementNode (dual-voting pattern)', () => {
    describe('rendering', () => {
        test('displays statement text')
        test('shows "Statement" header')
        test('displays category tags')
        test('displays keyword tags')
        test('shows instruction text for dual voting')
    });
    
    describe('dual voting', () => {
        test('shows both inclusion and content voting buttons')
        test('inclusion votes separate from content votes')
        test('both vote types can be active simultaneously')
        test('separate vote stats for each type')
    });
    
    describe('behaviour integration', () => {
        test('creates inclusionVoting behaviour')
        test('creates contentVoting behaviour')
        test('both behaviours independent')
        test('both update correctly')
    });
    
    describe('expansion', () => {
        test('expansion based on inclusion votes only')
        test('content votes do not affect expansion')
    });
    
    describe('child creation', () => {
        test('shows create child button when expanded')
        test('create child button at NE corner')
        test('dispatches createChildNode event')
    });
});

describe('CommentNode (content-only pattern)', () => {
    describe('rendering', () => {
        test('displays comment text')
        test('shows "Comment" or "Reply" header')
        test('displays creator info')
        test('shows creation date')
    });
    
    describe('voting', () => {
        test('shows content voting buttons only')
        test('no inclusion voting buttons')
        test('all comments included by default')
        test('freedom of speech principle')
    });
    
    describe('reply functionality', () => {
        test('shows reply button in discussion view')
        test('clicking reply dispatches event')
        test('reply button at correct position')
    });
    
    describe('behaviour integration', () => {
        test('creates contentVoting behaviour only')
        test('no inclusionVoting behaviour')
        test('uses discussionStore')
    });
});
```

**Success Criteria:**
- ✅ All 3 patterns work correctly
- ✅ Voting flows complete end-to-end
- ✅ Data reactivity proven
- ✅ Behaviour integration validated
- ✅ Type guards work correctly

**Expected Output:**
- 50+ tests passing
- All voting patterns validated
- Confidence in node implementations
- Pattern reusability confirmed

---

### **Session 7: NodeRenderer Integration**

**Why Seventh:** Hub component connecting everything. Needs all pieces working first.

**Duration:** 4-5 hours

**Files Needed:**
- ✅ `NodeRenderer.svelte` (already have)
- All node types (for slot rendering tests)

**Test Suite Structure:**

```typescript
describe('NodeRenderer', () => {
    describe('visibilityBehaviour integration', () => {
        test('creates behaviour for votable nodes')
        test('initializes with current netVotes')
        test('subscribes to visibility changes')
        test('updates node.isHidden on subscription')
        test('cleans up subscription on destroy')
    });
    
    describe('vote data extraction', () => {
        test('extracts from universalGraphStore when viewType=universal')
        test('extracts from statementNetworkStore for statements')
        test('extracts from wordViewStore for words')
        test('extracts from openQuestionViewStore for questions')
        test('defaults to 0 for unknown types')
    });
    
    describe('button positioning', () => {
        test('calculates showHideButton position correctly')
        test('positions at SW corner (0.7071 * radius)')
        test('recalculates on radius changes')
    });
    
    describe('event forwarding', () => {
        test('forwards modeChange to Graph')
        test('forwards visibilityChange to Graph')
        test('forwards discuss events')
        test('forwards reply events')
        test('forwards answerQuestion events')
    });
    
    describe('hidden node rendering', () => {
        test('renders HiddenNode when node.isHidden=true')
        test('renders normal node when node.isHidden=false')
        test('passes correct hiddenBy prop')
        test('passes correct netVotes prop')
    });
    
    describe('slot rendering', () => {
        test('renders StatementNode in slot')
        test('renders WordNode in slot')
        test('renders OpenQuestionNode in slot')
        test('passes correct props to slotted components')
    });
    
    describe('reactivity', () => {
        test('community visibility updates trigger re-render')
        test('user override updates trigger re-render')
        test('forceRefresh increments trigger re-render')
    });
    
    describe('comment node special handling', () => {
        test('corrects radius for visible comments')
        test('corrects radius for hidden comments')
        test('dispatches node-size-changed events')
    });
});
```

**Success Criteria:**
- ✅ Behaviour integration works
- ✅ Events flow correctly
- ✅ All node types render
- ✅ Vote data extraction correct
- ✅ Position calculations work

**Expected Output:**
- 35+ tests passing
- Integration validated
- Event flow proven
- Hub component stable

---

### **Session 8: Remaining Nodes**

**Why Eighth:** Once patterns validated in Session 6, test remaining node types.

**Duration:** 4-6 hours (depending on node count)

**Files Needed:**
- 📄 `DefinitionNode.svelte`
- 📄 `QuantityNode.svelte`
- 📄 `EvidenceNode.svelte`
- 📄 `CategoryNode.svelte`
- 📄 `AnswerNode.svelte`
- 📄 `OpenQuestionNode.svelte`

**Test Suite Structure:**

Each node follows same pattern as Session 6:
- Rendering tests
- Voting tests (single or dual)
- Data extraction tests
- Behaviour integration tests
- Special features tests (if any)

**Node-Specific Tests:**

```typescript
describe('QuantityNode', () => {
    // Standard single-voting tests
    
    describe('quantity-specific features', () => {
        test('displays quantity value with unit')
        test('shows unit conversion options')
        test('handles user response input')
        test('shows statistics in detail mode')
    });
});

describe('OpenQuestionNode', () => {
    // Standard single-voting tests
    
    describe('question-specific features', () => {
        test('displays question text')
        test('shows answer button')
        test('clicking answer dispatches answerQuestion event')
    });
});

describe('AnswerNode', () => {
    // Dual-voting pattern tests
    
    describe('answer-specific features', () => {
        test('links to parent question')
        test('displays answer text')
        test('shows evidence support')
        test('displays related statements')
    });
});
```

**Success Criteria:**
- ✅ All node types covered
- ✅ No pattern regressions
- ✅ Special features validated
- ✅ Complete coverage achieved

**Expected Output:**
- 60+ tests passing (10 per node type)
- All node types stable
- Pattern consistency confirmed
- Full node layer coverage

---

### **Session 9: Integration Tests**

**Why Last:** Requires all pieces working. Catches edge cases and cross-component issues.

**Duration:** 6-8 hours

**Files Needed:**
- ✅ `Graph.svelte` (already have)
- ✅ All stores (already have most)
- 📄 Any missing stores

**Test Suite Structure:**

```typescript
describe('Full Voting Flow', () => {
    test('complete voting workflow', async () => {
        // 1. Render graph with nodes
        // 2. Find and click vote button
        // 3. Wait for API call
        // 4. Verify optimistic update
        // 5. Verify API response handling
        // 6. Verify final state
        // 7. Verify vote counts updated
        // 8. Verify visibility recalculated
    });
    
    test('dual voting independence', async () => {
        // 1. Vote on inclusion
        // 2. Verify inclusion vote recorded
        // 3. Vote on content
        // 4. Verify content vote recorded
        // 5. Verify both votes independent
        // 6. Verify both stats display correctly
    });
    
    test('vote error handling', async () => {
        // 1. Click vote button
        // 2. Mock API failure
        // 3. Verify rollback occurs
        // 4. Verify error state
        // 5. Verify retry mechanism
    });
});

describe('Full Visibility Flow', () => {
    test('hide node workflow', async () => {
        // 1. Render visible node
        // 2. Click ShowHideButton
        // 3. Verify immediate UI update
        // 4. Verify localStorage save
        // 5. Verify backend API call
        // 6. Verify HiddenNode renders
    });
    
    test('show hidden node workflow', async () => {
        // 1. Render hidden node
        // 2. Click show button
        // 3. Verify UI expands
        // 4. Verify preference saved
        // 5. Node stays visible despite votes
    });
    
    test('persistence across refresh', async () => {
        // 1. Hide a node
        // 2. Simulate page refresh (remount)
        // 3. Verify node still hidden
        // 4. Verify preference loaded
        // 5. Show the node
        // 6. Refresh again
        // 7. Verify node still visible
    });
    
    test('user precedence over community', async () => {
        // 1. User shows node with negative votes
        // 2. Other users vote to make more negative
        // 3. Verify node stays visible
        // 4. Verify hiddenReason = 'user'
    });
    
    test('cross-view consistency', async () => {
        // 1. Hide node in universal view
        // 2. Switch to word view
        // 3. Verify node still hidden
        // 4. Show node in word view
        // 5. Switch back to universal
        // 6. Verify node still visible
    });
});

describe('Mode Transitions', () => {
    test('preview to detail expansion', async () => {
        // 1. Render node in preview
        // 2. Click expand button
        // 3. Verify modeChange event
        // 4. Verify node renders in detail
        // 5. Verify position preserved
        // 6. Verify vote state preserved
        // 7. Verify centering animation
    });
    
    test('detail to preview collapse', async () => {
        // 1. Render node in detail
        // 2. Click collapse button
        // 3. Verify transition
        // 4. Verify state preservation
    });
    
    test('mode change while voting', async () => {
        // 1. Start voting (optimistic update)
        // 2. Immediately change mode
        // 3. Verify vote completes
        // 4. Verify mode change completes
        // 5. Verify no race conditions
    });
    
    test('mode change while hidden', async () => {
        // 1. Hide a node
        // 2. Try to expand (should show first)
        // 3. Verify correct behavior
    });
});

describe('Multi-Node Interactions', () => {
    test('vote on multiple nodes simultaneously', async () => {
        // 1. Render multiple nodes
        // 2. Click vote on node A
        // 3. Immediately click vote on node B
        // 4. Verify both complete correctly
        // 5. Verify no interference
    });
    
    test('hide multiple nodes', async () => {
        // 1. Hide node A
        // 2. Hide node B
        // 3. Verify both hidden
        // 4. Verify both preferences saved
        // 5. Show node A
        // 6. Verify node B still hidden
    });
    
    test('graph layout updates correctly', async () => {
        // 1. Render graph with visible nodes
        // 2. Hide several nodes
        // 3. Verify simulation updates
        // 4. Verify layout recalculates
        // 5. Verify links update
    });
});

describe('Edge Cases & Error Conditions', () => {
    test('rapid vote toggling', async () => {
        // Click vote 10 times rapidly
        // Verify final state correct
        // Verify no duplicate API calls
    });
    
    test('network offline behavior', async () => {
        // Mock offline condition
        // Try to vote
        // Verify localStorage saves
        // Verify retry on reconnect
    });
    
    test('corrupted localStorage', async () => {
        // Insert malformed data
        // Load page
        // Verify graceful fallback
        // Verify recovery
    });
    
    test('missing metadata', async () => {
        // Render node without metadata
        // Verify graceful fallback
        // Verify voting still works
    });
    
    test('invalid Neo4j integers', async () => {
        // Pass malformed vote counts
        // Verify getNeo4jNumber handles it
        // Verify UI doesn't break
    });
});
```

**Success Criteria:**
- ✅ End-to-end flows work
- ✅ Persistence proven
- ✅ No race conditions
- ✅ Edge cases handled
- ✅ Cross-view consistency

**Expected Output:**
- 40+ integration tests passing
- Full system validation
- Confidence in production readiness
- Clear understanding of edge cases

---

## Required Files

### **Files Already Available**

✅ **Behaviours:**
- `voteBehaviour.ts`
- `visibilityBehaviour.ts`
- `behaviours/index.ts`

✅ **Base Components:**
- `BaseNode.svelte`
- `BasePreviewNode.svelte`
- `BaseDetailNode.svelte`

✅ **UI Components:**
- `ContentVoteButtons.svelte`
- `InclusionVoteButtons.svelte`
- `ShowHideButton.svelte`
- `VoteStats.svelte`
- `NodeHeader.svelte`
- `CreatorCredits.svelte`
- `CategoryTags.svelte`
- `KeywordTags.svelte`
- `NodeMetadata.svelte`
- `TextContent.svelte`
- `ExpandCollapseButton.svelte`
- `DiscussButton.svelte`
- `ReplyButton.svelte`
- `CreateLinkedNodeButton.svelte`
- `AnswerQuestionButton.svelte`

✅ **Node Components:**
- `WordNode.svelte`
- `StatementNode.svelte`
- `HiddenNode.svelte`

✅ **Integration:**
- `NodeRenderer.svelte`
- `Graph.svelte`

✅ **Stores:**
- `graphStore.ts`
- `universalGraphStore.ts`
- `visibilityPreferenceStore.ts`

✅ **Documentation:**
- `node-components.md`
- `node-voting-system.md`
- `visibility-system.md`

### **Files Needed (Priority Order)**

#### **Session 1 (voteBehaviour):**
1. 📄 `types/domain/nodes.ts` - VoteStatus, Keyword, node data types
2. 📄 `utils/neo4j-utils.ts` - getNeo4jNumber function
3. 📄 `services/api.ts` - fetchWithAuth function

#### **Session 2 (visibilityBehaviour):**
- Uses same files as Session 1

#### **Session 3 (Base Components):**
4. 📄 `types/graph/enhanced.ts` - RenderableNode, NodeMode, type guards
5. 📄 `constants/graph/nodes.ts` - NODE_CONSTANTS
6. 📄 `constants/graph/coordinate-space.ts` - COORDINATE_SPACE

#### **Session 4 (Vote UI):**
7. 📄 `constants/colors.ts` - COLORS object

#### **Session 5 (Visibility UI):**
- No new files needed

#### **Session 6 (Representative Nodes):**
8. 📄 `CommentNode.svelte` - Content-only pattern example

#### **Session 7 (NodeRenderer):**
- No new files needed (uses all previous)

#### **Session 8 (Remaining Nodes):**
9. 📄 `DefinitionNode.svelte`
10. 📄 `QuantityNode.svelte`
11. 📄 `EvidenceNode.svelte`
12. 📄 `CategoryNode.svelte`
13. 📄 `AnswerNode.svelte`
14. 📄 `OpenQuestionNode.svelte`

#### **Session 9 (Integration):**
15. 📄 `statementNetworkStore.ts`
16. 📄 `wordViewStore.ts`
17. 📄 `openQuestionViewStore.ts`
18. 📄 `services/graph/GraphManager.ts` (optional, for deep understanding)
19. 📄 `services/graph/UniversalGraphManager.ts` (optional)

---

## Testing Stack Setup

### **Recommended Dependencies**

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/svelte": "^4.0.5",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/user-event": "^14.5.1",
    "msw": "^2.0.11",
    "happy-dom": "^12.10.3",
    "@vitest/ui": "^1.0.0"
  }
}
```

### **Configuration Files**

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/types'
      ]
    }
  },
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/lib'),
      '$app': path.resolve(__dirname, './src/test/mocks/$app')
    }
  }
});
```

**src/test/setup.ts:**
```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock SvelteKit modules
vi.mock('$app/environment', () => ({
  browser: true,
  dev: true,
  building: false,
  version: 'test'
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn(),
  preloadData: vi.fn(),
  preloadCode: vi.fn(),
  beforeNavigate: vi.fn(),
  afterNavigate: vi.fn()
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
```

**src/test/mocks/handlers.ts (MSW):**
```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Vote endpoints
  http.post('/nodes/:type/:id/vote', async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      positiveVotes: body.isPositive ? 1 : 0,
      negativeVotes: body.isPositive ? 0 : 1,
      netVotes: body.isPositive ? 1 : -1
    });
  }),
  
  http.post('/nodes/:type/:id/vote/remove', () => {
    return HttpResponse.json({
      positiveVotes: 0,
      negativeVotes: 0,
      netVotes: 0
    });
  }),
  
  // Visibility endpoints
  http.post('/users/visibility-preferences', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      nodeId: body.nodeId,
      isVisible: body.isVisible,
      timestamp: new Date().toISOString()
    });
  }),
  
  http.get('/users/visibility-preferences', () => {
    return HttpResponse.json({});
  })
];
```

**src/test/mocks/server.ts:**
```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### **Test Utilities**

**src/test/test-utils.ts:**
```typescript
import { render } from '@testing-library/svelte';
import type { RenderableNode } from '$lib/types/graph/enhanced';

export function createMockNode(overrides = {}): RenderableNode {
  return {
    id: 'test-node-1',
    type: 'word',
    mode: 'preview',
    radius: 100,
    position: { x: 0, y: 0, svgTransform: 'translate(0,0)' },
    isHidden: false,
    hiddenReason: 'community',
    data: {
      word: 'test',
      inclusionPositiveVotes: 5,
      inclusionNegativeVotes: 2,
      createdAt: '2024-01-01',
      createdBy: 'user-1'
    },
    metadata: {
      inclusionVoteStatus: { status: null }
    },
    style: {
      colors: {
        primary: '#3498db',
        border: '#2980b9',
        background: '#1a1a1a'
      }
    },
    ...overrides
  };
}

export function createMockGraphStore() {
  return {
    recalculateNodeVisibility: vi.fn(),
    updateNodeVisibility: vi.fn(),
    forceTick: vi.fn(),
    getState: vi.fn(() => ({
      nodes: [],
      links: [],
      viewType: 'universal',
      isUpdating: false
    }))
  };
}

export function createMockVoteStore() {
  return {
    getVoteData: vi.fn(() => ({
      positiveVotes: 0,
      negativeVotes: 0,
      netVotes: 0,
      shouldBeHidden: false
    })),
    updateVoteData: vi.fn()
  };
}
```

---

## Testing Patterns

### **Pattern 1: Testing Behaviours**

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createVoteBehaviour } from '$lib/components/graph/nodes/behaviours/voteBehaviour';

describe('voteBehaviour', () => {
  let mockGraphStore;
  let behaviour;
  
  beforeEach(() => {
    mockGraphStore = createMockGraphStore();
    behaviour = createVoteBehaviour('test-node', 'word', {
      graphStore: mockGraphStore
    });
  });
  
  test('initializes with zero votes', async () => {
    await behaviour.initialize({ positiveVotes: 0, negativeVotes: 0 });
    
    expect(get(behaviour.positiveVotes)).toBe(0);
    expect(get(behaviour.negativeVotes)).toBe(0);
    expect(get(behaviour.netVotes)).toBe(0);
  });
  
  test('handles vote submission', async () => {
    await behaviour.initialize({ positiveVotes: 0, negativeVotes: 0 });
    
    const success = await behaviour.handleVote('agree');
    
    expect(success).toBe(true);
    expect(get(behaviour.userVoteStatus)).toBe('agree');
    expect(get(behaviour.isVoting)).toBe(false);
  });
});
```

### **Pattern 2: Testing Svelte Components**

```typescript
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { describe, test, expect, vi } from 'vitest';
import ContentVoteButtons from '$lib/components/graph/nodes/ui/ContentVoteButtons.svelte';

describe('ContentVoteButtons', () => {
  test('renders with no vote', () => {
    render(ContentVoteButtons, {
      props: {
        userVoteStatus: 'none',
        positiveVotes: 5,
        negativeVotes: 2,
        isVoting: false
      }
    });
    
    expect(screen.getByText('+3')).toBeInTheDocument();
  });
  
  test('dispatches vote event on click', async () => {
    const { component } = render(ContentVoteButtons, {
      props: {
        userVoteStatus: 'none',
        positiveVotes: 0,
        negativeVotes: 0,
        isVoting: false
      }
    });
    
    const voteHandler = vi.fn();
    component.$on('vote', voteHandler);
    
    const agreeButton = screen.getByLabelText('Agree');
    await fireEvent.click(agreeButton);
    
    expect(voteHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { voteType: 'agree' }
      })
    );
  });
});
```

### **Pattern 3: Testing Integration**

```typescript
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { server } from '../test/mocks/server';
import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';

describe('WordNode integration', () => {
  beforeAll(() => server.listen());
  afterAll(() => server.close());
  
  test('complete voting workflow', async () => {
    const mockNode = createMockNode({
      type: 'word',
      data: {
        word: 'test',
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0
      }
    });
    
    const { container } = render(WordNode, {
      props: { node: mockNode }
    });
    
    // Find and click vote button
    const agreeButton = container.querySelector('[aria-label="Include"]');
    await fireEvent.click(agreeButton);
    
    // Verify optimistic update
    expect(container.textContent).toContain('+1');
    
    // Wait for API response
    await waitFor(() => {
      expect(mockNode.data.inclusionPositiveVotes).toBe(1);
    });
  });
});
```

---

## Success Criteria

### **Per-Session Criteria**

Each session must meet these criteria before moving to the next:

**Code Coverage:**
- ✅ **Minimum 80%** statement coverage
- ✅ **Minimum 75%** branch coverage
- ✅ **100%** of critical paths covered

**Test Quality:**
- ✅ All tests pass reliably
- ✅ No flaky tests (must pass 10/10 runs)
- ✅ Clear test names describing behavior
- ✅ Arrange-Act-Assert pattern followed
- ✅ No console errors during tests

**Documentation:**
- ✅ Complex logic documented in tests
- ✅ Edge cases documented
- ✅ Known limitations noted

### **Overall Success Criteria**

**After all 9 sessions:**

**Coverage Metrics:**
- ✅ **90%+** coverage of behaviours
- ✅ **85%+** coverage of components
- ✅ **80%+** coverage of integration points
- ✅ All critical paths tested

**Functionality Verified:**
- ✅ All voting patterns work
- ✅ All visibility scenarios work
- ✅ All node types render correctly
- ✅ Mode transitions smooth
- ✅ Persistence works
- ✅ Reactivity triggers correctly

**Quality Metrics:**
- ✅ Zero known critical bugs
- ✅ All edge cases handled
- ✅ Error handling validated
- ✅ Performance acceptable

**Documentation:**
- ✅ All test suites documented
- ✅ Testing patterns established
- ✅ Maintenance guide created

---

## Troubleshooting Guide

### **Common Issues & Solutions**

#### **Issue: Tests timeout waiting for API responses**

**Cause:** MSW handlers not set up correctly or not returning responses.

**Solution:**
```typescript
// Verify MSW server is running
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Check handler is registered
console.log(server.listHandlers());

// Add explicit response
http.post('/nodes/:type/:id/vote', () => {
  return HttpResponse.json({ /* data */ }, { status: 200 });
});
```

#### **Issue: Svelte component tests fail with "Cannot find module"**

**Cause:** Path aliases not configured in vitest.config.ts

**Solution:**
```typescript
resolve: {
  alias: {
    '$lib': path.resolve(__dirname, './src/lib'),
    '$app': path.resolve(__dirname, './src/test/mocks/$app')
  }
}
```

#### **Issue: Store subscriptions not cleaning up (memory leaks)**

**Cause:** Missing unsubscribe in component cleanup

**Solution:**
```typescript
let unsubscribe;

onMount(() => {
  unsubscribe = store.subscribe(/* ... */);
});

onDestroy(() => {
  if (unsubscribe) unsubscribe();
});
```

#### **Issue: Tests fail with "Cannot read property 'subscribe' of undefined"**

**Cause:** Store not properly mocked

**Solution:**
```typescript
vi.mock('$lib/stores/graphStore', () => ({
  graphStore: {
    subscribe: vi.fn(),
    updateNodeVisibility: vi.fn(),
    recalculateNodeVisibility: vi.fn()
  }
}));
```

#### **Issue: Reactive statements not triggering in tests**

**Cause:** Need to wait for Svelte's reactivity cycle

**Solution:**
```typescript
import { tick } from 'svelte';

await tick(); // Wait for reactive updates
```

#### **Issue: Event dispatching not working**

**Cause:** Event listener not attached before dispatch

**Solution:**
```typescript
const { component } = render(MyComponent);

const handler = vi.fn();
component.$on('myEvent', handler); // Attach BEFORE triggering

// Now trigger event
await fireEvent.click(button);

expect(handler).toHaveBeenCalled();
```

---

## Next Steps

### **Immediate Actions for Next Chat**

1. **Share Required Files (Session 1):**
   - `types/domain/nodes.ts`
   - `utils/neo4j-utils.ts`
   - `services/api.ts`

2. **Confirm Testing Stack:**
   - Verify Vitest installed
   - Verify @testing-library/svelte installed
   - Confirm MSW can be used

3. **Begin Session 1:**
   - Start with voteBehaviour.ts tests
   - Set up mocks
   - Write first test suite
   - Validate approach

### **Long-Term Milestones**

**Week 1:**
- ✅ Sessions 1-3 complete (Behaviours + Base)
- ✅ Testing patterns established
- ✅ Mock infrastructure solid

**Week 2:**
- ✅ Sessions 4-6 complete (UI + Representative Nodes)
- ✅ All voting patterns validated
- ✅ Component tests comprehensive

**Week 3:**
- ✅ Sessions 7-9 complete (Integration + Remaining Nodes)
- ✅ Full coverage achieved
- ✅ Production-ready validation

---

## Summary

This testing plan provides a **comprehensive, prioritized roadmap** for validating the Project Zero node layer:

**Key Principles:**
1. **Bottom-Up:** Test foundations before integrations
2. **Pattern-Based:** Validate each voting pattern thoroughly
3. **Incremental:** Each session builds on previous success
4. **Practical:** Focus on real-world scenarios and edge cases

**Expected Outcomes:**
- ✅ **Reliable voting system** across all node types
- ✅ **Validated visibility system** with user overrides
- ✅ **Proven reactivity** in all data flows
- ✅ **Comprehensive coverage** of critical paths
- ✅ **Production-ready code** with confidence

**Success Metric:**
> "After 9 sessions, we can deploy the node layer with confidence, knowing all critical behaviors are tested and all edge cases are handled."

Ready to begin with **Session 1: voteBehaviour.ts** testing! 🚀