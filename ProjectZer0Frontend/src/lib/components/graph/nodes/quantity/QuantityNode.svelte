<!-- src/lib/components/graph/nodes/quantity/QuantityNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher, tick } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { isQuantityData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import { getDisplayName } from '../utils/nodeUtils';
    import { userStore } from '$lib/stores/userStore';
    import { unitPreferenceStore } from '$lib/stores/unitPreferenceStore';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { fetchWithAuth } from '$lib/services/api';
    import { getUserResponse, getStatistics, submitResponse, deleteUserResponse } from '$lib/services/quantity';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import ShowHideButton from '../common/ShowHideButton.svelte';
    import { COLORS } from '$lib/constants/colors';
    import QuantityVisualization from './QuantityVisualization.svelte';
    import type { UnitPreference } from '$lib/stores/unitPreferenceStore';
    
    export let node: RenderableNode;
    export let question: string = '';
    export let unitCategoryId: string = '';
    export let defaultUnitId: string = '';
    
    // Type guard for quantity data
    if (!isQuantityData(node.data)) {
        throw new Error('Invalid node data type for QuantityNode');
    }

    // Extract data from node
    const data = node.data;
    
    // Use props if provided, otherwise fall back to node data
    $: displayQuestion = question || data.question;
    $: displayUnitCategoryId = unitCategoryId || data.unitCategoryId;
    $: displayDefaultUnitId = defaultUnitId || data.defaultUnitId;
    
    // State variables
    let userName: string;
    let categoryName = '';
    let defaultUnitName = '';
    let defaultUnitSymbol = '';
    let userResponse: any = null;
    let statistics: any = null;
    let communityResponses: any[] = [];
    let availableUnits: any[] = [];
    let responseValue: string = '';
    let selectedUnitId: string = ''; // Will be synchronized with displayUnitId
    let displayUnitId: string = '';
    let displayUnitSymbol: string = '';
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let isLoadingResponses = false;
    let isLoadingUnitPreferences = false;
    
    // Layout constants
    const METRICS_SPACING = {
        leftAlign: -520, // Increased to allow more space
        sectionSpacing: 50,
        columnWidth: 450,
        rightAlign: 520,
    };

    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        hover: { isHovered: boolean };
        visibilityChange: { isHidden: boolean };
    }>();

    function handleModeChange() {
        const newMode = isDetail ? 'preview' : 'detail';
        console.debug(`[QuantityNode] Mode change requested:`, { 
            currentMode: node.mode, 
            newMode,
            isDetail
        });
        dispatch('modeChange', { mode: newMode });
    }
    
    function handleCollapse() {
        console.debug(`[QuantityNode] Collapse requested`);
        dispatch('modeChange', { mode: 'preview' });
    }
    
    function handleExpand() {
        console.debug(`[QuantityNode] Expand requested`);
        dispatch('modeChange', { mode: 'detail' });
    }
    
    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        dispatch('hover', event.detail);
    }
    
    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        console.debug(`[QuantityNode] Visibility change requested:`, event.detail);
        
        // Simply forward the visibility change event to NodeRenderer
        // This will be handled by the parent components and graph store
        dispatch('visibilityChange', event.detail);
    }

    async function loadUnitDetails() {
        try {
            // Get category details
            const category = await fetchWithAuth(`/units/categories/${displayUnitCategoryId}`);
            if (category) {
                categoryName = category.name;
            }
            
            // Get units for this category
            const units = await fetchWithAuth(`/units/categories/${displayUnitCategoryId}/units`);
            if (units && Array.isArray(units)) {
                availableUnits = units;
                
                // Find default unit details
                const defaultUnit = units.find(u => u.id === displayDefaultUnitId);
                if (defaultUnit) {
                    defaultUnitName = defaultUnit.name;
                    defaultUnitSymbol = defaultUnit.symbol;
                }
                
                // Initialize selected and display units
                if (!displayUnitId) {
                    displayUnitId = displayDefaultUnitId;
                    selectedUnitId = displayDefaultUnitId;
                    displayUnitSymbol = defaultUnitSymbol;
                }
            }
        } catch (error) {
            console.error('[QuantityNode] Error loading unit details:', error);
        }
    }

    async function loadUnitPreference() {
        try {
            isLoadingUnitPreferences = true;
            
            // First check if the store has already been initialized
            if (!$unitPreferenceStore.isLoaded) {
                await unitPreferenceStore.loadPreferences();
            }
            
            // Get unit preference for this node
            const preference = unitPreferenceStore.getPreference(node.id);
            
            if (preference) {
                displayUnitId = preference.unitId;
                selectedUnitId = preference.unitId; // Sync the selectedUnitId with displayUnitId
                
                // Update display unit symbol
                if (availableUnits.length > 0) {
                    const unit = availableUnits.find(u => u.id === displayUnitId);
                    if (unit) {
                        displayUnitSymbol = unit.symbol;
                    }
                }
                
                console.log(`[QuantityNode] Loaded unit preference for node ${node.id}: ${displayUnitId}`);
            } else {
                // No preference, use default
                displayUnitId = displayDefaultUnitId;
                selectedUnitId = displayDefaultUnitId; // Sync the selectedUnitId with displayUnitId
                displayUnitSymbol = defaultUnitSymbol;
            }
        } catch (error) {
            console.error('[QuantityNode] Error loading unit preference:', error);
            
            // Fall back to default unit
            displayUnitId = displayDefaultUnitId;
            selectedUnitId = displayDefaultUnitId; // Sync the selectedUnitId with displayUnitId
            displayUnitSymbol = defaultUnitSymbol;
        } finally {
            isLoadingUnitPreferences = false;
        }
    }

    async function loadUserResponse() {
        try {
            userResponse = await getUserResponse(node.id);
            
            if (userResponse) {
                // Set form values to user's response
                responseValue = userResponse.value.toString();
                
                // If user has a response, set the display unit to match their response unit
                // unless there's already a unit preference
                const preference = unitPreferenceStore.getPreference(node.id);
                if (!preference) {
                    displayUnitId = userResponse.unitId;
                    selectedUnitId = userResponse.unitId;
                }
                
                // Load unit symbol for display
                if (availableUnits.length > 0) {
                    const responseUnit = availableUnits.find(u => u.id === userResponse.unitId);
                    if (responseUnit) {
                        userResponse.unitSymbol = responseUnit.symbol;
                        
                        // If setting display unit from response, also set symbol
                        if (displayUnitId === userResponse.unitId) {
                            displayUnitSymbol = responseUnit.symbol;
                        }
                    }
                }
            } else {
                // No need to initialize selectedUnitId here as it's synchronized with displayUnitId
                responseValue = '';
            }
        } catch (error) {
            console.error('[QuantityNode] Error loading user response:', error);
        }
    }
    
    async function loadVisibilityPreference() {
        try {
            // Always initialize the store to be safe
            await visibilityStore.initialize();
            
            // Get visibility preference for this node
            const preference = visibilityStore.getPreference(node.id);
            
            // Log for debugging
            console.debug(`[QuantityNode] Loaded visibility preference for node ${node.id}:`, preference);
        } catch (error) {
            console.error('[QuantityNode] Error loading visibility preference:', error);
        }
    }

    async function loadStatistics() {
        try {
            isLoadingResponses = true;
            statistics = await getStatistics(node.id);
            console.log('[QuantityNode] Statistics loaded:', statistics);
            
            // Extract and format community responses if available
            if (statistics?.responses && Array.isArray(statistics.responses)) {
                // Add unit symbols to responses
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
                    // Format display value
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
            // Update both display unit and selected unit (for input)
            displayUnitId = newUnitId;
            selectedUnitId = newUnitId;
            
            // Update display unit symbol
            if (availableUnits.length > 0) {
                const unit = availableUnits.find(u => u.id === displayUnitId);
                if (unit) {
                    displayUnitSymbol = unit.symbol;
                }
            }
            
            // Save unit preference to store and backend
            await unitPreferenceStore.setPreference(node.id, displayUnitId);
            
            console.log(`[QuantityNode] Unit changed to ${displayUnitId}`);
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
        
        // Use displayUnitId for submission
        if (!displayUnitId) {
            errorMessage = 'Please select a unit';
            return;
        }
        
        // Parse value as number
        const numValue = parseFloat(responseValue);
        if (isNaN(numValue)) {
            errorMessage = 'Please enter a valid number';
            return;
        }
        
        isSubmitting = true;
        errorMessage = null;
        
        try {
            // Submit response to API using the selected display unit
            await submitResponse(node.id, numValue, displayUnitId);
            
            // Reload user response and statistics
            await loadUserResponse();
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
            // Delete response via API
            await deleteUserResponse(node.id);
            
            // Reset form values
            responseValue = '';
            
            // Reload user response and statistics
            userResponse = null;
            await loadStatistics();
        } catch (error) {
            console.error('[QuantityNode] Error deleting response:', error);
            errorMessage = 'Failed to delete response';
        } finally {
            isSubmitting = false;
        }
    }

    // Validate input to ensure it's a number
    function handleResponseInput(event: Event) {
        const input = event.target as HTMLInputElement;
        const value = input.value;
        
        // Allow empty input for now
        if (!value) {
            responseValue = '';
            return;
        }
        
        // Only allow numbers, decimal point, and negative sign
        if (!/^-?\d*\.?\d*$/.test(value)) {
            // Invalid input - revert to previous valid value
            input.value = responseValue;
            return;
        }
        
        // Valid input - update value
        responseValue = value;
    }
    
    // Helper function to format numbers
    function formatNumber(value: number): string {
        if (value === undefined || value === null) return '-';
        return Math.abs(value) < 0.01 
            ? value.toExponential(2) 
            : Number.isInteger(value) 
                ? value.toString() 
                : value.toFixed(2);
    }

    // Size calculations for preview mode
    $: textWidth = node.radius * 2 - 45;
    $: maxCharsPerLine = Math.floor(textWidth / 8);

    // Text wrapping for preview mode
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
        console.debug('[QuantityNode] Mounting with quantity:', {
            id: node.id,
            question: displayQuestion,
            unitCategoryId: displayUnitCategoryId,
            defaultUnitId: displayDefaultUnitId,
            mode: node.mode,
            isHidden: node.isHidden
        });
        
        // Initialize the unit preference store
        unitPreferenceStore.initialize();
        
        // Load unit details, unit preferences, user response, statistics, and visibility
        // regardless of node mode (preview or detail)
        await loadUnitDetails();
        await loadUnitPreference();
        await loadUserResponse();
        await loadStatistics();
        await loadVisibilityPreference();
    });

    // Reactive declarations
    $: isDetail = node.mode === 'detail';
    $: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';
    $: hasUserResponse = userResponse !== null;
    
    // Prepare display data for statistics
    $: responseCount = statistics?.responseCount || 0;
    $: minValue = statistics?.min !== undefined ? formatNumber(statistics.min) : '-';
    $: maxValue = statistics?.max !== undefined ? formatNumber(statistics.max) : '-';
    $: meanValue = statistics?.mean !== undefined ? formatNumber(statistics.mean) : '-';
    $: medianValue = statistics?.median !== undefined ? formatNumber(statistics.median) : '-';
    $: standardDeviation = statistics?.standardDeviation !== undefined ? formatNumber(statistics.standardDeviation) : '-';
