# Visibility System Documentation

## Overview

The Project Zero visibility system provides a **two-tier approach** to controlling what content users see in the graph:

1. **Community-Based Visibility** - Automatic hiding based on net votes (negative consensus)
2. **User Manual Overrides** - Personal preferences that override community decisions

This system respects both collective wisdom and individual choice, allowing users to curate their own experience while benefiting from community moderation.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Architecture](#architecture)
3. [How It Works](#how-it-works)
4. [User Interface](#user-interface)
5. [Implementation Details](#implementation-details)
6. [Data Flow](#data-flow)
7. [API Integration](#api-integration)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Core Concepts

### Visibility States

Nodes in the graph can exist in three visibility states:

| State | Description | Trigger | Displayed As |
|-------|-------------|---------|--------------|
| **Visible** | Normal rendering with full content | `netVotes >= 0` OR user shows | Full node (preview or detail mode) |
| **Community Hidden** | Automatically hidden by negative votes | `netVotes < 0` AND no user override | Small red-glowing HiddenNode |
| **User Hidden** | Manually hidden by user preference | User clicks "Hide" button | Small red-glowing HiddenNode |

### Precedence Rules

**User preferences ALWAYS override community decisions:**

```
User Preference > Community Votes
```

Examples:
- User shows a node with -10 votes → Node remains visible
- User hides a node with +20 votes → Node becomes hidden
- No user preference set → Community votes determine visibility

### Hidden Reason Tracking

Every hidden node tracks **why** it's hidden:

```typescript
node.hiddenReason: 'user' | 'community'
```

This enables:
- Clear UI messaging ("Hidden by you" vs "Hidden by community")
- Correct restoration behavior
- Analytics on hiding patterns

---

## Architecture

### Component Hierarchy

```
Graph.svelte
  └─ NodeRenderer.svelte
      ├─ visibilityBehaviour (per node)
      │   ├─ visibilityStore (localStorage + backend)
      │   └─ graphStore (simulation coordination)
      ├─ Node Component (StatementNode, WordNode, etc.)
      │   └─ ShowHideButton (SW corner)
      └─ HiddenNode.svelte
          └─ ShowHideButton (bottom center)
```

### Key Files

| File | Purpose | Responsibility |
|------|---------|----------------|
| `visibilityBehaviour.ts` | State management | User preference logic, persistence |
| `visibilityPreferenceStore.ts` | Persistence layer | localStorage + backend sync |
| `NodeRenderer.svelte` | Integration point | Creates behaviour, handles events |
| `ShowHideButton.svelte` | UI control | Dispatches visibility change events |
| `HiddenNode.svelte` | Hidden rendering | Displays hidden nodes compactly |
| `graphStore.ts` | Simulation coordination | Updates D3 simulation state |

---

## How It Works

### Community-Based Hiding (Automatic)

**Trigger:** Node's inclusion votes result in `netVotes < 0`

**Process:**
1. User votes on a node (via voteBehaviour)
2. Vote counts update: `positiveVotes`, `negativeVotes`
3. `netVotes = positiveVotes - negativeVotes`
4. BaseNode reactive statement detects change
5. Calls `visibilityBehaviour.updateCommunityVisibility(netVotes)`
6. If `netVotes < 0` AND no user preference:
   - Sets `communityHidden = true`
   - Updates `node.isHidden = true`
   - Triggers re-render as HiddenNode

**Example:**
```
Initial: +5 agree, -2 disagree → netVotes = +3 → Visible
User votes disagree: +5 agree, -8 disagree → netVotes = -3 → Hidden
```

### User Manual Override (Explicit)

**Trigger:** User clicks ShowHideButton

**Process (Hiding Visible Node):**
1. User clicks "Hide" button (SW corner)
2. ShowHideButton dispatches: `visibilityChange({ isHidden: true })`
3. NodeRenderer calls: `visibilityBehaviour.handleVisibilityChange(true, 'user')`
4. visibilityBehaviour:
   - Sets `userPreference = true` (means "isVisible = false")
   - Saves to `visibilityStore` (localStorage)
   - Calls backend API: `POST /users/visibility-preferences`
   - Updates `graphStore.updateNodeVisibility(nodeId, true, 'user')`
5. Subscription updates: `node.isHidden = true`, `node.hiddenReason = 'user'`
6. Re-renders as HiddenNode with "Hidden by you" label

**Process (Showing Hidden Node):**
1. User clicks "Show" button (on HiddenNode)
2. ShowHideButton dispatches: `visibilityChange({ isHidden: false })`
3. NodeRenderer calls: `visibilityBehaviour.handleVisibilityChange(false, 'user')`
4. visibilityBehaviour:
   - Sets `userPreference = true` (means "isVisible = true")
   - Saves to `visibilityStore` (localStorage)
   - Calls backend API
   - Updates graphStore
5. Subscription updates: `node.isHidden = false`, `node.hiddenReason = 'user'`
6. Re-renders as normal node with full content

### Precedence Logic

**Implementation in visibilityBehaviour.ts:**

```typescript
const isHidden = derived(
    [userPreference, communityHidden],
    ([userPref, communityHidden]) => {
        // User preference takes precedence if set
        if (userPref !== undefined) {
            return !userPref; // userPref is "isVisible", we need "isHidden"
        }
        // Fall back to community decision
        return communityHidden;
    }
);
```

**Scenarios:**

| User Preference | Net Votes | Result | Reason |
|----------------|-----------|--------|--------|
| `undefined` | `+5` | Visible | Community default |
| `undefined` | `-3` | Hidden | Community hiding |
| `true` (show) | `+5` | Visible | Matches community |
| `true` (show) | `-10` | Visible | **User override** |
| `false` (hide) | `+20` | Hidden | **User override** |
| `false` (hide) | `-5` | Hidden | Matches community |

---

## User Interface

### ShowHideButton

**Appearance:** White circular button with eye icon

**Positions:**
- **Visible nodes:** SW corner at `(radius * 0.7071, radius * 0.7071)`
- **Hidden nodes:** Bottom center at `(0, radius)`

**States:**
- `isHidden = false` → Shows "visibility_off" icon, hover text "hide"
- `isHidden = true` → Shows "visibility" icon, hover text "show"

**Behavior:**
- Hover: Glowing effect + text label appears
- Click: Toggles visibility, saves preference
- Scale animation on hover (1.0 → 1.5)

### HiddenNode

**Appearance:**
- Small red-glowing circle (diameter: 160px / radius: 80px)
- Dull red color: `#4A1A1A` (barely visible negative feeling)
- Glow effect with multiple blur layers

**Content:**
```
┌─────────────────┐
│    "Hidden"     │ ← Label text
│  "by community" │ ← or "by you"
│      -5         │ ← Net votes
│                 │
│   [Show Btn]    │ ← ShowHideButton
└─────────────────┘
```

**Purpose:**
- Maintains graph layout (nodes don't disappear completely)
- Shows vote information for transparency
- Provides easy restoration via Show button
- Distinguishes user vs community hiding

---

## Implementation Details

### visibilityBehaviour.ts

**Purpose:** Centralized visibility state management per node

**Key Features:**
- Manages both community and user visibility states
- Handles precedence logic
- Persists preferences via visibilityStore
- Updates graphStore for simulation coordination
- Provides reactive stores for UI binding

**Public Interface:**

```typescript
interface VisibilityBehaviour {
    // Reactive state
    isHidden: Readable<boolean>;
    hiddenReason: Readable<'user' | 'community'>;
    userPreference: Readable<boolean | undefined>;
    communityHidden: Readable<boolean>;
    
    // Methods
    initialize: (netVotes?: number) => Promise<void>;
    updateCommunityVisibility: (netVotes: number) => void;
    handleVisibilityChange: (isHidden: boolean, reason?: 'user' | 'community') => Promise<void>;
    setUserPreference: (isVisible: boolean) => Promise<void>;
    getUserPreference: () => boolean | undefined;
    getCurrentState: () => VisibilityBehaviourState;
    reset: () => void;
}
```

**Usage Pattern:**

```typescript
// In NodeRenderer.svelte
let visibilityBehaviour = createVisibilityBehaviour(nodeId, {
    communityThreshold: 0, // Hide when netVotes < 0
    graphStore: universalGraphStore // or statementNetworkStore, etc.
});

await visibilityBehaviour.initialize(netVotes);

// Subscribe to changes
visibilityBehaviour.isHidden.subscribe(isHidden => {
    node.isHidden = isHidden;
    node.hiddenReason = get(visibilityBehaviour.hiddenReason);
});

// Update on vote changes
$: if (visibilityBehaviour) {
    visibilityBehaviour.updateCommunityVisibility(netVotes);
}

// Handle user clicks
async function handleHideClick() {
    await visibilityBehaviour.handleVisibilityChange(true, 'user');
}
```

### visibilityPreferenceStore.ts

**Purpose:** Persistence layer for user preferences

**Storage Strategy:**
- **Primary:** localStorage (instant, offline-capable)
- **Secondary:** Backend API (cross-device sync)

**localStorage Format:**

```json
{
    "preferences": {
        "node-id-1": true,  // isVisible
        "node-id-2": false,
        "node-id-3": true
    },
    "details": {
        "node-id-1": {
            "isVisible": true,
            "source": "user",
            "timestamp": 1704067200000
        }
    },
    "timestamp": 1704067200000
}
```

**Key Methods:**

```typescript
// Load from backend and merge with cached
await visibilityStore.loadPreferences();

// Get single preference
const isVisible = visibilityStore.getPreference(nodeId);

// Set preference (saves to localStorage + backend)
await visibilityStore.setPreference(nodeId, true, 'user');

// Determine visibility with fallback
const shouldShow = visibilityStore.shouldBeVisible(nodeId, communityVisible);

// Bulk operations
const allPrefs = visibilityStore.getAllPreferences();
```

### NodeRenderer.svelte Integration

**Responsibilities:**
1. Create visibilityBehaviour instance per votable node
2. Initialize with current netVotes
3. Subscribe to visibility state changes
4. Update `node.isHidden` and `node.hiddenReason` reactively
5. Handle ShowHideButton events
6. Forward visibility changes to Graph component
7. Clean up subscriptions on destroy

**Key Code Sections:**

```typescript
// 1. Create behaviour on mount
onMount(async () => {
    if (node.type === 'word' || node.type === 'statement' /* ... */) {
        visibilityBehaviour = createVisibilityBehaviour(node.id, {
            communityThreshold: 0,
            graphStore: appropriateStore
        });
        
        await visibilityBehaviour.initialize(netVotes);
        
        // Subscribe to changes
        visibilityUnsubscribe = visibilityBehaviour.isHidden.subscribe(isHidden => {
            node.isHidden = isHidden;
            node.hiddenReason = get(visibilityBehaviour.hiddenReason);
            forceRefresh++; // Trigger Svelte reactivity
        });
    }
});

// 2. Update on vote changes
$: if (visibilityBehaviour && netVotes !== undefined) {
    visibilityBehaviour.updateCommunityVisibility(netVotes);
}

// 3. Handle user clicks
async function handleVisibilityChange(event) {
    if (visibilityBehaviour) {
        await visibilityBehaviour.handleVisibilityChange(
            event.detail.isHidden,
            'user'
        );
    }
    
    dispatch('visibilityChange', { nodeId: node.id, isHidden: event.detail.isHidden });
}

// 4. Cleanup
onDestroy(() => {
    if (visibilityUnsubscribe) {
        visibilityUnsubscribe();
    }
    if (visibilityBehaviour) {
        visibilityBehaviour.reset();
    }
});
```

---

## Data Flow

### Complete Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ USER ACTION: Clicks ShowHideButton                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ ShowHideButton.svelte                                        │
│ • Dispatches: visibilityChange({ isHidden: true/false })   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ NodeRenderer.handleVisibilityChange()                       │
│ • Receives event                                            │
│ • Calls: visibilityBehaviour.handleVisibilityChange()      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ visibilityBehaviour.handleVisibilityChange()                │
│ • Converts isHidden → isVisible                             │
│ • Calls: setUserPreference(isVisible)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
        ▼                           ▼
┌──────────────────┐    ┌──────────────────────┐
│ visibilityStore  │    │ graphStore           │
│ • Save to        │    │ • Update simulation  │
│   localStorage   │    │ • Set node.isHidden  │
│ • POST to backend│    │ • Force tick         │
└──────┬───────────┘    └──────────┬───────────┘
       │                           │
       └────────────┬──────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ visibilityBehaviour.isHidden (derived store)                │
│ • Recalculates based on new userPreference                  │
│ • Emits new value to subscribers                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ NodeRenderer subscription callback                          │
│ • Sets: node.isHidden = true/false                          │
│ • Sets: node.hiddenReason = 'user'                         │
│ • Triggers: forceRefresh++                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Svelte Reactivity                                           │
│ • Detects node property changes                             │
│ • Re-evaluates: {#if node.isHidden}                        │
│ • Re-renders component tree                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ UI UPDATE                                                    │
│ • HiddenNode appears (if hidden)                            │
│ • Normal node appears (if shown)                            │
│ • ShowHideButton updates icon/text                          │
└─────────────────────────────────────────────────────────────┘
```

### Vote Change Flow

```
┌─────────────────────────────────────────────────────────────┐
│ USER ACTION: Votes on node                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ voteBehaviour.handleVote()                                   │
│ • Calls API: POST /nodes/{id}/vote                          │
│ • Updates: positiveVotes, negativeVotes                     │
│ • Calculates: netVotes = positive - negative                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ NodeRenderer reactive statement                             │
│ $: if (visibilityBehaviour && netVotes !== undefined)      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ visibilityBehaviour.updateCommunityVisibility(netVotes)    │
│ • Calculates: shouldHide = (netVotes < 0)                  │
│ • Sets: communityHidden = shouldHide                        │
│ • ONLY applies if userPreference === undefined              │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
        ▼                           ▼
┌──────────────────┐    ┌──────────────────────┐
│ Has User Pref?   │    │ No User Preference   │
│ YES → No change  │    │ → Apply community    │
│ (precedence)     │    │   decision           │
└──────────────────┘    └──────────┬───────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │ isHidden derived store   │
                    │ updates based on         │
                    │ communityHidden          │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │ Subscription updates UI  │
                    └──────────────────────────┘
```

---

## API Integration

### Backend Endpoint

**Save User Preference:**

```http
POST /users/visibility-preferences
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
    "nodeId": "abc123",
    "isVisible": false
}
```

**Response:**
```json
{
    "nodeId": "abc123",
    "isVisible": false,
    "timestamp": "2024-01-01T12:00:00Z"
}
```

**Load All Preferences:**

```http
GET /users/visibility-preferences
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
    "node-id-1": true,
    "node-id-2": false,
    "node-id-3": {
        "isVisible": true,
        "source": "user",
        "timestamp": "2024-01-01T12:00:00Z"
    }
}
```

### Error Handling

**Network Errors:**
- Optimistic update still applies (localStorage saves immediately)
- Error logged to console
- User sees change instantly
- Background sync retries on next page load

**Validation Errors:**
- Should not occur (frontend validates before sending)
- If occurs: log error, revert optimistic update

**Auth Errors:**
- User not authenticated: preferences save to localStorage only
- On login: bulk sync cached preferences to backend

---

## Testing

### Unit Tests (Recommended)

**visibilityBehaviour.ts:**

```typescript
describe('visibilityBehaviour', () => {
    test('user preference overrides community hiding', async () => {
        const behaviour = createVisibilityBehaviour('test-node', {
            communityThreshold: 0
        });
        
        await behaviour.initialize(-5); // Should hide by community
        expect(get(behaviour.isHidden)).toBe(true);
        expect(get(behaviour.hiddenReason)).toBe('community');
        
        await behaviour.setUserPreference(true); // User shows
        expect(get(behaviour.isHidden)).toBe(false);
        expect(get(behaviour.hiddenReason)).toBe('user');
        
        behaviour.updateCommunityVisibility(-10); // More negative votes
        expect(get(behaviour.isHidden)).toBe(false); // Still visible (user override)
    });
    
    test('community hiding applies without user preference', async () => {
        const behaviour = createVisibilityBehaviour('test-node', {
            communityThreshold: 0
        });
        
        await behaviour.initialize(5); // Positive votes
        expect(get(behaviour.isHidden)).toBe(false);
        
        behaviour.updateCommunityVisibility(-3); // Goes negative
        expect(get(behaviour.isHidden)).toBe(true);
        expect(get(behaviour.hiddenReason)).toBe('community');
    });
});
```

### Manual Testing Checklist

**Community Hiding:**
- [ ] Node with netVotes >= 0 is visible
- [ ] Node with netVotes < 0 renders as HiddenNode
- [ ] HiddenNode shows "Hidden by community"
- [ ] HiddenNode displays net votes value
- [ ] Voting to make positive → node becomes visible

**User Override - Hide:**
- [ ] Click ShowHideButton on positive-vote node
- [ ] Node transitions to HiddenNode smoothly
- [ ] HiddenNode shows "Hidden by you"
- [ ] Preference persists after page refresh
- [ ] Node stays hidden even if votes become more positive

**User Override - Show:**
- [ ] Click "Show" on community-hidden node
- [ ] Node expands to full rendering
- [ ] ShowHideButton appears at SW corner
- [ ] Preference persists after refresh
- [ ] Node stays visible even if votes become more negative

**Precedence:**
- [ ] User shows node with -10 votes → stays visible
- [ ] Vote changes don't affect user-overridden nodes
- [ ] Removing user preference (future feature) → reverts to community

**Edge Cases:**
- [ ] Toggle hide/show rapidly → no errors
- [ ] Hide node, refresh, verify still hidden
- [ ] Show node, refresh, verify still visible
- [ ] Multiple nodes with different preferences
- [ ] Cross-view consistency (hide in universal, check in word view)

**Console Logs:**
- [ ] Clean logs, no errors
- [ ] Clear visibility state transitions
- [ ] Confirmation of persistence saves

---

## Troubleshooting

### Issue: Node doesn't hide when votes become negative

**Possible Causes:**
1. User preference exists (check localStorage)
2. visibilityBehaviour not initialized
3. netVotes calculation incorrect

**Solution:**
```javascript
// Check localStorage
console.log(localStorage.getItem('pz_visibility_preferences'));

// Check behaviour state
console.log(visibilityBehaviour?.getCurrentState());

// Verify netVotes
console.log('netVotes:', positiveVotes - negativeVotes);
```

### Issue: Preference doesn't persist after refresh

**Possible Causes:**
1. localStorage quota exceeded
2. Backend save failed
3. visibilityStore not initialized

**Solution:**
```javascript
// Check initialization
visibilityStore.initialize();

// Force reload preferences
await visibilityStore.loadPreferences();

// Check backend response
// (Look in Network tab for POST /users/visibility-preferences)
```

### Issue: ShowHideButton not appearing

**Possible Causes:**
1. Node type not in votable list
2. Button position off-screen
3. z-index issue

**Solution:**
```svelte
<!-- Check node type -->
{#if node.type === 'word' || node.type === 'statement' /* add missing types */}

<!-- Verify position calculation -->
$: showHideButtonX = node.radius * 0.7071; // Should be ~70% of radius
$: showHideButtonY = node.radius * 0.7071;

<!-- Check z-index -->
<ShowHideButton 
    style="z-index: 100; pointer-events: all;"
    <!-- ... -->
/>
```

### Issue: Multiple visibility behaviour instances causing conflicts

**Possible Causes:**
1. Component not cleaning up on destroy
2. Hot module reload creating duplicates

**Solution:**
```typescript
// Ensure cleanup
onDestroy(() => {
    if (visibilityUnsubscribe) {
        visibilityUnsubscribe();
        visibilityUnsubscribe = null;
    }
    if (visibilityBehaviour) {
        visibilityBehaviour.reset();
        visibilityBehaviour = null;
    }
});
```

### Debug Logging

**Enable verbose logging:**

```typescript
// In visibilityBehaviour.ts
const DEBUG = true;

if (DEBUG) {
    console.log('[VisibilityBehaviour] State change:', {
        nodeId,
        isHidden: get(isHidden),
        hiddenReason: get(hiddenReason),
        userPreference: get(userPreference),
        communityHidden: get(communityHidden)
    });
}
```

---

## Future Enhancements

### Planned Features

1. **Clear User Preference**
   - Button to remove user override
   - Revert to community decision
   - Bulk clear all preferences

2. **Preference Export/Import**
   - Export preferences as JSON
   - Import on new device
   - Share preferences with team

3. **Visibility Analytics**
   - Track hiding patterns
   - Show most commonly hidden topics
   - Suggest content filters

4. **Advanced Filters**
   - Hide entire categories
   - Hide by keyword
   - Hide by creator
   - Time-based hiding (hide for 1 week)

5. **Collaborative Hiding**
   - Team/organization-level preferences
   - Inherited visibility rules
   - Override inheritance

6. **Smart Recommendations**
   - "You might want to hide these similar nodes"
   - "This node was hidden by users with similar preferences"
   - ML-based content filtering suggestions

---

## Summary

The visibility system provides a **balanced approach** to content moderation:

✅ **Community wisdom** automatically hides low-quality content  
✅ **User autonomy** allows personal curation  
✅ **Transparent** - always shows why content is hidden  
✅ **Reversible** - easy to show hidden content  
✅ **Persistent** - preferences sync across devices  
✅ **Performant** - localStorage caching for instant updates

**Key Principles:**
1. User preferences always win
2. Community votes provide sensible defaults
3. Hiding is never permanent
4. System is transparent about decisions
5. Preferences are portable and persistent

This system enables users to maintain a high-quality, personalized graph experience while respecting the wisdom of the community.