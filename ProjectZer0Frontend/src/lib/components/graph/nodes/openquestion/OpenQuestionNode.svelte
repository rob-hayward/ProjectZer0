<!-- src/lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
	import { isOpenQuestionData } from '$lib/types/graph/enhanced';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import NodeHeader from '../ui/NodeHeader.svelte';
	import InclusionVoteButtons from '../ui/InclusionVoteButtons.svelte';
	import VoteStats from '../ui/VoteStats.svelte';
	import CategoryTags from '../ui/CategoryTags.svelte';
	import KeywordTags from '../ui/KeywordTags.svelte';
	import NodeMetadata from '../ui/NodeMetadata.svelte';
	import CreatorCredits from '../ui/CreatorCredits.svelte';
	import CreateLinkedNodeButton from '../ui/CreateLinkedNodeButton.svelte';
	import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
	import { graphStore } from '$lib/stores/graphStore';

	export let node: RenderableNode;

	// Type validation
	if (!isOpenQuestionData(node.data)) {
		throw new Error('Invalid node data type for OpenQuestionNode');
	}

	let questionData = node.data;

	// Helper to get correct metadata group
	function getMetadataGroup(): 'openquestion' {
		return 'openquestion';
	}

	// Data extraction
	$: displayQuestion = questionData.questionText;

	// Inclusion voting data (OpenQuestion nodes have inclusion voting only)
	$: inclusionPositiveVotes = getNeo4jNumber(questionData.inclusionPositiveVotes) || 0;
	$: inclusionNegativeVotes = getNeo4jNumber(questionData.inclusionNegativeVotes) || 0;
	$: inclusionNetVotes = getNeo4jNumber(questionData.inclusionNetVotes) || 
		(inclusionPositiveVotes - inclusionNegativeVotes);
	
	// User vote status from metadata
	$: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
	
	// Threshold check for expansion
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	// Extract categories - handle both string[] and Category[] formats
	$: categories = (() => {
		const cats = questionData.categories || [];
		if (cats.length === 0) return [];
		
		// Check if already enriched (has objects with id/name)
		if (typeof cats[0] === 'object' && 'id' in cats[0]) {
			return cats as Array<{ id: string; name: string }>;
		}
		
		// If string IDs, can't display without names
		return [];
	})();

	// Extract keywords
	$: keywords = questionData.keywords || [];

	// Extract answer count
	$: answerCount = questionData.answerCount || 0;

	// Voting behaviour instance
	let inclusionVoting: VoteBehaviour;

	// Mode state
	$: isDetail = node.mode === 'detail';

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
		createChildNode: { parentId: string; parentType: string; childType: string };
		categoryClick: { categoryId: string; categoryName: string };
		keywordClick: { word: string };
	}>();

	// Initialize voting behaviour on mount
	onMount(async () => {
		// Create voting behaviour for inclusion votes
		inclusionVoting = createVoteBehaviour(node.id, 'openquestion', {
			apiIdentifier: questionData.id,
			dataObject: questionData,
			dataProperties: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			getVoteEndpoint: (id) => `/openquestions/${id}/vote`,
			getRemoveVoteEndpoint: (id) => `/openquestions/${id}/vote/remove`,
			graphStore,
			onDataUpdate: () => {
				// Trigger reactivity
				questionData = { ...questionData };
			},
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'inclusionVoteStatus'
			}
		});

		// Initialize with current vote data
		await inclusionVoting.initialize({
			positiveVotes: inclusionPositiveVotes,
			negativeVotes: inclusionNegativeVotes,
			skipVoteStatusFetch: false
		});
	});

	// Vote handler - now uses behaviour
	async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!inclusionVoting) return;
		await inclusionVoting.handleVote(event.detail.voteType);
	}

	// Get reactive state from behaviour
	$: votingState = inclusionVoting?.getCurrentState() || {
		isVoting: false,
		voteSuccess: false,
		lastVoteType: null
	};

	// Mode change handler
	function handleModeChange(event: CustomEvent) {
		dispatch('modeChange', {
			...event.detail,
			nodeId: node.id
		});
	}

	// Category click handler
	function handleCategoryClick(event: CustomEvent<{ categoryId: string; categoryName: string }>) {
		dispatch('categoryClick', event.detail);
	}

	// Keyword click handler
	function handleKeywordClick(event: CustomEvent<{ word: string }>) {
		dispatch('keywordClick', event.detail);
	}

	// Create child node handler (Answer)
	function handleCreateChild() {
		dispatch('createChildNode', {
			parentId: node.id,
			parentType: 'openquestion',
			childType: 'answer'
		});
	}
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Open Question" {radius} mode="detail" />
		</svelte:fragment>

		<!-- CategoryTags: Show categories this question is tagged with -->
		<svelte:fragment slot="categoryTags" let:radius>
			{#if categories.length > 0}
				<CategoryTags 
					{categories}
					{radius}
					maxDisplay={3}
					on:categoryClick={handleCategoryClick}
				/>
			{/if}
		</svelte:fragment>

		<!-- KeywordTags: Show keywords (user and AI) -->
		<svelte:fragment slot="keywordTags" let:radius>
			{#if keywords.length > 0}
				<KeywordTags 
					{keywords}
					{radius}
					maxDisplay={8}
					on:keywordClick={handleKeywordClick}
				/>
			{/if}
		</svelte:fragment>

		<!-- Content: Display the question text -->
		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<foreignObject
				{x}
				y={y + 10}
				{width}
				height={height - 80}
			>
				<div class="question-display">
					{displayQuestion}
				</div>
			</foreignObject>

			<!-- Answer count display -->
			{#if answerCount > 0}
				<foreignObject
					{x}
					y={y + height - 70}
					{width}
					height="60"
				>
					<div class="answer-count">
						{answerCount} answer{answerCount !== 1 ? 's' : ''}
					</div>
				</foreignObject>
			{/if}
		</svelte:fragment>

		<!-- Voting: Inclusion voting only -->
		<svelte:fragment slot="voting" let:width let:height let:y>
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
		</svelte:fragment>

		<!-- Vote stats showing inclusion voting -->
		<svelte:fragment slot="stats" let:width let:y>
			<VoteStats
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				positiveLabel="Include"
				negativeLabel="Exclude"
				availableWidth={width}
				containerY={y}
				showUserStatus={false}
			/>
		</svelte:fragment>

		<!-- Metadata: Standard node metadata -->
		<svelte:fragment slot="metadata" let:radius>
			<NodeMetadata
				createdAt={questionData.createdAt}
				updatedAt={questionData.updatedAt}
				{radius}
			/>
		</svelte:fragment>

		<!-- Credits: Standard creator credits -->
		<svelte:fragment slot="credits" let:radius>
			<CreatorCredits
				createdBy={questionData.createdBy}
				publicCredit={questionData.publicCredit}
				{radius}
				prefix="asked by:"
			/>
		</svelte:fragment>

		<!-- CreateChild: Answer creation button (NE corner) -->
		<svelte:fragment slot="createChild" let:radius>
			{#if canExpand}
				<CreateLinkedNodeButton
					y={-radius * 0.7071}
					x={radius * 0.7071}
					nodeId={node.id}
					nodeType="openquestion"
					on:click={handleCreateChild}
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Question" {radius} mode="preview" />
		</svelte:fragment>

		<!-- Content: Show question text in preview -->
		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<text
				x="0"
				y={y + 10}
				class="question-preview"
				text-anchor="middle"
			>
				{displayQuestion.length > 80 ? displayQuestion.substring(0, 80) + '...' : displayQuestion}
			</text>
		</svelte:fragment>

		<!-- Voting: Inclusion voting in preview mode -->
		<svelte:fragment slot="voting" let:x let:y let:width let:height>
			<InclusionVoteButtons
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				isVoting={votingState.isVoting}
				voteSuccess={votingState.voteSuccess}
				lastVoteType={votingState.lastVoteType}
				availableWidth={width}
				containerY={y}
				mode="preview"
				on:vote={handleInclusionVote}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.question-display {
		font-family: 'Inter', sans-serif;
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
		padding: 10px;
		box-sizing: border-box;
	}

	.question-preview {
		font-family: 'Orbitron', sans-serif;
		font-size: 14px;
		font-weight: 500;
		fill: white;
		dominant-baseline: middle;
	}

	.answer-count {
		font-family: 'Inter', sans-serif;
		font-size: 12px;
		font-weight: 500;
		color: rgba(0, 188, 212, 0.9); /* Cyan color for questions */
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}
</style>