# Two-Tier Voting Components - Usage Guide

## Overview

We now have **two separate voting UI components** to support the two-tier voting system:

1. **InclusionVoteButtons.svelte** - For "Should this exist?" voting (➕/➖ icons)
2. **VoteButtons.svelte** - For "Content quality" voting (👍/👎 icons)
3. **VoteStats.svelte** - Shared component with configurable labels for both types

---

## Component Details

### 1. InclusionVoteButtons.svelte

**Purpose:** Vote on whether content should be included in the graph and unlocked for detail viewing.

**Icons:** 
- ➕ `add` (Material Symbol) - Include
- ➖ `remove` (Material Symbol) - Exclude

**Props:**
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

**Events:**
```typescript
dispatch('vote', { voteType: VoteStatus });
```

**Usage Example:**
```svelte
<InclusionVoteButtons
  userVoteStatus={inclusionUserVoteStatus}
  positiveVotes={inclusionPositiveVotes}
  negativeVotes={inclusionNegativeVotes}
  {isVotingInclusion}
  voteSuccess={inclusionVoteSuccess}
  lastVoteType={lastInclusionVoteType}
  availableWidth={width}
  containerY={height}
  mode="preview"
  on:vote={handleInclusionVote}
/>
```

**Hover Text:**
- "Include" (when not voted)
- "Exclude" (when not voted)
- "Remove vote" (when already voted)

---

### 2. VoteButtons.svelte (Existing - Unchanged)

**Purpose:** Vote on content quality/agreement.

**Icons:**
- 👍 `thumb_up` (Material Symbol) - Agree
- 👎 `thumb_down` (Material Symbol) - Disagree

**Props:** Same as InclusionVoteButtons

**Usage Example:**
```svelte
<VoteButtons
  userVoteStatus={contentUserVoteStatus}
  positiveVotes={contentPositiveVotes}
  negativeVotes={contentNegativeVotes}
  {isVotingContent}
  voteSuccess={contentVoteSuccess}
  lastVoteType={lastContentVoteType}
  availableWidth={width}
  containerY={height}
  mode="detail"
  on:vote={handleContentVote}
/>
```

**Hover Text:**
- "Agree" (when not voted)
- "Disagree" (when not voted)
- "Remove vote" (when already voted)

---

### 3. VoteStats.svelte (Enhanced)

**Purpose:** Display detailed vote breakdown for either voting type.

**NEW Props (added for configurability):**
```typescript
export let positiveLabel: string = 'Total Agree';  // NEW
export let negativeLabel: string = 'Total Disagree'; // NEW
export let netLabel: string = 'Net Votes';         // NEW
```

**All Props:**
```typescript
export let userVoteStatus: VoteStatus = 'none';
export let positiveVotes: number = 0;
export let negativeVotes: number = 0;
export let userName: string = 'Anonymous';
export let showUserStatus: boolean = true;
export let availableWidth: number = 400;
export let containerY: number = 0;
export let showBackground: boolean = true;
export let positiveLabel: string = 'Total Agree';
export let negativeLabel: string = 'Total Disagree';
export let netLabel: string = 'Net Votes';
```

**Usage - Inclusion Voting:**
```svelte
<VoteStats
  userVoteStatus={inclusionUserVoteStatus}
  positiveVotes={inclusionPositiveVotes}
  negativeVotes={inclusionNegativeVotes}
  {userName}
  showUserStatus={true}
  availableWidth={width}
  containerY={30}
  showBackground={false}
  positiveLabel="Total Include"
  negativeLabel="Total Exclude"
  netLabel="Net Inclusion"
/>
```

**Usage - Content Voting (default labels):**
```svelte
<VoteStats
  userVoteStatus={contentUserVoteStatus}
  positiveVotes={contentPositiveVotes}
  negativeVotes={contentNegativeVotes}
  {userName}
  showUserStatus={true}
  availableWidth={width}
  containerY={30}
  showBackground={false}
  <!-- Uses defaults: "Total Agree" / "Total Disagree" / "Net Votes" -->
/>
```

---

## Full Example: Node with Two-Tier Voting

