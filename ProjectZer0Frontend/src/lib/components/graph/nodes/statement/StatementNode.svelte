<!-- src/lib/components/graph/nodes/statement/StatementNode.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
	import { isStatementData } from '$lib/types/graph/enhanced';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { TextContent, NodeHeader, InclusionVoteButtons, ContentVoteButtons, VoteStats, CategoryTags, KeywordTags, NodeMetadata, CreatorCredits, CreateLinkedNodeButton } from '../ui';
	import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
	import { graphStore } from '$lib/stores/graphStore';

	export let node: RenderableNode;

	if (!isStatementData(node.data)) {
		throw new Error('Invalid node data type for StatementNode');
	}

	let statementData = node.data;

	function getMetadataGroup(): 'statement' {
		return 'statement';
	}

	$: displayStatement = statementData.statement;

	$: inclusionPositiveVotes = getNeo4jNumber(statementData.inclusionPositiveVotes) || 0;
	$: inclusionNegativeVotes = getNeo4jNumber(statementData.inclusionNegativeVotes) || 0;
	$: inclusionNetVotes = getNeo4jNumber(statementData.inclusionNetVotes) || 
		(inclusionPositiveVotes - inclusionNegativeVotes);
	
	$: contentPositiveVotes = getNeo4jNumber(statementData.contentPositiveVotes) || 0;
	$: contentNegativeVotes = getNeo4jNumber(statementData.contentNegativeVotes) || 0;
	$: contentNetVotes = getNeo4jNumber(statementData.contentNetVotes) || 
		(contentPositiveVotes - contentNegativeVotes);
	
	$: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
	$: contentUserVoteStatus = (node.metadata?.contentVoteStatus?.status || 'none') as VoteStatus;
	
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	$: categories = (() => {
		const cats = statementData.categories || [];
		if (cats.length === 0) return [];
		if (typeof cats[0] === 'object' && 'id' in cats[0]) {
			return cats as Array<{ id: string; name: string }>;
		}
		return [];
	})();

	$: keywords = statementData.keywords || [];

	let inclusionVoting: VoteBehaviour;
	let contentVoting: VoteBehaviour;

	$: isDetail = node.mode === 'detail';

	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
		createChildNode: { parentId: string; parentType: string; childType: string };
		categoryClick: { categoryId: string; categoryName: string };
		keywordClick: { word: string };
	}>();

	onMount(async () => {
		inclusionVoting = createVoteBehaviour(node.id, 'statement', {
			apiIdentifier: statementData.id,
			dataObject: statementData,
			dataProperties: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			getVoteEndpoint: (id) => `/nodes/statement/${id}/vote-inclusion`,
			getRemoveVoteEndpoint: (id) => `/nodes/statement/${id}/vote/remove`,
			graphStore,
			onDataUpdate: () => {
				statementData = { ...statementData };
			},
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'inclusionVoteStatus',
				metadataGroup: getMetadataGroup()
			}
		});

		contentVoting = createVoteBehaviour(node.id, 'statement', {
			apiIdentifier: statementData.id,
			dataObject: statementData,
			dataProperties: {
				positiveVotesKey: 'contentPositiveVotes',
				negativeVotesKey: 'contentNegativeVotes'
			},
			getVoteEndpoint: (id) => `/nodes/statement/${id}/vote-content`,
			getRemoveVoteEndpoint: (id) => `/nodes/statement/${id}/vote/remove`,
			graphStore,
			onDataUpdate: () => {
				statementData = { ...statementData };
			},
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'contentVoteStatus',
				metadataGroup: getMetadataGroup()
			}
		});

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

	async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!inclusionVoting) return;
		await inclusionVoting.handleVote(event.detail.voteType);
	}

	async function handleContentVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!contentVoting) return;
		await contentVoting.handleVote(event.detail.voteType);
	}

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
			parentType: 'statement',
			childType: 'evidence'
		});
	}
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Statement" {radius} mode="detail" />
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

		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<foreignObject {x} {y} {width} height={height - 100}>
				<TextContent text={displayStatement} mode="detail" />
			</foreignObject>

			<foreignObject {x} y={y + height - 90} {width} height="80">
				<div class="instruction-text">
					<strong>Include/Exclude:</strong> Should this statement exist in the graph? 
					<strong>Agree/Disagree:</strong> Is this statement accurate and well-reasoned?
				</div>
			</foreignObject>
		</svelte:fragment>

		<svelte:fragment slot="voting" let:width let:height let:y>
			<InclusionVoteButtons
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				isVoting={inclusionVotingState.isVoting}
				voteSuccess={inclusionVotingState.voteSuccess}
				lastVoteType={inclusionVotingState.lastVoteType}
				availableWidth={width}
				containerY={y}
				mode="detail"
				on:vote={handleInclusionVote}
			/>

			<ContentVoteButtons
				userVoteStatus={contentUserVoteStatus}
				positiveVotes={contentPositiveVotes}
				negativeVotes={contentNegativeVotes}
				isVoting={contentVotingState.isVoting}
				voteSuccess={contentVotingState.voteSuccess}
				lastVoteType={contentVotingState.lastVoteType}
				availableWidth={width}
				containerY={y + 60}
				mode="detail"
				on:vote={handleContentVote}
			/>
		</svelte:fragment>

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
			
			<g transform="translate(0, 80)">
				<VoteStats
					userVoteStatus={contentUserVoteStatus}
					positiveVotes={contentPositiveVotes}
					negativeVotes={contentNegativeVotes}
					positiveLabel="Agree"
					negativeLabel="Disagree"
					availableWidth={width}
					containerY={y}
					showUserStatus={false}
				/>
			</g>
		</svelte:fragment>

		<svelte:fragment slot="metadata" let:radius>
			<NodeMetadata
				createdAt={statementData.createdAt}
				updatedAt={statementData.updatedAt}
				{radius}
			/>
		</svelte:fragment>

		<svelte:fragment slot="credits" let:radius>
			<CreatorCredits
				createdBy={statementData.createdBy}
				publicCredit={statementData.publicCredit}
				{radius}
			/>
		</svelte:fragment>

		<svelte:fragment slot="createChild" let:radius>
			{#if canExpand}
				<CreateLinkedNodeButton
					y={-radius * 0.7071}
					x={radius * 0.7071}
					nodeId={node.id}
					nodeType="statement"
					on:click={handleCreateChild}
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Statement" {radius} mode="preview" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<foreignObject {x} {y} {width} {height}>
				<TextContent text={displayStatement} mode="preview" />
			</foreignObject>
		</svelte:fragment>

		<svelte:fragment slot="voting" let:width let:height let:y>
			<InclusionVoteButtons
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				isVoting={inclusionVotingState.isVoting}
				voteSuccess={inclusionVotingState.voteSuccess}
				lastVoteType={inclusionVotingState.lastVoteType}
				availableWidth={width}
				containerY={y}
				mode="preview"
				on:vote={handleInclusionVote}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.instruction-text {
		font-family: Inter, sans-serif;
		font-size: 11px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.7);
		text-align: center;
		line-height: 1.3;
		padding: 5px 10px;
	}

	.instruction-text strong {
		color: rgba(255, 255, 255, 0.9);
		font-weight: 600;
	}
</style>