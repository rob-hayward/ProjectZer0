Documentation for Phase 3: Individual Node Refactoring

Table of Contents

Architecture Overview
Base Layer Components
Slot System Reference
Node Type Patterns
Child Node Relationships
Step-by-Step Refactoring Guide
Code Templates
Common Patterns


1. Architecture Overview
1.1 Separation of Concerns
The refactored architecture follows clear separation:
┌─────────────────────────────────────────────────────────────┐
│                    NODE TYPE COMPONENTS                      │
│            (StatementNode, WordNode, etc.)                   │
│                                                               │
│  RESPONSIBILITIES:                                            │
│  • Data extraction from node.data and node.metadata          │
│  • Business logic (vote handling, API calls)                 │
│  • Event dispatching                                          │
│  • Content rendering (what goes in slots)                    │
│                                                               │
│  DOES NOT HANDLE:                                             │
│  ✗ Component positioning                                      │
│  ✗ Layout calculations                                        │
│  ✗ Spacing between elements                                  │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────────────┐
│              BASE LAYER COMPONENTS                           │
│      (BasePreviewNode, BaseDetailNode)                       │
│                                                               │
│  RESPONSIBILITIES:                                            │
│  • Component positioning (transform calculations)            │
│  • Layout management (where things go)                       │
│  • Spacing between elements                                  │
│  • ContentBox integration                                    │
│  • Button positioning (expand/collapse/createChild)          │
│                                                               │
│  DOES NOT HANDLE:                                             │
│  ✗ Data extraction                                            │
│  ✗ Business logic                                             │
│  ✗ Content rendering                                          │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────────────┐
│                    CONTENTBOX                                │
│                                                               │
│  RESPONSIBILITIES:                                            │
│  • Internal content area layout (content/voting/stats)       │
│  • Section sizing (LAYOUT_RATIOS)                            │
│  • Y-position calculations for sections                      │
│  • Per-node-type configuration                               │
└─────────────────────────────────────────────────────────────┘
1.2 Key Principles