</script>

{#if isDetail}
    <!-- DETAIL MODE -->
    <BaseDetailNode {node} on:modeChange={handleModeChange} on:visibilityChange={handleVisibilityChange}>
        <svelte:fragment slot="default" let:radius>
            <!-- Title -->
            <text
                y={-radius + 40}
                class="title"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size={NODE_CONSTANTS.FONTS.title.size}
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                Quantity
            </text>
            <!-- Title -->
            <text
                y={-radius + 40}
                class="title"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size={NODE_CONSTANTS.FONTS.title.size}
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                Quantity
            </text>

             <!-- Keywords Display (if any) -->
             {#if data.keywords && data.keywords.length > 0}
             <g transform="translate(0, {-radius + 320})">
                 <text 
                     x={METRICS_SPACING.leftAlign} 
                     class="keywords-label left-align"
                 >
                     Keywords:
                 </text>
                 
                 <foreignObject 
                     x={METRICS_SPACING.leftAlign}
                     y="10"
                     width={Math.abs(METRICS_SPACING.leftAlign) * 2}
                     height="50"
                 >
                     <div class="keywords-container">
                         {#each data.keywords as keyword}
                             <div class="keyword-chip" class:ai-keyword={keyword.source === 'ai'} class:user-keyword={keyword.source === 'user'}>
                                 {keyword.word}
                             </div>
                         {/each}
                     </div>
                 </foreignObject>
             </g>
         {/if}

            <!-- Question Display -->
            <g transform="translate(0, {-radius + 420})">
                <foreignObject 
                    x={METRICS_SPACING.leftAlign}
                    width={Math.abs(METRICS_SPACING.leftAlign) * 2}
                    height="100"
                >
                    <div class="question-text">
                        {displayQuestion}
                    </div>
                </foreignObject>
            </g>
            
            <!-- Category Display (moved from unit selection) --> 
            <g transform="translate(0, {-radius + 490})">
                <text 
                    x={METRICS_SPACING.leftAlign} 
                    class="unit-category-label left-align"
                >
                    Category: {categoryName}
                </text>
            </g>

            <!-- Community Responses Visualization - increased size -->
            <g transform="translate(0, {-radius + 530})">
                <text 
                    x={METRICS_SPACING.leftAlign} 
                    class="section-header left-align"
                >
                    Community Responses ({responseCount})
                </text>
                
                <foreignObject
                    x={METRICS_SPACING.leftAlign}
                    y="30"
                    width={Math.abs(METRICS_SPACING.leftAlign) * 2}
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
                            x={METRICS_SPACING.leftAlign}
                            y="20"
                            class="stats-summary left-align"
                        >
                            Mean: <tspan class="stats-value">{meanValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x={METRICS_SPACING.leftAlign}
                            y="50"
                            class="stats-summary left-align"
                        >
                            Median: <tspan class="stats-value">{medianValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x={METRICS_SPACING.leftAlign + 150}
                            y="20"
                            class="stats-summary left-align"
                        >
                            Min: <tspan class="stats-value">{minValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x={METRICS_SPACING.leftAlign + 150}
                            y="50"
                            class="stats-summary left-align"
                        >
                            Max: <tspan class="stats-value">{maxValue} {displayUnitSymbol}</tspan>
                        </text>
                        
                        <text 
                            x={METRICS_SPACING.leftAlign + 300}
                            y="20"
                            class="stats-summary left-align"
                        >
                            StdDev: <tspan class="stats-value">{standardDeviation} {displayUnitSymbol}</tspan>
                        </text>
                    </g>
                {/if}
            </g>

            <!-- User Response Section combined with Unit Selection -->
            <g transform="translate(0, {-radius + 870})">
                <text 
                    x={METRICS_SPACING.leftAlign} 
                    class="section-header left-align"
                >
                    {hasUserResponse ? 'Your Response' : 'Add Your Response'}
                </text>
                
                <!-- User's current response display (if exists) -->
                {#if hasUserResponse}
                    <g transform="translate(0, 30)">
                        <text 
                            x={METRICS_SPACING.leftAlign}
                            class="user-response-value left-align"
                        >
                            Current answer: <tspan class="value-highlight">{userResponse.value} {userResponse.unitSymbol || userResponse.unitId}</tspan>
                        </text>
                        
                        <!-- Delete response button moved here -->
                        <foreignObject x={METRICS_SPACING.rightAlign - 120} y="-5" width="120" height="40">
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
                
                <!-- Always show the response input form -->
                <g transform="translate(0, {hasUserResponse ? 70 : 40})">
                    <!-- First row -->
                    <text 
                        x={METRICS_SPACING.leftAlign}
                        y="-10"
                        class="form-label left-align"
                    >
                        {hasUserResponse ? 'Update your answer:' : 'Enter your answer:'}
                    </text>
                
                    <foreignObject x={METRICS_SPACING.leftAlign} y="0" width="200" height="40">
                        <input 
                            type="text" 
                            class="response-input"
                            placeholder="Enter value"
                            value={responseValue}
                            on:input={handleResponseInput}
                            disabled={isSubmitting}
                        />
                    </foreignObject>
                    
                    <foreignObject x={METRICS_SPACING.leftAlign + 210} y="0" width="120" height="40">
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
                            x={METRICS_SPACING.leftAlign}
                            y="50"
                            class="error-message left-align"
                        >
                            {errorMessage}
                        </text>
                    {/if}
                    
                    <!-- Second row - Unit Selection Control (moved from above) -->
                    <text 
                        x={METRICS_SPACING.leftAlign}
                        y="70"
                        class="unit-preferences-label left-align"
                    >
                        Change Units:
                    </text>
                    
                    <foreignObject x={METRICS_SPACING.leftAlign + 110} y="60" width="200" height="40">
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
            {#if data.createdBy}
                <g transform="translate(0, {radius - 55})">
                    <text class="creator-label">
                        created by: {getDisplayName(data.createdBy, null, !data.publicCredit)}
                    </text>
                </g>
            {/if}
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} on:modeChange={handleModeChange} on:hover={handleHover} on:visibilityChange={handleVisibilityChange}>
        <svelte:fragment slot="title" let:radius>
            <text
                y={-radius + 40}
                class="title centered"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size="12px"
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                Quantity
            </text>
        </svelte:fragment>

        <svelte:fragment slot="content" let:radius>
            <text
                y={-radius/4 - 35}
                x={-radius + 35}
                class="content left-aligned"
                style:font-family={NODE_CONSTANTS.FONTS.word.family}
                style:font-size={NODE_CONSTANTS.FONTS.word.size}
                style:font-weight={NODE_CONSTANTS.FONTS.word.weight}
            >
                {#each lines as line, i}
                    <tspan 
                        x={-radius + 40}
                        dy={i === 0 ? 0 : "1.2em"}
                    >
                        {line}
                    </tspan>
                {/each}
            </text>
        </svelte:fragment>

        <svelte:fragment slot="score" let:radius>
            <!-- Moved up stats to prevent them from falling out of the node -->
            <!-- Show category -->
            <text
                y={radius - 70}
                class="unit-info"
                style:font-family={NODE_CONSTANTS.FONTS.word.family}
                style:font-size={NODE_CONSTANTS.FONTS.value.size}
                style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
            >
                {categoryName || displayUnitCategoryId}
            </text>
            
            <!-- Show number of responses -->
            <text
                y={radius - 50}
                class="stats-info"
                style:font-family={NODE_CONSTANTS.FONTS.word.family}
                style:font-size={NODE_CONSTANTS.FONTS.value.size}
                style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
            >
                {responseCount} {responseCount === 1 ? 'response' : 'responses'}
            </text>
            
            <!-- Show mean value if we have responses -->
            {#if responseCount > 0 && statistics?.mean !== undefined}
                <text
                    y={radius - 30}
                    class="stats-value"
                    style:font-family={NODE_CONSTANTS.FONTS.word.family}
                    style:font-size={NODE_CONSTANTS.FONTS.value.size}
                    style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
                >
                    Mean: {formatNumber(statistics.mean)} {displayUnitSymbol}
                </text>
            {/if}
        </svelte:fragment>

        <!-- Button slot is no longer needed since the base component will handle both buttons -->
        <!-- We just need to make sure to forward the events -->
    </BasePreviewNode>
{/if}

<style>
    /* Base Text Styles */
    text {
        text-anchor: middle;
        font-family: 'Orbitron', sans-serif;
        fill: white;
        pointer-events: none;
    }

    .title {
        fill: rgba(255, 255, 255, 0.7);
    }

    .centered {
        text-anchor: middle;
    }

    .left-aligned, .left-align {
        text-anchor: start;
    }

    .content {
        fill: white;
    }

    .unit-info {
        fill: rgba(255, 255, 255, 0.7);
        font-size: 12px;
    }
    
    .stats-info {
        fill: rgba(255, 255, 255, 0.7);
        font-size: 12px;
    }
    
    .stats-value {
        fill: rgba(26, 188, 156, 0.9); /* TURQUOISE color for highlighting the value */
        font-size: 12px;
    }
    
    .section-header {
        font-size: 16px;
        fill: rgba(26, 188, 156, 0.9); /* TURQUOISE with opacity */
        font-weight: 500;
    }

    .user-response-value {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.8);
    }

    .error-message {
        font-size: 12px;
        fill: #ff4444;
    }

    .creator-label {
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.5);
    }

    .form-label {
        font-size: 13px;
        fill: rgba(255, 255, 255, 0.6);
    }
    
    .stats-summary {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
    }
    
    .unit-preferences-label, .unit-category-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.8);
    }
    
    .keywords-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.8);
    }

    /* Detail Mode Styling */
    :global(.question-text) {
        color: white;
        font-family: 'Orbitron', sans-serif;
        font-size: 16px;
        font-weight: 500;
        line-height: 1.5;
        text-align: left;
    }
    
    :global(.keywords-container) {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 5px;
    }
    
    :global(.keyword-chip) {
        background: rgba(26, 188, 156, 0.2); /* TURQUOISE with opacity */
        border: 1px solid rgba(26, 188, 156, 0.3); /* TURQUOISE with opacity */
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
        color: white;
        font-family: 'Orbitron', sans-serif;
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
        font-family: 'Orbitron', sans-serif;
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
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
        box-sizing: border-box;
    }

    :global(.response-input:focus) {
        outline: none;
        border: 2px solid rgba(26, 188, 156, 0.6); /* TURQUOISE with opacity */
        box-shadow: 0 0 0 1px rgba(26, 188, 156, 0.3); /* TURQUOISE with opacity */
    }

    :global(.unit-select) {
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        padding: 6px 10px;
        font-family: 'Orbitron', sans-serif;
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
        border: 2px solid rgba(26, 188, 156, 0.6); /* TURQUOISE with opacity */
        box-shadow: 0 0 0 1px rgba(26, 188, 156, 0.3); /* TURQUOISE with opacity */
    }

    :global(.response-button) {
        width: 100%;
        height: 100%;
        padding: 6px 12px;
        border-radius: 4px;
        font-family: 'Orbitron', sans-serif;
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
        background: rgba(26, 188, 156, 0.3); /* TURQUOISE with opacity */
        border: 1px solid rgba(26, 188, 156, 0.4); /* TURQUOISE with opacity */
    }

    :global(.submit-button:hover:not(:disabled)) {
        background: rgba(26, 188, 156, 0.4); /* TURQUOISE with opacity */
        border: 1px solid rgba(26, 188, 156, 0.5); /* TURQUOISE with opacity */
    }
    
    :global(.edit-button) {
        background: rgba(52, 152, 219, 0.3);
        border: 1px solid rgba(52, 152, 219, 0.4);
    }

    :global(.edit-button:hover:not(:disabled)) {
        background: rgba(52, 152, 219, 0.4);
        border: 1px solid rgba(52, 152, 219, 0.5);
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
    
    :global(.value-highlight) {
        fill: rgba(26, 188, 156, 0.9);
        font-weight: bold;
    }
</style>    