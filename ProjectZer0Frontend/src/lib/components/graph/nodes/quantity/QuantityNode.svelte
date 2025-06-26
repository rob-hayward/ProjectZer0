<!-- src/lib/components/graph/nodes/quantity/QuantityNode.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
    import type { RenderableNode, NodeMode, ViewType } from '$lib/types/graph/enhanced';
    import { isQuantityData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import { userStore } from '$lib/stores/userStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { unitPreferenceStore } from '$lib/stores/unitPreferenceStore';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { fetchWithAuth } from '$lib/services/api';
    import { getUserResponse, getStatistics, submitResponse, deleteUserResponse } from '$lib/services/quantity';
    import { COLORS } from '$lib/constants/colors';
    import QuantityVisualization from './QuantityVisualization.svelte';
    import type { UnitPreference } from '$lib/stores/unitPreferenceStore';
    
    // ENHANCED: Import universal graph store for batch data
    import { universalGraphStore } from '$lib/stores/universalGraphStore';
    import { get } from 'svelte/store';
    
    // Import the shared behaviors and UI components
    import {
        createVoteBehaviour,
        createVisibilityBehaviour,
        createModeBehaviour,
        createDataBehaviour
    } from '../behaviours';
    
    // Import the shared UI components
    import NodeHeader from '../ui/NodeHeader.svelte';
    import CreatorCredits from '../ui/CreatorCredits.svelte';
    import ContentBox from '../ui/ContentBox.svelte';
    import { wrapTextForWidth } from '../utils/textUtils';
    
    export let node: RenderableNode;
    export let question: string = '';
    export let unitCategoryId: string = '';
    export let defaultUnitId: string = '';
    
    // ENHANCED: Optional props for explicit context control
    export let viewType: ViewType | undefined = undefined;
    
    // Debug toggle - set to true to show ContentBox borders
    const DEBUG_SHOW_BORDERS = false;
    
    // Type guard for quantity data
    if (!isQuantityData(node.data)) {
        throw new Error('Invalid node data type for QuantityNode');
    }

    // Extract data from node
    const quantityData = node.data;
    
    // Use props if provided, otherwise fall back to node data
    $: displayQuestion = question || quantityData.question;
    $: displayUnitCategoryId = unitCategoryId || quantityData.unitCategoryId;
    $: displayDefaultUnitId = defaultUnitId || quantityData.defaultUnitId;
    
    // ENHANCED: Context-aware detection
    $: detectedViewType = detectViewContext(viewType);

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
            if (pathname.includes('/quantity')) return 'quantity';
            if (pathname.includes('/discussion')) return 'discussion';
        }

        // Method 3: Detect from graph store context
        if (graphStore) {
            const currentViewType = graphStore.getViewType?.();
            if (currentViewType) return currentViewType;
        }

        // Default fallback
        return 'quantity';
    }
    
    // Behavior instances
    let voteBehaviour: any;
    let visibilityBehaviour: any;
    let modeBehaviour: any;
    let dataBehaviour: any;
    let behavioursInitialized = false;
    
    // State variables for quantity-specific features
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
    
    // ENHANCED: Track if we've used batch data to avoid duplicate API calls
    let usedBatchData = false;
    
    // Initialize behaviors
    $: if (node.id && !behavioursInitialized) {
        console.log(`[QuantityNode] Initializing for context: ${detectedViewType}`);
        
        // Note: Quantity nodes don't typically have voting, but we can add it if needed
        // Future: If voting support is added to quantity nodes:
        // voteBehaviour = createVoteBehaviour(node.id, 'quantity', { 
        //     voteStore: detectedViewType === 'universal' ? universalGraphStore : null 
        // });
        
        visibilityBehaviour = createVisibilityBehaviour(node.id, { 
            graphStore, 
            viewType: detectedViewType 
        });
        modeBehaviour = createModeBehaviour(node.mode);
        dataBehaviour = createDataBehaviour('quantity', quantityData, {
            transformData: (rawData) => ({
                ...rawData,
                formattedDate: rawData.createdAt
                    ? new Date(rawData.createdAt).toLocaleDateString()
                    : ''
            })
        });
        
        behavioursInitialized = true;
    }
    
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        hover: { isHovered: boolean };
        visibilityChange: { isHidden: boolean };
    }>();

    function handleModeChange() {
        const newMode = modeBehaviour?.handleModeChange();
        if (newMode) {
            dispatch('modeChange', { mode: newMode });
        }
    }
    
    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        dispatch('hover', event.detail);
    }
    
    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        dispatch('visibilityChange', event.detail);
    }

    // ENHANCED: Try to load data from universal graph store first
    async function loadUserResponseOptimized() {
        // First, try to get user response from universal graph batch data
        if (detectedViewType === 'universal' && !usedBatchData) {
            const universalData = get(universalGraphStore);
            if (universalData?.user_data?.quantity_responses?.[node.id]) {
                const batchResponse = universalData.user_data.quantity_responses[node.id];
                console.log(`[QuantityNode] Using batch user response for ${node.id}:`, batchResponse);
                
                userResponse = {
                    id: batchResponse.nodeId,
                    value: batchResponse.value,
                    unitId: batchResponse.unitId,
                    unitSymbol: batchResponse.unitSymbol,
                    submittedAt: batchResponse.submittedAt
                };
                
                responseValue = batchResponse.value.toString();
                usedBatchData = true;
                return; // Skip API call
            }
        }
        
        // Fallback: Make individual API call if batch data not available
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

    // ENHANCED: Try to load unit preferences from batch data first
    async function loadUnitPreferenceOptimized() {
        try {
            isLoadingUnitPreferences = true;
            
            // First, try to get unit preference from universal graph batch data
            if (detectedViewType === 'universal' && !usedBatchData) {
                const universalData = get(universalGraphStore);
                if (universalData?.user_data?.unit_preferences?.[node.id]) {
                    const batchPreference = universalData.user_data.unit_preferences[node.id];
                    console.log(`[QuantityNode] Using batch unit preference for ${node.id}:`, batchPreference);
                    
                    displayUnitId = batchPreference.unitId;
                    selectedUnitId = batchPreference.unitId;
                    
                    if (availableUnits.length > 0) {
                        const unit = availableUnits.find(u => u.id === displayUnitId);
                        if (unit) {
                            displayUnitSymbol = unit.symbol;
                        }
                        
                        // Update user response unit symbol if available
                        if (userResponse && availableUnits.length > 0) {
                            const responseUnit = availableUnits.find(u => u.id === userResponse.unitId);
                            if (responseUnit) {
                                userResponse.unitSymbol = responseUnit.symbol;
                            }
                        }
                    }
                    
                    isLoadingUnitPreferences = false;
                    return; // Skip API calls
                }
            }
            
            // Fallback: Use the existing unit preference store logic
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
                    
                    // Update user response unit symbol if available
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

    // Quantity-specific functions (preserved from original but optimized)
    async function loadUnitDetails() {
        // CRITICAL FIX: Skip API calls if no valid unit data or if values are null/invalid
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
            
            // Set fallback values instead of making API calls
            categoryName = 'No units configured';
            defaultUnitName = 'No unit';
            defaultUnitSymbol = '';
            availableUnits = [];
            
            // Still initialize display units to prevent errors
            if (!displayUnitId) {
                displayUnitId = 'none';
                selectedUnitId = 'none';
                displayUnitSymbol = '';
            }
            
            return;
        }
        
        try {
            // Get category details
            const category = await fetchWithAuth(`/api/units/categories/${displayUnitCategoryId}`);
            if (category) {
                categoryName = category.name;
            } else {
                categoryName = 'Unknown Category';
            }
            
            // Get units for this category
            const units = await fetchWithAuth(`/api/units/categories/${displayUnitCategoryId}/units`);
            if (units && Array.isArray(units)) {
                availableUnits = units;
                
                // Find default unit details
                const defaultUnit = units.find(u => u.id === displayDefaultUnitId);
                if (defaultUnit) {
                    defaultUnitName = defaultUnit.name;
                    defaultUnitSymbol = defaultUnit.symbol;
                } else {
                    defaultUnitName = 'Unknown Unit';
                    defaultUnitSymbol = '';
                }
                
                // Initialize selected and display units
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
            
            // Set fallback values on error to prevent further API calls
            categoryName = 'Error loading units';
            defaultUnitName = 'Error';
            defaultUnitSymbol = '';
            availableUnits = [];
            
            // Ensure display units are set to prevent undefined errors
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
            // NOTE: Keep using individual API call for statistics as this data changes frequently
            // and we need fresh data when users submit responses
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
            
            // ENHANCED: Still save to preference store for persistence
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
            // ENHANCED: Make individual API call for user interaction
            await submitResponse(node.id, numValue, displayUnitId);
            
            // Reload data after submission
            await loadUserResponseOptimized();
            await loadStatistics();
            
            // ENHANCED: If in universal view, update the store cache
            if (detectedViewType === 'universal') {
                // The individual API call above should trigger store updates automatically
                // via the existing store mechanisms
            }
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
            // ENHANCED: Make individual API call for user interaction
            await deleteUserResponse(node.id);
            responseValue = '';
            userResponse = null;
            await loadStatistics();
            
            // ENHANCED: If in universal view, update the store cache
            if (detectedViewType === 'universal') {
                // The individual API call above should trigger store updates automatically
            }
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
    $: isDetail = node.mode === 'detail';
    $: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';
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

    onMount(async () => {
        // Initialize behaviors
        const initPromises = [];
        if (dataBehaviour) initPromises.push(dataBehaviour.initialize());
        if (visibilityBehaviour) initPromises.push(visibilityBehaviour.initialize(0)); // No votes for quantity nodes
        if (initPromises.length > 0) await Promise.all(initPromises);
        
        // ENHANCED: Initialize with optimized data loading
        unitPreferenceStore.initialize();
        await loadUnitDetails();
        await loadUnitPreferenceOptimized();
        await loadUserResponseOptimized();
        await loadStatistics();
    });

    onDestroy(() => {
        if (dataBehaviour?.destroy) dataBehaviour.destroy();
    });
</script>

{#if isDetail}
    <!-- DETAIL MODE -->
    <BaseDetailNode {node} on:modeChange={handleModeChange} on:visibilityChange={handleVisibilityChange}>
        <svelte:fragment slot="default" let:radius>
            <NodeHeader title="Quantity" radius={radius} mode="detail" />
            
            <!-- Custom layout for quantity node - not using ContentBox due to complex layout needs -->
            
            <!-- Keywords Display (if any) -->
            {#if quantityData.keywords && quantityData.keywords.length > 0}
                <g transform="translate(0, {-radius + 280})">
                    <text 
                        x="-520" 
                        class="keywords-label left-align"
                        style:font-family="Inter"
                        style:font-size="14px"
                        style:fill="rgba(255, 255, 255, 0.8)"
                    >
                        Keywords:
                    </text>
                    
                    <foreignObject 
                        x="-520"
                        y="10"
                        width="1040"
                        height="50"
                    >
                        <div class="keywords-container">
                            {#each quantityData.keywords as keyword}
                                <div class="keyword-chip" class:ai-keyword={keyword.source === 'ai'} class:user-keyword={keyword.source === 'user'}>
                                    {keyword.word}
                                </div>
                            {/each}
                        </div>
                    </foreignObject>
                </g>
            {/if}

            <!-- Question Display -->
            <g transform="translate(0, {-radius + 340})">
                <foreignObject 
                    x="-520"
                    width="1040"
                    height="100"
                >
                    <div class="question-text">
                        {displayQuestion}
                    </div>
                </foreignObject>
            </g>
            
            <!-- Category Display --> 
            <g transform="translate(0, {-radius + 490})">
                <text 
                    x="-520" 
                    class="unit-category-label left-align"
                    style:font-family="Inter"
                    style:font-size="14px"
                    style:fill="rgba(255, 255, 255, 0.8)"
                >
                    Category: {categoryName}
                </text>
            </g>

            <!-- Community Responses Visualization -->
            <g transform="translate(0, {-radius + 530})">
                <text 
                    x="-520" 
                    class="section-header left-align"
                    style:font-family="Inter"
                    style:font-size="16px"
                    style:fill="rgba(26, 188, 156, 0.9)"
                    style:font-weight="500"
                >
                    Community Responses ({responseCount})
                </text>
                
                <foreignObject
                    x="-520"
                    y="30"
                    width="1040"
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
                            x="-520"
                            y="20"
                            class="stats-summary left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.7)"
                        >
                            Mean: <tspan class="stats-value" style:fill="rgba(26, 188, 156, 0.9)">{meanValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x="-520"
                            y="50"
                            class="stats-summary left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.7)"
                        >
                            Median: <tspan class="stats-value" style:fill="rgba(26, 188, 156, 0.9)">{medianValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x="-370"
                            y="20"
                            class="stats-summary left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.7)"
                        >
                            Min: <tspan class="stats-value" style:fill="rgba(26, 188, 156, 0.9)">{minValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x="-370"
                            y="50"
                            class="stats-summary left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.7)"
                        >
                            Max: <tspan class="stats-value" style:fill="rgba(26, 188, 156, 0.9)">{maxValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x="-220"
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
            <g transform="translate(0, {-radius + 870})">
                <text 
                    x="-520" 
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
                            x="-520"
                            class="user-response-value left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.8)"
                        >
                            Current answer: <tspan class="value-highlight" style:fill="rgba(26, 188, 156, 0.9)" style:font-weight="bold">{userResponse.value} {userResponse.unitSymbol || userResponse.unitId}</tspan>
                        </text>
                        
                        <!-- Delete response button -->
                        <foreignObject x="-180" y="40" width="120" height="40">
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
                        x="-520"
                        y="-10"
                        class="form-label left-align"
                        style:font-family="Inter"
                        style:font-size="13px"
                        style:fill="rgba(255, 255, 255, 0.6)"
                    >
                        {hasUserResponse ? 'Update your answer:' : 'Enter your answer:'}
                    </text>
                
                    <foreignObject x="-520" y="0" width="200" height="40">
                        <input 
                            type="text" 
                            class="response-input"
                            placeholder="Enter value"
                            value={responseValue}
                            on:input={handleResponseInput}
                            disabled={isSubmitting}
                        />
                    </foreignObject>
                    
                    <foreignObject x="-310" y="0" width="120" height="40">
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
                            x="-520"
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
                        x="-520"
                        y="70"
                        class="unit-preferences-label left-align"
                        style:font-family="Inter"
                        style:font-size="14px"
                        style:fill="rgba(255, 255, 255, 0.8)"
                    >
                        Change Units:
                    </text>
                    
                    <foreignObject x="-410" y="60" width="200" height="40">
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
                        
            <!-- Creator credits -->
            {#if quantityData.createdBy}
                <CreatorCredits
                    createdBy={quantityData.createdBy}
                    publicCredit={quantityData.publicCredit}
                    creatorDetails={null}
                    radius={radius}
                    prefix="created by:"
                />
            {/if}
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} on:modeChange={handleModeChange} on:hover={handleHover} on:visibilityChange={handleVisibilityChange} showContentBoxBorder={DEBUG_SHOW_BORDERS}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="Quantity" radius={radius} size="small" mode="preview" />
        </svelte:fragment>

        <svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
            <foreignObject
                x={x}
                y={y + layoutConfig.titleYOffset - 10}
                width={width}
                height={height - layoutConfig.titleYOffset}
            >
                <div class="question-preview">
                    {#each lines as line, i}
                        <div class="question-line">
                            {line}
                        </div>
                    {/each}
                </div>
            </foreignObject>
        </svelte:fragment>

        <svelte:fragment slot="voting" let:x let:y let:width let:height>
            <!-- Show category and stats instead of voting for quantity nodes -->
            <text
                x="0"
                y={y + height / 2 - 20}
                class="unit-info"
                style:font-family="Inter"
                style:font-size="12px"
                style:fill="rgba(255, 255, 255, 0.7)"
                style:text-anchor="middle"
            >
                {categoryName || displayUnitCategoryId}
            </text>
            
            <text
                x="0"
                y={y + height / 2}
                class="stats-info"
                style:font-family="Inter"
                style:font-size="12px"
                style:fill="rgba(255, 255, 255, 0.7)"
                style:text-anchor="middle"
            >
                {responseCount} {responseCount === 1 ? 'response' : 'responses'}
            </text>
            
            {#if responseCount > 0 && statistics?.mean !== undefined}
                <text
                    x="0"
                    y={y + height / 2 + 20}
                    class="stats-value"
                    style:font-family="Inter"
                    style:font-size="12px"
                    style:fill="rgba(26, 188, 156, 0.9)"
                    style:text-anchor="middle"
                >
                    Mean: {formatNumber(statistics.mean)} {displayUnitSymbol}
                </text>
            {/if}
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
    
    /* Keywords styling */
    :global(.keywords-container) {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 5px;
    }
    
    :global(.keyword-chip) {
        background: rgba(26, 188, 156, 0.2);
        border: 1px solid rgba(26, 188, 156, 0.3);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
        color: white;
        font-family: 'Inter', sans-serif;
    }
    
    :global(.keyword-chip.ai-keyword) {
        background: rgba(52, 152, 219, 0.2);
        border: 1px solid rgba(52, 152, 219, 0.3);
    }
    
    :global(.keyword-chip.user-keyword) {
        background: rgba(46, 204, 113, 0.2);
        border: 1px solid rgba(46, 204, 113, 0.3);
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