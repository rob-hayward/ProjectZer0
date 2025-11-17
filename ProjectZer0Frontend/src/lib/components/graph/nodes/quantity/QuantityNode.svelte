<!-- src/lib/components/graph/nodes/quantity/QuantityNode.svelte -->
<!-- REORGANIZED: Clean 3-section semantic structure - contentText / inclusionVoting / quantityVisualization -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode, ViewType } from '$lib/types/graph/enhanced';
    import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
    import { isQuantityData } from '$lib/types/graph/enhanced';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import { TextContent, NodeHeader, InclusionVoteButtons, VoteStats, CategoryTags, KeywordTags, NodeMetadata, CreatorCredits, CreateLinkedNodeButton } from '../ui';
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
    
    if (!isQuantityData(node.data)) {
        throw new Error('Invalid node data type for QuantityNode');
    }

    let quantityData = node.data;
    
    function getMetadataGroup(): 'quantity' {
        return 'quantity';
    }
    
    $: displayQuestion = question || quantityData.question;
    $: displayUnitCategoryId = unitCategoryId || quantityData.unitCategoryId;
    $: displayDefaultUnitId = defaultUnitId || quantityData.defaultUnitId;
    
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
        : (getNeo4jNumber(quantityData.inclusionPositiveVotes) || 0);
    
    $: inclusionNegativeVotes = negativeVotesStore 
        ? $negativeVotesStore
        : (getNeo4jNumber(quantityData.inclusionNegativeVotes) || 0);
    
    $: inclusionNetVotes = netVotesStore 
        ? $netVotesStore
        : (getNeo4jNumber(quantityData.inclusionNetVotes) || (inclusionPositiveVotes - inclusionNegativeVotes));
    
    $: inclusionUserVoteStatus = (userVoteStatusStore 
        ? $userVoteStatusStore
        : (node.metadata?.inclusionVoteStatus?.status || 'none')) as VoteStatus;

    // FIXED: Create votingState from store subscriptions
    $: votingState = {
        isVoting: isVotingStore ? $isVotingStore : false,
        voteSuccess: voteSuccessStore ? $voteSuccessStore : false,
        lastVoteType: lastVoteTypeStore ? $lastVoteTypeStore : null
    };
    
    $: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

    $: categories = (() => {
        const cats = quantityData.categories || [];
        if (cats.length === 0) return [];
        
        if (typeof cats[0] === 'object' && 'id' in cats[0]) {
            return cats as Array<{ id: string; name: string }>;
        }
        
        return [];
    })();

    $: keywords = quantityData.keywords || [];

    $: isDetail = node.mode === 'detail';
    
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
    
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
        visibilityChange: { isHidden: boolean };
        createChildNode: { parentId: string; parentType: string; childType: string };
        categoryClick: { categoryId: string; categoryName: string };
        keywordClick: { word: string };
    }>();

    onMount(async () => {
        console.log('[QuantityNode] Initializing vote behaviour for', node.id);
        
        inclusionVoting = createVoteBehaviour(node.id, 'quantity', {
            apiIdentifier: quantityData.id,
            dataObject: quantityData,
            dataProperties: {
                positiveVotesKey: 'inclusionPositiveVotes',
                negativeVotesKey: 'inclusionNegativeVotes'
            },
            apiResponseKeys: {
                positiveVotesKey: 'inclusionPositiveVotes',
                negativeVotesKey: 'inclusionNegativeVotes'
            },
            getVoteEndpoint: (id) => `/nodes/quantity/${id}/vote`,
            getRemoveVoteEndpoint: (id) => `/nodes/quantity/${id}/vote`,
            getVoteStatusEndpoint: (id) => `/nodes/quantity/${id}/vote-status`,
            graphStore,
            metadataConfig: {
                nodeMetadata: node.metadata,
                voteStatusKey: 'inclusionVoteStatus',
                metadataGroup: getMetadataGroup()
            },
            voteKind: 'INCLUSION'
        });

        await inclusionVoting.initialize({
            positiveVotes: inclusionPositiveVotes,
            negativeVotes: inclusionNegativeVotes,
            skipVoteStatusFetch: false
        });

        console.log('[QuantityNode] Vote behaviour initialized:', {
            nodeId: node.id,
            initialVotes: { inclusionPositiveVotes, inclusionNegativeVotes, inclusionNetVotes },
            initialStatus: inclusionUserVoteStatus
        });

        unitPreferenceStore.initialize();
        await loadUnitDetails();
        await loadUnitPreferenceOptimized();
        await loadUserResponseOptimized();
        await loadStatistics();
    });

    async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
        if (!inclusionVoting) return;
        await inclusionVoting.handleVote(event.detail.voteType);
    }

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

    async function loadUserResponseOptimized() {
        if (detectedViewType === 'universal' && !usedBatchData) {
            const universalData = get(universalGraphStore);
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

    $: hasUserResponse = userResponse !== null;
    $: responseCount = statistics?.responseCount || 0;
</script>

{#if isDetail}
    <BaseDetailNode 
        {node} 
        categoryTagsYOffset={0.90}
        keywordTagsYOffset={0.80}
        on:modeChange={handleModeChange} 
        on:visibilityChange={handleVisibilityChange}
    >
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="Quantity" {radius} mode="detail" />
        </svelte:fragment>

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

        <!-- REORGANIZED: Section 1 - Content Text (question + unit category) -->
        <svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
            <!-- Question text -->
            <foreignObject 
                {x} 
                y={y + Math.floor(height * (positioning.text || 0))} 
                {width} 
                height={Math.floor(height * (positioning.textHeight || 0.70))}
            >
                <TextContent text={displayQuestion} mode="detail" verticalAlign="start" />
            </foreignObject>
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
                    <strong>Include/Exclude:</strong> Should this question exist in the graph?
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

            <!-- Inclusion vote stats - WIDTH AND POSITION FROM CONTENTBOX -->
            <g transform="translate({width * (positioning.statsXOffset || 0)}, {y + Math.floor(height * positioning.stats)})">
                <VoteStats
                    userVoteStatus={inclusionUserVoteStatus}
                    positiveVotes={inclusionPositiveVotes}
                    negativeVotes={inclusionNegativeVotes}
                    positiveLabel="Include"
                    negativeLabel="Exclude"
                    availableWidth={width * (positioning.statsWidth || 1.0)}
                    showUserStatus={false}
                    showBackground={false}
                />
            </g>
        </svelte:fragment>

        <!-- REORGANIZED: Section 3 - Quantity Visualization & Response Interface -->
        <svelte:fragment slot="contentVoting" let:x let:y let:width let:height let:positioning>
            <!-- Community responses header -->
            <foreignObject 
                {x} 
                y={y + Math.floor(height * (positioning.responsesHeader || 0))} 
                {width} 
                height="30"
            >
                <div class="section-header">
                    Community Responses ({responseCount})
                </div>
            </foreignObject>

            <!-- Quantity Visualization -->
            <foreignObject
                {x}
                y={y + Math.floor(height * (positioning.visualization || 0.08))}
                {width}
                height={Math.floor(height * (positioning.visualizationHeight || 0.35))}
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

            <!-- User response section header -->
            <foreignObject 
                {x} 
                y={y + Math.floor(height * (positioning.userResponseHeader || 0.45))} 
                {width} 
                height="30"
            >
                <div class="section-header">
                    {hasUserResponse ? 'Your Response' : 'Add Your Response'}
                </div>
            </foreignObject>

            <!-- Current response display (if exists) -->
            {#if hasUserResponse}
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.currentResponse || 0.52))} 
                    {width} 
                    height="30"
                >
                    <div class="user-response-value">
                        Current answer: <span class="value-highlight">{userResponse.value} {userResponse.unitSymbol || userResponse.unitId}</span>
                    </div>
                </foreignObject>

                <foreignObject 
                    x={x + width * 0.7} 
                    y={y + Math.floor(height * (positioning.deleteButton || 0.56))} 
                    width="120" 
                    height="40"
                >
                    <button 
                        class="response-button delete-button"
                        on:click={handleDeleteResponse}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Deleting...' : 'Delete'}
                    </button>
                </foreignObject>
            {/if}

            <!-- Response input form -->
            <foreignObject 
                {x} 
                y={y + Math.floor(height * (positioning.inputForm || (hasUserResponse ? 0.62 : 0.52)))} 
                width="200" 
                height="40"
            >
                <input 
                    type="text" 
                    class="response-input"
                    placeholder="Enter value"
                    value={responseValue}
                    on:input={handleResponseInput}
                    disabled={isSubmitting}
                />
            </foreignObject>

            <foreignObject 
                x={x + 210} 
                y={y + Math.floor(height * (positioning.inputForm || (hasUserResponse ? 0.62 : 0.52)))} 
                width="120" 
                height="40"
            >
                <button 
                    class="response-button submit-button"
                    on:click={handleSubmitResponse}
                    disabled={isSubmitting || !responseValue}
                >
                    {isSubmitting ? 'Submitting...' : (hasUserResponse ? 'Update' : 'Submit')}
                </button>
            </foreignObject>

            {#if errorMessage}
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * ((positioning.inputForm || 0.52) + 0.10))} 
                    {width} 
                    height="30"
                >
                    <div class="error-message">{errorMessage}</div>
                </foreignObject>
            {/if}

            <!-- Unit selector -->
            <foreignObject 
                {x} 
                y={y + Math.floor(height * (positioning.unitSelector || 0.80))} 
                width="200" 
                height="40"
            >
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

            <foreignObject 
                x={x + 210} 
                y={y + Math.floor(height * (positioning.unitSelector || 0.80))} 
                {width}
                height="30"
            >
                <div class="unit-selector-label">Change display units</div>
            </foreignObject>
        </svelte:fragment>

        <svelte:fragment slot="metadata" let:radius>
            <NodeMetadata
                createdAt={quantityData.createdAt}
                updatedAt={quantityData.updatedAt}
                {radius}
            />
        </svelte:fragment>

        <svelte:fragment slot="credits" let:radius>
            <CreatorCredits
                createdBy={quantityData.createdBy}
                publicCredit={quantityData.publicCredit}
                {radius}
            />
        </svelte:fragment>

        <svelte:fragment slot="createChild" let:radius>
            {#if canExpand}
                <CreateLinkedNodeButton
                    y={-radius * 0.7071}
                    x={radius * 0.7071}
                    nodeId={node.id}
                    nodeType="quantity"
                    on:click={handleCreateChild}
                />
            {/if}
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange} on:visibilityChange={handleVisibilityChange}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="Quantity" {radius} mode="preview" />
        </svelte:fragment>

        <svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
            <foreignObject 
                {x} 
                y={y + Math.floor(height * (positioning.text || 0))} 
                {width} 
                height={Math.floor(height * (positioning.textHeight || 1.0))}
            >
                <TextContent text={displayQuestion} mode="preview" verticalAlign="start" />
            </foreignObject>
        </svelte:fragment>

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

    .section-header,
    .unit-selector-label {
        font-family: Inter, sans-serif;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }

    .section-header {
        font-size: 16px;
        font-weight: 500;
        color: rgba(26, 188, 156, 0.9);
    }

    .unit-selector-label {
        font-size: 12px;
        justify-content: flex-start;
        padding-left: 10px;
    }

    .user-response-value {
        font-family: Inter, sans-serif;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }

    .value-highlight {
        color: rgba(26, 188, 156, 0.9);
        font-weight: bold;
        margin-left: 5px;
    }

    .error-message {
        font-family: Inter, sans-serif;
        font-size: 12px;
        color: #ff4444;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }

    :global(.loading-message), 
    :global(.no-responses-message), 
    :global(.no-visualization-message) {
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
        text-align: center;
        padding: 20px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
    }

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