<!-- src/lib/components/graph/nodes/statement/StatementNode.svelte -->
<!-- REORGANIZED: Clean 3-section semantic structure - contentText / inclusionVoting / contentVoting -->
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
		: (getNeo4jNumber(statementData.inclusionPositiveVotes) || 0);
	
	$: inclusionNegativeVotes = inclusionNegativeVotesStore 
		? $inclusionNegativeVotesStore
		: (getNeo4jNumber(statementData.inclusionNegativeVotes) || 0);
	
	$: inclusionNetVotes = inclusionNetVotesStore 
		? $inclusionNetVotesStore
		: (getNeo4jNumber(statementData.inclusionNetVotes) || (inclusionPositiveVotes - inclusionNegativeVotes));
	
	$: inclusionUserVoteStatus = (inclusionUserVoteStatusStore 
		? $inclusionUserVoteStatusStore
		: (node.metadata?.inclusionVoteStatus?.status || 'none')) as VoteStatus;

	// FIXED: Subscribe to CONTENT stores (reactive), fallback to data
	$: contentPositiveVotes = contentPositiveVotesStore 
		? $contentPositiveVotesStore
		: (getNeo4jNumber(statementData.contentPositiveVotes) || 0);
	
	$: contentNegativeVotes = contentNegativeVotesStore 
		? $contentNegativeVotesStore
		: (getNeo4jNumber(statementData.contentNegativeVotes) || 0);
	
	$: contentNetVotes = contentNetVotesStore 
		? $contentNetVotesStore
		: (getNeo4jNumber(statementData.contentNetVotes) || (contentPositiveVotes - contentNegativeVotes));
	
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
		const cats = statementData.categories || [];
		if (cats.length === 0) return [];
		if (typeof cats[0] === 'object' && 'id' in cats[0]) {
			return cats as Array<{ id: string; name: string }>;
		}
		return [];
	})();

	$: keywords = statementData.keywords || [];

	$: isDetail = node.mode === 'detail';

	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
		createChildNode: { parentId: string; parentType: string; childType: string };
		expandCategory: { 
			categoryId: string;
			categoryName: string;
			sourceNodeId: string;  
			sourcePosition: { x: number; y: number };  
		};
		expandWord: { 
			word: string;
			sourceNodeId: string;
			sourcePosition: { x: number; y: number };
		};
	}>();

	onMount(async () => {
		console.log('[StatementNode] Initializing vote behaviours for', node.id);
		
		// Initialize INCLUSION voting
		inclusionVoting = createVoteBehaviour(node.id, 'statement', {
			apiIdentifier: statementData.id,
			dataObject: statementData,
			dataProperties: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			apiResponseKeys: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			getVoteEndpoint: (id) => `/nodes/statement/${id}/vote-inclusion`,
			getRemoveVoteEndpoint: (id) => `/nodes/statement/${id}/vote`,
			getVoteStatusEndpoint: (id) => `/nodes/statement/${id}/vote-status`,
			graphStore,
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'inclusionVoteStatus',
				metadataGroup: getMetadataGroup()
			},
			voteKind: 'INCLUSION'
		});

		// Initialize CONTENT voting
		contentVoting = createVoteBehaviour(node.id, 'statement', {
			apiIdentifier: statementData.id,
			dataObject: statementData,
			dataProperties: {
				positiveVotesKey: 'contentPositiveVotes',
				negativeVotesKey: 'contentNegativeVotes'
			},
			apiResponseKeys: {
				positiveVotesKey: 'contentPositiveVotes',
				negativeVotesKey: 'contentNegativeVotes'
			},
			getVoteEndpoint: (id) => `/nodes/statement/${id}/vote-content`,
			getRemoveVoteEndpoint: (id) => `/nodes/statement/${id}/vote`,
			getVoteStatusEndpoint: (id) => `/nodes/statement/${id}/vote-status`,
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
		
		console.log('[StatementNode] Vote behaviours initialized:', {
			nodeId: node.id,
			inclusionVotes: { inclusionPositiveVotes, inclusionNegativeVotes, inclusionNetVotes },
			contentVotes: { contentPositiveVotes, contentNegativeVotes, contentNetVotes },
			inclusionStatus: inclusionUserVoteStatus,
			contentStatus: contentUserVoteStatus
		});
	});

	async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!inclusionVoting) {
			console.error('[StatementNode] Inclusion vote behaviour not initialized');
			return;
		}
		console.log('[StatementNode] Handling inclusion vote:', event.detail.voteType);
		await inclusionVoting.handleVote(event.detail.voteType);
	}

	async function handleContentVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!contentVoting) {
			console.error('[StatementNode] Content vote behaviour not initialized');
			return;
		}
		console.log('[StatementNode] Handling content vote:', event.detail.voteType);
		await contentVoting.handleVote(event.detail.voteType);
	}

	function handleModeChange(event: CustomEvent) {
		dispatch('modeChange', {
			...event.detail,
			nodeId: node.id
		});
	}

	function handleCategoryClick(event: CustomEvent<{ categoryId: string; categoryName: string }>) {
		const { categoryId, categoryName } = event.detail;
		
		console.log('[StatementNode] Category tag clicked:', {
			categoryId,
			categoryName,
			sourceNodeId: node.id,
			sourcePosition: node.position
		});
		
		dispatch('expandCategory', {  // ← RENAMED from categoryClick
			categoryId,
			categoryName,
			sourceNodeId: node.id,  // ← ADDED
			sourcePosition: {       // ← ADDED
				x: node.position?.x || 0,
				y: node.position?.y || 0
			}
		});
	}

	function handleKeywordClick(event: CustomEvent<{ word: string }>) {
    const { word } = event.detail;
    
    console.log('[NodeComponent] Keyword clicked:', {
        word,
        sourceNodeId: node.id,
        sourcePosition: node.position
    });
    
    dispatch('expandWord', {
        word,
        sourceNodeId: node.id,
        sourcePosition: {
            x: node.position?.x || 0,
            y: node.position?.y || 0
        }
    });
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

		<!-- REORGANIZED: Section 1 - Content Text Only -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<!-- Statement text fills the entire content text section -->
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.text || 0))} 
				{width} 
				height={Math.floor(height * (positioning.textHeight || 1.0))}
			>
				<TextContent text={displayStatement} mode="detail" verticalAlign="start" />
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
					<strong>Include/Exclude:</strong> Should this exist in the graph?
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
					<strong>Agree/Disagree:</strong> Is this statement accurate?
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
				createdAt={statementData.createdAt}
				updatedAt={statementData.updatedAt}
			/>
		</svelte:fragment>

		<svelte:fragment slot="credits" let:radius>
			<CreatorCredits
				createdBy={statementData.createdBy}
				publicCredit={statementData.publicCredit}
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

		<!-- REORGANIZED: Preview mode - simplified structure -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.text || 0))} 
				{width} 
				height={Math.floor(height * (positioning.textHeight || 1.0))}
			>
				<TextContent text={displayStatement} mode="preview" verticalAlign="start" />
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