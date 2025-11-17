<!-- src/lib/components/graph/nodes/word/WordNode.svelte -->
<!-- REORGANIZED: Clean semantic structure - contentText / inclusionVoting only (no content voting) -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
	import { isWordNodeData } from '$lib/types/graph/enhanced';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import NodeHeader from '../ui/NodeHeader.svelte';
	import InclusionVoteButtons from '../ui/InclusionVoteButtons.svelte';
	import VoteStats from '../ui/VoteStats.svelte';
	import KeywordTags from '../ui/KeywordTags.svelte';
	import NodeMetadata from '../ui/NodeMetadata.svelte';
	import CreatorCredits from '../ui/CreatorCredits.svelte';
	import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
	import { graphStore } from '$lib/stores/graphStore';

	export let node: RenderableNode;

	// Type validation
	if (!isWordNodeData(node.data)) {
		throw new Error('Invalid node data type for WordNode');
	}

	let wordData = node.data;

	// Data extraction
	$: displayWord = wordData.word;

	let inclusionVoting: VoteBehaviour;

	// CRITICAL: Extract store references for Svelte's $ auto-subscription
	$: positiveVotesStore = inclusionVoting?.positiveVotes;
	$: negativeVotesStore = inclusionVoting?.negativeVotes;
	$: netVotesStore = inclusionVoting?.netVotes;
	$: userVoteStatusStore = inclusionVoting?.userVoteStatus;
	$: isVotingStore = inclusionVoting?.isVoting;
	$: voteSuccessStore = inclusionVoting?.voteSuccess;
	$: lastVoteTypeStore = inclusionVoting?.lastVoteType;

	// FIXED: Subscribe to stores (reactive), fallback to data
	$: inclusionPositiveVotes = positiveVotesStore 
		? $positiveVotesStore
		: (getNeo4jNumber(wordData.inclusionPositiveVotes) || 0);
	
	$: inclusionNegativeVotes = negativeVotesStore 
		? $negativeVotesStore
		: (getNeo4jNumber(wordData.inclusionNegativeVotes) || 0);
	
	$: inclusionNetVotes = netVotesStore 
		? $netVotesStore
		: (getNeo4jNumber(wordData.inclusionNetVotes) || (inclusionPositiveVotes - inclusionNegativeVotes));
	
	$: inclusionUserVoteStatus = (userVoteStatusStore 
		? $userVoteStatusStore
		: (node.metadata?.inclusionVoteStatus?.status || 'none')) as VoteStatus;

	// FIXED: Create votingState from store subscriptions
	$: votingState = {
		isVoting: isVotingStore ? $isVotingStore : false,
		voteSuccess: voteSuccessStore ? $voteSuccessStore : false,
		lastVoteType: lastVoteTypeStore ? $lastVoteTypeStore : null
	};
	
	// Threshold check for expansion
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	// Convert categories (string[]) to Keyword[] format for KeywordTags component
	$: keywordsForDisplay = (wordData.categories || []).map((cat: string) => ({
		word: cat,
		frequency: 1,
		source: 'user' as const
	})) as Keyword[];

	// Mode state
	$: isDetail = node.mode === 'detail';

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
		keywordClick: { word: string };
	}>();

	// Initialize voting behaviour on mount
	onMount(async () => {
		// Create voting behaviour for inclusion votes
		inclusionVoting = createVoteBehaviour(node.id, 'word', {
			apiIdentifier: displayWord, // Words use their text as identifier
			dataObject: wordData,
			dataProperties: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			getVoteEndpoint: (word) => `/nodes/word/${encodeURIComponent(word)}/vote`,
			getRemoveVoteEndpoint: (word) => `/nodes/word/${encodeURIComponent(word)}/vote/remove`,
			graphStore,
			onDataUpdate: () => {
				// Trigger reactivity
				wordData = { ...wordData };
			},
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'inclusionVoteStatus'
			}
		});

		// Initialize with current vote data
		await inclusionVoting.initialize({
			positiveVotes: inclusionPositiveVotes,
			negativeVotes: inclusionNegativeVotes,
			skipVoteStatusFetch: false
		});
	});

	// Vote handler - now uses behaviour
	async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!inclusionVoting) return;
		await inclusionVoting.handleVote(event.detail.voteType);
	}

	// Mode change handler
	function handleModeChange(event: CustomEvent) {
		dispatch('modeChange', {
			...event.detail,
			nodeId: node.id
		});
	}

	// Keyword click handler (for categories this word appears in)
	function handleKeywordClick(event: CustomEvent<{ word: string }>) {
		dispatch('keywordClick', event.detail);
	}
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Word" {radius} mode="detail" />
		</svelte:fragment>

		<!-- KeywordTags: Show categories this word appears in -->
		<svelte:fragment slot="keywordTags" let:radius>
			{#if keywordsForDisplay.length > 0}
				<KeywordTags 
					keywords={keywordsForDisplay}
					{radius}
					maxDisplay={8}
					on:keywordClick={handleKeywordClick}
				/>
			{/if}
		</svelte:fragment>

		<!-- REORGANIZED: Section 1 - Content Text (Word Display) -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<!-- Display the word prominently, centered -->
			<text
				x={x + width/2}
				y={y + Math.floor(height * (positioning.word || 0.5))}
				class="main-word"
				style:font-family="Inter"
				style:font-size="32px"
				style:font-weight="700"
				style:fill="white"
				style:text-anchor="middle"
				style:dominant-baseline="middle"
				style:filter="drop-shadow(0 0 12px rgba(255, 255, 255, 0.4))"
			>
				{displayWord}
			</text>
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
					<strong>Include/Exclude:</strong> Should this word exist in the graph?
				</div>
			</foreignObject>

			<!-- Inclusion vote buttons -->
			<g transform="translate(0, {y + Math.floor(height * positioning.buttons)})">
				<InclusionVoteButtons
					userVoteStatus={inclusionUserVoteStatus}
					positiveVotes={inclusionPositiveVotes}
					negativeVotes={inclusionNegativeVotes}
					isVoting={votingState.isVoting}
					voteSuccess={votingState.voteSuccess}
					lastVoteType={votingState.lastVoteType}
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

		<!-- Section 3: No content voting for words -->

		<!-- Metadata -->
		<svelte:fragment slot="metadata" let:radius>
			<NodeMetadata
				createdAt={wordData.createdAt}
				updatedAt={wordData.updatedAt}
				{radius}
			/>
		</svelte:fragment>

		<!-- Creator credits -->
		<svelte:fragment slot="credits" let:radius>
			{#if wordData.createdBy}
				<CreatorCredits
					createdBy={wordData.createdBy}
					publicCredit={wordData.publicCredit}
					{radius}
					prefix="created by:"
				/>
			{/if}
		</svelte:fragment>

		<!-- No createChild slot - Words don't create children directly -->
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Word" {radius} mode="preview" size="medium" />
		</svelte:fragment>

		<!-- REORGANIZED: Preview mode - simplified structure -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<!-- Display the word -->
			<text
				x={x + width/2}
				y={y + Math.floor(height * (positioning.word || 0.5))}
				class="word-preview"
				style:font-family="Inter"
				style:font-size="20px"
				style:font-weight="500"
				style:fill="white"
				style:text-anchor="middle"
				style:dominant-baseline="middle"
			>
				{displayWord}
			</text>
		</svelte:fragment>

		<!-- Inclusion voting only -->
		<svelte:fragment slot="inclusionVoting" let:x let:y let:width let:height let:positioning>
			<g transform="translate(0, {y + Math.floor(height * positioning.buttons)})">
				<InclusionVoteButtons
					userVoteStatus={inclusionUserVoteStatus}
					positiveVotes={inclusionPositiveVotes}
					negativeVotes={inclusionNegativeVotes}
					isVoting={votingState.isVoting}
					voteSuccess={votingState.voteSuccess}
					lastVoteType={votingState.lastVoteType}
					availableWidth={width}
					mode="preview"
					on:vote={handleInclusionVote}
				/>
			</g>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.main-word,
	.word-preview {
		text-anchor: middle;
		dominant-baseline: middle;
	}

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