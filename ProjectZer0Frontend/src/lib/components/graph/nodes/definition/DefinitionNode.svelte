<!-- src/lib/components/graph/nodes/definition/DefinitionNode.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus } from '$lib/types/domain/nodes';
	import { isDefinitionData } from '$lib/types/graph/enhanced';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import NodeHeader from '../ui/NodeHeader.svelte';
	import InclusionVoteButtons from '../ui/InclusionVoteButtons.svelte';
	import ContentVoteButtons from '../ui/ContentVoteButtons.svelte';
	import VoteStats from '../ui/VoteStats.svelte';
	import NodeMetadata from '../ui/NodeMetadata.svelte';
	import CreatorCredits from '../ui/CreatorCredits.svelte';
	import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
	import { graphStore } from '$lib/stores/graphStore';

	export let node: RenderableNode;
	export let wordText: string = '';

	// Type validation
	if (!isDefinitionData(node.data)) {
		throw new Error('Invalid node data type for DefinitionNode');
	}

	let definitionData = node.data;

	// Determine subtype from group
	const subtype = node.group === 'live-definition' ? 'live' : 'alternative';
	const nodeTitle = subtype === 'live' ? 'Live Definition' : 'Alternative Definition';

	// Helper to get correct metadata group (maps live-definition and alternative-definition to 'definition')
	function getMetadataGroup(): 'definition' {
		return 'definition';
	}

	// Data extraction
	$: definitionText = definitionData.definitionText;

	// INCLUSION voting (whether definition should exist)
	$: inclusionPositiveVotes = getNeo4jNumber(definitionData.inclusionPositiveVotes) || 0;
	$: inclusionNegativeVotes = getNeo4jNumber(definitionData.inclusionNegativeVotes) || 0;
	$: inclusionNetVotes = getNeo4jNumber(definitionData.inclusionNetVotes) || 
		(inclusionPositiveVotes - inclusionNegativeVotes);
	
	// CONTENT voting (quality/accuracy of definition)
	$: contentPositiveVotes = getNeo4jNumber(definitionData.contentPositiveVotes) || 0;
	$: contentNegativeVotes = getNeo4jNumber(definitionData.contentNegativeVotes) || 0;
	$: contentNetVotes = getNeo4jNumber(definitionData.contentNetVotes) || 
		(contentPositiveVotes - contentNegativeVotes);
	
	// User vote status
	$: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
	$: contentUserVoteStatus = (node.metadata?.contentVoteStatus?.status || 'none') as VoteStatus;
	
	// Threshold check for expansion (based on inclusion votes)
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	// Voting behaviour instances
	let inclusionVoting: VoteBehaviour;
	let contentVoting: VoteBehaviour;

	// Mode state
	$: isDetail = node.mode === 'detail';

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
	}>();

	// Initialize voting behaviours on mount
	onMount(async () => {
		// Create voting behaviour for INCLUSION votes
		inclusionVoting = createVoteBehaviour(node.id, 'definition', {
			apiIdentifier: definitionData.id,
			dataObject: definitionData,
			dataProperties: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			getVoteEndpoint: (id) => `/definitions/${id}/inclusion-vote`,
			getRemoveVoteEndpoint: (id) => `/definitions/${id}/inclusion-vote/remove`,
			graphStore,
			onDataUpdate: () => {
				// Trigger reactivity
				definitionData = { ...definitionData };
			},
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'inclusionVoteStatus',
				metadataGroup: getMetadataGroup()
			}
		});

		// Create voting behaviour for CONTENT votes
		contentVoting = createVoteBehaviour(node.id, 'definition', {
			apiIdentifier: definitionData.id,
			dataObject: definitionData,
			dataProperties: {
				positiveVotesKey: 'contentPositiveVotes',
				negativeVotesKey: 'contentNegativeVotes'
			},
			getVoteEndpoint: (id) => `/definitions/${id}/content-vote`,
			getRemoveVoteEndpoint: (id) => `/definitions/${id}/content-vote/remove`,
			graphStore,
			onDataUpdate: () => {
				// Trigger reactivity
				definitionData = { ...definitionData };
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
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title={nodeTitle} {radius} mode="detail" />
		</svelte:fragment>

		<!-- Content: Definition text with bold word -->
		<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
			<foreignObject
				x={x}
				y={y + 10}
				{width}
				height={height - 100}
			>
				<div class="definition-display">
					<span class="definition-text">
						<span class="word-part">{wordText}:</span> {definitionText}
					</span>
				</div>
			</foreignObject>

			<!-- Instruction text for dual voting -->
			<foreignObject
				x={x}
				y={y + height - 90}
				{width}
				height="80"
			>
				<div class="instruction-text">
					<strong>Include/Exclude:</strong> Should this definition exist for "{wordText}"? 
					<strong>Agree/Disagree:</strong> Is this definition accurate and well-written?
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

		<!-- Metadata -->
		<svelte:fragment slot="metadata" let:radius>
			<NodeMetadata
				createdAt={definitionData.createdAt}
				updatedAt={definitionData.updatedAt}
				{radius}
			/>
		</svelte:fragment>

		<!-- Creator credits -->
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

		<!-- No createChild slot - Definitions don't create children -->
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title={nodeTitle} {radius} mode="preview" size="small" />
		</svelte:fragment>

		<!-- Content: Definition text with bold word -->
		<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
			<foreignObject
				x={x}
				y={y + layoutConfig.titleYOffset}
				{width}
				{height}
			>
				<div class="definition-preview">
					<span class="definition-text">
						<span class="word-part">{wordText}:</span> {definitionText}
					</span>
				</div>
			</foreignObject>
		</svelte:fragment>

		<!-- Preview mode: ONLY inclusion voting -->
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
	.definition-display {
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
		padding: 10px;
		box-sizing: border-box;
	}

	.definition-preview {
		font-family: Inter;
		font-size: 12px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.9);
		text-align: center;
		line-height: 1.4;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 5px;
		box-sizing: border-box;
	}

	.definition-text {
		font-weight: 400;
		color: rgba(255, 255, 255, 0.9);
	}

	.word-part {
		font-weight: 600;
		color: white;
	}

	.instruction-text {
		font-family: Inter;
		font-size: 12px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.75);
		text-align: center;
		line-height: 1.4;
		padding: 10px;
		box-sizing: border-box;
	}

	.instruction-text strong {
		color: rgba(255, 255, 255, 0.9);
		font-weight: 600;
	}
</style>