<!-- src/lib/components/graph/nodes/controls/ControlNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '$lib/constants/graph/node-styling';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import type { NetworkSortType, NetworkSortDirection } from '$lib/stores/statementNetworkStore';
    
    // Props
    export let node: RenderableNode;
    export let sortType: NetworkSortType = 'netPositive';
    export let sortDirection: NetworkSortDirection = 'desc';
    export let keywords: string[] = [];
    export let keywordOperator: string = 'OR';
    export let showOnlyMyItems: boolean = false;
    export let availableKeywords: string[] = [];
    
    // Internal state
    let isDetail = node.mode === 'detail';
    let keywordInput = '';
    let keywordSearchResults: string[] = [];
    let searchTimeout: NodeJS.Timeout | null = null;
    let pendingChanges = false;
    
    // Sort options
    const sortOptions: Record<string, string> = {
        'netPositive': 'Net Votes',
        'totalVotes': 'Total Activity',
        'chronological': 'Date Created'
    };
    
    // Direction options
    const directionOptions: Record<string, string> = {
        'desc': 'Descending',
        'asc': 'Ascending'
    };
    
    // Working copies of props
    let editSortType = sortType;
    let editSortDirection = sortDirection;
    let editKeywords = [...keywords];
    let editKeywordOperator = keywordOperator;
    let editShowOnlyMyItems = showOnlyMyItems;
    
    // Layout constants 
    const METRICS_SPACING = {
        labelX: -200,
        equalsX: 0,
        valueX: 30
    };
    
    // Event dispatcher
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        controlChange: {
            sortType: NetworkSortType;
            sortDirection: NetworkSortDirection;
            keywords: string[];
            keywordOperator: string;
            showOnlyMyItems: boolean;
        };
    }>();
    
    // Function to handle expanding or collapsing the node
    function handleModeChange() {
        const newMode = isDetail ? 'preview' : 'detail';
        console.debug(`[ControlNode] Mode change requested:`, { 
            currentMode: node.mode, 
            newMode 
        });
        
        // Apply any pending changes on collapse
        if (isDetail && pendingChanges) {
            applyChanges();
        }
        
        isDetail = newMode === 'detail';
        dispatch('modeChange', { mode: newMode });
    }
    
    // Apply changes to parent component
    function applyChanges() {
        sortType = editSortType;
        sortDirection = editSortDirection;
        keywords = [...editKeywords];
        keywordOperator = editKeywordOperator;
        showOnlyMyItems = editShowOnlyMyItems;
        
        dispatch('controlChange', {
            sortType,
            sortDirection,
            keywords,
            keywordOperator,
            showOnlyMyItems
        });
        
        pendingChanges = false;
    }
    
    // Clear all filters
    function clearAllFilters() {
        editKeywords = [];
        editShowOnlyMyItems = false;
        pendingChanges = true;
        
        // Don't apply changes immediately - let the user click Apply
        // This ensures the Apply button is enabled after clearing filters
    }
    
    // Handle keyword input changes with debounce
    function handleKeywordInputChange() {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        if (!keywordInput.trim()) {
            keywordSearchResults = [];
            return;
        }
        
        searchTimeout = setTimeout(() => {
            searchKeywords(keywordInput);
            searchTimeout = null;
        }, 250);
    }
    
    // Search keywords
    function searchKeywords(query: string) {
        if (!query.trim()) {
            keywordSearchResults = [];
            return;
        }
        
        const lowerQuery = query.toLowerCase();
        const keywords = availableKeywords || [];
        
        // First, keywords that start with the query
        const startsWith = keywords
            .filter(k => k.toLowerCase().startsWith(lowerQuery))
            .slice(0, 5);
            
        // Then, keywords that contain but don't start with the query
        const contains = keywords
            .filter(k => !k.toLowerCase().startsWith(lowerQuery) && k.toLowerCase().includes(lowerQuery))
            .slice(0, 5);
            
        keywordSearchResults = [...startsWith, ...contains];
    }
    
    // Add keyword
    function addKeyword(keyword: string) {
        if (!keyword || editKeywords.includes(keyword)) return;
        
        editKeywords = [...editKeywords, keyword];
        keywordInput = '';
        keywordSearchResults = [];
        pendingChanges = true;
    }
    
    // Remove keyword
    function removeKeyword(keyword: string) {
        editKeywords = editKeywords.filter(k => k !== keyword);
        pendingChanges = true;
    }
    
    // Toggle keyword operator (AND/OR)
    function toggleKeywordOperator() {
        editKeywordOperator = editKeywordOperator === 'OR' ? 'AND' : 'OR';
        pendingChanges = true;
    }
    
    // Toggle user filter
    function toggleUserFilter() {
        editShowOnlyMyItems = !editShowOnlyMyItems;
        pendingChanges = true;
    }
    
    // Monitor for changes
    function markPendingChanges() {
        pendingChanges = true;
    }
    
    // Handle keyboard input
    function handleKeywordInputKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && keywordInput) {
            if (keywordSearchResults.length > 0) {
                addKeyword(keywordSearchResults[0]);
            } else {
                addKeyword(keywordInput);
            }
            event.preventDefault();
        }
    }
    
    onMount(() => {
        console.debug('[ControlNode] Mounted control node:', {
            id: node.id,
            mode: node.mode,
            radius: node.radius,
            position: node.position
        });
        
        editSortType = sortType;
        editSortDirection = sortDirection;
        editKeywords = [...keywords];
        editKeywordOperator = keywordOperator;
        editShowOnlyMyItems = showOnlyMyItems;
    });
    
    // Keep track of mode changes
    $: if (node.mode !== undefined) {
        isDetail = node.mode === 'detail';
    }
    
    // Size calculations for preview mode
    $: textWidth = node.radius * 2 - 45;
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
                Graph Controls
            </text>
     
            <!-- Sort Controls -->
            <g transform="translate(0, {-radius/2})">
                <text class="section-title">Sort statements</text>
                
                <!-- Sort Type Selection -->
                <foreignObject 
                    x={-180} 
                    y={20} 
                    width={170} 
                    height={70}
                >
                    <div class="control-section">
                        <label for="sort-type">Sort by</label>
                        <select 
                            id="sort-type"
                            bind:value={editSortType}
                            on:change={markPendingChanges}
                        >
                            {#each Object.entries(sortOptions) as [value, label]}
                                <option {value}>{label}</option>
                            {/each}
                        </select>
                    </div>
                </foreignObject>
                
                <!-- Sort Direction Selection -->
                <foreignObject 
                    x={10} 
                    y={20} 
                    width={170} 
                    height={70}
                >
                    <div class="control-section">
                        <label for="sort-direction">Direction</label>
                        <select 
                            id="sort-direction"
                            bind:value={editSortDirection}
                            on:change={markPendingChanges}
                        >
                            {#each Object.entries(directionOptions) as [value, label]}
                                <option {value}>{label}</option>
                            {/each}
                        </select>
                    </div>
                </foreignObject>
            </g>
            
            <!-- Keyword Filter -->
            <g transform="translate(0, {-radius/5})">
                <text class="section-title">Filter by Keywords</text>
                
                <!-- Selected Keywords Display -->
                {#if editKeywords.length > 0}
                    <foreignObject 
                        x={-180} 
                        y={20} 
                        width={360} 
                        height={70}
                    >
                        <div class="selected-keywords">
                            {#each editKeywords as keyword}
                                <div class="keyword-chip">
                                    <span>{keyword}</span>
                                    <button 
                                        class="remove-keyword"
                                        on:click={() => removeKeyword(keyword)}
                                        aria-label={`Remove ${keyword} filter`}
                                    >
                                        <span class="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            {/each}
                            
                            <!-- Operator Toggle -->
                            {#if editKeywords.length > 1}
                                <button 
                                    class="operator-toggle"
                                    on:click={toggleKeywordOperator}
                                    aria-label="Toggle between AND and OR operators"
                                >
                                    {editKeywordOperator}
                                </button>
                            {/if}
                        </div>
                    </foreignObject>
                {/if}
                
                <!-- Keyword Input -->
                <foreignObject 
                    x={-180} 
                    y={editKeywords.length > 0 ? 100 : 20} 
                    width={360} 
                    height={60}
                >
                    <div class="keyword-input-container">
                        <div class="autocomplete-wrapper">
                            <input
                                type="text"
                                placeholder="Add keyword..."
                                bind:value={keywordInput}
                                on:input={handleKeywordInputChange}
                                on:keydown={handleKeywordInputKeydown}
                                autocomplete="off"
                            />
                            
                            {#if keywordSearchResults.length > 0 && keywordInput}
                                <div class="autocomplete-dropdown" role="listbox">
                                    {#each keywordSearchResults as suggestion}
                                        <button 
                                            class="autocomplete-item"
                                            role="option"
                                            aria-selected="false"
                                            on:click={() => addKeyword(suggestion)}
                                            on:keydown={(e) => e.key === 'Enter' && addKeyword(suggestion)}
                                        >
                                            {suggestion}
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                        
                        <button 
                            class="add-keyword"
                            on:click={() => addKeyword(keywordInput)}
                            disabled={!keywordInput}
                        >
                            Add
                        </button>
                    </div>
                </foreignObject>
            </g>
            
            <!-- User Filter -->
            <g transform="translate(0, {radius/4})">
                <text class="section-title">My Content</text>
                
                <foreignObject 
                    x={-180} 
                    y={20} 
                    width={360} 
                    height={60}
                >
                    <div class="user-filter">
                        <label class="toggle-switch">
                            <input 
                                type="checkbox" 
                                bind:checked={editShowOnlyMyItems}
                                on:change={toggleUserFilter}
                            />
                            <span class="slider"></span>
                        </label>
                        <span class="filter-label">
                            {editShowOnlyMyItems 
                                ? `Showing only my statements` 
                                : `Showing all statements`}
                        </span>
                    </div>
                </foreignObject>
            </g>
            
            <!-- Control Buttons -->
            <g transform="translate(0, {radius/2})">
                <foreignObject 
                    x={-180} 
                    y={0} 
                    width={360} 
                    height={60}
                >
                    <div class="button-group">
                        <button 
                            class="clear-filters"
                            on:click={clearAllFilters}
                            disabled={editKeywords.length === 0 && !editShowOnlyMyItems}
                        >
                            Clear All Filters
                        </button>
                        <button 
                            class="apply-filters"
                            on:click={applyChanges}
                            disabled={!pendingChanges}
                        >
                            Apply Changes
                        </button>
                    </div>
                </foreignObject>
            </g>
            
            <!-- Contract button -->
            <ExpandCollapseButton 
                mode="collapse"
                y={radius}
                on:click={handleModeChange}
            />
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} on:modeChange={handleModeChange}>
        <svelte:fragment slot="title" let:radius>
            <text
                y={-radius + 40}
                class="title"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size={NODE_CONSTANTS.FONTS.title.size}
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                Graph Controls
            </text>
        </svelte:fragment>

        <svelte:fragment slot="content" let:radius>
            <g transform="translate(0, -20)">
                <text 
                    class="preview-setting"
                >
                    Sort: {sortOptions[sortType] || sortType}
                </text>
                
                <text 
                    y="25"
                    class="preview-setting"
                >
                    Order: {directionOptions[sortDirection] || sortDirection}
                </text>
                
                {#if keywords.length > 0}
                    <text 
                        y="50"
                        class="preview-setting"
                    >
                        Filters: {keywords.length} keyword{keywords.length > 1 ? 's' : ''}
                    </text>
                {/if}
                
                {#if showOnlyMyItems}
                    <text 
                        y={keywords.length > 0 ? 75 : 50}
                        class="preview-setting"
                    >
                        My content only
                    </text>
                {/if}
            </g>
        </svelte:fragment>

        <svelte:fragment slot="score" let:radius>
            <text
                y={radius - 30}
                class="hint-text"
            >
                Click to configure
            </text>
        </svelte:fragment>

        <!-- Expand Button in Preview Mode -->
        <svelte:fragment slot="button" let:radius>
            <ExpandCollapseButton 
                mode="expand"
                y={radius}
                on:click={handleModeChange}
            />
        </svelte:fragment>
    </BasePreviewNode>
{/if}

<style>
    text {
        text-anchor: middle;
        font-family: 'Orbitron', sans-serif;
        fill: white;
        user-select: none;
    }

    .title {
        fill: rgba(255, 255, 255, 0.7);
    }
    
    .section-title {
        font-size: 14px;
        font-weight: 500;
        fill: rgba(255, 255, 255, 0.9);
    }
    
    .preview-setting {
        font-size: 14px;
        font-weight: 400;
        fill: rgba(255, 255, 255, 0.9);
    }
    
    .hint-text {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.5);
    }

    :global(.control-section) {
        display: flex;
        flex-direction: column;
        gap: 5px;
        width: 100%;
    }
    
    :global(.control-section label) {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(select) {
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 12px;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 16px;
        padding-right: 30px;
    }
    
    :global(.selected-keywords) {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 8px 0;
    }
    
    :global(.keyword-chip) {
        display: flex;
        align-items: center;
        background: rgba(46, 204, 113, 0.2);
        border: 1px solid rgba(46, 204, 113, 0.3);
        border-radius: 16px;
        padding: 4px 10px;
        font-size: 12px;
        color: white;
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.remove-keyword) {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.8);
        cursor: pointer;
        padding: 0;
        margin-left: 5px;
        font-size: 12px;
        display: flex;
        align-items: center;
    }
    
    :global(.operator-toggle) {
        background: rgba(52, 152, 219, 0.2);
        border: 1px solid rgba(52, 152, 219, 0.3);
        border-radius: 16px;
        color: white;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.keyword-input-container) {
        display: flex;
        gap: 8px;
    }
    
    :global(.autocomplete-wrapper) {
        position: relative;
        flex: 1;
    }
    
    :global(input[type="text"]) {
        width: 100%;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 12px;
    }
    
    :global(.autocomplete-dropdown) {
        position: absolute;
        width: 100%;
        max-height: 200px;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        z-index: 10;
        margin-top: 2px;
    }
    
    :global(.autocomplete-item) {
        width: 100%;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s ease;
        background: transparent;
        border: none;
        color: white;
        text-align: left;
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.autocomplete-item:hover),
    :global(.autocomplete-item:focus) {
        background: rgba(52, 152, 219, 0.2);
        outline: none;
    }
    
    :global(.add-keyword) {
        background: rgba(52, 152, 219, 0.2);
        border: 1px solid rgba(52, 152, 219, 0.3);
        border-radius: 4px;
        color: white;
        padding: 8px 12px;
        font-size: 12px;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.add-keyword:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    :global(.user-filter) {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    :global(.toggle-switch) {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 22px;
    }
    
    :global(.toggle-switch input) {
        opacity: 0;
        width: 0;
        height: 0;
    }
    
    :global(.slider) {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.2);
        transition: .4s;
        border-radius: 22px;
    }
    
    :global(.slider:before) {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 2px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
    }
    
    :global(input:checked + .slider) {
        background-color: rgba(46, 204, 113, 0.2);
        border-color: rgba(46, 204, 113, 0.3);
    }
    
    :global(input:checked + .slider:before) {
        transform: translateX(22px);
    }
    
    :global(.filter-label) {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.button-group) {
        display: flex;
        gap: 10px;
        width: 100%;
    }
    
    :global(.clear-filters) {
        background: rgba(231, 76, 60, 0.2);
        border: 1px solid rgba(231, 76, 60, 0.3);
        border-radius: 4px;
        color: white;
        padding: 8px 12px;
        font-size: 14px;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
        text-align: center;
        flex: 1;
    }
    
    :global(.clear-filters:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    :global(.apply-filters) {
        background: rgba(46, 204, 113, 0.2);
        border: 1px solid rgba(46, 204, 113, 0.3);
        border-radius: 4px;
        color: white;
        padding: 8px 12px;
        font-size: 14px;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
        text-align: center;
        flex: 1;
    }
    
    :global(.apply-filters:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    /* Material Icons */
    :global(.material-symbols-outlined) {
        font-family: 'Material Symbols Outlined';
        font-weight: normal;
        font-style: normal;
        font-size: 18px;
        line-height: 1;
        letter-spacing: normal;
        text-transform: none;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
        font-feature-settings: 'liga';
        -webkit-font-feature-settings: 'liga';
        -webkit-font-smoothing: antialiased;
    }
</style>