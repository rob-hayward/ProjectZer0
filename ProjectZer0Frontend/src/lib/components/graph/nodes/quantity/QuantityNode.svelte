<!-- src/lib/components/graph/nodes/quantity/QuantityNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
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
    let availableUnits: any[] = [];
    let responseValue: string = '';
    let selectedUnitId: string = '';
    let isSubmitting = false;
    let errorMessage: string | null = null;
    
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
            statistics = await getStatistics(node.id);
            console.log('[QuantityNode] Statistics loaded:', statistics);
        } catch (error) {
            console.error('[QuantityNode] Error loading statistics:', error);
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
    $: responseSummary = statistics ? 
        `${responseCount} ${responseCount === 1 ? 'response' : 'responses'} • ` +
        `Min: ${formatNumber(statistics.min)} • ` +
        `Max: ${formatNumber(statistics.max)} • ` +
        `Mean: ${formatNumber(statistics.mean)}` : 
        'No responses yet';
    
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
            <g class="question-display" transform="translate(0, {-radius/2 - 55})">
                <foreignObject 
                    x={-200}
                    width="400"
                    height="100"
                >
                    <div class="question-text">
                        {displayQuestion}
                    </div>
                </foreignObject>
            </g>

            <!-- Unit Information -->
            <g transform="translate(0, {-radius/4})">
                <text 
                    x={-200} 
                    class="unit-label left-align"
                >
                    Unit Category: <tspan class="unit-value">{categoryName || displayUnitCategoryId}</tspan>
                </text>
                
                <text 
                    x={-200}
                    y="25"
                    class="unit-label left-align"
                >
                    Default Unit: <tspan class="unit-value">{defaultUnitName || displayDefaultUnitId} {defaultUnitSymbol ? `(${defaultUnitSymbol})` : ''}</tspan>
                </text>
            </g>

            <!-- Statistics Summary -->
            <g transform="translate(0, {-radius/8 + 40})">
                <text 
                    x={-200} 
                    class="stats-label left-align"
                >
                    Statistics:
                </text>
                
                <text 
                    x={-200}
                    y="25"
                    class="stats-summary left-align"
                >
                    {responseSummary}
                </text>
            </g>

            <!-- Response Form -->
            <g transform="translate(0, {radius/4})">
                <text 
                    x={-200} 
                    class="form-label left-align"
                >
                    {hasUserResponse ? 'Your Response:' : 'Submit Your Response:'}
                </text>
                
                {#if hasUserResponse}
                    <!-- Show user's current response -->
                    <text 
                        x={-200}
                        y="30"
                        class="user-response left-align"
                    >
                        {userResponse.value} {userResponse.unitSymbol || userResponse.unitId}
                    </text>
                    
                    <!-- Delete response button -->
                    <foreignObject x={-200} y="45" width="120" height="40">
                        <button 
                            class="response-button delete-button"
                            on:click={handleDeleteResponse}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Deleting...' : 'Delete Response'}
                        </button>
                    </foreignObject>
                {:else}
                    <!-- Show response form -->
                    <foreignObject x={-200} y="30" width="120" height="40">
                        <input 
                            type="number" 
                            class="response-input"
                            placeholder="Enter value"
                            bind:value={responseValue}
                            disabled={isSubmitting}
                        />
                    </foreignObject>
                    
                    <foreignObject x={-70} y="30" width="150" height="40">
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
                    
                    <foreignObject x={90} y="30" width="120" height="40">
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
                            x={-200}
                            y="80"
                            class="error-message left-align"
                        >
                            {errorMessage}
                        </text>
                    {/if}
                {/if}
            </g>

            <!-- Visualization Placeholder -->
            <g transform="translate(0, {radius/2 + 30})">
                <text 
                    class="placeholder-text"
                >
                    {responseCount > 0 ? 'Distribution of Responses' : 'No response data to visualize yet'}
                </text>
                
                {#if responseCount > 0 && statistics?.distributionCurve?.length > 0}
                    <!-- Simple placeholder for the distribution curve -->
                    <rect 
                        x={-150}
                        y="10"
                        width="300"
                        height="80"
                        class="visualization-placeholder"
                    />
                    
                    <text 
                        y="55"
                        class="placeholder-text"
                    >
                        Distribution Visualization
                    </text>
                {/if}
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

    .unit-label, .stats-label, .form-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .unit-value {
        fill: white;
        font-weight: 500;
    }

    .stats-summary {
        font-size: 12px;
        fill: rgba(255, 255, 255, 0.9);
    }

    .user-response {
        font-size: 14px;
        fill: white;
    }

    .error-message {
        font-size: 12px;
        fill: #ff4444;
    }

    .placeholder-text {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.5);
    }

    .visualization-placeholder {
        fill: rgba(140, 82, 255, 0.1);
        stroke: rgba(140, 82, 255, 0.3);
        stroke-width: 1;
        rx: 4;
        ry: 4;
    }

    .creator-label {
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.5);
    }

    /* Detail Mode Styling */
    :global(.question-text) {
        color: white;
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        line-height: 1.4;
        text-align: left;
        padding-right: 20px;
    }

    /* Form Styling */
    :global(.response-input) {
        width: 100%;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        padding: 6px 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
        box-sizing: border-box;
        display: block;
    }

    :global(.response-input:focus) {
        outline: none;
        border: 2px solid rgba(255, 255, 255, 0.6);
    }

    :global(.unit-select) {
        width: 100%;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        padding: 6px 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
        box-sizing: border-box;
        display: block;
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
        border: 2px solid rgba(255, 255, 255, 0.6);
    }

    :global(.response-button) {
        width: 100%;
        padding: 6px 12px;
        border-radius: 4px;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        margin: 0;
        color: white;
        white-space: nowrap;
    }

    :global(.submit-button) {
        background: rgba(140, 82, 255, 0.3);
        border: 1px solid rgba(140, 82, 255, 0.4);
    }

    :global(.submit-button:hover:not(:disabled)) {
        background: rgba(140, 82, 255, 0.4);
        border: 1px solid rgba(140, 82, 255, 0.5);
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