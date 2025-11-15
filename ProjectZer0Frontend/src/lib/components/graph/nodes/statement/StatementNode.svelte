<!-- src/lib/components/graph/nodes/statement/StatementNode.svelte -->
<!-- REORGANIZED: Proper content ordering - prompts in content section, voting buttons in voting section, stats in stats section -->
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

	// 🔍 DEBUGGING: Log complete node data structure
	console.group(`[StatementNode] Node Data Debug - ID: ${node.id}`);
	console.log('Full node object:', node);
	console.log('node.data:', statementData);
	console.log('node.data.categories:', statementData.categories);
	console.log('categories type:', typeof statementData.categories);
	console.log('categories is array?', Array.isArray(statementData.categories));
	if (Array.isArray(statementData.categories)) {
		console.log('categories length:', statementData.categories.length);
		console.log('categories[0]:', statementData.categories[0]);
	}
	console.log('node.data.keywords:', statementData.keywords);
	console.log('keywords type:', typeof statementData.keywords);
	console.log('keywords is array?', Array.isArray(statementData.keywords));
	if (Array.isArray(statementData.keywords)) {
		console.log('keywords length:', statementData.keywords.length);
		console.log('keywords[0]:', statementData.keywords[0]);
	}
	console.log('Raw JSON of statementData:', JSON.stringify(statementData, null, 2));
	console.groupEnd();

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
		categoryClick: { categoryId: string; categoryName: string };
		keywordClick: { word: string };
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
			{:else}
				<!-- 🔍 DEBUGGING: Visual indicator when no categories -->
				<text
					y="0"
					style:font-family="Inter"
					style:font-size="10px"
					style:fill="rgba(255, 0, 0, 0.6)"
					style:text-anchor="middle"
				>
					[NO CATEGORIES]
				</text>
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
			{:else}
				<!-- 🔍 DEBUGGING: Visual indicator when no keywords -->
				<text
					y="0"
					style:font-family="Inter"
					style:font-size="10px"
					style:fill="rgba(255, 0, 0, 0.6)"
					style:text-anchor="middle"
				>
					[NO KEYWORDS]
				</text>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<!-- 4. Statement text at top (50% of content section) -->
			<foreignObject {x} {y} {width} height={Math.floor(height * 0.4)}>
				<TextContent text={displayStatement} mode="detail" />
			</foreignObject>

			<!-- 5. Inclusion vote prompt -->
			<foreignObject {x} y={y + Math.floor(height * 0.55)} {width} height="24">
				<div class="vote-prompt">
					<strong>Include/Exclude:</strong> Should this exist in the graph?
				</div>
			</foreignObject>

			<!-- 6. Inclusion vote buttons -->
			<g transform="translate(0, {y + Math.floor(height * 0.73)})">
				<InclusionVoteButtons
					userVoteStatus={inclusionUserVoteStatus}
					positiveVotes={inclusionPositiveVotes}
					negativeVotes={inclusionNegativeVotes}
					isVoting={inclusionVotingState.isVoting}
					voteSuccess={inclusionVotingState.voteSuccess}
					lastVoteType={inclusionVotingState.lastVoteType}
					availableWidth={width}
					containerY={0}
					mode="detail"
					on:vote={handleInclusionVote}
				/>
			</g>

			<!-- 7. Inclusion vote stats (compact) -->
			<g transform="translate(0, {y + Math.floor(height * 0.45)})">
				<VoteStats
					userVoteStatus={inclusionUserVoteStatus}
					positiveVotes={inclusionPositiveVotes}
					negativeVotes={inclusionNegativeVotes}
					positiveLabel="Include"
					negativeLabel="Exclude"
					availableWidth={width}
					containerY={0}
					showUserStatus={false}
					showBackground={false}
				/>
			</g>
		</svelte:fragment>

		<svelte:fragment slot="voting" let:width let:height let:y>
			<!-- 8. Content vote prompt -->
			<foreignObject x={-width/2} {y} {width} height="24">
				<div class="vote-prompt">
					<strong>Agree/Disagree:</strong> Is this statement accurate?
				</div>
			</foreignObject>

			<!-- 9. Content vote buttons -->
			<g transform="translate(0, {y + 28})">
				<ContentVoteButtons
					userVoteStatus={contentUserVoteStatus}
					positiveVotes={contentPositiveVotes}
					negativeVotes={contentNegativeVotes}
					isVoting={contentVotingState.isVoting}
					voteSuccess={contentVotingState.voteSuccess}
					lastVoteType={contentVotingState.lastVoteType}
					availableWidth={width}
					containerY={0}
					mode="detail"
					on:vote={handleContentVote}
				/>
			</g>

			<!-- 10. Content vote stats (compact) -->
			<g transform="translate(0, {y + 70})">
				<VoteStats
					userVoteStatus={contentUserVoteStatus}
					positiveVotes={contentPositiveVotes}
					negativeVotes={contentNegativeVotes}
					positiveLabel="Agree"
					negativeLabel="Disagree"
					availableWidth={width}
					containerY={0}
					showUserStatus={false}
					showBackground={false}
				/>
			</g>
		</svelte:fragment>

		<svelte:fragment slot="stats" let:width let:height let:y>
			<!-- Stats section now available for item 11: metadata and credits -->
			<!-- These will be added in next iteration -->
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
			<!-- Store subscriptions automatically trigger reactivity -->
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