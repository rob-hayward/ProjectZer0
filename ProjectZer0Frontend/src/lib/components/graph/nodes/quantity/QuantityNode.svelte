<!-- src/lib/components/graph/nodes/quantity/QuantityNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode, ViewType } from '$lib/types/graph/enhanced';
    import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
    import { isQuantityData } from '$lib/types/graph/enhanced';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import NodeHeader from '../ui/NodeHeader.svelte';
    import InclusionVoteButtons from '../ui/InclusionVoteButtons.svelte';
    import VoteStats from '../ui/VoteStats.svelte';
    import CategoryTags from '../ui/CategoryTags.svelte';
    import KeywordTags from '../ui/KeywordTags.svelte';
    import NodeMetadata from '../ui/NodeMetadata.svelte';
    import CreatorCredits from '../ui/CreatorCredits.svelte';
    import CreateLinkedNodeButton from '../ui/CreateLinkedNodeButton.svelte';
    import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
    import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
    import { fetchWithAuth } from '$lib/services/api';
    import { userStore } from '$lib/stores/userStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { unitPreferenceStore } from '$lib/stores/unitPreferenceStore';
    import { getUserResponse, getStatistics, submitResponse, deleteUserResponse } from '$lib/services/quantity';
    import QuantityVisualization from './QuantityVisualization.svelte';
    import { universalGraphStore } from '$lib/stores/universalGraphStore';
    import { get } from 'svelte/store';
    import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
    
    export let node: RenderableNode;
    export let question: string = '';
    export let unitCategoryId: string = '';
    export let defaultUnitId: string = '';
    export let viewType: ViewType | undefined = undefined;
    
    // Type validation
    if (!isQuantityData(node.data)) {
        throw new Error('Invalid node data type for QuantityNode');
    }

    // CRITICAL: Change const to let for reactivity
    let quantityData = node.data;
    
    // Helper to get correct metadata group
    function getMetadataGroup(): 'quantity' {
        return 'quantity';
    }
    
    // Data extraction
    $: displayQuestion = question || quantityData.question;
    $: displayUnitCategoryId = unitCategoryId || quantityData.unitCategoryId;
    $: displayDefaultUnitId = defaultUnitId || quantityData.defaultUnitId;
    
    // Context-aware detection
    $: detectedViewType = detectViewContext(viewType);

    function detectViewContext(explicitViewType?: ViewType): ViewType {
        if (explicitViewType) return explicitViewType;

        if (typeof window !== 'undefined') {
            const pathname = window.location.pathname;
            if (pathname.includes('/universal')) return 'universal';
            if (pathname.includes('/quantity')) return 'quantity';
            if (pathname.includes('/discussion')) return 'discussion';
        }

        if (graphStore) {
            const currentViewType = graphStore.getViewType?.();
            if (currentViewType) return currentViewType;
        }

        return 'quantity';
    }
    
    // INCLUSION voting extraction
    $: inclusionPositiveVotes = getNeo4jNumber(quantityData.inclusionPositiveVotes) || 0;
    $: inclusionNegativeVotes = getNeo4jNumber(quantityData.inclusionNegativeVotes) || 0;
    $: inclusionNetVotes = getNeo4jNumber(quantityData.inclusionNetVotes) || 
        (inclusionPositiveVotes - inclusionNegativeVotes);
    
    // User vote status from metadata
    $: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
    
    // Threshold check for expansion
    $: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

    // Extract categories - handle both string[] and Category[] formats
    $: categories = (() => {
        const cats = quantityData.categories || [];
        if (cats.length === 0) return [];
        
        if (typeof cats[0] === 'object' && 'id' in cats[0]) {
            return cats as Array<{ id: string; name: string }>;
        }
        
        return [];
    })();

    // Extract keywords
    $: keywords = quantityData.keywords || [];

    // Voting behaviour instance
    let inclusionVoting: VoteBehaviour;

    // Mode state
    $: isDetail = node.mode === 'detail';
    
    // Quantity-specific state variables
    let categoryName = '';
    let defaultUnitName = '';
    let defaultUnitSymbol = '';
    let userResponse: any = null;
    let statistics: any = null;
    let communityResponses: any[] = [];
    let availableUnits: any[] = [];
    let responseValue: string = '';
    let selectedUnitId: string = '';
    let displayUnitId: string = '';
    let displayUnitSymbol: string = '';
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let isLoadingResponses = false;
    let isLoadingUnitPreferences = false;
    let usedBatchData = false;
    
    // Event dispatcher
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
        visibilityChange: { isHidden: boolean };
        createChildNode: { parentId: string; parentType: string; childType: string };
        categoryClick: { categoryId: string; categoryName: string };
        keywordClick: { word: string };
    }>();

    // Initialize voting behaviour on mount
    onMount(async () => {
        // Create voting behaviour for inclusion votes
        inclusionVoting = createVoteBehaviour(node.id, 'quantity', {
            apiIdentifier: quantityData.id,
            dataObject: quantityData,
            dataProperties: {
                positiveVotesKey: 'inclusionPositiveVotes',
                negativeVotesKey: 'inclusionNegativeVotes'
            },
            getVoteEndpoint: (id) => `/quantities/${id}/inclusion-vote`,
            getRemoveVoteEndpoint: (id) => `/quantities/${id}/inclusion-vote/remove`,
            graphStore,
            onDataUpdate: () => {
                // Trigger reactivity
                quantityData = { ...quantityData };
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

        // Initialize quantity-specific features
        unitPreferenceStore.initialize();
        await loadUnitDetails();
        await loadUnitPreferenceOptimized();
        await loadUserResponseOptimized();
        await loadStatistics();
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

    function handleModeChange(event: CustomEvent<{ mode: NodeMode }>) {
        dispatch('modeChange', {
            mode: event.detail.mode,
            nodeId: node.id
        });
    }
    
    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        dispatch('visibilityChange', event.detail);
    }

    function handleCategoryClick(event: CustomEvent<{ categoryId: string; categoryName: string }>) {
        dispatch('categoryClick', event.detail);
    }

    function handleKeywordClick(event: CustomEvent<{ word: string }>) {
        dispatch('keywordClick', event.detail);
    }

    function handleCreateChild() {
        dispatch('createChildNode', {
            parentId: node.id,
            parentType: 'quantity',
            childType: 'evidence'
        });
    }

    // Optimized data loading from universal graph store
    async function loadUserResponseOptimized() {
        if (detectedViewType === 'universal' && !usedBatchData) {
            const universalData = get(universalGraphStore);
            // Type assertion to handle the store typing issue
            const userData = (universalData as any)?.user_data;
            if (userData?.quantity_responses?.[node.id]) {
                const batchResponse = userData.quantity_responses[node.id];
                
                userResponse = {
                    id: batchResponse.nodeId,
                    value: batchResponse.value,
                    unitId: batchResponse.unitId,
                    unitSymbol: batchResponse.unitSymbol,
                    submittedAt: batchResponse.submittedAt
                };
                
                responseValue = batchResponse.value.toString();
                usedBatchData = true;
                return;
            }
        }
        
        try {
            userResponse = await getUserResponse(node.id);
            
            if (userResponse) {
                responseValue = userResponse.value.toString();
                
                const preference = unitPreferenceStore.getPreference(node.id);
                if (!preference) {
                    displayUnitId = userResponse.unitId;
                    selectedUnitId = userResponse.unitId;
                }
                
                if (availableUnits.length > 0) {
                    const responseUnit = availableUnits.find(u => u.id === userResponse.unitId);
                    if (responseUnit) {
                        userResponse.unitSymbol = responseUnit.symbol;
                        
                        if (displayUnitId === userResponse.unitId) {
                            displayUnitSymbol = responseUnit.symbol;
                        }
                    }
                }
            } else {
                responseValue = '';
            }
        } catch (error) {
            console.error('[QuantityNode] Error loading user response:', error);
        }
    }

    async function loadUnitPreferenceOptimized() {
        try {
            isLoadingUnitPreferences = true;
            
            if (detectedViewType === 'universal' && !usedBatchData) {
                const universalData = get(universalGraphStore);
                // Type assertion to handle the store typing issue
                const userData = (universalData as any)?.user_data;
                if (userData?.unit_preferences?.[node.id]) {
                    const batchPreference = userData.unit_preferences[node.id];
                    
                    displayUnitId = batchPreference.unitId;
                    selectedUnitId = batchPreference.unitId;
                    
                    if (availableUnits.length > 0) {
                        const unit = availableUnits.find(u => u.id === displayUnitId);
                        if (unit) {
                            displayUnitSymbol = unit.symbol;
                        }
                        
                        if (userResponse && availableUnits.length > 0) {
                            const responseUnit = availableUnits.find(u => u.id === userResponse.unitId);
                            if (responseUnit) {
                                userResponse.unitSymbol = responseUnit.symbol;
                            }
                        }
                    }
                    
                    isLoadingUnitPreferences = false;
                    return;
                }
            }
            
            if (!$unitPreferenceStore.isLoaded) {
                await unitPreferenceStore.loadPreferences();
            }
            
            const preference = unitPreferenceStore.getPreference(node.id);
            
            if (preference) {
                displayUnitId = preference.unitId;
                selectedUnitId = preference.unitId;
                
                if (availableUnits.length > 0) {
                    const unit = availableUnits.find(u => u.id === displayUnitId);
                    if (unit) {
                        displayUnitSymbol = unit.symbol;
                    }
                    
                    if (userResponse && availableUnits.length > 0) {
                        const responseUnit = availableUnits.find(u => u.id === userResponse.unitId);
                        if (responseUnit) {
                            userResponse.unitSymbol = responseUnit.symbol;
                        }
                    }
                }
            } else {
                responseValue = '';
            }
        } catch (error) {
            console.error('[QuantityNode] Error loading unit preference:', error);
        } finally {
            isLoadingUnitPreferences = false;
        }
    }

    async function loadUnitDetails() {
        if (!displayUnitCategoryId || 
            displayUnitCategoryId === 'default' || 
            displayUnitCategoryId === 'null' ||
            displayUnitCategoryId === null ||
            displayUnitCategoryId.trim() === '' ||
            !displayDefaultUnitId || 
            displayDefaultUnitId === 'default' ||
            displayDefaultUnitId === 'null' ||
            displayDefaultUnitId === null ||
            displayDefaultUnitId.trim() === '') {
            
            categoryName = 'No units configured';
            defaultUnitName = 'No unit';
            defaultUnitSymbol = '';
            availableUnits = [];
            
            if (!displayUnitId) {
                displayUnitId = 'none';
                selectedUnitId = 'none';
                displayUnitSymbol = '';
            }
            
            return;
        }
        
        try {
            const category = await fetchWithAuth(`/api/units/categories/${displayUnitCategoryId}`);
            if (category) {
                categoryName = category.name;
            } else {
                categoryName = 'Unknown Category';
            }
            
            const units = await fetchWithAuth(`/api/units/categories/${displayUnitCategoryId}/units`);
            if (units && Array.isArray(units)) {
                availableUnits = units;
                
                const defaultUnit = units.find(u => u.id === displayDefaultUnitId);
                if (defaultUnit) {
                    defaultUnitName = defaultUnit.name;
                    defaultUnitSymbol = defaultUnit.symbol;
                } else {
                    defaultUnitName = 'Unknown Unit';
                    defaultUnitSymbol = '';
                }
                
                if (!displayUnitId) {
                    displayUnitId = displayDefaultUnitId;
                    selectedUnitId = displayDefaultUnitId;
                    displayUnitSymbol = defaultUnitSymbol;
                }
            } else {
                availableUnits = [];
                defaultUnitName = 'No units available';
                defaultUnitSymbol = '';
            }
            
        } catch (error) {
            console.error('[QuantityNode] Error loading unit details:', error);
            
            categoryName = 'Error loading units';
            defaultUnitName = 'Error';
            defaultUnitSymbol = '';
            availableUnits = [];
            
            if (!displayUnitId) {
                displayUnitId = 'error';
                selectedUnitId = 'error';
                displayUnitSymbol = '';
            }
        }
    }

    async function loadStatistics() {
        try {
            isLoadingResponses = true;
            statistics = await getStatistics(node.id);
            
            if (statistics?.responses && Array.isArray(statistics.responses)) {
                if (availableUnits.length > 0) {
                    statistics.responses = statistics.responses.map((response: any) => {
                        const unit = availableUnits.find(u => u.id === response.unitId);
                        if (unit) {
                            return {
                                ...response,
                                unitSymbol: unit.symbol
                            };
                        }
                        return response;
                    });
                }
                
                communityResponses = statistics.responses.map((response: { value: number; unitSymbol?: string; unitId: string; }) => ({
                    ...response,
                    displayValue: `${formatNumber(response.value)} ${response.unitSymbol || response.unitId}`
                }));
            }
        } catch (error) {
            console.error('[QuantityNode] Error loading statistics:', error);
        } finally {
            isLoadingResponses = false;
        }
    }
    
    async function handleUnitChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        const newUnitId = select.value;
        
        if (newUnitId === displayUnitId) return;
        
        try {
            displayUnitId = newUnitId;
            selectedUnitId = newUnitId;
            
            if (availableUnits.length > 0) {
                const unit = availableUnits.find(u => u.id === displayUnitId);
                if (unit) {
                    displayUnitSymbol = unit.symbol;
                }
            }
            
            await unitPreferenceStore.setPreference(node.id, displayUnitId);
        } catch (error) {
            console.error('[QuantityNode] Error changing unit:', error);
        }
    }

    async function handleSubmitResponse() {
        if (isSubmitting) return;
        if (!responseValue) {
            errorMessage = 'Please enter a value';
            return;
        }
        
        if (!displayUnitId) {
            errorMessage = 'Please select a unit';
            return;
        }
        
        const numValue = parseFloat(responseValue);
        if (isNaN(numValue)) {
            errorMessage = 'Please enter a valid number';
            return;
        }
        
        isSubmitting = true;
        errorMessage = null;
        
        try {
            await submitResponse(node.id, numValue, displayUnitId);
            await loadUserResponseOptimized();
            await loadStatistics();
        } catch (error) {
            console.error('[QuantityNode] Error submitting response:', error);
            errorMessage = 'Failed to submit response';
        } finally {
            isSubmitting = false;
        }
    }

    async function handleDeleteResponse() {
        if (isSubmitting) return;
        if (!userResponse) return;
        
        isSubmitting = true;
        
        try {
            await deleteUserResponse(node.id);
            responseValue = '';
            userResponse = null;
            await loadStatistics();
        } catch (error) {
            console.error('[QuantityNode] Error deleting response:', error);
            errorMessage = 'Failed to delete response';
        } finally {
            isSubmitting = false;
        }
    }

    function handleResponseInput(event: Event) {
        const input = event.target as HTMLInputElement;
        const value = input.value;
        
        if (!value) {
            responseValue = '';
            return;
        }
        
        if (!/^-?\d*\.?\d*$/.test(value)) {
            input.value = responseValue;
            return;
        }
        
        responseValue = value;
    }
    
    function formatNumber(value: number): string {
        if (value === undefined || value === null) return '-';
        return Math.abs(value) < 0.01 
            ? value.toExponential(2) 
            : Number.isInteger(value) 
                ? value.toString() 
                : value.toFixed(2);
    }

    // Reactive declarations
    $: hasUserResponse = userResponse !== null;
    $: responseCount = statistics?.responseCount || 0;
    $: minValue = statistics?.min !== undefined ? formatNumber(statistics.min) : '-';
    $: maxValue = statistics?.max !== undefined ? formatNumber(statistics.max) : '-';
    $: meanValue = statistics?.mean !== undefined ? formatNumber(statistics.mean) : '-';
    $: medianValue = statistics?.median !== undefined ? formatNumber(statistics.median) : '-';
    $: standardDeviation = statistics?.standardDeviation !== undefined ? formatNumber(statistics.standardDeviation) : '-';

    // Text wrapping for preview mode
    $: textWidth = node.radius * 2 - 45;
    $: maxCharsPerLine = Math.floor(textWidth / 8);
    $: lines = displayQuestion.split(' ').reduce((acc, word) => {
        const currentLine = acc[acc.length - 1] || '';
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        
        if (!currentLine || testLine.length <= maxCharsPerLine) {
            acc[acc.length - 1] = testLine;
        } else {
            acc.push(word);
        }
        return acc;
    }, ['']);
</script>

{#if isDetail}
    <!-- DETAIL MODE -->
    <BaseDetailNode {node} on:modeChange={handleModeChange} on:visibilityChange={handleVisibilityChange}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="Quantity" {radius} mode="detail" />
        </svelte:fragment>

        <!-- CategoryTags (if any) -->
        <svelte:fragment slot="categoryTags" let:radius>
            {#if categories.length > 0}
                <CategoryTags
                    {categories}
                    {radius}
                    maxDisplay={3}
                    on:categoryClick={handleCategoryClick}
                />
            {/if}
        </svelte:fragment>

        <!-- KeywordTags (if any) -->
        <svelte:fragment slot="keywordTags" let:radius>
            {#if keywords.length > 0}
                <KeywordTags
                    {keywords}
                    {radius}
                    maxDisplay={8}
                    on:keywordClick={handleKeywordClick}
                />
            {/if}
        </svelte:fragment>

        <!-- Custom Content - Quantity nodes have complex layout that doesn't fit ContentBox -->
        <svelte:fragment slot="content" let:x let:y let:width let:height>
            <!-- Inclusion Voting Section -->
            <g transform="translate({x}, {y - 150})">
                <VoteStats
                    userVoteStatus={inclusionUserVoteStatus}
                    positiveVotes={inclusionPositiveVotes}
                    negativeVotes={inclusionNegativeVotes}
                    showUserStatus={false}
                    availableWidth={width * 0.4}
                    containerY={0}
                    positiveLabel="Total Agree"
                    negativeLabel="Total Disagree"
                    netLabel="Net Votes"
                />
                
                <g transform="translate({width * 0.25}, 0)">
                    <InclusionVoteButtons
                        userVoteStatus={inclusionUserVoteStatus}
                        positiveVotes={inclusionPositiveVotes}
                        negativeVotes={inclusionNegativeVotes}
                        isVoting={votingState.isVoting}
                        voteSuccess={votingState.voteSuccess}
                        lastVoteType={votingState.lastVoteType}
                        availableWidth={width * 0.3}
                        containerY={50}
                        mode="detail"
                        on:vote={handleInclusionVote}
                    />
                </g>
            </g>

            <!-- Question Display -->
            <g transform="translate({x}, {y - 50})">
                <foreignObject 
                    x="0"
                    y="0"
                    {width}
                    height="80"
                >
                    <div class="question-text">
                        {displayQuestion}
                    </div>
                </foreignObject>
            </g>
            
            <!-- Category Display --> 
            <g transform="translate({x}, {y + 40})">
                <text 
                    x="0" 
                    class="unit-category-label left-align"
                    style:font-family="Inter"
                    style:font-size="14px"
                    style:fill="rgba(255, 255, 255, 0.8)"
                >
                    Unit Category: {categoryName}
                </text>
            </g>

            <!-- Community Responses Visualization -->
            <g transform="translate({x}, {y + 80})">
                <text 
                    x="0" 
                    class="section-header left-align"
                    style:font-family="Inter"
                    style:font-size="16px"
                    style:fill="rgba(26, 188, 156, 0.9)"
                    style:font-weight="500"
                >
                    Community Responses ({responseCount})
                </text>
                
                <foreignObject
                    x="0"
                    y="30"
                    {width}
                    height="320"
                >
                    {#if statistics && statistics.distributionCurve && statistics.distributionCurve.length > 0}
                        <QuantityVisualization 
                            {statistics}
                            {userResponse}
                            unitSymbol={displayUnitSymbol}
                            {displayUnitId}
                            categoryId={displayUnitCategoryId}
                            defaultUnitId={displayDefaultUnitId}
                        />
                    {:else if isLoadingResponses}
                        <div class="loading-message">Loading response data...</div>
                    {:else if responseCount === 0}
                        <div class="no-responses-message">No responses yet. Be the first to respond!</div>
                    {:else}
                        <div class="no-visualization-message">Not enough data for visualization.</div>
                    {/if}
                </foreignObject>
                
                <!-- Basic statistics summary if no visualization available -->
                {#if statistics && (!statistics.distributionCurve || statistics.distributionCurve.length === 0) && responseCount > 0}
                    <g transform="translate(0, 130)">
                        <text 
                            x="0"
                            y="20"
                            class="stats-summary left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.7)"
                        >
                            Mean: <tspan class="stats-value" style:fill="rgba(26, 188, 156, 0.9)">{meanValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x="0"
                            y="50"
                            class="stats-summary left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.7)"
                        >
                            Median: <tspan class="stats-value" style:fill="rgba(26, 188, 156, 0.9)">{medianValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x={width * 0.3}
                            y="20"
                            class="stats-summary left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.7)"
                        >
                            Min: <tspan class="stats-value" style:fill="rgba(26, 188, 156, 0.9)">{minValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x={width * 0.3}
                            y="50"
                            class="stats-summary left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.7)"
                        >
                            Max: <tspan class="stats-value" style:fill="rgba(26, 188, 156, 0.9)">{maxValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x={width * 0.6}
                            y="20"
                            class="stats-summary left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.7)"
                        >
                            StdDev: <tspan class="stats-value" style:fill="rgba(26, 188, 156, 0.9)">{standardDeviation} {displayUnitSymbol}</tspan>
                        </text>
                    </g>
                {/if}
            </g>

            <!-- User Response Section -->
            <g transform="translate({x}, {y + 420})">
                <text 
                    x="0" 
                    class="section-header left-align"
                    style:font-family="Inter"
                    style:font-size="16px"
                    style:fill="rgba(26, 188, 156, 0.9)"
                    style:font-weight="500"
                >
                    {hasUserResponse ? 'Your Response' : 'Add Your Response'}
                </text>
                
                <!-- User's current response display (if exists) -->
                {#if hasUserResponse}
                    <g transform="translate(0, 30)">
                        <text 
                            x="0"
                            class="user-response-value left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.8)"
                        >
                            Current answer: <tspan class="value-highlight" style:fill="rgba(26, 188, 156, 0.9)" style:font-weight="bold">{userResponse.value} {userResponse.unitSymbol || userResponse.unitId}</tspan>
                        </text>
                        
                        <!-- Delete response button -->
                        <foreignObject x={width * 0.7} y="40" width="120" height="40">
                            <button 
                                class="response-button delete-button"
                                on:click={handleDeleteResponse}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Deleting...' : 'Delete'}
                            </button>
                        </foreignObject>
                    </g>
                {/if}
                
                <!-- Response input form -->
                <g transform="translate(0, {hasUserResponse ? 70 : 40})">
                    <text 
                        x="0"
                        y="-10"
                        class="form-label left-align"
                        style:font-family="Inter"
                        style:font-size="13px"
                        style:fill="rgba(255, 255, 255, 0.6)"
                    >
                        {hasUserResponse ? 'Update your answer:' : 'Enter your answer:'}
                    </text>
                
                    <foreignObject x="0" y="0" width="200" height="40">
                        <input 
                            type="text" 
                            class="response-input"
                            placeholder="Enter value"
                            value={responseValue}
                            on:input={handleResponseInput}
                            disabled={isSubmitting}
                        />
                    </foreignObject>
                    
                    <foreignObject x="210" y="0" width="120" height="40">
                        <button 
                            class="response-button submit-button"
                            on:click={handleSubmitResponse}
                            disabled={isSubmitting || !responseValue}
                        >
                            {isSubmitting ? 'Submitting...' : (hasUserResponse ? 'Update' : 'Submit')}
                        </button>
                    </foreignObject>
                    
                    {#if errorMessage}
                        <text 
                            x="0"
                            y="50"
                            class="error-message left-align"
                            style:font-family="Inter"
                            style:font-size="12px"
                            style:fill="#ff4444"
                        >
                            {errorMessage}
                        </text>
                    {/if}
                    
                    <!-- Unit Selection Control -->
                    <text 
                        x="0"
                        y="70"
                        class="unit-preferences-label left-align"
                        style:font-family="Inter"
                        style:font-size="14px"
                        style:fill="rgba(255, 255, 255, 0.8)"
                    >
                        Change Units:
                    </text>
                    
                    <foreignObject x="110" y="60" width="200" height="40">
                        <select 
                            class="unit-select display-unit-select"
                            value={displayUnitId}
                            on:change={handleUnitChange}
                            disabled={isLoadingUnitPreferences || !availableUnits.length}
                        >
                            <option value="">Select unit</option>
                            {#each availableUnits as unit}
                                <option value={unit.id}>{unit.name} ({unit.symbol})</option>
                            {/each}
                        </select>
                    </foreignObject>
                </g>
            </g>
        </svelte:fragment>

        <!-- Create Evidence Button -->
        <svelte:fragment slot="createChild" let:radius>
            <CreateLinkedNodeButton
                y={-radius * 0.7071}
                x={radius * 0.7071}
                nodeId={node.id}
                nodeType="quantity"
                on:click={handleCreateChild}
            />
        </svelte:fragment>

        <!-- Creator credits -->
        <svelte:fragment slot="credits" let:radius>
            {#if quantityData.createdBy}
                <CreatorCredits
                    createdBy={quantityData.createdBy}
                    publicCredit={quantityData.publicCredit}
                    creatorDetails={null}
                    {radius}
                    prefix="created by:"
                />
            {/if}
        </svelte:fragment>

        <!-- Node Metadata (timestamps) -->
        <svelte:fragment slot="metadata" let:radius>
            <NodeMetadata
                createdAt={quantityData.createdAt}
                updatedAt={quantityData.updatedAt}
                {radius}
            />
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange} on:visibilityChange={handleVisibilityChange}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="Quantity" {radius} size="small" mode="preview" />
        </svelte:fragment>

        <svelte:fragment slot="content" let:x let:y let:width let:height>
            <foreignObject
                {x}
                {y}
                {width}
                {height}
            >
                <div class="question-preview">
                    {#each lines as line}
                        <div class="question-line">{line}</div>
                    {/each}
                </div>
            </foreignObject>
        </svelte:fragment>

        <svelte:fragment slot="voting" let:width let:height>
            <InclusionVoteButtons
                userVoteStatus={inclusionUserVoteStatus}
                positiveVotes={inclusionPositiveVotes}
                negativeVotes={inclusionNegativeVotes}
                isVoting={votingState.isVoting}
                voteSuccess={votingState.voteSuccess}
                lastVoteType={votingState.lastVoteType}
                availableWidth={width}
                containerY={height / 2}
                mode="preview"
                on:vote={handleInclusionVote}
            />
        </svelte:fragment>
    </BasePreviewNode>
{/if}

<style>
    .left-align {
        text-anchor: start;
    }

    /* Question styling */
    :global(.question-text) {
        color: white;
        font-family: 'Inter', sans-serif;
        font-size: 16px;
        font-weight: 500;
        line-height: 1.5;
        text-align: left;
    }
    
    .question-preview {
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 400;
        color: rgba(255, 255, 255, 0.9);
        text-align: center;
        line-height: 1.4;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: 0;
        margin: 0;
        box-sizing: border-box;
    }
    
    .question-line {
        margin-bottom: 2px;
    }

    /* Community Responses Styling */
    :global(.loading-message), :global(.no-responses-message), :global(.no-visualization-message) {
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
        text-align: center;
        padding: 20px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
    }

    /* Form Styling */
    :global(.response-input) {
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        padding: 6px 10px;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        box-sizing: border-box;
    }

    :global(.response-input:focus) {
        outline: none;
        border: 2px solid rgba(26, 188, 156, 0.6);
        box-shadow: 0 0 0 1px rgba(26, 188, 156, 0.3);
    }

    :global(.unit-select) {
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        padding: 6px 10px;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        box-sizing: border-box;
        cursor: pointer;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 16px;
        padding-right: 32px;
    }
    
    :global(.display-unit-select) {
        background-color: rgba(26, 188, 156, 0.15);
        border-color: rgba(26, 188, 156, 0.4);
    }

    :global(.unit-select:focus) {
        outline: none;
        border: 2px solid rgba(26, 188, 156, 0.6);
        box-shadow: 0 0 0 1px rgba(26, 188, 156, 0.3);
    }

    :global(.response-button) {
        width: 100%;
        height: 100%;
        padding: 6px 12px;
        border-radius: 4px;
        font-family: 'Inter', sans-serif;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        color: white;
        white-space: nowrap;
    }

    :global(.submit-button) {
        background: rgba(26, 188, 156, 0.3);
        border: 1px solid rgba(26, 188, 156, 0.4);
    }

    :global(.submit-button:hover:not(:disabled)) {
        background: rgba(26, 188, 156, 0.4);
        border: 1px solid rgba(26, 188, 156, 0.5);
    }

    :global(.delete-button) {
        background: rgba(231, 76, 60, 0.2);
        border: 1px solid rgba(231, 76, 60, 0.3);
    }

    :global(.delete-button:hover:not(:disabled)) {
        background: rgba(231, 76, 60, 0.3);
        border: 1px solid rgba(231, 76, 60, 0.4);
    }

    :global(.response-button:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>