<!-- src/lib/components/graph/nodes/word/WordNode.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
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
	import { fetchWithAuth } from '$lib/services/api';

	export let node: RenderableNode;

	// Type validation
	if (!isWordNodeData(node.data)) {
		throw new Error('Invalid node data type for WordNode');
	}

	const wordData = node.data;

	// Data extraction
	$: displayWord = wordData.word;

	// Inclusion voting data (Word nodes have inclusion voting only)
	$: inclusionPositiveVotes = getNeo4jNumber(wordData.inclusionPositiveVotes) || 0;
	$: inclusionNegativeVotes = getNeo4jNumber(wordData.inclusionNegativeVotes) || 0;
	$: inclusionNetVotes = getNeo4jNumber(wordData.inclusionNetVotes) || 
		(inclusionPositiveVotes - inclusionNegativeVotes);
	
	// User vote status from metadata - uses VoteStatus type for consistency
	// InclusionVoteButtons expects VoteStatus ('agree'/'disagree'/'none')
	// and displays it as "Include"/"Exclude" labels
	$: inclusionUserVoteStatus = (node.metadata?.userVoteStatus?.status || 'none') as VoteStatus;
	
	// Threshold check for expansion
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	// Convert categories (string[]) to Keyword[] format for KeywordTags component
	$: keywordsForDisplay = (wordData.categories || []).map((cat: string) => ({
		word: cat,
		frequency: 1,
		source: 'user' as const
	})) as Keyword[];

	// Voting state
	let isVotingInclusion = false;
	let voteSuccess = false;
	let lastVoteType: VoteStatus | null = null;

	// Mode state
	$: isDetail = node.mode === 'detail';

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
	}>();

	// Vote handler
	async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (isVotingInclusion) return;
		isVotingInclusion = true;
		voteSuccess = false;

		const { voteType } = event.detail;

		try {
			const endpoint = voteType === 'none'
				? `/nodes/word/${encodeURIComponent(displayWord)}/vote/remove`
				: `/nodes/word/${encodeURIComponent(displayWord)}/vote`;

			const response = await fetchWithAuth(endpoint, {
				method: voteType === 'none' ? 'DELETE' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: voteType !== 'none' ? JSON.stringify({ voteType }) : undefined
			});

			if (response.ok) {
				const result = await response.json();
				
				// Update local vote counts
				if (result.inclusionPositiveVotes !== undefined) {
					wordData.inclusionPositiveVotes = result.inclusionPositiveVotes;
				}
				if (result.inclusionNegativeVotes !== undefined) {
					wordData.inclusionNegativeVotes = result.inclusionNegativeVotes;
				}
				if (result.inclusionNetVotes !== undefined) {
					wordData.inclusionNetVotes = result.inclusionNetVotes;
				}

				// Update metadata - userVoteStatus.status is used for all voting types
				if (node.metadata?.userVoteStatus) {
					node.metadata.userVoteStatus.status = voteType === 'none' ? null : voteType;
				} else if (node.metadata) {
					node.metadata.userVoteStatus = {
						status: voteType === 'none' ? null : voteType
					};
				}

				voteSuccess = true;
				lastVoteType = voteType === 'none' ? null : voteType;

				// Reset success indicator after delay
				setTimeout(() => {
					voteSuccess = false;
					lastVoteType = null;
				}, 2000);
			}
		} catch (error) {
			console.error('Error voting on word:', error);
		} finally {
			isVotingInclusion = false;
		}
	}

	// Mode change handler
	function handleModeChange(event: CustomEvent) {
		dispatch('modeChange', {
			...event.detail,
			nodeId: node.id
		});
	}

	// Keyword click handler (for categories this word appears in)
	// KeywordTags emits 'keywordClick' with { word: string }
	function handleKeywordClick(event: CustomEvent<{ word: string }>) {
		// TODO: Implement keyword navigation or filtering
		console.log('Keyword clicked:', event.detail.word);
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

		<!-- Content: Display the word prominently -->
		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<text
				x="0"
				y={y + 20}
				class="main-word"
				style:font-family="Inter"
				style:font-size="32px"
				style:font-weight="700"
				style:fill="white"
				style:text-anchor="middle"
				style:filter="drop-shadow(0 0 12px rgba(255, 255, 255, 0.4))"
			>
				{displayWord}
			</text>
		</svelte:fragment>

		<!-- Inclusion voting only -->
		<svelte:fragment slot="voting" let:width let:height>
			<InclusionVoteButtons
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				isVoting={isVotingInclusion}
				{voteSuccess}
				{lastVoteType}
				availableWidth={width}
				containerY={0}
				mode="detail"
				on:vote={handleInclusionVote}
			/>
		</svelte:fragment>

		<!-- Vote stats -->
		<svelte:fragment slot="stats" let:width>
			<VoteStats
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				positiveLabel="Include"
				negativeLabel="Exclude"
				availableWidth={width}
				containerY={0}
			/>
		</svelte:fragment>

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

		<!-- Content: Display the word -->
		<svelte:fragment slot="content" let:x let:y let:layoutConfig>
			<text
				x="0"
				y={y + layoutConfig.titleYOffset + 40}
				class="word-preview"
				style:font-family="Inter"
				style:font-size="20px"
				style:font-weight="500"
				style:fill="white"
				style:text-anchor="middle"
			>
				{displayWord}
			</text>
		</svelte:fragment>

		<!-- Inclusion voting only -->
		<svelte:fragment slot="voting" let:width let:height let:y>
			<InclusionVoteButtons
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				isVoting={isVotingInclusion}
				{voteSuccess}
				{lastVoteType}
				availableWidth={width}
				containerY={y}
				mode="preview"
				on:vote={handleInclusionVote}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.main-word,
	.word-preview {
		text-anchor: middle;
		dominant-baseline: middle;
	}
</style>