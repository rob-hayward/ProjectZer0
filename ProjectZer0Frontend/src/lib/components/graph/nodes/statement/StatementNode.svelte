<!-- src/lib/components/graph/nodes/statement/StatementNode.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
	import { isStatementData } from '$lib/types/graph/enhanced';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import NodeHeader from '../ui/NodeHeader.svelte';
	import InclusionVoteButtons from '../ui/InclusionVoteButtons.svelte';
	import ContentVoteButtons from '../ui/ContentVoteButtons.svelte';
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
	if (!isStatementData(node.data)) {
		throw new Error('Invalid node data type for StatementNode');
	}

	let statementData = node.data;

	// Helper to get correct metadata group
	function getMetadataGroup(): 'statement' {
		return 'statement';
	}

	// Data extraction
	$: displayStatement = statementData.statement;

	// INCLUSION voting (whether statement should exist)
	$: inclusionPositiveVotes = getNeo4jNumber(statementData.inclusionPositiveVotes) || 0;
	$: inclusionNegativeVotes = getNeo4jNumber(statementData.inclusionNegativeVotes) || 0;
	$: inclusionNetVotes = getNeo4jNumber(statementData.inclusionNetVotes) || 
		(inclusionPositiveVotes - inclusionNegativeVotes);
	
	// CONTENT voting (quality/accuracy of statement)
	$: contentPositiveVotes = getNeo4jNumber(statementData.contentPositiveVotes) || 0;
	$: contentNegativeVotes = getNeo4jNumber(statementData.contentNegativeVotes) || 0;
	$: contentNetVotes = getNeo4jNumber(statementData.contentNetVotes) || 
		(contentPositiveVotes - contentNegativeVotes);
	
	// User vote status
	$: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
	$: contentUserVoteStatus = (node.metadata?.contentVoteStatus?.status || 'none') as VoteStatus;
	
	// Threshold check for expansion (based on inclusion votes)
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	// Extract categories - handle both string[] and Category[] formats
	$: categories = (() => {
		const cats = statementData.categories || [];
		if (cats.length === 0) return [];
		
		// Check if already enriched (has objects with id/name)
		if (typeof cats[0] === 'object' && 'id' in cats[0]) {
			return cats as { id: string; name: string }[];
		}
		
		// If string IDs, we can't display them without names - return empty
		return [];
	})();

	// Extract keywords
	$: keywords = statementData.keywords || [];

	// Voting behaviour instances
	let inclusionVoting: VoteBehaviour;
	let contentVoting: VoteBehaviour;

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

	// Initialize voting behaviours on mount
	onMount(async () => {
		// Create voting behaviour for INCLUSION votes
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
				// Trigger reactivity
				statementData = { ...statementData };
			},
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'inclusionVoteStatus',
				metadataGroup: getMetadataGroup()
			}
		});

		// Create voting behaviour for CONTENT votes
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
				// Trigger reactivity
				statementData = { ...statementData };
			},
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'contentVoteStatus',
				metadataGroup: getMetadataGroup()
			}
		});

		// Initialize both voting behaviours
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

	// Vote handlers - now use behaviours
	async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!inclusionVoting) return;
		await inclusionVoting.handleVote(event.detail.voteType);
	}

	async function handleContentVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!contentVoting) return;
		await contentVoting.handleVote(event.detail.voteType);
	}

	// Get reactive state from behaviours
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

	// Create child node handler (Evidence)
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

		<!-- CategoryTags: Show categories this statement is tagged with -->
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

		<!-- Content: Display the statement text -->
		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<foreignObject
				{x}
				y={y + 10}
				{width}
				height={height - 100}
			>
				<div class="statement-display">
					{displayStatement}
				</div>
			</foreignObject>

			<!-- Instruction text for dual voting -->
			<foreignObject
				{x}
				y={y + height - 90}
				{width}
				height="80"
			>
				<div class="instruction-text">
					<strong>Include/Exclude:</strong> Should this statement exist in the graph? 
					<strong>Agree/Disagree:</strong> Is this statement accurate and well-reasoned?
				</div>
			</foreignObject>
		</svelte:fragment>

		<!-- DUAL VOTING: Both inclusion and content -->
		<svelte:fragment slot="voting" let:width let:height let:y>
			<!-- Inclusion voting -->
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

			<!-- Content voting (positioned below inclusion) -->
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

		<!-- Vote stats showing both voting types separately -->
		<svelte:fragment slot="stats" let:width let:y>
			<!-- Inclusion stats -->
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
			
			<!-- Content stats (positioned below) -->
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

		<!-- Metadata: Standard node metadata -->
		<svelte:fragment slot="metadata" let:radius>
			<NodeMetadata
				createdAt={statementData.createdAt}
				updatedAt={statementData.updatedAt}
				{radius}
			/>
		</svelte:fragment>

		<!-- Credits: Standard creator credits -->
		<svelte:fragment slot="credits" let:radius>
			<CreatorCredits
				createdBy={statementData.createdBy}
				publicCredit={statementData.publicCredit}
				{radius}
			/>
		</svelte:fragment>

		<!-- CreateChild: Evidence creation button (NE corner) -->
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

		<!-- Content: Show statement text in preview -->
		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<text
				x="0"
				y={y + 10}
				class="statement-preview"
				text-anchor="middle"
			>
				{displayStatement.length > 80 ? displayStatement.substring(0, 80) + '...' : displayStatement}
			</text>
		</svelte:fragment>

		<!-- Voting: Inclusion voting in preview mode (primary) -->
		<svelte:fragment slot="voting" let:x let:y let:width let:height>
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
	.statement-display {
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

	.statement-preview {
		font-family: 'Orbitron', sans-serif;
		font-size: 14px;
		font-weight: 500;
		fill: white;
		dominant-baseline: middle;
	}

	.instruction-text {
		font-family: 'Inter', sans-serif;
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