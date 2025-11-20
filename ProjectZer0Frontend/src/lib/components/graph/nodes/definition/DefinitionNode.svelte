<!-- src/lib/components/graph/nodes/definition/DefinitionNode.svelte -->
<!-- REORGANIZED: Clean 3-section semantic structure - contentText / inclusionVoting / contentVoting -->
<!-- FIXED: API endpoints now use /definitions/ instead of /nodes/definition/ -->
<!-- FIXED: Word extraction from data instead of prop, style debugging -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus } from '$lib/types/domain/nodes';
	import { isDefinitionData } from '$lib/types/graph/enhanced';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { TextContent, NodeHeader, InclusionVoteButtons, ContentVoteButtons, VoteStats, NodeMetadata, CreatorCredits } from '../ui';
	import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
	import { graphStore } from '$lib/stores/graphStore';

	export let node: RenderableNode;
	// FIXED: Make wordText optional since we can extract it from data
	export let wordText: string = '';

	if (!isDefinitionData(node.data)) {
		throw new Error('Invalid node data type for DefinitionNode');
	}

	let definitionData = node.data;

	// DEBUG: Log the definition data we're receiving
	console.log('[DefinitionNode] Received definition data:', {
		id: definitionData.id,
		word: definitionData.word,
		definitionText: definitionData.definitionText,
		wordTextProp: wordText,
		hasDefinitionText: !!definitionData.definitionText,
		definitionTextLength: definitionData.definitionText?.length,
		nodeStyle: node.style,
		nodeColors: node.style?.colors
	});

	const subtype = node.group === 'live-definition' ? 'live' : 'alternative';
	const nodeTitle = subtype === 'live' ? 'Live Definition' : 'Alternative Definition';

	function getMetadataGroup(): 'definition' {
		return 'definition';
	}

	// FIXED: Extract word from data object if not provided as prop
	$: displayWord = wordText || definitionData.word || '[word missing]';
	$: definitionText = definitionData.definitionText || '[definition text missing]';

	// DEBUG: Log reactive values
	$: console.log('[DefinitionNode] Reactive values:', {
		displayWord,
		definitionText,
		definitionTextLength: definitionText.length,
		isDetail
	});

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
		: (getNeo4jNumber(definitionData.inclusionPositiveVotes) || 0);
	
	$: inclusionNegativeVotes = inclusionNegativeVotesStore 
		? $inclusionNegativeVotesStore
		: (getNeo4jNumber(definitionData.inclusionNegativeVotes) || 0);
	
	$: inclusionNetVotes = inclusionNetVotesStore 
		? $inclusionNetVotesStore
		: (getNeo4jNumber(definitionData.inclusionNetVotes) || (inclusionPositiveVotes - inclusionNegativeVotes));
	
	$: inclusionUserVoteStatus = (inclusionUserVoteStatusStore 
		? $inclusionUserVoteStatusStore
		: (node.metadata?.inclusionVoteStatus?.status || 'none')) as VoteStatus;

	// FIXED: Subscribe to CONTENT stores (reactive), fallback to data
	$: contentPositiveVotes = contentPositiveVotesStore 
		? $contentPositiveVotesStore
		: (getNeo4jNumber(definitionData.contentPositiveVotes) || 0);
	
	$: contentNegativeVotes = contentNegativeVotesStore 
		? $contentNegativeVotesStore
		: (getNeo4jNumber(definitionData.contentNegativeVotes) || 0);
	
	$: contentNetVotes = contentNetVotesStore 
		? $contentNetVotesStore
		: (getNeo4jNumber(definitionData.contentNetVotes) || (contentPositiveVotes - contentNegativeVotes));
	
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

	$: isDetail = node.mode === 'detail';

	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
	}>();

	onMount(async () => {
		console.log('[DefinitionNode] Mounting - data verification:', {
			nodeId: node.id,
			word: definitionData.word,
			definitionText: definitionData.definitionText,
			hasText: !!definitionData.definitionText,
			textLength: definitionData.definitionText?.length,
			style: node.style,
			colors: node.style?.colors
		});

		console.log('[DefinitionNode] Initializing vote behaviours for', node.id);

		// Initialize INCLUSION voting
		// FIXED: Use /definitions/ endpoints instead of /nodes/definition/
		inclusionVoting = createVoteBehaviour(node.id, 'definition', {
			apiIdentifier: definitionData.id,
			dataObject: definitionData,
			dataProperties: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			apiResponseKeys: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			getVoteEndpoint: (id) => `/definitions/${id}/vote-inclusion`,
			getRemoveVoteEndpoint: (id) => `/definitions/${id}/vote`,
			getVoteStatusEndpoint: (id) => `/definitions/${id}/vote-status`,
			graphStore,
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'inclusionVoteStatus',
				metadataGroup: getMetadataGroup()
			}
			// NO voteKind - uses separate endpoint
		});

		// Initialize CONTENT voting
		// FIXED: Use /definitions/ endpoints instead of /nodes/definition/
		contentVoting = createVoteBehaviour(node.id, 'definition', {
			apiIdentifier: definitionData.id,
			dataObject: definitionData,
			dataProperties: {
				positiveVotesKey: 'contentPositiveVotes',
				negativeVotesKey: 'contentNegativeVotes'
			},
			apiResponseKeys: {
				positiveVotesKey: 'contentPositiveVotes',
				negativeVotesKey: 'contentNegativeVotes'
			},
			getVoteEndpoint: (id) => `/definitions/${id}/vote-content`,
			getRemoveVoteEndpoint: (id) => `/definitions/${id}/vote`,
			getVoteStatusEndpoint: (id) => `/definitions/${id}/vote-status`,
			graphStore,
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'contentVoteStatus',
				metadataGroup: getMetadataGroup()
			}
			// NO voteKind - uses separate endpoint
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

		console.log('[DefinitionNode] Vote behaviours initialized:', {
			nodeId: node.id,
			inclusionVotes: { inclusionPositiveVotes, inclusionNegativeVotes, inclusionNetVotes },
			contentVotes: { contentPositiveVotes, contentNegativeVotes, contentNetVotes },
			inclusionStatus: inclusionUserVoteStatus,
			contentStatus: contentUserVoteStatus
		});
	});

	async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!inclusionVoting) {
			console.error('[DefinitionNode] Inclusion vote behaviour not initialized');
			return;
		}
		console.log('[DefinitionNode] Handling inclusion vote:', event.detail.voteType);
		await inclusionVoting.handleVote(event.detail.voteType);
	}

	async function handleContentVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!contentVoting) {
			console.error('[DefinitionNode] Content vote behaviour not initialized');
			return;
		}
		console.log('[DefinitionNode] Handling content vote:', event.detail.voteType);
		await contentVoting.handleVote(event.detail.voteType);
	}

	function handleModeChange(event: CustomEvent) {
		dispatch('modeChange', {
			...event.detail,
			nodeId: node.id
		});
	}
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title={nodeTitle} {radius} mode="detail" />
		</svelte:fragment>

		<!-- REORGANIZED: Section 1 - Content Text (Word + Definition) -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<!-- DEBUG: Show what we're trying to render -->
			{#if !definitionText || definitionText === '[definition text missing]'}
				<text
					x="0"
					y={y + 50}
					style:font-family="Inter"
					style:font-size="12px"
					style:fill="red"
					style:text-anchor="middle"
				>
					DEBUG: No definition text available
				</text>
				<text
					x="0"
					y={y + 70}
					style:font-family="Inter"
					style:font-size="10px"
					style:fill="red"
					style:text-anchor="middle"
				>
					Data: {JSON.stringify(definitionData)}
				</text>
			{/if}

			<!-- Word + Definition display -->
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.text || 0))} 
				{width} 
				height={Math.floor(height * (positioning.textHeight || 0.70))}
			>
				<div class="definition-wrapper">
					<span class="word-part">{displayWord}:</span>
					<div class="definition-text">
						<TextContent text={definitionText} mode="detail" verticalAlign="start" />
					</div>
				</div>
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
					<strong>Include/Exclude:</strong> Should this definition exist?
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
					<strong>Agree/Disagree:</strong> Is this definition accurate?
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
				createdAt={definitionData.createdAt}
				updatedAt={definitionData.updatedAt}
				{radius}
			/>
		</svelte:fragment>

		<svelte:fragment slot="credits" let:radius>
			{#if definitionData.createdBy && definitionData.createdBy !== 'FreeDictionaryAPI'}
				<CreatorCredits
					createdBy={definitionData.createdBy}
					publicCredit={definitionData.publicCredit}
					{radius}
					prefix="defined by:"
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title={nodeTitle} {radius} mode="preview" size="small" />
		</svelte:fragment>

		<!-- REORGANIZED: Preview mode - simplified structure -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.text || 0))} 
				{width} 
				height={Math.floor(height * (positioning.textHeight || 1.0))}
			>
				<div class="definition-wrapper">
					<span class="word-part">{displayWord}:</span>
					<div class="definition-text">
						<TextContent text={definitionText} mode="preview" verticalAlign="start" />
					</div>
				</div>
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

	.definition-wrapper {
		font-family: Inter, sans-serif;
		text-align: left;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-start;
		width: 100%;
		height: 100%;
		padding: 5px;
		box-sizing: border-box;
	}

	.word-part {
		font-weight: 600;
		color: white;
		font-size: inherit;
		margin-bottom: 0.5em;
		display: block;
	}

	.definition-text {
		flex: 1;
		width: 100%;
		overflow-wrap: break-word;
		word-wrap: break-word;
	}
</style>