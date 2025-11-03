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
	import CreateLinkedNodeButton from '../ui/CreateLinkedNodeButton.svelte';
	import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
	import { graphStore } from '$lib/stores/graphStore';

	export let node: RenderableNode;

	// Type definition for CategoryNode data structure
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
		contentPositiveVotes?: number;
		contentNegativeVotes?: number;
		contentNetVotes?: number;
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

	// Data extraction
	$: displayName = categoryData.name;

	// Inclusion voting data (Category nodes have inclusion voting only)
	$: inclusionPositiveVotes = getNeo4jNumber(categoryData.inclusionPositiveVotes) || 0;
	$: inclusionNegativeVotes = getNeo4jNumber(categoryData.inclusionNegativeVotes) || 0;
	$: inclusionNetVotes = getNeo4jNumber(categoryData.inclusionNetVotes) || 
		(inclusionPositiveVotes - inclusionNegativeVotes);
	
	// User vote status from metadata
	$: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
	
	// Threshold check for expansion
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	// Convert composed words to Keyword[] format for KeywordTags component
	// Categories are composed of 1-5 WordNodes
	$: keywordsForDisplay = (categoryData.words || []).map((wordObj: { id: string; word: string; inclusionNetVotes: number }) => ({
		word: wordObj.word,
		frequency: 1,
		source: 'user' as const
	})) as Keyword[];

	// Voting behaviour instance
	let inclusionVoting: VoteBehaviour;

	// Mode state
	$: isDetail = node.mode === 'detail';

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
		createChildNode: { parentId: string; parentType: string; preAssignedCategory: string };
	}>();

	// Initialize voting behaviour on mount
	onMount(async () => {
		// Create voting behaviour for inclusion votes
		inclusionVoting = createVoteBehaviour(node.id, 'category', {
			apiIdentifier: categoryData.id,
			dataObject: categoryData,
			dataProperties: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			getVoteEndpoint: (id) => `/categories/${id}/vote`,
			getRemoveVoteEndpoint: (id) => `/categories/${id}/vote/remove`,
			graphStore,
			onDataUpdate: () => {
				// Trigger reactivity
				categoryData = { ...categoryData };
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

	// Get reactive state from behaviour
	$: votingState = inclusionVoting?.getCurrentState() || {
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

	// Keyword click handler (for composed words that define the category)
	function handleKeywordClick(event: CustomEvent<{ word: string }>) {
		const { word } = event.detail;
		console.log('Composed word clicked:', word);
		// TODO: Implement expansion - load word node with definitions
		// This would fetch /words/${word}/with-definitions and add to graph
	}

	// Create child node handler (generic - any node type tagged with this category)
	function handleCreateChild() {
		dispatch('createChildNode', {
			parentId: node.id,
			parentType: 'category',
			preAssignedCategory: node.id
		});
	}
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Category" {radius} mode="detail" />
		</svelte:fragment>

		<!-- KeywordTags: Show composed words that define this category -->
		<svelte:fragment slot="keywordTags" let:radius>
			{#if keywordsForDisplay.length > 0}
				<KeywordTags 
					keywords={keywordsForDisplay}
					{radius}
					maxDisplay={5}
					on:keywordClick={handleKeywordClick}
				/>
			{/if}
		</svelte:fragment>

		<!-- Content: Display the category name prominently -->
		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<text
				x="0"
				y={y + 20}
				class="category-name"
				text-anchor="middle"
			>
				{displayName}
			</text>
		</svelte:fragment>

		<!-- Voting: Inclusion voting only -->
		<svelte:fragment slot="voting" let:x let:y let:width let:height>
			<InclusionVoteButtons
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				isVoting={votingState.isVoting}
				voteSuccess={votingState.voteSuccess}
				lastVoteType={votingState.lastVoteType}
				availableWidth={width}
				containerY={y}
				mode="detail"
				on:vote={handleInclusionVote}
			/>
		</svelte:fragment>

		<!-- Stats: Single voting stats -->
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
		</svelte:fragment>

		<!-- Metadata: Standard node metadata -->
		<svelte:fragment slot="metadata" let:radius>
			<NodeMetadata
				createdAt={categoryData.createdAt}
				updatedAt={categoryData.updatedAt}
				{radius}
			/>
		</svelte:fragment>

		<!-- Credits: Standard creator credits -->
		<svelte:fragment slot="credits" let:radius>
			<CreatorCredits
				createdBy={categoryData.createdBy}
				publicCredit={categoryData.publicCredit}
				{radius}
			/>
		</svelte:fragment>

		<!-- CreateChild: Generic node creation button (NE corner) -->
		<!-- Any node type can be tagged with this category -->
		<svelte:fragment slot="createChild" let:radius>
			{#if canExpand}
				<CreateLinkedNodeButton
					y={-radius * 0.7071}
					x={radius * 0.7071}
					nodeId={node.id}
					nodeType="category"
					on:click={handleCreateChild}
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Category" {radius} mode="preview" />
		</svelte:fragment>

		<!-- Content: Show category name in preview -->
		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<text
				x="0"
				y={y + 10}
				class="category-name-preview"
				text-anchor="middle"
			>
				{displayName}
			</text>
		</svelte:fragment>

		<!-- Voting: Inclusion voting in preview mode -->
		<svelte:fragment slot="voting" let:x let:y let:width let:height>
			<InclusionVoteButtons
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				isVoting={votingState.isVoting}
				voteSuccess={votingState.voteSuccess}
				lastVoteType={votingState.lastVoteType}
				availableWidth={width}
				containerY={y}
				mode="preview"
				on:vote={handleInclusionVote}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.category-name {
		font-family: 'Orbitron', sans-serif;
		font-size: 18px;
		font-weight: 600;
		fill: white;
		dominant-baseline: middle;
	}

	.category-name-preview {
		font-family: 'Orbitron', sans-serif;
		font-size: 14px;
		font-weight: 500;
		fill: white;
		dominant-baseline: middle;
	}
</style>