```svelte
<script lang="ts">
  import { InclusionVoteButtons, VoteButtons, VoteStats } from '../ui';
  
  // Inclusion vote data
  $: inclusionPositiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
  $: inclusionNegativeVotes = getNeo4jNumber(nodeData.negativeVotes) || 0;
  $: inclusionNetVotes = inclusionPositiveVotes - inclusionNegativeVotes;
  $: inclusionUserVoteStatus = node.metadata?.userVoteStatus?.status || 'none';
  
  // Content vote data (only for applicable node types)
  $: contentPositiveVotes = getNeo4jNumber(nodeData.contentPositiveVotes) || 0;
  $: contentNegativeVotes = getNeo4jNumber(nodeData.contentNegativeVotes) || 0;
  $: contentUserVoteStatus = node.metadata?.contentVoteStatus?.status || 'none';
  
  // Detail mode unlock threshold
  $: canShowDetail = inclusionNetVotes > 0;
  $: effectiveMode = canShowDetail ? node.mode : 'preview';
  
  let isVotingInclusion = false;
  let isVotingContent = false;
  
  async function handleInclusionVote(event) {
    // Handle inclusion voting...
  }
  
  async function handleContentVote(event) {
    // Handle content voting...
  }
</script>

{#if effectiveMode === 'detail'}
  <BaseDetailNode {node} on:modeChange>
    <ContentBox nodeType="statement" mode="detail">
      <svelte:fragment slot="content">
        <!-- Node content here -->
      </svelte:fragment>
      
      <svelte:fragment slot="voting" let:width let:height>
        <!-- INCLUSION VOTING (secondary in detail) -->
        <g transform="translate(0, 0)">
          <InclusionVoteButtons
            userVoteStatus={inclusionUserVoteStatus}
            positiveVotes={inclusionPositiveVotes}
            negativeVotes={inclusionNegativeVotes}
            isVoting={isVotingInclusion}
            availableWidth={width}
            containerY={0}
            mode="detail"
            on:vote={handleInclusionVote}
          />
        </g>
        
        <!-- CONTENT VOTING (primary in detail) -->
        <g transform="translate(0, 50)">
          <VoteButtons
            userVoteStatus={contentUserVoteStatus}
            positiveVotes={contentPositiveVotes}
            negativeVotes={contentNegativeVotes}
            isVoting={isVotingContent}
            availableWidth={width}
            containerY={0}
            mode="detail"
            on:vote={handleContentVote}
          />
        </g>
      </svelte:fragment>
      
      <svelte:fragment slot="stats" let:width>
        <!-- Show stats for both (or just one if preferred) -->
        <VoteStats
          userVoteStatus={inclusionUserVoteStatus}
          positiveVotes={inclusionPositiveVotes}
          negativeVotes={inclusionNegativeVotes}
          {userName}
          availableWidth={width}
          positiveLabel="Total Include"
          negativeLabel="Total Exclude"
          netLabel="Net Inclusion"
        />
      </svelte:fragment>
    </ContentBox>
  </BaseDetailNode>
{:else}
  <BasePreviewNode {node} on:modeChange canExpand={canShowDetail}>
    <ContentBox nodeType="statement" mode="preview">
      <svelte:fragment slot="content">
        <!-- Simplified content -->
      </svelte:fragment>
      
      <svelte:fragment slot="voting" let:width let:height>
        <!-- ONLY INCLUSION VOTING (primary in preview) -->
        <InclusionVoteButtons
          userVoteStatus={inclusionUserVoteStatus}
          positiveVotes={inclusionPositiveVotes}
          negativeVotes={inclusionNegativeVotes}
          isVoting={isVotingInclusion}
          availableWidth={width}
          containerY={height / 2}
          mode="preview"
          on:vote={handleInclusionVote}
        />
      </svelte:fragment>
    </ContentBox>
  </BasePreviewNode>
{/if}
```

---

## Visual Distinction Summary

| Aspect | Inclusion Voting | Content Voting |
|--------|------------------|----------------|
| **Icons** | ➕ / ➖ (add/remove) | 👍 / 👎 (thumbs) |
| **Purpose** | "Should exist?" | "Quality/Agreement?" |
| **Label** | Include/Exclude | Agree/Disagree |
| **Preview Mode** | ✅ Primary (prominent) | ❌ Not shown |
| **Detail Mode** | ✅ Secondary (smaller) | ✅ Primary (if applicable) |
| **Stats Labels** | Total Include/Exclude | Total Agree/Disagree |
| **Component** | `InclusionVoteButtons` | `VoteButtons` |

---

## Node Type Voting Matrix

| Node Type | Inclusion Voting | Content Voting |
|-----------|------------------|----------------|
| Statement | ✅ Yes | ✅ Yes (binary) |
| OpenQuestion | ✅ Yes | ❌ No |
| Answer | ✅ Yes | ✅ Yes (binary) |
| Quantity | ✅ Yes | ✅ Yes (special UI) |
| Evidence | ✅ Yes | ✅ Yes (multi-criteria) |
| Category | ✅ Yes | ❌ No |
| Word | ✅ Yes | ❌ No |
| Definition | ✅ Yes | ❌ No |
| Comment | ✅ Yes | ❌ No |

---

## Key Implementation Notes

1. **Always check threshold:** `canShowDetail = inclusionNetVotes > 0`
2. **Separate vote handlers:** One for inclusion, one for content
3. **Separate vote state:** Track loading/success separately
4. **API endpoints differ:** 
   - Inclusion: `/nodes/{type}/{id}/vote`
   - Content: `/nodes/{type}/{id}/content-vote`
5. **Preview mode:** Only show inclusion voting
6. **Detail mode:** Show both (if content voting applicable)