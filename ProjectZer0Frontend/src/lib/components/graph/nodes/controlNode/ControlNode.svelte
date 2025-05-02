<!-- src/lib/components/graph/nodes/controls/ControlNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import type { NetworkSortType, NetworkSortDirection } from '$lib/stores/statementNetworkStore';
    import { wordListStore } from '$lib/stores/wordListStore';
    
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
    let keywordError: string | null = null;
    let keywordExists = false;
    
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
        modeChange: { 
            mode: NodeMode;
            radius?: number;
        };
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
        
        // Apply any pending changes on collapse
        if (isDetail && pendingChanges) {
            applyChanges();
        }
        
        isDetail = newMode === 'detail';
        
        // Get the correct size based on mode
        const newRadius = isDetail 
            ? COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 
            : COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2;
            
        console.debug(`[ControlNode] Mode change:`, { 
            id: node.id,
            oldMode: node.mode,
            newMode,
            oldRadius: node.radius,
            newRadius
        });
        
        // Update node size and mode
        dispatch('modeChange', { 
            mode: newMode,
            radius: newRadius
        });
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
    function handleKeywordInputChange(event: Event) {
        keywordError = null;
        keywordExists = false;
        
        // Log that input handler fired
        console.debug('[ControlNode] Keyword input changed:', keywordInput);
        
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        if (!keywordInput || !keywordInput.trim()) {
            keywordSearchResults = [];
            return;
        }
        
        // If we have available keywords, search immediately for faster feedback
        if (availableKeywords && availableKeywords.length > 0) {
            searchKeywords(keywordInput);
        }
        
        // Still use debounce for complex operations
        searchTimeout = setTimeout(() => {
            // For complex operations (like fetching from API)
            // But we already searched locally above
            searchTimeout = null;
        }, 250);
    }
    
    // Search keywords
    function searchKeywords(query: string) {
        if (!query || !query.trim()) {
            keywordSearchResults = [];
            keywordExists = false;
            return;
        }
        
        const lowerQuery = query.toLowerCase().trim();
        const keywords = availableKeywords || [];
        
        console.debug(`[ControlNode] Searching keywords: "${lowerQuery}" in ${keywords.length} available keywords`);
        
        // Check if the exact keyword exists
        keywordExists = keywords.some(k => k.toLowerCase() === lowerQuery);
        
        // First, exact matches (case-insensitive)
        const exactMatches = keywords
            .filter(k => k.toLowerCase() === lowerQuery);
            
        // Second, keywords that start with the query
        const startsWith = keywords
            .filter(k => k.toLowerCase().startsWith(lowerQuery) && k.toLowerCase() !== lowerQuery)
            .slice(0, 5);
            
        // Then, keywords that contain but don't start with the query
        const contains = keywords
            .filter(k => !k.toLowerCase().startsWith(lowerQuery) && k.toLowerCase().includes(lowerQuery))
            .slice(0, 5);
        
        // Create a combined list with priority order (exact matches first, then startsWith, then contains)
        const maxSuggestions = 10;
        let results = [...exactMatches];
        
        // Add "starts with" matches until we reach the max
        for (let i = 0; i < startsWith.length && results.length < maxSuggestions; i++) {
            results.push(startsWith[i]);
        }
        
        // Add "contains" matches until we reach the max
        for (let i = 0; i < contains.length && results.length < maxSuggestions; i++) {
            results.push(contains[i]);
        }
            
        keywordSearchResults = results;
        
        // Debug log the search results
        console.debug(`[ControlNode] Keyword search results for "${lowerQuery}":`, {
            exactMatches: exactMatches.length,
            startsWith: startsWith.length,
            contains: contains.length,
            totalResults: results.length,
            keywordExists: keywordExists
        });
    }
    
    // Add keyword
    function addKeyword(keyword: string) {
        if (!keyword) return;
        
        const trimmedKeyword = keyword.trim();
        if (!trimmedKeyword) return;
        
        // Check if keyword already exists in filter
        if (editKeywords.some(k => k.toLowerCase() === trimmedKeyword.toLowerCase())) {
            keywordError = `'${trimmedKeyword}' is already in your filters`;
            return;
        }
        
        // Check if it's in the available keywords list
        const exists = availableKeywords.some(k => 
            k.toLowerCase() === trimmedKeyword.toLowerCase()
        );
        
        if (!exists) {
            keywordError = `'${trimmedKeyword}' is not a known keyword`;
            return;
        }
        
        // Find the exact case-matching version from the available keywords
        const exactKeyword = availableKeywords.find(k => 
            k.toLowerCase() === trimmedKeyword.toLowerCase()
        ) || trimmedKeyword;
        
        // Add to keywords list
        editKeywords = [...editKeywords, exactKeyword];
        keywordInput = '';
        keywordSearchResults = [];
        keywordError = null;
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
    
    // Handle keyboard input for keyword search box
    function handleKeywordInputKeydown(event: KeyboardEvent) {
        // Enter key pressed with input content
        if (event.key === 'Enter' && keywordInput) {
            event.preventDefault();
            
            // 1. If exact match in keywords, use that
            if (keywordExists) {
                const exactMatch = availableKeywords.find(k => 
                    k.toLowerCase() === keywordInput.toLowerCase().trim()
                );
                if (exactMatch) {
                    addKeyword(exactMatch);
                    return;
                }
            }
            
            // 2. If we have search results, use the first one
            if (keywordSearchResults.length > 0) {
                addKeyword(keywordSearchResults[0]);
            } else {
                // 3. Try with the raw input as fallback
                addKeyword(keywordInput);
            }
        }
    }
    
    onMount(() => {
        console.debug('[ControlNode] Mounted control node:', {
            id: node.id,
            mode: node.mode,
            radius: node.radius,
            position: node.position
        });
        
        // Initialize working copies
        editSortType = sortType;
        editSortDirection = sortDirection;
        editKeywords = [...keywords];
        editKeywordOperator = keywordOperator;
        editShowOnlyMyItems = showOnlyMyItems;
        
        // Ensure the node has the correct radius based on mode
        isDetail = node.mode === 'detail';
        const correctRadius = isDetail 
            ? COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 
            : COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2;
            
        // Log if there's a radius mismatch
        if (node.radius !== correctRadius) {
            console.debug(`[ControlNode] Radius mismatch on mount:`, {
                currentRadius: node.radius,
                expectedRadius: correctRadius,
                mode: node.mode
            });
        }
    });
    
    // Keep track of mode changes
    $: if (node.mode !== undefined) {
        isDetail = node.mode === 'detail';
    }
    
    // Create a derived node with proper size
    $: nodeWithCorrectSize = {
        ...node,
        radius: isDetail 
            ? COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 
            : COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2
    };
    
    // Size calculations for preview mode
    $: textWidth = nodeWithCorrectSize.radius * 2 - 45;
</script>

{#if isDetail}
    <!-- DETAIL MODE -->
    <BaseDetailNode node={nodeWithCorrectSize} on:modeChange={handleModeChange}>
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
            <g transform="translate(0, {-radius/1.7})">
                <text class="section-title">Sort and Filter Statements</text>
                
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
            <g transform="translate(0, {-radius/7.5})">
                <text class="section-title">Filter by Keywords</text>
                
                <!-- Keyword Input - Fixed position at the top -->
                <foreignObject 
                    x={-180} 
                    y={20} 
                    width={360} 
                    height={keywordError ? 90 : 60}
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
                                class={keywordError ? "has-error" : ""}
                            />
                            
                            {#if keywordError}
                                <div class="keyword-error">{keywordError}</div>
                            {/if}
                            
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
                                            <span class="suggestion-text">
                                                {suggestion}
                                            </span>
                                            {#if suggestion.toLowerCase() === keywordInput.toLowerCase().trim()}
                                                <span class="exact-match">(exact match)</span>
                                            {/if}
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                        
                        <button 
                            class="add-keyword"
                            on:click={() => addKeyword(keywordInput)}
                            disabled={!keywordInput || (keywordInput.trim() !== '' && !keywordExists)}
                            title={keywordExists ? "Add this keyword" : "This keyword doesn't exist in the database"}
                        >
                            Add
                        </button>
                    </div>
                </foreignObject>
                
                <!-- Selected Keywords Display - Always below the input -->
                {#if editKeywords.length > 0}
                    <foreignObject 
                        x={-180} 
                        y={keywordError ? 95 : 60} 
                        width={360} 
                        height={100}
                    >
                        <div class="selected-keywords">
                            {#each editKeywords as keyword, index}
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
                                
                                <!-- Add operator between keywords -->
                                {#if index < editKeywords.length - 1}
                                    <button 
                                        class="keyword-operator" 
                                        on:click={toggleKeywordOperator}
                                        on:keydown={(e) => e.key === 'Enter' && toggleKeywordOperator()}
                                        aria-label="Toggle filter operator"
                                    >
                                        {editKeywordOperator}
                                    </button>
                                {/if}
                            {/each}
                            
                            <!-- Operator explanation -->
                            {#if editKeywords.length > 1}
                                <div class="operator-info">
                                    <button 
                                        class="operator-toggle"
                                        on:click={toggleKeywordOperator}
                                        aria-label="Toggle between AND and OR operators"
                                    >
                                        {editKeywordOperator === 'AND' ? 'Match ALL keywords' : 'Match ANY keyword'}
                                    </button>
                                    <span class="operator-hint">
                                        (click to change)
                                    </span>
                                </div>
                            {/if}
                        </div>
                    </foreignObject>
                {/if}
            </g>
            
            <!-- Control Buttons -->
            <g transform="translate(0, {radius/2})">
                <foreignObject 
                    x={-160} 
                    y={-20} 
                    width={320} 
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
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode node={nodeWithCorrectSize} on:modeChange={handleModeChange}>
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
            <g transform="translate(0, -30)">
                <text 
                    x="-10"
                    class="preview-setting"
                >
                    Sort: {sortOptions[sortType] || sortType}
                </text>
                
                <text 
                    y="25"
                    x="0"
                    class="preview-setting"
                >
                    Order: {directionOptions[sortDirection] || sortDirection}
                </text>
                
                {#if keywords.length > 0}
                    <text 
                        y="50"
                        x="-10"
                        class="preview-setting"
                    >
                        Filters: {keywords.length} keyword{keywords.length > 1 ? 's' : ''}
                    </text>
                    
                    <!-- Display up to 3 keywords in preview mode -->
                    <foreignObject 
                        x={-120}
                        y="60" 
                        width={240} 
                        height={60}
                    >
                        <div class="preview-keywords">
                            {#each keywords.slice(0, 3) as keyword}
                                <div class="preview-keyword-chip">
                                    {keyword}
                                </div>
                            {/each}
                            {#if keywords.length > 3}
                                <div class="preview-keyword-more">
                                    +{keywords.length - 3} more
                                </div>
                            {/if}
                        </div>
                    </foreignObject>
                {/if}
            </g>
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
    
    :global(.keyword-operator) {
        background: rgba(52, 152, 219, 0.2);
        border: 1px solid rgba(52, 152, 219, 0.3);
        border-radius: 16px;
        color: white;
        padding: 2px 8px;
        font-size: 10px;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
        margin: 0 4px;
        /* Add these for button reset */
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    
    :global(.operator-info) {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 8px;
        width: 100%;
    }
    
    :global(.operator-toggle) {
        background: rgba(52, 152, 219, 0.2);
        border: 1px solid rgba(52, 152, 219, 0.3);
        border-radius: 16px;
        color: white;
        padding: 4px 12px;
        font-size: 11px;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.operator-hint) {
        font-size: 9px;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 4px;
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
    
    :global(.has-error) {
        border-color: rgba(231, 76, 60, 0.5) !important;
    }
    
    :global(.keyword-error) {
        color: rgba(231, 76, 60, 0.9);
        font-size: 11px;
        margin-top: 4px;
        font-family: 'Orbitron', sans-serif;
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
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    :global(.suggestion-text) {
        flex: 1;
    }
    
    :global(.exact-match) {
        color: rgba(46, 204, 113, 0.8);
        font-size: 10px;
        font-style: italic;
        margin-left: 8px;
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
    
    /* Preview mode keyword chips */
    :global(.preview-keywords) {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 5px;
    }
    
    :global(.preview-keyword-chip) {
        background: rgba(46, 204, 113, 0.2);
        border: 1px solid rgba(46, 204, 113, 0.3);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 10px;
        color: white;
        font-family: 'Orbitron', sans-serif;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100px;
    }
    
    :global(.preview-keyword-more) {
        background: rgba(52, 152, 219, 0.2);
        border: 1px solid rgba(52, 152, 219, 0.3);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 10px;
        color: rgba(255, 255, 255, 0.7);
        font-family: 'Orbitron', sans-serif;
    }
</style>