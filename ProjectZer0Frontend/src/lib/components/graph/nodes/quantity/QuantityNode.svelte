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
    import { fetchWithAuth } from '$lib/services/api';
    import { getUserResponse, getStatistics, submitResponse, deleteUserResponse } from '$lib/services/quantity';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import { COLORS } from '$lib/constants/colors';
    
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
    let selectedUnitId: string = '';
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let isLoadingResponses = false;
    
    // Enhanced detail node size (approximately 3x) - adjust the main constants
    const DETAIL_NODE_WIDTH = 1200;
    const DETAIL_NODE_HEIGHT = 900;
    
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
                
                // If no unit is selected, select the default unit
                if (!selectedUnitId) {
                    selectedUnitId = displayDefaultUnitId;
                }
            }
        } catch (error) {
            console.error('[QuantityNode] Error loading unit details:', error);
        }
    }

    async function loadUserResponse() {
        try {
            userResponse = await getUserResponse(node.id);
            
            if (userResponse) {
                // Set form values to user's response
                responseValue = userResponse.value.toString();
                selectedUnitId = userResponse.unitId;
            }
        } catch (error) {
            console.error('[QuantityNode] Error loading user response:', error);
        }
    }

    async function loadStatistics() {
        try {
            isLoadingResponses = true;
            statistics = await getStatistics(node.id);
            console.log('[QuantityNode] Statistics loaded:', statistics);
            
                            // Extract and format community responses if available
            if (statistics?.responses && Array.isArray(statistics.responses)) {
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

    async function handleSubmitResponse() {
        if (isSubmitting) return;
        if (!responseValue || !selectedUnitId) {
            errorMessage = 'Please enter a value and select a unit';
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
            // Submit response to API
            await submitResponse(node.id, numValue, selectedUnitId);
            
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
            selectedUnitId = displayDefaultUnitId;
            
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
        });
        
        // Load unit details, user response, and statistics
        await loadUnitDetails();
        await loadUserResponse();
        await loadStatistics();
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
    
    // Helper function to format numbers
    function formatNumber(value: number): string {
        if (value === undefined || value === null) return '-';
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }
</script>

{#if isDetail}
    <!-- DETAIL MODE -->
    <BaseDetailNode {node} on:modeChange={handleModeChange}>
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

            <!-- Question Display -->
            <g transform="translate(0, {-radius + 100})">
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

            <!-- Keywords Display (if any) -->
            {#if data.keywords && data.keywords.length > 0}
                <g transform="translate(0, {-radius + 200})">
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

            <!-- Unit Information -->
            <g transform="translate(0, {-radius + 280})">
                <text 
                    x={METRICS_SPACING.leftAlign} 
                    class="section-header left-align"
                >
                    Unit Information
                </text>
                
                <text 
                    x={METRICS_SPACING.leftAlign}
                    y="30"
                    class="unit-label left-align"
                >
                    Category: <tspan class="unit-value">{categoryName || displayUnitCategoryId}</tspan>
                </text>
                
                <text 
                    x={METRICS_SPACING.leftAlign}
                    y="60"
                    class="unit-label left-align"
                >
                    Default Unit: <tspan class="unit-value">{defaultUnitName || displayDefaultUnitId} {defaultUnitSymbol ? `(${defaultUnitSymbol})` : ''}</tspan>
                </text>
            </g>

            <!-- User Response Section -->
            <g transform="translate(0, {-radius + 380})">
                <text 
                    x={METRICS_SPACING.leftAlign} 
                    class="section-header left-align"
                >
                    {hasUserResponse ? 'Your Response' : 'Add Your Response'}
                </text>
                
                {#if hasUserResponse}
                    <g transform="translate(0, 30)">
                        <!-- Show user's current response -->
                        <text 
                            x={METRICS_SPACING.leftAlign}
                            class="user-response-value left-align"
                        >
                            Your answer: <tspan class="value-highlight">{userResponse.value} {userResponse.unitSymbol || userResponse.unitId}</tspan>
                        </text>
                        
                        <!-- Update/delete response buttons -->
                        <foreignObject x={METRICS_SPACING.leftAlign} y="20" width="120" height="40">
                            <button 
                                class="response-button edit-button"
                                on:click={() => hasUserResponse = false}
                            >
                                Edit Response
                            </button>
                        </foreignObject>
                        
                        <foreignObject x={METRICS_SPACING.leftAlign + 130} y="20" width="120" height="40">
                            <button 
                                class="response-button delete-button"
                                on:click={handleDeleteResponse}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Deleting...' : 'Delete Response'}
                            </button>
                        </foreignObject>
                    </g>
                {:else}
                    <!-- Response input form -->
                    <g transform="translate(0, 40)">
                        <text 
                            x={METRICS_SPACING.leftAlign}
                            y="-10"
                            class="form-label left-align"
                        >
                            Enter your answer:
                        </text>
                    
                        <foreignObject x={METRICS_SPACING.leftAlign} y="0" width="150" height="40">
                            <input 
                                type="number" 
                                class="response-input"
                                placeholder="Enter value"
                                bind:value={responseValue}
                                disabled={isSubmitting}
                            />
                        </foreignObject>
                        
                        <foreignObject x={METRICS_SPACING.leftAlign + 160} y="0" width="180" height="40">
                            <select 
                                class="unit-select"
                                bind:value={selectedUnitId}
                                disabled={isSubmitting || !availableUnits.length}
                            >
                                <option value="">Select unit</option>
                                {#each availableUnits as unit}
                                    <option value={unit.id}>{unit.name} ({unit.symbol})</option>
                                {/each}
                            </select>
                        </foreignObject>
                        
                        <foreignObject x={METRICS_SPACING.leftAlign + 350} y="0" width="120" height="40">
                            <button 
                                class="response-button submit-button"
                                on:click={handleSubmitResponse}
                                disabled={isSubmitting || !responseValue || !selectedUnitId}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit'}
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
                    </g>
                {/if}
            </g>

            <!-- Community Responses -->
            <g transform="translate(0, {-radius + 500})">
                <text 
                    x={METRICS_SPACING.leftAlign} 
                    class="section-header left-align"
                >
                    Community Responses ({responseCount})
                </text>
                
                <!-- Statistics summary -->
                <g transform="translate(0, 30)">
                    <text x={METRICS_SPACING.leftAlign} class="stats-label left-align">
                        Mean: <tspan class="stats-value">{meanValue} {defaultUnitSymbol || ''}</tspan>
                    </text>
                    
                    <text x={METRICS_SPACING.leftAlign + 200} class="stats-label left-align">
                        Median: <tspan class="stats-value">{medianValue} {defaultUnitSymbol || ''}</tspan>
                    </text>
                    
                    <text x={METRICS_SPACING.leftAlign + 400} class="stats-label left-align">
                        Min: <tspan class="stats-value">{minValue} {defaultUnitSymbol || ''}</tspan>
                    </text>
                    
                    <text x={METRICS_SPACING.leftAlign + 600} class="stats-label left-align">
                        Max: <tspan class="stats-value">{maxValue} {defaultUnitSymbol || ''}</tspan>
                    </text>
                    
                    <text x={METRICS_SPACING.leftAlign} y="30" class="stats-label left-align">
                        Standard Deviation: <tspan class="stats-value">{standardDeviation} {defaultUnitSymbol || ''}</tspan>
                    </text>
                </g>
                
                <!-- List of community responses -->
                <foreignObject 
                    x={METRICS_SPACING.leftAlign}
                    y="70"
                    width={Math.abs(METRICS_SPACING.leftAlign) * 2}
                    height="250"
                >
                    <div class="community-responses-container">
                        {#if isLoadingResponses}
                            <div class="loading-message">Loading responses...</div>
                        {:else if communityResponses.length === 0}
                            <div class="no-responses-message">No responses yet. Be the first to respond!</div>
                        {:else}
                            <div class="response-list">
                                {#each communityResponses as response, i}
                                    <div class="response-item" class:user-response={response.isCurrentUser}>
                                        <span class="response-value">{response.displayValue}</span>
                                        <span class="response-username">{response.username || 'Anonymous'}</span>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </foreignObject>
            </g>
            
            <!-- Creator credits -->
            {#if data.createdBy}
                <g transform="translate(0, {radius - 55})">
                    <text class="creator-label">
                        created by: {getDisplayName(data.createdBy, null, !data.publicCredit)}
                    </text>
                </g>
            {/if}

            <!-- Collapse button -->
            <ExpandCollapseButton 
                mode="collapse"
                y={radius}
                on:click={handleCollapse}
            />
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} on:modeChange={handleModeChange} on:hover={handleHover}>
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
            <text
                y={radius - 30}
                class="unit-info"
                style:font-family={NODE_CONSTANTS.FONTS.word.family}
                style:font-size={NODE_CONSTANTS.FONTS.value.size}
                style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
            >
                {categoryName || displayUnitCategoryId}
            </text>
        </svelte:fragment>

        <!-- Expand Button in Preview Mode -->
        <svelte:fragment slot="button" let:radius>
            <ExpandCollapseButton 
                mode="expand"
                y={radius}
                on:click={handleExpand}
            />
        </svelte:fragment>
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
    
    .section-header {
        font-size: 16px;
        fill: rgba(142, 68, 173, 0.9);
        font-weight: 500;
    }

    .unit-label, .stats-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .unit-value, .stats-value, .value-highlight {
        fill: white;
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
        background: rgba(142, 68, 173, 0.2);
        border: 1px solid rgba(142, 68, 173, 0.3);
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
    :global(.community-responses-container) {
        height: 100%;
        overflow-y: auto;
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.response-list) {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    :global(.response-item) {
        display: flex;
        justify-content: space-between;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        color: white;
    }
    
    :global(.response-item.user-response) {
        background: rgba(142, 68, 173, 0.15);
        border: 1px solid rgba(142, 68, 173, 0.3);
    }
    
    :global(.response-value) {
        font-weight: 500;
    }
    
    :global(.response-username) {
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.9em;
    }
    
    :global(.no-responses-message), :global(.loading-message) {
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
        text-align: center;
        padding: 20px;
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
        border: 2px solid rgba(142, 68, 173, 0.6);
        box-shadow: 0 0 0 1px rgba(142, 68, 173, 0.3);
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

    :global(.unit-select:focus) {
        outline: none;
        border: 2px solid rgba(142, 68, 173, 0.6);
        box-shadow: 0 0 0 1px rgba(142, 68, 173, 0.3);
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
        background: rgba(142, 68, 173, 0.3);
        border: 1px solid rgba(142, 68, 173, 0.4);
    }

    :global(.submit-button:hover:not(:disabled)) {
        background: rgba(142, 68, 173, 0.4);
        border: 1px solid rgba(142, 68, 173, 0.5);
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
</style>