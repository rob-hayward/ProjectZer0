<!-- Enhanced StatementNode.svelte - Batch Data Optimized Version -->

<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode, ViewType } from '$lib/types/graph/enhanced';
	import type { StatementNode } from '$lib/types/domain/nodes';
	import type { VoteStatus } from '$lib/types/domain/nodes'; // Add VoteStatus import
	import { isStatementData } from '$lib/types/graph/enhanced';
	import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { userStore } from '$lib/stores/userStore';
	import { graphStore } from '$lib/stores/graphStore';
	import { getUserDetails } from '$lib/services/userLookup';

	// ENHANCED: Import all possible vote stores
	import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
	import { universalGraphStore } from '$lib/stores/universalGraphStore';
	import { get } from 'svelte/store';
	// Add other stores as needed for future views

	import {
		createVoteBehaviour,
		createVisibilityBehaviour,
		createModeBehaviour,
		createDataBehaviour
	} from '../behaviours';

	// Import the shared UI components
	import VoteButtons from '../ui/VoteButtons.svelte';
	import VoteStats from '../ui/VoteStats.svelte';
	import NodeHeader from '../ui/NodeHeader.svelte';
	import CreatorCredits from '../ui/CreatorCredits.svelte';
	import ContentBox from '../ui/ContentBox.svelte';
	import { wrapTextForWidth } from '../utils/textUtils';

	export let node: RenderableNode;
	export let statementText: string = '';
	
	// ENHANCED: Optional props for explicit context control
	export let viewType: ViewType | undefined = undefined;
	export let voteStore: any = undefined; // Allow explicit store override

	// Debug toggle - set to true to show ContentBox borders
	const DEBUG_SHOW_BORDERS = false;

	if (!isStatementData(node.data)) {
		throw new Error('Invalid node data type for StatementNode');
	}

	const statementData = node.data as StatementNode;

	// Get the statement text
	$: displayStatementText = statementText || statementData.statement;

	// ENHANCED: Context-aware store detection
	$: detectedViewType = detectViewContext(viewType);
	$: contextVoteStore = selectVoteStore(detectedViewType, voteStore);
	
	// ENHANCED: Track if we've used batch data to avoid duplicate API calls
	let usedBatchVoteData = false;

	/**
	 * ROBUST: Detect current view context using multiple methods
	 */
	function detectViewContext(explicitViewType?: ViewType): ViewType {
		// Method 1: Use explicit viewType prop if provided
		if (explicitViewType) {
			return explicitViewType;
		}

		// Method 2: Detect from URL path
		if (typeof window !== 'undefined') {
			const pathname = window.location.pathname;
			if (pathname.includes('/universal')) return 'universal';
			if (pathname.includes('/statement-network')) return 'statement-network';
			if (pathname.includes('/discussion')) return 'discussion';
		}

		// Method 3: Detect from graph store context
		if (graphStore) {
			const currentViewType = graphStore.getViewType?.();
			if (currentViewType) return currentViewType;
		}

		// Default fallback
		return 'statement-network';
	}

	/**
	 * FLEXIBLE: Select appropriate vote store based on context
	 */
	function selectVoteStore(detectedViewType: ViewType, explicitStore?: any) {
		// Method 1: Use explicit store override if provided
		if (explicitStore) {
			return explicitStore;
		}

		// Method 2: Select based on detected view type
		switch (detectedViewType) {
			case 'universal':
				return universalGraphStore;
			
			case 'statement-network':
				return statementNetworkStore;
			
			case 'discussion':
				// Discussion view might use statement network store or its own
				return statementNetworkStore;
			
			default:
				// Safe fallback
				return statementNetworkStore;
		}
	}

	let voteBehaviour: any;
	let visibilityBehaviour: any;
	let modeBehaviour: any;
	let dataBehaviour: any;
	let behavioursInitialized = false;

	function triggerDataUpdate() {
		statementDataWrapper = { ...statementData };
	}

	// ENHANCED: Optimized vote behavior creation with batch data check
	$: if (node.id && contextVoteStore && !behavioursInitialized) {
		console.log(`[StatementNode] Initializing for context: ${detectedViewType} with store:`, contextVoteStore === universalGraphStore ? 'universal' : 'other');
		
		// ENHANCED: Check for batch vote data first in universal context
		let initialVoteData = undefined; // Changed from null to undefined
		if (detectedViewType === 'universal' && !usedBatchVoteData) {
			const universalData = get(universalGraphStore);
			if (universalData?.user_data?.votes?.[node.id]) {
				const batchVote = universalData.user_data.votes[node.id];
				console.log(`[StatementNode] Using batch vote data for ${node.id}:`, batchVote);
				
				initialVoteData = {
					userVoteStatus: (batchVote.status || 'none') as VoteStatus, // Type assertion
					positiveVotes: statementData.positiveVotes || 0,
					negativeVotes: statementData.negativeVotes || 0,
					votedAt: batchVote.votedAt
				};
				usedBatchVoteData = true;
			}
		}
		
		voteBehaviour = createVoteBehaviour(node.id, 'statement', {
			voteStore: contextVoteStore,  // ✅ CONTEXT-AWARE STORE!
			graphStore,
			apiIdentifier: node.id,
			dataObject: statementData,
			getVoteEndpoint: (id) => `/nodes/statement/${id}/vote`,
			getRemoveVoteEndpoint: (id) => `/nodes/statement/${id}/vote/remove`,
			onDataUpdate: triggerDataUpdate,
			// ENHANCED: Pass initial batch data to skip individual API call
			initialVoteData: initialVoteData
		});

		visibilityBehaviour = createVisibilityBehaviour(node.id, { 
			graphStore,
			viewType: detectedViewType  // ← ENHANCED: Add viewType to fix localStorage thrashing
		});
		modeBehaviour = createModeBehaviour(node.mode);
		dataBehaviour = createDataBehaviour('statement', statementData, {
			transformData: (rawData) => ({
				...rawData,
				formattedDate: rawData.createdAt
					? new Date(rawData.createdAt).toLocaleDateString()
					: ''
			})
		});

		behavioursInitialized = true;
	}

	// ENHANCED: Reset behaviours if context changes
	$: if (behavioursInitialized && contextVoteStore) {
		// If the store context changes, reinitialize behaviours
		const currentStore = voteBehaviour?.getCurrentState?.()?.store;
		if (currentStore !== contextVoteStore) {
			behavioursInitialized = false;
		}
	}

	$: isDetail = node.mode === 'detail';
	$: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';

	function getNeo4jNumber(value: any): number {
		return value && typeof value === 'object' && 'low' in value ? Number(value.low) : Number(value || 0);
	}

	let statementDataWrapper = statementData;

	// ENHANCED: Context-aware vote data retrieval with batch data priority
	$: dataPositiveVotes = getNeo4jNumber(statementDataWrapper.positiveVotes) || 0;
	$: dataNegativeVotes = getNeo4jNumber(statementDataWrapper.negativeVotes) || 0;
	$: storeVoteData = contextVoteStore?.getVoteData?.(node.id) || { positiveVotes: 0, negativeVotes: 0 };

	$: positiveVotes = dataPositiveVotes || storeVoteData.positiveVotes;
	$: negativeVotes = dataNegativeVotes || storeVoteData.negativeVotes;
	$: netVotes = positiveVotes - negativeVotes;

	$: behaviorState = voteBehaviour?.getCurrentState() || {};
	$: userVoteStatus = behaviorState.userVoteStatus || 'none';
	$: isVoting = behaviorState.isVoting || false;
	$: voteSuccess = behaviorState.voteSuccess || false;
	$: lastVoteType = behaviorState.lastVoteType || null;

	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode };
		visibilityChange: { isHidden: boolean };
	}>();

	function syncVoteState() {
		if (voteBehaviour) {
			const state = voteBehaviour.getCurrentState();
			userVoteStatus = state.userVoteStatus;
			isVoting = state.isVoting;
			voteSuccess = state.voteSuccess;
			lastVoteType = state.lastVoteType;
		}
	}

	async function updateVoteState(voteType: 'agree' | 'disagree' | 'none') {
		if (!voteBehaviour) return false;
		userVoteStatus = voteType;
		isVoting = true;

		try {
			const success = await voteBehaviour.handleVote(voteType);
			syncVoteState();
			if (success) {
				triggerDataUpdate();
				
				// ENHANCED: Update universal store if in universal context
				if (detectedViewType === 'universal' && universalGraphStore.updateUserVoteStatus) {
					universalGraphStore.updateUserVoteStatus(
						node.id, 
						voteType === 'none' ? null : voteType,
						new Date().toISOString()
					);
				}
			}
			return success;
		} catch (error) {
			syncVoteState();
			return false;
		}
	}

	function handleModeChange() {
		const newMode = modeBehaviour?.handleModeChange();
		if (newMode) dispatch('modeChange', { mode: newMode });
	}

	function handleVote(event: CustomEvent<{ voteType: any }>) {
		updateVoteState(event.detail.voteType);
	}

	function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
		dispatch('visibilityChange', event.detail);
	}

	let statementCreatorDetails: any = null;

	onMount(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));

		const initPromises = [];
		if (dataBehaviour) initPromises.push(dataBehaviour.initialize());
		if (voteBehaviour) {
			// ENHANCED: Initialize with batch data or regular data
			const initData = usedBatchVoteData ? 
				{ skipVoteStatusFetch: true } : // Skip API call if we have batch data
				{
					positiveVotes: statementData.positiveVotes,
					negativeVotes: statementData.negativeVotes
				};
			
			initPromises.push(voteBehaviour.initialize(initData));
		}
		if (visibilityBehaviour) initPromises.push(visibilityBehaviour.initialize(netVotes));
		if (initPromises.length > 0) await Promise.all(initPromises);

		syncVoteState();

		// Recalculate visibility after initialization
		if (graphStore) {
			graphStore.recalculateNodeVisibility(
				node.id,
				positiveVotes,
				negativeVotes
			);
		}

		if (statementData.createdBy) {
			try {
				statementCreatorDetails = await getUserDetails(statementData.createdBy);
			} catch (e) {
				console.error('[StatementNode] Error fetching creator details:', e);
			}
		}
	});

	onDestroy(() => {
		if (dataBehaviour?.destroy) dataBehaviour.destroy();
	});