DRY (Don't Repeat Yourself)

Position calculations happen ONCE in base components
Node types never calculate transforms or positions
Common UI components are reused


Consistency

All nodes have elements at identical relative positions
Standard slot structure enforces uniform layout
Override props available for special cases


Flexibility with Constraints

Base layout is standardized but overridable
Slots are optional (use only what you need)
Position offsets can be customized per node




2. Base Layer Components
2.1 BasePreviewNode.svelte
Purpose: Layout container for preview mode (inclusion voting focus)
Key Features:

✅ Positions title above ContentBox
✅ Integrates ContentBox for content/voting/stats
✅ Conditionally shows expand button based on threshold
✅ Simple, consistent layout

Props:
typescriptexport let node: RenderableNode;
export let nodeX: number | undefined = undefined;
export let nodeY: number | undefined = undefined;
export let showContentBoxBorder: boolean = false; // Debug
export let canExpand: boolean = true; // Threshold control
export let titleYOffset: number = 0.85; // Position override
export let voteBasedStyles = { glow: {...}, ring: {...} };
Positioning:

Title: -radius * titleYOffset (above ContentBox)
ContentBox: (0, 0) (center)
Expand button: (radius * 0.7071, -radius * 0.7071) (SE corner)

Slots:
typescriptinterface Slots {
  title: { radius: number };
  content: { x, y, width, height, layoutConfig };
  voting: { x, y, width, height, layoutConfig };
  stats: { x, y, width, height, layoutConfig }; // Usually unused
}

2.2 BaseDetailNode.svelte
Purpose: Layout container for detail mode (full features + metadata)
Key Features:

✅ Positions all elements in standard locations
✅ Integrates ContentBox
✅ Supports tags, metadata, credits, create button
✅ All slots optional

Props:
typescriptexport let node: RenderableNode;
export let nodeX: number | undefined = undefined;
export let nodeY: number | undefined = undefined;
export let style = node.style;
export let showContentBoxBorder: boolean = false; // Debug
export let voteBasedStyles = { glow: {...}, ring: {...} };

// Position overrides (all optional)
export let titleYOffset: number = 0.90;
export let categoryTagsYOffset: number = 0.78;
export let keywordTagsYOffset: number = 0.66;
export let metadataYOffset: number = 0.78;
export let creditsYOffset: number = 0.90;
Positioning:
ElementPositionFormulaTitleAbove ContentBox-radius * 0.90CategoryTagsAbove ContentBox-radius * 0.78KeywordTagsAbove ContentBox-radius * 0.66ContentBoxCenter(0, 0)MetadataBelow ContentBox+radius * 0.78CreditsBelow ContentBox+radius * 0.90CreateChild ButtonNE corner(+radius * 0.7071, -radius * 0.7071)Collapse ButtonSE corner(-radius * 0.7071, +radius * 0.7071)
Slots:
typescriptinterface Slots {
  title: { radius: number };
  categoryTags: { radius: number };
  keywordTags: { radius: number };
  content: { x, y, width, height, layoutConfig };
  voting: { x, y, width, height, layoutConfig };
  stats: { x, y, width, height, layoutConfig };
  metadata: { radius: number };
  credits: { radius: number };
  createChild: { radius: number };
}

3. Slot System Reference
3.1 Slot Types
Type A: Positioned Slots (Base Layer Positions)

Receive { radius: number }
Base layer calculates position via transform="translate(x, y)"
Used for: title, categoryTags, keywordTags, metadata, credits, createChild

Type B: ContentBox Slots (ContentBox Positions)

Receive { x, y, width, height, layoutConfig }
ContentBox calculates positions based on LAYOUT_RATIOS
Used for: content, voting, stats

3.2 Slot Usage Patterns
Title Slot (Both Modes)
svelte<svelte:fragment slot="title" let:radius>
  <NodeHeader title="Statement" {radius} mode="preview" />
</svelte:fragment>
Note: BasePreviewNode/BaseDetailNode positions this. You just provide content.
CategoryTags Slot (Detail Only)
svelte<svelte:fragment slot="categoryTags" let:radius>
  {#if nodeData.categories?.length}
    <CategoryTags 
      categories={nodeData.categories} 
      {radius}
      maxDisplay={3}
      on:categoryClick={handleCategoryClick}
    />
  {/if}
</svelte:fragment>
KeywordTags Slot (Detail Only)
svelte<svelte:fragment slot="keywordTags" let:radius>
  {#if nodeData.keywords?.length}
    <KeywordTags 
      keywords={nodeData.keywords} 
      {radius}
      maxDisplay={8}
      on:keywordClick={handleKeywordClick}
    />
  {/if}
</svelte:fragment>
Content Slot (Both Modes)
svelte<svelte:fragment slot="content" let:x let:y let:width let:height>
  <foreignObject {x} {y} {width} {height}>
    <div class="content-display">{displayContent}</div>
  </foreignObject>
</svelte:fragment>
Note: Use provided x, y, width, height directly. No calculations needed.
Voting Slot (Both Modes)
Preview Mode (Inclusion Only):
svelte<svelte:fragment slot="voting" let:x let:y let:width let:height>
  <InclusionVoteButtons
    userVoteStatus={inclusionUserVoteStatus}
    positiveVotes={inclusionPositiveVotes}
    negativeVotes={inclusionNegativeVotes}
    {isVoting}
    availableWidth={width}
    containerY={y + height / 2}
    mode="preview"
    on:vote={handleInclusionVote}
  />
</svelte:fragment>
Detail Mode (Dual Voting for applicable nodes):
svelte<svelte:fragment slot="voting" let:x let:y let:width let:height>
  <!-- Inclusion voting (secondary) -->
  <InclusionVoteButtons
    userVoteStatus={inclusionUserVoteStatus}
    positiveVotes={inclusionPositiveVotes}
    negativeVotes={inclusionNegativeVotes}
    availableWidth={width}
    containerY={y}
    mode="detail"
    on:vote={handleInclusionVote}
  />
  
  <!-- Content voting (primary - if applicable) -->
  <ContentVoteButtons
    userVoteStatus={contentUserVoteStatus}
    positiveVotes={contentPositiveVotes}
    negativeVotes={contentNegativeVotes}
    availableWidth={width}
    containerY={y + 60}
    mode="detail"
    on:vote={handleContentVote}
  />
</svelte:fragment>
Detail Mode (Inclusion Only for nodes without content voting):
svelte<svelte:fragment slot="voting" let:x let:y let:width let:height>
  <InclusionVoteButtons
    userVoteStatus={inclusionUserVoteStatus}
    positiveVotes={inclusionPositiveVotes}
    negativeVotes={inclusionNegativeVotes}
    availableWidth={width}
    containerY={y + height / 2}
    mode="detail"
    on:vote={handleInclusionVote}
  />
</svelte:fragment>
Stats Slot (Detail Only)
svelte<svelte:fragment slot="stats" let:x let:y let:width let:height>
  <VoteStats
    inclusionVotes={{ positive: inclusionPositiveVotes, negative: inclusionNegativeVotes }}
    contentVotes={{ positive: contentPositiveVotes, negative: contentNegativeVotes }}
    availableWidth={width}
    containerY={y}
  />
</svelte:fragment>
Metadata Slot (Detail Only)
svelte<svelte:fragment slot="metadata" let:radius>
  <NodeMetadata
    createdAt={nodeData.createdAt}
    updatedAt={nodeData.updatedAt}
    {radius}
  />
</svelte:fragment>
Credits Slot (Detail Only)
svelte<svelte:fragment slot="credits" let:radius>
  {#if nodeData.createdBy}
    <CreatorCredits
      createdBy={nodeData.createdBy}
      publicCredit={nodeData.publicCredit}
      {radius}
      prefix="created by:"
    />
  {/if}
</svelte:fragment>
CreateChild Slot (Detail Only)
svelte<svelte:fragment slot="createChild" let:radius>
  <CreateLinkedNodeButton
    parentId={node.id}
    parentType={node.type}
    buttonType="evidence"
    {radius}
    disabled={!canCreateChild}
    on:click={handleCreateChild}
  />
</svelte:fragment>

4. Node Type Patterns
4.1 Voting Patterns
Node TypeInclusion VotingContent VotingNotesWord✅ Yes❌ NoDefinitions provide contentDefinition✅ Yes❌ NoAlready specific to wordCategory✅ Yes❌ NoOrganizational nodeStatement✅ Yes✅ Yes (binary)Quality assessment neededOpenQuestion✅ Yes❌ NoAnswers provide contentAnswer✅ Yes✅ Yes (binary)Quality assessment neededQuantity✅ Yes✅ Yes (special)Range submission UIEvidence✅ Yes✅ Yes (multi-criteria)Quality + relevanceComment✅ Yes❌ NoDiscussion node
4.2 Component Patterns
Node TypeCategoryTagsKeywordTagsMetadataCreditsCreateChildWord❌ No✅ Yes (if in categories)✅ Yes✅ Yes❌ NoDefinition❌ No❌ No✅ Yes✅ Yes❌ NoCategory❌ No✅ Yes (composed words)✅ Yes✅ Yes✅ Yes (generic)Statement✅ Yes✅ Yes✅ Yes✅ Yes✅ Yes (evidence)OpenQuestion✅ Yes✅ Yes✅ Yes✅ Yes✅ Yes (answer)Answer✅ Yes✅ Yes✅ Yes✅ Yes✅ Yes (evidence)Quantity✅ Yes✅ Yes✅ Yes✅ Yes✅ Yes (evidence)Evidence✅ Yes✅ Yes✅ Yes✅ Yes❌ No (terminal)Comment❌ No❌ No✅ Yes✅ Yes✅ Yes (reply)

5. Child Node Relationships
5.1 Child Node Types by Parent
Parent NodeChild TypesRelationshipCreateButton LabelWordDefinitionParent-Child"Add Definition"OpenQuestionAnswerParent-Child"Answer Question"StatementEvidenceSupporting"Add Evidence"StatementStatementRelated"Add Related Statement"StatementOpenQuestionRelated"Ask Question"AnswerEvidenceSupporting"Add Evidence"QuantityEvidenceSupporting"Add Evidence"CommentCommentReply"Reply"DiscussionCommentParent-Child"Add Comment"CategoryAny NodeTagged"Create Node"
5.2 Child Node Implementation
Pattern 1: Single Child Type (Definition, Answer, Evidence)
svelte<svelte:fragment slot="createChild" let:radius>
  <CreateLinkedNodeButton
    parentId={node.id}
    parentType={node.type}
    buttonType="definition"  <!-- or "answer" or "evidence" -->
    {radius}
    on:click={handleCreateChild}
  />
</svelte:fragment>
Pattern 2: Multiple Child Types (Statement)
svelte<svelte:fragment slot="createChild" let:radius>
  <!-- Could be multiple buttons or a dropdown menu -->
  <CreateLinkedNodeButton
    parentId={node.id}
    parentType="statement"
    buttonType="evidence"
    {radius}
    on:click={handleCreateEvidence}
  />
  <!-- Note: For related statements/questions, might need different UI -->
</svelte:fragment>
Pattern 3: Reply Threading (Comment)
svelte<svelte:fragment slot="createChild" let:radius>
  <CreateLinkedNodeButton
    parentId={node.id}
    parentType="comment"
    buttonType="reply"
    {radius}
    on:click={handleReply}
  />
</svelte:fragment>
Pattern 4: Generic Creation (Category)
svelte<svelte:fragment slot="createChild" let:radius>
  <CreateLinkedNodeButton
    parentId={node.id}
    parentType="category"
    buttonType="generic"
    preAssignedCategory={node.id}
    {radius}
    on:click={handleCreateNode}
  />
</svelte:fragment>
5.3 Parent-Child vs Related Relationships
Parent-Child Relationships (Strong, Required):

Word → Definition: Definitions must have parent word
OpenQuestion → Answer: Answers must have parent question
Discussion → Comment: Comments must have parent discussion
Comment → Comment (Reply): Replies must have parent comment

Supporting Relationships (Contextual, Optional):

Statement → Evidence: Evidence supports statement claim
Answer → Evidence: Evidence supports answer claim
Quantity → Evidence: Evidence supports quantity estimate

Related Relationships (Associative, Flexible):

Statement → Statement: Related/contradictory statements
Statement → OpenQuestion: Questions about statement
Category → Any Node: Nodes tagged with category


6. Step-by-Step Refactoring Guide
Step 1: Analyze Current Node
Questions to answer:

Does this node have inclusion voting? (✅ Always yes)
Does this node have content voting? (Check patterns table)
What UI components does it need? (Tags, metadata, credits, createChild?)
What are its child node types?
Is it a special case (larger size, custom layout)?

Step 2: Set Up Data Extraction
svelte<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { RenderableNode } from '$lib/types/graph/enhanced';
  import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
  import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
  
  // Base components
  import BasePreviewNode from '../base/BasePreviewNode.svelte';
  import BaseDetailNode from '../base/BaseDetailNode.svelte';
  
  // UI components (import only what you need)
  import {
    NodeHeader,
    InclusionVoteButtons,
    ContentVoteButtons,  // Only if content voting
    VoteStats,
    CategoryTags,        // Only if applicable
    KeywordTags,         // Only if applicable
    NodeMetadata,
    CreatorCredits,
    CreateLinkedNodeButton  // Only if creates children
  } from '../ui';
  
  export let node: RenderableNode;
  export let nodeX: number | undefined = undefined;
  export let nodeY: number | undefined = undefined;
  
  const dispatch = createEventDispatcher();
  
  // Type validation
  const nodeData = node.data as NodeTypeData;
  
  // Extract display content
  $: displayContent = nodeData.content; // Adjust field name
  
  // INCLUSION VOTES (always present)
  $: inclusionPositiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
  $: inclusionNegativeVotes = getNeo4jNumber(nodeData.negativeVotes) || 0;
  $: inclusionNetVotes = inclusionPositiveVotes - inclusionNegativeVotes;
  $: inclusionUserVoteStatus = node.metadata?.userVoteStatus?.status || 'none';
  
  // CONTENT VOTES (only if applicable)
  $: contentPositiveVotes = getNeo4jNumber(nodeData.contentPositiveVotes) || 0;
  $: contentNegativeVotes = getNeo4jNumber(nodeData.contentNegativeVotes) || 0;
  $: contentUserVoteStatus = node.metadata?.contentVoteStatus?.status || 'none';
  
  // THRESHOLD LOGIC
  $: canExpand = hasMetInclusionThreshold(inclusionNetVotes);
  
  // Voting state
  let isVotingInclusion = false;
  let isVotingContent = false;
  
  // Display mode logic
  $: isDetail = node.mode === 'detail';
</script>
Step 3: Implement Vote Handlers
svelte<script>
  // ... (continued from above)
  
  async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
    if (isVotingInclusion) return;
    isVotingInclusion = true;
    
    const { voteType } = event.detail;
    
    try {
      const endpoint = voteType === 'none'
        ? `/nodes/${node.type}/${node.id}/vote/remove`
        : `/nodes/${node.type}/${node.id}/vote`;
      
      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: voteType !== 'none' ? JSON.stringify({ 
          isPositive: voteType === 'agree' 
        }) : undefined
      });
      
      // Update local state
      // (Backend returns updated vote counts)
      node.data.positiveVotes = response.positiveVotes;
      node.data.negativeVotes = response.negativeVotes;
      node.metadata.userVoteStatus = { status: voteType };
      
    } catch (error) {
      console.error('[NodeType] Inclusion vote failed:', error);
    } finally {
      isVotingInclusion = false;
    }
  }
  
  // Only implement if node has content voting
  async function handleContentVote(event: CustomEvent<{ voteType: VoteStatus }>) {
    if (isVotingContent) return;
    isVotingContent = true;
    
    const { voteType } = event.detail;
    
    try {
      const endpoint = voteType === 'none'
        ? `/nodes/${node.type}/${node.id}/content-vote/remove`
        : `/nodes/${node.type}/${node.id}/content-vote`;
      
      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: voteType !== 'none' ? JSON.stringify({ 
          isPositive: voteType === 'agree' 
        }) : undefined
      });
      
      // Update local state
      node.data.contentPositiveVotes = response.contentPositiveVotes;
      node.data.contentNegativeVotes = response.contentNegativeVotes;
      node.metadata.contentVoteStatus = { status: voteType };
      
    } catch (error) {
      console.error('[NodeType] Content vote failed:', error);
    } finally {
      isVotingContent = false;
    }
  }
  
  function handleModeChange(event: CustomEvent) {
    dispatch('modeChange', event.detail);
  }
