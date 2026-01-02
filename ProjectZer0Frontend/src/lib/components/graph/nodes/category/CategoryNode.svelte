<!-- src/lib/components/graph/nodes/category/CategoryNode.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
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

	interface CategoryNodeData {
		id: string;
		name: string;
		createdBy: string;
		publicCredit: boolean;
		createdAt: string;
		updatedAt: string;
		inclusionPositiveVotes: number;
		inclusionNegativeVotes: number;
		inclusionNetVotes: number;
		wordCount?: number;
		contentCount?: number;
		childCount?: number;
		words?: Array<{
			id: string;
			word: string;
			inclusionNetVotes: number;
		}>;
		parentCategory?: {
			id: string;
			name: string;
		} | null;
		childCategories?: Array<{
			id: string;
			name: string;
			inclusionNetVotes: number;
		}>;
		discussionId?: string;
	}

	let categoryData = node.data as CategoryNodeData;

	$: displayName = categoryData.name;
	$: childCount = categoryData.childCount || 0;

	$: keywordsForDisplay = (categoryData.words || []).map((wordObj: { id: string; word: string; inclusionNetVotes: number }) => ({
		word: wordObj.word,
		frequency: 1,
		source: 'user' as const
	})) as Keyword[];

	let inclusionVoting: VoteBehaviour;

	$: positiveVotesStore = inclusionVoting?.positiveVotes;
	$: negativeVotesStore = inclusionVoting?.negativeVotes;
	$: netVotesStore = inclusionVoting?.netVotes;
	$: userVoteStatusStore = inclusionVoting?.userVoteStatus;
	$: isVotingStore = inclusionVoting?.isVoting;
	$: voteSuccessStore = inclusionVoting?.voteSuccess;
	$: lastVoteTypeStore = inclusionVoting?.lastVoteType;

	$: inclusionPositiveVotes = positiveVotesStore 
		? $positiveVotesStore
		: (getNeo4jNumber(categoryData.inclusionPositiveVotes) || 0);
	
	$: inclusionNegativeVotes = negativeVotesStore 
		? $negativeVotesStore
		: (getNeo4jNumber(categoryData.inclusionNegativeVotes) || 0);
	
	$: inclusionNetVotes = netVotesStore 
		? $netVotesStore
		: (getNeo4jNumber(categoryData.inclusionNetVotes) || (inclusionPositiveVotes - inclusionNegativeVotes));
	
	$: inclusionUserVoteStatus = (userVoteStatusStore 
		? $userVoteStatusStore
		: (node.metadata?.inclusionVoteStatus?.status || 'none')) as VoteStatus;

	$: votingState = {
		isVoting: isVotingStore ? $isVotingStore : false,
		voteSuccess: voteSuccessStore ? $voteSuccessStore : false,
		lastVoteType: lastVoteTypeStore ? $lastVoteTypeStore : null
	};
	
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);
	$: isDetail = node.mode === 'detail';

	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
		expandWord: { 
			word: string;
			sourceNodeId: string;
			sourcePosition: { x: number; y: number };
		};
	}>();

	onMount(async () => {
		console.log('[CategoryNode] Initializing vote behaviour for', node.id);
		
		inclusionVoting = createVoteBehaviour(node.id, 'category', {
			apiIdentifier: categoryData.id,
			dataObject: categoryData,
			dataProperties: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			apiResponseKeys: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			getVoteEndpoint: (id) => `/categories/${id}/vote-inclusion`,
			getRemoveVoteEndpoint: (id) => `/categories/${id}/vote`,
			getVoteStatusEndpoint: (id) => `/categories/${id}/vote-status`,
			graphStore,
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'inclusionVoteStatus',
				metadataGroup: 'category'
			}
		});

		await inclusionVoting.initialize({
			positiveVotes: inclusionPositiveVotes,
			negativeVotes: inclusionNegativeVotes,
			skipVoteStatusFetch: false
		});
		
		console.log('[CategoryNode] Vote behaviour initialized:', {
			positiveVotes: inclusionPositiveVotes,
			negativeVotes: inclusionNegativeVotes,
			userVoteStatus: inclusionUserVoteStatus
		});
	});

	async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!inclusionVoting) {
			console.error('[CategoryNode] Vote behaviour not initialized');
			return;
		}
		console.log('[CategoryNode] Handling vote:', event.detail.voteType);
		await inclusionVoting.handleVote(event.detail.voteType);
	}

	function handleModeChange(event: CustomEvent) {
		dispatch('modeChange', {
			...event.detail,
			nodeId: node.id
		});
	}

	function handleKeywordClick(event: CustomEvent<{ word: string }>) {
		const { word } = event.detail;
		
		console.log('[CategoryNode] Keyword clicked:', {
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
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Category" {radius} mode="detail" />
		</svelte:fragment>

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

		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<text
				x={x + width/2}
				y={y + Math.floor(height * (positioning.categoryName || 0.40))}
				class="category-name"
				style:font-family="Inter"
				style:font-size="28px"
				style:font-weight="700"
				style:fill="white"
				style:text-anchor="middle"
				style:dominant-baseline="middle"
				style:filter="drop-shadow(0 0 10px rgba(255, 138, 61, 0.4))"
			>
				{displayName}
			</text>

			<!-- Only show subcategories count if it exists -->
			{#if childCount > 0}
				<foreignObject 
					{x} 
					y={y + Math.floor(height * (positioning.subcategories || 0.70))} 
					{width} 
					height="40"
				>
					<div class="category-stats">
						<div class="stat-item">
							<span class="stat-label">Subcategories:</span>
							<span class="stat-value">{childCount}</span>
						</div>
					</div>
				</foreignObject>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="inclusionVoting" let:x let:y let:width let:height let:positioning>
			<foreignObject 
				{x} 
				y={y + Math.floor(height * positioning.prompt)} 
				{width} 
				height="24"
			>
				<div class="vote-prompt">
					<strong>Include/Exclude:</strong> Should this category exist?
				</div>
			</foreignObject>

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

		<svelte:fragment slot="metadata" let:radius>
			<NodeMetadata
				createdAt={categoryData.createdAt}
				updatedAt={categoryData.updatedAt}
			/>
		</svelte:fragment>

		<svelte:fragment slot="credits" let:radius>
			{#if categoryData.createdBy}
				<CreatorCredits
					createdBy={categoryData.createdBy}
					publicCredit={categoryData.publicCredit}
					prefix="created by:"
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Category" {radius} mode="preview" size="medium" />
		</svelte:fragment>

		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<text
				x="0"
				y={y + Math.floor(height * (positioning.categoryName || 0.35))}
				class="category-name-preview"
				text-anchor="middle"
			>
				{displayName}
			</text>
			
			<!-- Only show subcategories count in preview if it exists -->
			{#if childCount > 0}
				<text
					x="0"
					y={y + Math.floor(height * (positioning.subcategories || 0.70))}
					class="stats-preview"
					text-anchor="middle"
				>
					{childCount} subcategories
				</text>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="inclusionVoting" let:x let:y let:width let:height let:positioning>
			<g transform="translate(0, {y + Math.floor(height * (positioning.buttons || 0.5))})">
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
	.category-name {
		text-anchor: middle;
		dominant-baseline: middle;
	}

	.category-name-preview {
		font-family: 'Inter', sans-serif;
		font-size: 14px;
		font-weight: 500;
		fill: white;
		dominant-baseline: middle;
	}

	.stats-preview {
		font-family: 'Inter', sans-serif;
		font-size: 10px;
		font-weight: 400;
		fill: rgba(255, 255, 255, 0.6);
		dominant-baseline: middle;
	}

	:global(.category-stats) {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 5px;
		height: 100%;
		justify-content: center;
		align-items: center;
	}

	:global(.stat-item) {
		font-family: 'Inter', sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.8);
		display: flex;
		gap: 8px;
		align-items: center;
	}

	:global(.stat-label) {
		color: rgba(255, 255, 255, 0.6);
		font-weight: 400;
	}

	:global(.stat-value) {
		color: rgba(255, 138, 61, 0.9);
		font-weight: 600;
		font-size: 14px;
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