</script>

<!-- Rest of the component template remains the same -->
{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange} on:visibilityChange={handleVisibilityChange}>
		<svelte:fragment slot="default" let:radius>
			<NodeHeader title="Statement" radius={radius} mode="detail" />
			<ContentBox nodeType="statement" mode="detail" showBorder={DEBUG_SHOW_BORDERS}>
				<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
					<!-- Main statement text -->
					<foreignObject
						x={x}
						y={y + layoutConfig.titleYOffset + 0}
						width={width}
						height={height - layoutConfig.titleYOffset - 90}
					>
						<div class="statement-display">
							{displayStatementText}
						</div>
					</foreignObject>

					<!-- Keywords Display (if any) -->
					{#if statementData.keywords && statementData.keywords.length > 0}
						<foreignObject
							x={x}
							y={y}
							width={width}
							height="50"
						>
							<div class="keywords-section">
								<div class="keywords-container">
									{#each statementData.keywords as keyword}
										<div class="keyword-chip" class:ai-keyword={keyword.source === 'ai'} class:user-keyword={keyword.source === 'user'}>
											{keyword.word}
										</div>
									{/each}
								</div>
							</div>
						</foreignObject>
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="voting" let:width let:height>
					<VoteButtons
						{userVoteStatus}
						{positiveVotes}
						{negativeVotes}
						{isVoting}
						{voteSuccess}
						{lastVoteType}
						availableWidth={width}
						containerY={height}
						mode="detail"
						on:vote={handleVote}
					/>
				</svelte:fragment>

				<svelte:fragment slot="stats" let:width>
					<VoteStats
						{userVoteStatus}
						{positiveVotes}
						{negativeVotes}
						{userName}
						showUserStatus={true}
						availableWidth={width}
						containerY={30}
						showBackground={false}
					/>
				</svelte:fragment>
			</ContentBox>

			{#if statementData.createdBy}
				<CreatorCredits
					createdBy={statementData.createdBy}
					publicCredit={statementData.publicCredit}
					creatorDetails={statementCreatorDetails}
					radius={radius}
					prefix="created by:"
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} on:modeChange={handleModeChange} on:visibilityChange={handleVisibilityChange} showContentBoxBorder={DEBUG_SHOW_BORDERS}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Statement" radius={radius} size="small" mode="preview" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
			<!-- Main statement text -->
			<foreignObject
				x={x}
				y={y - 55}
				width={width}
				height={height - layoutConfig.titleYOffset}
			>
				<div class="statement-preview">
					{displayStatementText}
				</div>
			</foreignObject>
		</svelte:fragment>

		<svelte:fragment slot="voting" let:x let:y let:width let:height let:layoutConfig>
			<VoteButtons
				{userVoteStatus}
				{positiveVotes}
				{negativeVotes}
				{isVoting}
				{voteSuccess}
				{lastVoteType}
				availableWidth={width}
				containerY={y + height / 2}
				mode="preview"
				on:vote={handleVote}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.statement-display {
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
		padding: 0;
		margin: 0;
		box-sizing: border-box;
	}

	.statement-preview {
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
		padding: 0;
		margin: 0;
		box-sizing: border-box;
	}

	.keywords-section {
		font-family: Inter;
		color: rgba(255, 255, 255, 0.9);
		text-align: left;
		width: 100%;
		height: 100%;
		padding: 0;
		margin: 0;
		box-sizing: border-box;
	}

	.keywords-container {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.keyword-chip {
		background: rgba(46, 204, 113, 0.2);
		border: 1px solid rgba(46, 204, 113, 0.3);
		border-radius: 12px;
		padding: 4px 8px;
		font-size: 10px;
		color: white;
		font-family: Inter;
		font-weight: 500;
	}

	.keyword-chip.ai-keyword {
		background: rgba(52, 152, 219, 0.2);
		border: 1px solid rgba(52, 152, 219, 0.3);
	}

	.keyword-chip.user-keyword {
		background: rgba(46, 204, 113, 0.2);
		border: 1px solid rgba(46, 204, 113, 0.3);
	}
</style>