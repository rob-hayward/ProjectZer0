<!-- src/lib/components/graph/nodes/category/CategoryNode.svelte -->
<!-- REORGANIZED: Clean semantic structure - contentText / inclusionVoting only (no content voting) -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
	import { isCategoryData } from '$lib/types/graph/enhanced';
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
	if (!isCategoryData(node.data)) {
		throw new Error('Invalid node data type for CategoryNode');
	}

	let categoryData = node.data;

	// Data extraction
	$: displayName = categoryData.name;
	$: wordCount = categoryData.wordCount || 0;
	$: contentCount = categoryData.contentCount || 0;
	$: childCount = categoryData.childCount || 0;
	$: composedWords = categoryData.words || [];

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

	// FIXED: Create votingState from store subscriptions
	$: votingState = {
		isVoting: isVotingStore ? $isVotingStore : false,
		voteSuccess: voteSuccessStore ? $voteSuccessStore : false,
		lastVoteType: lastVoteTypeStore ? $lastVoteTypeStore : null
	};
	
	// Threshold check for expansion
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	// Convert composed words to Keyword[] format for KeywordTags component
	$: keywordsForDisplay = composedWords.map((w: any) => ({
		word: typeof w === 'string' ? w : w.word,
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
		parentCategoryClick: { categoryId: string; categoryName: string };
		childCategoryClick: { categoryId: string; categoryName: string };
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
			getVoteEndpoint: (id) => `/nodes/category/${id}/vote-inclusion`,  // Was: /vote
			getRemoveVoteEndpoint: (id) => `/nodes/category/${id}/vote`,      // Was: /vote/remove
			getVoteStatusEndpoint: (id) => `/nodes/category/${id}/vote-status`, // Added,
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

	// Vote handler
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

	// Keyword click handler (for composed words)
	function handleKeywordClick(event: CustomEvent<{ word: string }>) {
		dispatch('keywordClick', event.detail);
	}

	// Parent category click handler
	function handleParentCategoryClick() {
		if (categoryData.parentCategory) {
			dispatch('parentCategoryClick', {
				categoryId: categoryData.parentCategory.id,
				categoryName: categoryData.parentCategory.name
			});
		}
	}

	// Child category click handler
	function handleChildCategoryClick(childId: string, childName: string) {
		dispatch('childCategoryClick', {
			categoryId: childId,
			categoryName: childName
		});
	}
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Category" {radius} mode="detail" />
		</svelte:fragment>

		<!-- KeywordTags: Show composed words -->
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

		<!-- REORGANIZED: Section 1 - Content Text (Category Display + Stats) -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<!-- Display the category name prominently, centered -->
			<text
				x={x + width/2}
				y={y + Math.floor(height * (positioning.categoryName || 0.35))}
				class="category-name"
				style:font-family="Inter"
				style:font-size="28px"
				style:font-weight="700"
				style:fill="white"
				style:text-anchor="middle"
				style:dominant-baseline="middle"
				style:filter="drop-shadow(0 0 10px rgba(0, 255, 176, 0.4))"
			>
				{displayName}
			</text>

			<!-- Category statistics -->
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.stats || 0.55))} 
				{width} 
				height="60"
			>
				<div class="category-stats">
					<div class="stat-item">
						<span class="stat-label">Words:</span>
						<span class="stat-value">{wordCount}</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">Content:</span>
						<span class="stat-value">{contentCount}</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">Subcategories:</span>
						<span class="stat-value">{childCount}</span>
					</div>
				</div>
			</foreignObject>

			<!-- Parent category (if exists) -->
			{#if categoryData.parentCategory}
				<foreignObject 
					{x} 
					y={y + Math.floor(height * (positioning.parentCategory || 0.75))} 
					{width} 
					height="30"
				>
					<div 
						class="parent-category"
						on:click={handleParentCategoryClick}
						on:keydown={(e) => e.key === 'Enter' && handleParentCategoryClick()}
						role="button"
						tabindex="0"
					>
						↑ Parent: {categoryData.parentCategory.name}
					</div>
				</foreignObject>
			{/if}

			<!-- Child categories (if exist) -->
			{#if categoryData.childCategories && categoryData.childCategories.length > 0}
				<foreignObject 
					{x} 
					y={y + Math.floor(height * (positioning.childCategories || 0.85))} 
					{width} 
					height="40"
				>
					<div class="child-categories">
						{#each categoryData.childCategories.slice(0, 3) as child}
							<div 
								class="child-category"
								on:click={() => handleChildCategoryClick(child.id, child.name)}
								on:keydown={(e) => e.key === 'Enter' && handleChildCategoryClick(child.id, child.name)}
								role="button"
								tabindex="0"
							>
								↓ {child.name}
							</div>
						{/each}
						{#if categoryData.childCategories.length > 3}
							<div class="child-more">
								+{categoryData.childCategories.length - 3} more
							</div>
						{/if}
					</div>
				</foreignObject>
			{/if}
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
					<strong>Include/Exclude:</strong> Should this category exist in the graph?
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

		<!-- Section 3: No content voting for categories -->

		<!-- Metadata -->
		<svelte:fragment slot="metadata" let:radius>
			<NodeMetadata
				createdAt={categoryData.createdAt}
				updatedAt={categoryData.updatedAt}
				{radius}
			/>
		</svelte:fragment>

		<!-- Creator credits -->
		<svelte:fragment slot="credits" let:radius>
			{#if categoryData.createdBy}
				<CreatorCredits
					createdBy={categoryData.createdBy}
					publicCredit={categoryData.publicCredit}
					{radius}
					prefix="created by:"
				/>
			{/if}
		</svelte:fragment>

		<!-- No createChild slot - Categories don't create children directly through this interface -->
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Category" {radius} mode="preview" size="medium" />
		</svelte:fragment>

		<!-- REORGANIZED: Preview mode - simplified structure -->
		<svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
			<!-- Display the category name -->
			<text
				x={x + width/2}
				y={y + Math.floor(height * (positioning.categoryName || 0.4))}
				class="category-preview"
				style:font-family="Inter"
				style:font-size="18px"
				style:font-weight="600"
				style:fill="white"
				style:text-anchor="middle"
				style:dominant-baseline="middle"
			>
				{displayName}
			</text>

			<!-- Stats summary in preview -->
			<foreignObject 
				{x} 
				y={y + Math.floor(height * (positioning.statsPreview || 0.65))} 
				{width} 
				height="30"
			>
				<div class="stats-preview">
					{wordCount} words • {contentCount} items
				</div>
			</foreignObject>
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
	.category-name,
	.category-preview {
		text-anchor: middle;
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
		color: rgba(0, 255, 176, 0.9);
		font-weight: 600;
		font-size: 14px;
	}

	:global(.parent-category) {
		font-family: 'Inter', sans-serif;
		font-size: 11px;
		font-weight: 500;
		color: rgba(52, 152, 219, 0.9);
		text-align: center;
		cursor: pointer;
		text-decoration: underline;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	:global(.parent-category:hover) {
		color: rgba(52, 152, 219, 1);
	}

	:global(.child-categories) {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: center;
		align-items: center;
		height: 100%;
		padding: 0 5px;
	}

	:global(.child-category) {
		font-family: 'Inter', sans-serif;
		font-size: 10px;
		font-weight: 500;
		color: rgba(155, 89, 182, 0.9);
		cursor: pointer;
		text-decoration: underline;
		white-space: nowrap;
	}

	:global(.child-category:hover) {
		color: rgba(155, 89, 182, 1);
	}

	:global(.child-more) {
		font-family: 'Inter', sans-serif;
		font-size: 10px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.5);
		font-style: italic;
	}

	:global(.stats-preview) {
		font-family: 'Inter', sans-serif;
		font-size: 11px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.7);
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
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