</script>
Step 4: Build Preview Mode
svelte{#if !isDetail}
  <BasePreviewNode 
    {node} 
    {nodeX} 
    {nodeY} 
    {canExpand}
    on:modeChange={handleModeChange}
  >
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="NodeType" {radius} size="small" mode="preview" />
    </svelte:fragment>
    
    <svelte:fragment slot="content" let:x let:y let:width let:height>
      <foreignObject {x} {y} {width} {height}>
        <div class="content-preview">{displayContent}</div>
      </foreignObject>
    </svelte:fragment>
    
    <svelte:fragment slot="voting" let:x let:y let:width let:height>
      <InclusionVoteButtons
        userVoteStatus={inclusionUserVoteStatus}
        positiveVotes={inclusionPositiveVotes}
        negativeVotes={inclusionNegativeVotes}
        {isVotingInclusion}
        availableWidth={width}
        containerY={y + height / 2}
        mode="preview"
        on:vote={handleInclusionVote}
      />
    </svelte:fragment>
  </BasePreviewNode>
{:else}
Step 5: Build Detail Mode
svelte  <BaseDetailNode 
    {node} 
    {nodeX} 
    {nodeY}
    on:modeChange={handleModeChange}
  >
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="NodeType" {radius} mode="detail" />
    </svelte:fragment>
    
    <!-- Only include if node has categories -->
    <svelte:fragment slot="categoryTags" let:radius>
      {#if nodeData.categories?.length}
        <CategoryTags 
          categories={nodeData.categories} 
          {radius}
          on:categoryClick={handleCategoryClick}
        />
      {/if}
    </svelte:fragment>
    
    <!-- Only include if node has keywords -->
    <svelte:fragment slot="keywordTags" let:radius>
      {#if nodeData.keywords?.length}
        <KeywordTags 
          keywords={nodeData.keywords} 
          {radius}
          on:keywordClick={handleKeywordClick}
        />
      {/if}
    </svelte:fragment>
    
    <svelte:fragment slot="content" let:x let:y let:width let:height>
      <foreignObject {x} {y} {width} {height}>
        <div class="content-display">{displayContent}</div>
      </foreignObject>
    </svelte:fragment>
    
    <svelte:fragment slot="voting" let:x let:y let:width let:height>
      <!-- Inclusion voting (always) -->
      <InclusionVoteButtons
        userVoteStatus={inclusionUserVoteStatus}
        positiveVotes={inclusionPositiveVotes}
        negativeVotes={inclusionNegativeVotes}
        {isVotingInclusion}
        availableWidth={width}
        containerY={y}
        mode="detail"
        on:vote={handleInclusionVote}
      />
      
      <!-- Content voting (only if applicable) -->
      {#if hasContentVoting}
        <ContentVoteButtons
          userVoteStatus={contentUserVoteStatus}
          positiveVotes={contentPositiveVotes}
          negativeVotes={contentNegativeVotes}
          {isVotingContent}
          availableWidth={width}
          containerY={y + 60}
          mode="detail"
          on:vote={handleContentVote}
        />
      {/if}
    </svelte:fragment>
    
    <svelte:fragment slot="stats" let:x let:y let:width let:height>
      <VoteStats
        inclusionVotes={{ positive: inclusionPositiveVotes, negative: inclusionNegativeVotes }}
        contentVotes={hasContentVoting ? { positive: contentPositiveVotes, negative: contentNegativeVotes } : undefined}
        availableWidth={width}
        containerY={y}
      />
    </svelte:fragment>
    
    <svelte:fragment slot="metadata" let:radius>
      <NodeMetadata
        createdAt={nodeData.createdAt}
        updatedAt={nodeData.updatedAt}
        {radius}
      />
    </svelte:fragment>
    
    <svelte:fragment slot="credits" let:radius>
      {#if nodeData.createdBy}
        <CreatorCredits
          createdBy={nodeData.createdBy}
          publicCredit={nodeData.publicCredit}
          {radius}
        />
      {/if}
    </svelte:fragment>
    
    <!-- Only include if node creates children -->
    <svelte:fragment slot="createChild" let:radius>
      <CreateLinkedNodeButton
        parentId={node.id}
        parentType={node.type}
        buttonType="childType"
        {radius}
        on:click={handleCreateChild}
      />
    </svelte:fragment>
  </BaseDetailNode>
{/if}
Step 6: Add Styles
svelte<style>
  .content-preview {
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    line-height: 1.4;
  }
  
  .content-display {
    font-family: Inter;
    font-size: 16px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    line-height: 1.4;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
</style>

7. Code Templates
7.1 Minimal Node Template (Inclusion Voting Only)
Use for: Word, Definition, Category, OpenQuestion, Comment
svelte<script lang="ts">
  // Imports
  import BasePreviewNode from '../base/BasePreviewNode.svelte';
  import BaseDetailNode from '../base/BaseDetailNode.svelte';
  import { NodeHeader, InclusionVoteButtons, VoteStats, NodeMetadata, CreatorCredits } from '../ui';
  
  export let node: RenderableNode;
  
  // Data extraction
  const nodeData = node.data as NodeTypeData;
  $: displayContent = nodeData.content;
  
  // Inclusion votes only
  $: inclusionPositiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
  $: inclusionNegativeVotes = getNeo4jNumber(nodeData.negativeVotes) || 0;
  $: inclusionNetVotes = inclusionPositiveVotes - inclusionNegativeVotes;
  $: inclusionUserVoteStatus = node.metadata?.userVoteStatus?.status || 'none';
  $: canExpand = hasMetInclusionThreshold(inclusionNetVotes);
  
  let isVotingInclusion = false;
  $: isDetail = node.mode === 'detail';
  
  async function handleInclusionVRetryRHyou were cut off by max length, please continue.svelte  async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
    if (isVotingInclusion) return;
    isVotingInclusion = true;
    
    const { voteType } = event.detail;
    
    try {
      const endpoint = voteType === 'none'
        ? `/nodes/${node.type}/${node.id}/vote/remove`
        : `/nodes/${node.type}/${node.id}/vote`;
      
      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: voteType !== 'none' ? JSON.stringify({ 
          isPositive: voteType === 'agree' 
        }) : undefined
      });
      
      node.data.positiveVotes = response.positiveVotes;
      node.data.negativeVotes = response.negativeVotes;
      node.metadata.userVoteStatus = { status: voteType };
      
    } catch (error) {
      console.error('Inclusion vote failed:', error);
    } finally {
      isVotingInclusion = false;
    }
  }
</script>

{#if !isDetail}
  <BasePreviewNode {node} {canExpand} on:modeChange>
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="NodeType" {radius} size="small" mode="preview" />
    </svelte:fragment>
    
    <svelte:fragment slot="content" let:x let:y let:width let:height>
      <foreignObject {x} {y} {width} {height}>
        <div class="content-preview">{displayContent}</div>
      </foreignObject>
    </svelte:fragment>
    
    <svelte:fragment slot="voting" let:width let:height>
      <InclusionVoteButtons
        userVoteStatus={inclusionUserVoteStatus}
        positiveVotes={inclusionPositiveVotes}
        negativeVotes={inclusionNegativeVotes}
        {isVotingInclusion}
        availableWidth={width}
        containerY={height / 2}
        mode="preview"
        on:vote={handleInclusionVote}
      />
    </svelte:fragment>
  </BasePreviewNode>
{:else}
  <BaseDetailNode {node} on:modeChange>
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="NodeType" {radius} mode="detail" />
    </svelte:fragment>
    
    <svelte:fragment slot="content" let:x let:y let:width let:height>
      <foreignObject {x} {y} {width} {height}>
        <div class="content-display">{displayContent}</div>
      </foreignObject>
    </svelte:fragment>
    
    <svelte:fragment slot="voting" let:width let:height>
      <InclusionVoteButtons
        userVoteStatus={inclusionUserVoteStatus}
        positiveVotes={inclusionPositiveVotes}
        negativeVotes={inclusionNegativeVotes}
        {isVotingInclusion}
        availableWidth={width}
        containerY={height / 2}
        mode="detail"
        on:vote={handleInclusionVote}
      />
    </svelte:fragment>
    
    <svelte:fragment slot="stats" let:width>
      <VoteStats
        inclusionVotes={{ positive: inclusionPositiveVotes, negative: inclusionNegativeVotes }}
        availableWidth={width}
      />
    </svelte:fragment>
    
    <svelte:fragment slot="metadata" let:radius>
      <NodeMetadata createdAt={nodeData.createdAt} updatedAt={nodeData.updatedAt} {radius} />
    </svelte:fragment>
    
    <svelte:fragment slot="credits" let:radius>
      {#if nodeData.createdBy}
        <CreatorCredits createdBy={nodeData.createdBy} publicCredit={nodeData.publicCredit} {radius} />
      {/if}
    </svelte:fragment>
  </BaseDetailNode>
{/if}

<style>
  .content-preview {
    font-family: Inter;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
  }
  
  .content-display {
    font-family: Inter;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
</style>

7.2 Full-Featured Node Template (Dual Voting + All Features)
Use for: Statement, Answer, Quantity, Evidence
svelte<script lang="ts">
  // Imports
  import BasePreviewNode from '../base/BasePreviewNode.svelte';
  import BaseDetailNode from '../base/BaseDetailNode.svelte';
  import {
    NodeHeader,
    CategoryTags,
    KeywordTags,
    InclusionVoteButtons,
    ContentVoteButtons,
    VoteStats,
    NodeMetadata,
    CreatorCredits,
    CreateLinkedNodeButton
  } from '../ui';
  
  export let node: RenderableNode;
  export let nodeX: number | undefined = undefined;
  export let nodeY: number | undefined = undefined;
  
  const dispatch = createEventDispatcher();
  
  // Data extraction
  const nodeData = node.data as NodeTypeData;
  $: displayContent = nodeData.content;
  
  // Inclusion votes
  $: inclusionPositiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
  $: inclusionNegativeVotes = getNeo4jNumber(nodeData.negativeVotes) || 0;
  $: inclusionNetVotes = inclusionPositiveVotes - inclusionNegativeVotes;
  $: inclusionUserVoteStatus = node.metadata?.userVoteStatus?.status || 'none';
  
  // Content votes
  $: contentPositiveVotes = getNeo4jNumber(nodeData.contentPositiveVotes) || 0;
  $: contentNegativeVotes = getNeo4jNumber(nodeData.contentNegativeVotes) || 0;
  $: contentUserVoteStatus = node.metadata?.contentVoteStatus?.status || 'none';
  
  // Threshold
  $: canExpand = hasMetInclusionThreshold(inclusionNetVotes);
  
  // Voting state
  let isVotingInclusion = false;
  let isVotingContent = false;
  
  $: isDetail = node.mode === 'detail';
  
  // Vote handlers
  async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
    if (isVotingInclusion) return;
    isVotingInclusion = true;
    
    const { voteType } = event.detail;
    
    try {
      const endpoint = voteType === 'none'
        ? `/nodes/${node.type}/${node.id}/vote/remove`
        : `/nodes/${node.type}/${node.id}/vote`;
      
      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: voteType !== 'none' ? JSON.stringify({ isPositive: voteType === 'agree' }) : undefined
      });
      
      node.data.positiveVotes = response.positiveVotes;
      node.data.negativeVotes = response.negativeVotes;
      node.metadata.userVoteStatus = { status: voteType };
      
    } catch (error) {
      console.error('Inclusion vote failed:', error);
    } finally {
      isVotingInclusion = false;
    }
  }
  
  async function handleContentVote(event: CustomEvent<{ voteType: VoteStatus }>) {
    if (isVotingContent) return;
    isVotingContent = true;
    
    const { voteType } = event.detail;
    
    try {
      const endpoint = voteType === 'none'
        ? `/nodes/${node.type}/${node.id}/content-vote/remove`
        : `/nodes/${node.type}/${node.id}/content-vote`;
      
      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: voteType !== 'none' ? JSON.stringify({ isPositive: voteType === 'agree' }) : undefined
      });
      
      node.data.contentPositiveVotes = response.contentPositiveVotes;
      node.data.contentNegativeVotes = response.contentNegativeVotes;
      node.metadata.contentVoteStatus = { status: voteType };
      
    } catch (error) {
      console.error('Content vote failed:', error);
    } finally {
      isVotingContent = false;
    }
  }
  
  function handleModeChange(event: CustomEvent) {
    dispatch('modeChange', event.detail);
  }
  
  function handleCategoryClick(event: CustomEvent) {
    // Navigate to category or filter
    console.log('Category clicked:', event.detail);
  }
  
  function handleKeywordClick(event: CustomEvent) {
    // Navigate to word or filter
    console.log('Keyword clicked:', event.detail);
  }
  
  function handleCreateChild() {
    // Open child creation modal
    console.log('Create child node');
  }
</script>

{#if !isDetail}
  <BasePreviewNode {node} {nodeX} {nodeY} {canExpand} on:modeChange={handleModeChange}>
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="NodeType" {radius} size="small" mode="preview" />
    </svelte:fragment>
    
    <svelte:fragment slot="content" let:x let:y let:width let:height>
      <foreignObject {x} {y} {width} {height}>
        <div class="content-preview">{displayContent}</div>
      </foreignObject>
    </svelte:fragment>
    
    <svelte:fragment slot="voting" let:x let:y let:width let:height>
      <InclusionVoteButtons
        userVoteStatus={inclusionUserVoteStatus}
        positiveVotes={inclusionPositiveVotes}
        negativeVotes={inclusionNegativeVotes}
        {isVotingInclusion}
        availableWidth={width}
        containerY={y + height / 2}
        mode="preview"
        on:vote={handleInclusionVote}
      />
    </svelte:fragment>
  </BasePreviewNode>
{:else}
  <BaseDetailNode {node} {nodeX} {nodeY} on:modeChange={handleModeChange}>
    <svelte:fragment slot="title" let:radius>
      <NodeHeader title="NodeType" {radius} mode="detail" />
    </svelte:fragment>
    
    <svelte:fragment slot="categoryTags" let:radius>
      {#if nodeData.categories?.length}
        <CategoryTags 
          categories={nodeData.categories} 
          {radius}
          on:categoryClick={handleCategoryClick}
        />
      {/if}
    </svelte:fragment>
    
    <svelte:fragment slot="keywordTags" let:radius>
      {#if nodeData.keywords?.length}
        <KeywordTags 
          keywords={nodeData.keywords} 
          {radius}
          on:keywordClick={handleKeywordClick}
        />
      {/if}
    </svelte:fragment>
    
    <svelte:fragment slot="content" let:x let:y let:width let:height>
      <foreignObject {x} {y} {width} {height}>
        <div class="content-display">{displayContent}</div>
      </foreignObject>
    </svelte:fragment>
    
    <svelte:fragment slot="voting" let:x let:y let:width let:height>
      <!-- Inclusion voting (secondary in detail) -->
      <InclusionVoteButtons
        userVoteStatus={inclusionUserVoteStatus}
        positiveVotes={inclusionPositiveVotes}
        negativeVotes={inclusionNegativeVotes}
        {isVotingInclusion}
        availableWidth={width}
        containerY={y}
        mode="detail"
        on:vote={handleInclusionVote}
      />
      
      <!-- Content voting (primary in detail) -->
      <ContentVoteButtons
        userVoteStatus={contentUserVoteStatus}
        positiveVotes={contentPositiveVotes}
        negativeVotes={contentNegativeVotes}
        {isVotingContent}
        availableWidth={width}
        containerY={y + 60}
        mode="detail"
        on:vote={handleContentVote}
      />
    </svelte:fragment>
    
    <svelte:fragment slot="stats" let:x let:y let:width let:height>
      <VoteStats
        inclusionVotes={{ positive: inclusionPositiveVotes, negative: inclusionNegativeVotes }}
        contentVotes={{ positive: contentPositiveVotes, negative: contentNegativeVotes }}
        availableWidth={width}
        containerY={y}
      />
    </svelte:fragment>
    
    <svelte:fragment slot="metadata" let:radius>
      <NodeMetadata
        createdAt={nodeData.createdAt}
        updatedAt={nodeData.updatedAt}
        {radius}
      />
    </svelte:fragment>
    
    <svelte:fragment slot="credits" let:radius>
      {#if nodeData.createdBy}
        <CreatorCredits
          createdBy={nodeData.createdBy}
          publicCredit={nodeData.publicCredit}
          {radius}
        />
      {/if}
    </svelte:fragment>
    
    <svelte:fragment slot="createChild" let:radius>
      <CreateLinkedNodeButton
        parentId={node.id}
        parentType={node.type}
        buttonType="evidence"
        {radius}
        on:click={handleCreateChild}
      />
    </svelte:fragment>
  </BaseDetailNode>
{/if}

<style>
  .content-preview {
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    line-height: 1.4;
  }
  
  .content-display {
    font-family: Inter;
    font-size: 16px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    line-height: 1.4;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
</style>

8. Common Patterns
8.1 Handling Special Cases
Large Nodes (e.g., Quantity with graph):
svelte<BaseDetailNode 
  {node}
  titleYOffset={1.2}
  categoryTagsYOffset={1.05}
  metadataYOffset={1.0}
  creditsYOffset={1.15}
>
  <!-- slots -->
</BaseDetailNode>
Nodes Without Certain Features:
svelte<!-- Word node: No category tags, no createChild -->
<BaseDetailNode {node}>
  <svelte:fragment slot="title">...</svelte:fragment>
  <!-- Skip categoryTags slot -->
  <svelte:fragment slot="keywordTags">...</svelte:fragment>
  <svelte:fragment slot="content">...</svelte:fragment>
  <svelte:fragment slot="voting">...</svelte:fragment>
  <svelte:fragment slot="stats">...</svelte:fragment>
  <svelte:fragment slot="metadata">...</svelte:fragment>
  <svelte:fragment slot="credits">...</svelte:fragment>
  <!-- Skip createChild slot -->
</BaseDetailNode>
8.2 Conditional Rendering
Show tags only if present:
svelte<svelte:fragment slot="categoryTags" let:radius>
  {#if nodeData.categories?.length}
    <CategoryTags categories={nodeData.categories} {radius} />
  {/if}
</svelte:fragment>
Show createChild only if threshold met:
svelte<svelte:fragment slot="createChild" let:radius>
  {#if canExpand}
    <CreateLinkedNodeButton
      parentId={node.id}
      buttonType="answer"
      {radius}
      on:click={handleCreateChild}
    />
  {/if}
</svelte:fragment>
8.3 Data Extraction Patterns
Neo4j Integer Handling:
svelteimport { getNeo4jNumber } from '$lib/utils/neo4j-utils';

$: inclusionPositiveVotes = getNeo4jNumber(nodeData.positiveVotes) || 0;
Metadata Fallbacks:
svelte$: inclusionUserVoteStatus = node.metadata?.userVoteStatus?.status || 'none';
Optional Fields:
svelte$: categories = nodeData.categories || [];
$: keywords = nodeData.keywords || [];
$: hasCreator = !!nodeData.createdBy;
8.4 Event Handling Patterns
Mode Change (Always forward):
sveltefunction handleModeChange(event: CustomEvent) {
  dispatch('modeChange', event.detail);
}
Category/Keyword Click (Navigate or filter):
sveltefunction handleCategoryClick(event: CustomEvent<{ categoryId: string }>) {
  const { categoryId } = event.detail;
  // Option 1: Navigate to category node
  // Option 2: Filter graph by category
  // Option 3: Open category details
}
Child Creation (Open modal/form):
sveltefunction handleCreateChild() {
  // Dispatch event to open creation modal
  dispatch('createChildNode', {
    parentId: node.id,
    parentType: node.type,
    childType: 'evidence'
  });
}

9. Testing Checklist
For each refactored node, verify:
Preview Mode:

✅ Title displays correctly
✅ Content displays correctly (truncated if needed)
✅ InclusionVoteButtons appear and function
✅ Expand button shows/hides based on threshold
✅ Expand button works when threshold met
✅ Mode change event fires correctly

Detail Mode:

✅ Title displays correctly
✅ CategoryTags display (if applicable)
✅ KeywordTags display (if applicable)
✅ Content displays fully
✅ InclusionVoteButtons appear and function
✅ ContentVoteButtons appear and function (if applicable)
✅ VoteStats display correctly
✅ NodeMetadata displays timestamps
✅ CreatorCredits display (if present)
✅ CreateLinkedNodeButton appears (if applicable)
✅ Collapse button works
✅ All elements positioned correctly (no overlaps)

Voting:

✅ Inclusion vote API calls work
✅ Content vote API calls work (if applicable)
✅ Vote counts update locally
✅ User vote status updates
✅ Loading states work
✅ Error handling works

Special Cases:

✅ Node works with missing optional fields
✅ Node works with empty arrays (categories, keywords)
✅ Node works without creator info
✅ Position overrides work (if tested)


10. Phase 3 Implementation Order
Order of Refactoring (Dependencies First):

Word (3-4h) - Foundation, no dependencies
Definition (3-4h) - Depends on Word
Category (5-6h) - Foundation, uses KeywordTags heavily
Statement (4-5h) - Full featured, good reference
OpenQuestion (4-5h) - Similar to Statement
Answer (5-6h) - New node, depends on OpenQuestion
Quantity (4-5h) - Special case, larger size
Evidence (5-6h) - New node, terminal (no children)
Comment (3-4h) - Simple, threaded replies
Hidden (1-2h) - Review/verify existing


11. Quick Reference
Import Statement:
svelteimport {
  NodeHeader,
  CategoryTags,
  KeywordTags,
  InclusionVoteButtons,
  ContentVoteButtons,
  VoteStats,
  NodeMetadata,
  CreatorCredits,
  CreateLinkedNodeButton
} from '../ui';
Vote Constant:
svelteimport { hasMetInclusionThreshold, VOTING_CONSTANTS } from '$lib/constants/graph/voting';
Utility Functions:
svelteimport { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import { fetchWithAuth } from '$lib/services/api';
Base Components:
svelteimport BasePreviewNode from '../base/BasePreviewNode.svelte';
import BaseDetailNode from '../base/BaseDetailNode.svelte';

Summary
Phase 2 Complete ✅
We've successfully implemented Option B for both BasePreviewNode and BaseDetailNode, achieving:

✅ Excellent Consistency - All nodes have identical positioning
✅ Separation of Concerns - Base layer = layout, Nodes = logic/content
✅ DRY Principles - No repeated position calculations
✅ Flexibility - Override props for special cases
✅ Clear Architecture - Easy to understand and maintain

Ready for Phase 3: Individual node refactoring with consistent patterns and templates.

End of Documentation