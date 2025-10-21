<!-- src/lib/components/graph/nodes/definition/DefinitionNode.svelte -->
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

	$: definitionText = definitionData.definitionText;

	$: inclusionPositiveVotes = getNeo4jNumber(definitionData.inclusionPositiveVotes) || 0;
	$: inclusionNegativeVotes = getNeo4jNumber(definitionData.inclusionNegativeVotes) || 0;
	$: inclusionNetVotes = getNeo4jNumber(definitionData.inclusionNetVotes) || 
		(inclusionPositiveVotes - inclusionNegativeVotes);
	
	$: contentPositiveVotes = getNeo4jNumber(definitionData.contentPositiveVotes) || 0;
	$: contentNegativeVotes = getNeo4jNumber(definitionData.contentNegativeVotes) || 0;
	$: contentNetVotes = getNeo4jNumber(definitionData.contentNetVotes) || 
		(contentPositiveVotes - contentNegativeVotes);
	
	$: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
	$: contentUserVoteStatus = (node.metadata?.contentVoteStatus?.status || 'none') as VoteStatus;
	
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	let inclusionVoting: VoteBehaviour;
	let contentVoting: VoteBehaviour;

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
			getVoteEndpoint: (id) => `/definitions/${id}/inclusion-vote`,
			getRemoveVoteEndpoint: (id) => `/definitions/${id}/inclusion-vote/remove`,
			graphStore,
			onDataUpdate: () => {
				definitionData = { ...definitionData };
			},
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
			getVoteEndpoint: (id) => `/definitions/${id}/content-vote`,
			getRemoveVoteEndpoint: (id) => `/definitions/${id}/content-vote/remove`,
			graphStore,
			onDataUpdate: () => {
				definitionData = { ...definitionData };
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
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title={nodeTitle} {radius} mode="detail" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<foreignObject {x} {y} {width} height={height - 100}>
				<div class="definition-wrapper">
					<span class="word-part">{wordText}:</span>
					<TextContent text={definitionText} mode="detail" />
				</div>
			</foreignObject>

			<foreignObject {x} y={y + height - 90} {width} height="80">
				<div class="instruction-text">
					<strong>Include/Exclude:</strong> Should this definition exist for "{wordText}"? 
					<strong>Agree/Disagree:</strong> Is this definition accurate and well-written?
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

		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<foreignObject {x} {y} {width} {height}>
				<div class="definition-wrapper">
					<span class="word-part">{wordText}:</span>
					<TextContent text={definitionText} mode="preview" />
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
				mode="preview"
				on:vote={handleInclusionVote}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.definition-wrapper {
		font-family: Inter, sans-serif;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}

	.word-part {
		font-weight: 600;
		color: white;
		font-size: inherit;
		margin-bottom: 0.25em;
	}

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