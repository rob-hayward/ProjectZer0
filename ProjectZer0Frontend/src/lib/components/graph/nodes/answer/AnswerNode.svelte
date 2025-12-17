<!-- src/lib/components/graph/nodes/answer/AnswerNode.svelte -->
<!-- REORGANIZED: Clean 3-section semantic structure - contentText / inclusionVoting / contentVoting -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
	import { isAnswerData } from '$lib/types/graph/enhanced';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { TextContent, NodeHeader, InclusionVoteButtons, ContentVoteButtons, VoteStats, CategoryTags, KeywordTags, NodeMetadata, CreatorCredits } from '../ui';
	import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
	import { graphStore } from '$lib/stores/graphStore';

	export let node: RenderableNode;

	if (!isAnswerData(node.data)) {
		throw new Error('Invalid node data type for AnswerNode');
	}

	let answerData = node.data;

	function getMetadataGroup(): 'answer' {
		return 'answer';
	}

	$: displayAnswer = answerData.answerText;

	let inclusionVoting: VoteBehaviour;
	let contentVoting: VoteBehaviour;

	// CRITICAL: Extract INCLUSION store references for Svelte's $ auto-subscription
	$: inclusionPositiveVotesStore = inclusionVoting?.positiveVotes;
	$: inclusionNegativeVotesStore = inclusionVoting?.negativeVotes;
	$: inclusionNetVotesStore = inclusionVoting?.netVotes;
	$: inclusionUserVoteStatusStore = inclusionVoting?.userVoteStatus;
	$: inclusionIsVotingStore = inclusionVoting?.isVoting;
	$: inclusionVoteSuccessStore = inclusionVoting?.voteSuccess;
	$: inclusionLastVoteTypeStore = inclusionVoting?.lastVoteType;

	// CRITICAL: Extract CONTENT store references for Svelte's $ auto-subscription
	$: contentPositiveVotesStore = contentVoting?.positiveVotes;
	$: contentNegativeVotesStore = contentVoting?.negativeVotes;
	$: contentNetVotesStore = contentVoting?.netVotes;
	$: contentUserVoteStatusStore = contentVoting?.userVoteStatus;
	$: contentIsVotingStore = contentVoting?.isVoting;
	$: contentVoteSuccessStore = contentVoting?.voteSuccess;
	$: contentLastVoteTypeStore = contentVoting?.lastVoteType;

	// FIXED: Subscribe to INCLUSION stores (reactive), fallback to data
	$: inclusionPositiveVotes = inclusionPositiveVotesStore 
		? $inclusionPositiveVotesStore
		: (getNeo4jNumber(answerData.inclusionPositiveVotes) || 0);
	
	$: inclusionNegativeVotes = inclusionNegativeVotesStore 
		? $inclusionNegativeVotesStore
		: (getNeo4jNumber(answerData.inclusionNegativeVotes) || 0);
	
	$: inclusionNetVotes = inclusionNetVotesStore 
		? $inclusionNetVotesStore
		: (getNeo4jNumber(answerData.inclusionNetVotes) || (inclusionPositiveVotes - inclusionNegativeVotes));
	
	$: inclusionUserVoteStatus = (inclusionUserVoteStatusStore 
		? $inclusionUserVoteStatusStore
		: (node.metadata?.inclusionVoteStatus?.status || 'none')) as VoteStatus;

	// FIXED: Subscribe to CONTENT stores (reactive), fallback to data
	$: contentPositiveVotes = contentPositiveVotesStore 
		? $contentPositiveVotesStore
		: (getNeo4jNumber(answerData.contentPositiveVotes) || 0);
	
	$: contentNegativeVotes = contentNegativeVotesStore 
		? $contentNegativeVotesStore
		: (getNeo4jNumber(answerData.contentNegativeVotes) || 0);
	
	$: contentNetVotes = contentNetVotesStore 
		? $contentNetVotesStore
		: (getNeo4jNumber(answerData.contentNetVotes) || (contentPositiveVotes - contentNegativeVotes));
	
	$: contentUserVoteStatus = (contentUserVoteStatusStore 
		? $contentUserVoteStatusStore
		: (node.metadata?.contentVoteStatus?.status || 'none')) as VoteStatus;

	// FIXED: Create votingState objects from store subscriptions
	$: inclusionVotingState = {
		isVoting: inclusionIsVotingStore ? $inclusionIsVotingStore : false,
		voteSuccess: inclusionVoteSuccessStore ? $inclusionVoteSuccessStore : false,
		lastVoteType: inclusionLastVoteTypeStore ? $inclusionLastVoteTypeStore : null
	};

	$: contentVotingState = {
		isVoting: contentIsVotingStore ? $contentIsVotingStore : false,
		voteSuccess: contentVoteSuccessStore ? $contentVoteSuccessStore : false,
		lastVoteType: contentLastVoteTypeStore ? $contentLastVoteTypeStore : null
	};
	
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	$: categories = (() => {
		const cats = answerData.categories || [];
		if (cats.length === 0) return [];
		if (typeof cats[0] === 'object' && 'id' in cats[0]) {
			return cats as Array<{ id: string; name: string }>;
		}
		return [];
	})();

	$: keywords = answerData.keywords || [];

	$: isDetail = node.mode === 'detail';

	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
		categoryClick: { categoryId: string; categoryName: string };
		keywordClick: { word: string };
	}>();

	onMount(async () => {
		console.log('[AnswerNode] Initializing vote behaviours for', node.id);
		
		// Initialize INCLUSION voting
		inclusionVoting = createVoteBehaviour(node.id, 'answer', {
			apiIdentifier: answerData.id,
			dataObject: answerData,
			dataProperties: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			apiResponseKeys: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			getVoteEndpoint: (id) => `/nodes/answer/${id}/vote-inclusion`,
			getRemoveVoteEndpoint: (id) => `/nodes/answer/${id}/vote`,
			getVoteStatusEndpoint: (id) => `/nodes/answer/${id}/vote-status`,
			graphStore,
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'inclusionVoteStatus',
				metadataGroup: getMetadataGroup()
			},
			voteKind: 'INCLUSION'
		});

		// Initialize CONTENT voting
		contentVoting = createVoteBehaviour(node.id, 'answer', {
			apiIdentifier: answerData.id,
			dataObject: answerData,
			dataProperties: {
				positiveVotesKey: 'contentPositiveVotes',
				negativeVotesKey: 'contentNegativeVotes'
			},
			apiResponseKeys: {
				positiveVotesKey: 'contentPositiveVotes',
				negativeVotesKey: 'contentNegativeVotes'
			},
			getVoteEndpoint: (id) => `/nodes/answer/${id}/vote-content`,
			getRemoveVoteEndpoint: (id) => `/nodes/answer/${id}/vote`,
			getVoteStatusEndpoint: (id) => `/nodes/answer/${id}/vote-status`,
			graphStore,
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'contentVoteStatus',
				metadataGroup: getMetadataGroup()
			},
			voteKind: 'CONTENT'
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
		
		console.log('[AnswerNode] Vote behaviours initialized:', {
			nodeId: node.id,
			inclusionVotes: { inclusionPositiveVotes, inclusionNegativeVotes, inclusionNetVotes },
			contentVotes: { contentPositiveVotes, contentNegativeVotes, contentNetVotes },
			inclusionStatus: inclusionUserVoteStatus,
			contentStatus: contentUserVoteStatus
		});
	});

	async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!inclusionVoting) {
			console.error('[AnswerNode] Inclusion vote behaviour not initialized');
			return;
		}
		console.log('[AnswerNode] Handling inclusion vote:', event.detail.voteType);
		await inclusionVoting.handleVote(event.detail.voteType);
	}

	async function handleContentVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!contentVoting) {
			console.error('[AnswerNode] Content vote behaviour not initialized');
			return;
		}
		console.log('[AnswerNode] Handling content vote:', event.detail.voteType);
		await contentVoting.handleVote(event.detail.voteType);
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
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Answer" {radius} mode="detail" />
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

		<!-- REORGANIZED: Section 1 - Content Text Only -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<!-- Answer text -->
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.text || 0))} 
				{width} 
				height={Math.floor(height * (positioning.textHeight || 0.65))}
			>
				<TextContent text={displayAnswer} mode="detail" verticalAlign="start" />
			</foreignObject>

			<!-- Instruction text -->
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.instruction || 0.70))} 
				{width} 
				height="40"
			>
			</foreignObject>
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
					<strong>Include/Exclude:</strong> Should this answer exist?
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

		<!-- REORGANIZED: Section 3 - Content Voting (Complete system, mirrors inclusion!) -->
		<svelte:fragment slot="contentVoting" let:x let:y let:width let:height let:positioning>
			<!-- Content vote prompt -->
			<foreignObject 
				{x} 
				y={y + Math.floor(height * positioning.prompt)} 
				{width} 
				height="24"
			>
				<div class="vote-prompt">
					<strong>Agree/Disagree:</strong> Is this answer accurate?
				</div>
			</foreignObject>

			<!-- Content vote buttons -->
			<g transform="translate(0, {y + Math.floor(height * positioning.buttons)})">
				<ContentVoteButtons
					userVoteStatus={contentUserVoteStatus}
					positiveVotes={contentPositiveVotes}
					negativeVotes={contentNegativeVotes}
					isVoting={contentVotingState.isVoting}
					voteSuccess={contentVotingState.voteSuccess}
					lastVoteType={contentVotingState.lastVoteType}
					availableWidth={width}
					mode="detail"
					on:vote={handleContentVote}
				/>
			</g>

			<!-- Content vote stats -->
			<g transform="translate(0, {y + Math.floor(height * positioning.stats)})">
				<VoteStats
					userVoteStatus={contentUserVoteStatus}
					positiveVotes={contentPositiveVotes}
					negativeVotes={contentNegativeVotes}
					positiveLabel="Agree"
					negativeLabel="Disagree"
					availableWidth={width}
					showUserStatus={false}
					showBackground={false}
				/>
			</g>
		</svelte:fragment>

		<svelte:fragment slot="metadata" let:radius>
			<NodeMetadata
				createdAt={answerData.createdAt}
				updatedAt={answerData.updatedAt}
			/>
		</svelte:fragment>

		<svelte:fragment slot="credits" let:radius>
			<CreatorCredits
				createdBy={answerData.createdBy}
				publicCredit={answerData.publicCredit}
			/>
		</svelte:fragment>

		<!-- REMOVED: createChild slot no longer needed - NodeRenderer will handle the CreateLinkedNodeButton once 'answer' is added to qualifying node types -->
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Answer" {radius} mode="preview" />
		</svelte:fragment>

		<!-- REORGANIZED: Preview mode - simplified structure -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.text || 0))} 
				{width} 
				height={Math.floor(height * (positioning.textHeight || 1.0))}
			>
				<TextContent text={displayAnswer} mode="preview" verticalAlign="start" />
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
</style>