<!-- src/lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte -->
<!-- REORGANIZED: Clean semantic structure - contentText / inclusionVoting only (no content voting) -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
	import { isOpenQuestionData } from '$lib/types/graph/enhanced';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { TextContent, NodeHeader, InclusionVoteButtons, VoteStats, CategoryTags, KeywordTags, NodeMetadata, CreatorCredits, CreateLinkedNodeButton } from '../ui';
	import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
	import { graphStore } from '$lib/stores/graphStore';

	export let node: RenderableNode;

	if (!isOpenQuestionData(node.data)) {
		throw new Error('Invalid node data type for OpenQuestionNode');
	}

	let questionData = node.data;

	function getMetadataGroup(): 'openquestion' {
		return 'openquestion';
	}

	$: displayQuestion = questionData.questionText;

	let inclusionVoting: VoteBehaviour;

	// CRITICAL: Extract INCLUSION store references for Svelte's $ auto-subscription
	$: inclusionPositiveVotesStore = inclusionVoting?.positiveVotes;
	$: inclusionNegativeVotesStore = inclusionVoting?.negativeVotes;
	$: inclusionNetVotesStore = inclusionVoting?.netVotes;
	$: inclusionUserVoteStatusStore = inclusionVoting?.userVoteStatus;
	$: inclusionIsVotingStore = inclusionVoting?.isVoting;
	$: inclusionVoteSuccessStore = inclusionVoting?.voteSuccess;
	$: inclusionLastVoteTypeStore = inclusionVoting?.lastVoteType;

	// FIXED: Subscribe to INCLUSION stores (reactive), fallback to data
	$: inclusionPositiveVotes = inclusionPositiveVotesStore 
		? $inclusionPositiveVotesStore
		: (getNeo4jNumber(questionData.inclusionPositiveVotes) || 0);
	
	$: inclusionNegativeVotes = inclusionNegativeVotesStore 
		? $inclusionNegativeVotesStore
		: (getNeo4jNumber(questionData.inclusionNegativeVotes) || 0);
	
	$: inclusionNetVotes = inclusionNetVotesStore 
		? $inclusionNetVotesStore
		: (getNeo4jNumber(questionData.inclusionNetVotes) || (inclusionPositiveVotes - inclusionNegativeVotes));
	
	$: inclusionUserVoteStatus = (inclusionUserVoteStatusStore 
		? $inclusionUserVoteStatusStore
		: (node.metadata?.inclusionVoteStatus?.status || 'none')) as VoteStatus;

	// FIXED: Create votingState object from store subscriptions
	$: inclusionVotingState = {
		isVoting: inclusionIsVotingStore ? $inclusionIsVotingStore : false,
		voteSuccess: inclusionVoteSuccessStore ? $inclusionVoteSuccessStore : false,
		lastVoteType: inclusionLastVoteTypeStore ? $inclusionLastVoteTypeStore : null
	};
	
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	$: categories = (() => {
		const cats = questionData.categories || [];
		if (cats.length === 0) return [];
		if (typeof cats[0] === 'object' && 'id' in cats[0]) {
			return cats as Array<{ id: string; name: string }>;
		}
		return [];
	})();

	$: keywords = questionData.keywords || [];
	$: answerCount = questionData.answerCount || 0;

	$: isDetail = node.mode === 'detail';

	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
		createChildNode: { parentId: string; parentType: string; childType: string };
		categoryClick: { categoryId: string; categoryName: string };
		keywordClick: { word: string };
	}>();

	onMount(async () => {
		console.log('[OpenQuestionNode] Initializing vote behaviour for', node.id);
		
		// Initialize INCLUSION voting only (no content voting for questions)
		inclusionVoting = createVoteBehaviour(node.id, 'openquestion', {
			apiIdentifier: questionData.id,
			dataObject: questionData,
			dataProperties: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			apiResponseKeys: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			getVoteEndpoint: (id) => `/nodes/openquestion/${id}/vote-inclusion`,
			getRemoveVoteEndpoint: (id) => `/nodes/openquestion/${id}/vote`,
			getVoteStatusEndpoint: (id) => `/nodes/openquestion/${id}/vote-status`,
			graphStore,
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'inclusionVoteStatus',
				metadataGroup: getMetadataGroup()
			},
			voteKind: 'INCLUSION'
		});

		await inclusionVoting.initialize({
			positiveVotes: inclusionPositiveVotes,
			negativeVotes: inclusionNegativeVotes,
			skipVoteStatusFetch: false
		});
		
		console.log('[OpenQuestionNode] Vote behaviour initialized:', {
			nodeId: node.id,
			initialVotes: { inclusionPositiveVotes, inclusionNegativeVotes, inclusionNetVotes },
			initialStatus: inclusionUserVoteStatus
		});
	});

	async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!inclusionVoting) {
			console.error('[OpenQuestionNode] Vote behaviour not initialized');
			return;
		}
		console.log('[OpenQuestionNode] Handling inclusion vote:', event.detail.voteType);
		await inclusionVoting.handleVote(event.detail.voteType);
	}

	function handleModeChange(event: CustomEvent) {
		dispatch('modeChange', {
			...event.detail,
			nodeId: node.id
		});
	}

	function handleCategoryClick(event: CustomEvent<{ categoryId: string; categoryName: string }>) {
		dispatch('categoryClick', event.detail);
	}

	function handleKeywordClick(event: CustomEvent<{ word: string }>) {
		dispatch('keywordClick', event.detail);
	}

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
			<NodeHeader title="Question" {radius} mode="detail" />
		</svelte:fragment>

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

		<!-- REORGANIZED: Section 1 - Content Text (question + answer count) -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<!-- Question text -->
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.text || 0))} 
				{width} 
				height={Math.floor(height * (positioning.textHeight || 0.80))}
			>
				<TextContent text={displayQuestion} mode="detail" verticalAlign="start" />
			</foreignObject>

			<!-- Answer count -->
			{#if answerCount > 0}
				<foreignObject 
					{x} 
					y={y + Math.floor(height * (positioning.answerCount || 0.85))} 
					{width} 
					height="30"
				>
					<div class="answer-count">
						{answerCount} answer{answerCount !== 1 ? 's' : ''}
					</div>
				</foreignObject>
			{/if}
		</svelte:fragment>

		<!-- REORGANIZED: Section 2 - Inclusion Voting (Complete system) -->
		<svelte:fragment slot="inclusionVoting" let:x let:y let:width let:height let:positioning>
			<!-- Inclusion vote prompt -->
			<foreignObject 
				{x} 
				y={y + Math.floor(height * positioning.prompt)} 
				{width} 
				height="24"
			>
				<div class="vote-prompt">
					<strong>Include/Exclude:</strong> Should this question exist in the graph?
				</div>
			</foreignObject>

			<!-- Inclusion vote buttons -->
			<g transform="translate(0, {y + Math.floor(height * positioning.buttons)})">
				<InclusionVoteButtons
					userVoteStatus={inclusionUserVoteStatus}
					positiveVotes={inclusionPositiveVotes}
					negativeVotes={inclusionNegativeVotes}
					isVoting={inclusionVotingState.isVoting}
					voteSuccess={inclusionVotingState.voteSuccess}
					lastVoteType={inclusionVotingState.lastVoteType}
					availableWidth={width}
					mode="detail"
					on:vote={handleInclusionVote}
				/>
			</g>

			<!-- Inclusion vote stats -->
			<g transform="translate(0, {y + Math.floor(height * positioning.stats)})">
				<VoteStats
					userVoteStatus={inclusionUserVoteStatus}
					positiveVotes={inclusionPositiveVotes}
					negativeVotes={inclusionNegativeVotes}
					positiveLabel="Include"
					negativeLabel="Exclude"
					availableWidth={width}
					showUserStatus={false}
					showBackground={false}
				/>
			</g>
		</svelte:fragment>

		<!-- Section 3: No content voting for questions -->

		<svelte:fragment slot="metadata" let:radius>
			<NodeMetadata
				createdAt={questionData.createdAt}
				updatedAt={questionData.updatedAt}
			/>
		</svelte:fragment>

		<svelte:fragment slot="credits" let:radius>
			<CreatorCredits
				createdBy={questionData.createdBy}
				publicCredit={questionData.publicCredit}
				prefix="asked by:"
			/>
		</svelte:fragment>

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

		<!-- REORGANIZED: Preview mode - simplified structure -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.text || 0))} 
				{width} 
				height={Math.floor(height * (positioning.textHeight || 1.0))}
			>
				<TextContent text={displayQuestion} mode="preview" verticalAlign="start" />
			</foreignObject>
		</svelte:fragment>

		<svelte:fragment slot="inclusionVoting" let:x let:y let:width let:height let:positioning>
			<!-- Preview mode: just centered inclusion buttons -->
			<g transform="translate(0, {y + Math.floor(height * positioning.buttons)})">
				<InclusionVoteButtons
					userVoteStatus={inclusionUserVoteStatus}
					positiveVotes={inclusionPositiveVotes}
					negativeVotes={inclusionNegativeVotes}
					isVoting={inclusionVotingState.isVoting}
					voteSuccess={inclusionVotingState.voteSuccess}
					lastVoteType={inclusionVotingState.lastVoteType}
					availableWidth={width}
					mode="preview"
					on:vote={handleInclusionVote}
				/>
			</g>
		</svelte:fragment>

		<!-- No content voting in preview mode -->
	</BasePreviewNode>
{/if}

<style>
	.vote-prompt {
		font-family: Inter, sans-serif;
		font-size: 11px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.7);
		text-align: center;
		line-height: 1.3;
		padding: 2px 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.vote-prompt strong {
		color: rgba(255, 255, 255, 0.9);
		font-weight: 600;
	}

	.answer-count {
		font-family: Inter, sans-serif;
		font-size: 12px;
		font-weight: 500;
		color: rgba(0, 188, 212, 0.9);
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}
</style>