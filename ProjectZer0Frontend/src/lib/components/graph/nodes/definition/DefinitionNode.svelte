<!-- src/lib/components/graph/nodes/definition/DefinitionNode.svelte -->
<!-- REORGANIZED: Clean 3-section semantic structure - contentText / inclusionVoting / contentVoting -->
<!-- FIXED: Word on same line as definition, preview font size matches category/word nodes -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus } from '$lib/types/domain/nodes';
	import { isDefinitionData } from '$lib/types/graph/enhanced';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { NodeHeader, InclusionVoteButtons, ContentVoteButtons, VoteStats, NodeMetadata, CreatorCredits } from '../ui';
	import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
	import { graphStore } from '$lib/stores/graphStore';

	export let node: RenderableNode;
	export let wordText: string = '';

	if (!isDefinitionData(node.data)) {
		throw new Error('Invalid node data type for DefinitionNode');
	}

	let definitionData = node.data;

	const subtype = node.group === 'live-definition' ? 'live' : 'alternative';
	const nodeTitle = subtype === 'live' ? 'Live Definition' : 'Alternative Definition';

	function getMetadataGroup(): 'definition' {
		return 'definition';
	}

	$: displayWord = wordText || definitionData.word || '[word missing]';
	$: definitionText = definitionData.definitionText || '[definition text missing]';

	let inclusionVoting: VoteBehaviour;
	let contentVoting: VoteBehaviour;

	// CRITICAL: Extract INCLUSION store references
	$: inclusionPositiveVotesStore = inclusionVoting?.positiveVotes;
	$: inclusionNegativeVotesStore = inclusionVoting?.negativeVotes;
	$: inclusionNetVotesStore = inclusionVoting?.netVotes;
	$: inclusionUserVoteStatusStore = inclusionVoting?.userVoteStatus;
	$: inclusionIsVotingStore = inclusionVoting?.isVoting;
	$: inclusionVoteSuccessStore = inclusionVoting?.voteSuccess;
	$: inclusionLastVoteTypeStore = inclusionVoting?.lastVoteType;

	// CRITICAL: Extract CONTENT store references
	$: contentPositiveVotesStore = contentVoting?.positiveVotes;
	$: contentNegativeVotesStore = contentVoting?.negativeVotes;
	$: contentNetVotesStore = contentVoting?.netVotes;
	$: contentUserVoteStatusStore = contentVoting?.userVoteStatus;
	$: contentIsVotingStore = contentVoting?.isVoting;
	$: contentVoteSuccessStore = contentVoting?.voteSuccess;
	$: contentLastVoteTypeStore = contentVoting?.lastVoteType;

	// FIXED: Subscribe to INCLUSION stores
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

	// FIXED: Subscribe to CONTENT stores
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

	// FIXED: Create voting states
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
		});

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

		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.text || 0.2))} 
				{width} 
				height={Math.floor(height * (positioning.textHeight || 0.70))}
			>
				<div class="definition-wrapper detail">
					<span class="word-part">{displayWord}:</span>
					<span class="definition-text">{definitionText}</span>
				</div>
			</foreignObject>
		</svelte:fragment>

		<svelte:fragment slot="inclusionVoting" let:x let:y let:width let:height let:positioning>
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

		<svelte:fragment slot="contentVoting" let:x let:y let:width let:height let:positioning>
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
			/>
		</svelte:fragment>

		<svelte:fragment slot="credits" let:radius>
			{#if definitionData.createdBy && definitionData.createdBy !== 'FreeDictionaryAPI'}
				<CreatorCredits
					createdBy={definitionData.createdBy}
					publicCredit={definitionData.publicCredit}
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

		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.text || 0.2))} 
				{width} 
				height={Math.floor(height * (positioning.textHeight || 1.15))}
			>
				<div class="definition-wrapper preview">
					<span class="word-part">{displayWord}:</span>
					<span class="definition-text">{definitionText}</span>
				</div>
			</foreignObject>
		</svelte:fragment>

		<svelte:fragment slot="inclusionVoting" let:x let:y let:width let:height let:positioning>
			<g transform="translate(0, {y + Math.floor(height * (positioning.buttons || 0.65))})">
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

	/* UPDATED: Inline layout for word + definition */
	.definition-wrapper {
		font-family: Inter, sans-serif;
		text-align: left;
		width: 100%;
		height: 100%;
		padding: 5px;
		box-sizing: border-box;
		line-height: 1.5;
		color: white;
		display: block; /* Block container for proper foreignObject rendering */
	}

	/* UPDATED: Inline word display */
	.word-part {
		font-weight: 600;
		color: white;
		display: inline;
		margin-right: 0.3em;
	}

	/* UPDATED: Different font sizes for detail vs preview */
	.definition-wrapper.detail {
		font-size: 13px;
	}

	.definition-wrapper.detail .word-part {
		font-size: 16px;
	}

	.definition-wrapper.preview {
		font-size: 12px;
		padding: 3px 5px; /* Reduced vertical padding to prevent text cutoff */
	}

	.definition-wrapper.preview .word-part {
		font-size: 14px; /* Matches category and word preview nodes */
	}

	/* UPDATED: Inline definition text with proper wrapping */
	.definition-text {
		display: inline;
		overflow-wrap: break-word;
		word-wrap: break-word;
		word-break: break-word;
		white-space: normal;
	}
</style>