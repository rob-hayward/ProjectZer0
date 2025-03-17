<!-- src/lib/components/graph/controls/GraphControls.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { graphFilterStore, type FilterOperator } from '$lib/stores/graphFilterStore';
    import { userStore } from '$lib/stores/userStore';
    import { wordListStore } from '$lib/stores/wordListStore';
    
    // Props to configure available options
    export let viewType: 'statement-network' | 'word-network' | 'definition-network' = 'statement-network';
    
    // Enable/disable specific control sections
    export let enableSorting = true;
    export let enableKeywordFilter = true;
    export let enableUserFilter = true;
    export let enableNodeTypeFilter = false;
    
    // Initial values
    export let initialSortType = 'netPositive';
    export let initialSortDirection = 'desc';
    export let initialKeywords: string[] = [];
    export let initialKeywordOperator = 'OR';
    export let initialNodeTypes: string[] = [];
    export let initialNodeTypeOperator = 'OR';
    export let initialUserFilter = false;
    
    // Available keywords for suggestions (can be passed in or loaded from wordListStore)
    export let availableKeywords: string[] = [];
    let isLoadingWords = false;
    
    // Available node types (if node type filtering is enabled)
    export let availableNodeTypes: Array<{ id: string; label: string }> = [
        { id: 'statement', label: 'Statements' },
        { id: 'word', label: 'Words' },
        { id: 'definition', label: 'Definitions' }
    ];
    
    // Configure sort options based on view type
    const sortOptions = {
        'statement-network': [
            { value: 'netPositive', label: 'Net Votes' },
            { value: 'totalVotes', label: 'Total Activity' },
            { value: 'chronological', label: 'Date Created' }
        ],
        'word-network': [
            { value: 'netPositive', label: 'Net Votes' },
            { value: 'alphabetical', label: 'Alphabetical' },
            { value: 'definitionCount', label: 'Definition Count' }
        ],
        'definition-network': [
            { value: 'netPositive', label: 'Net Votes' },
            { value: 'chronological', label: 'Date Created' }
        ]
    };
    
    // Direction options
    const directionOptions = [
        { value: 'desc', label: 'Descending' },
        { value: 'asc', label: 'Ascending' }
    ];
    
    // Current state (initialized from props)
    let selectedSortType = initialSortType;
    let selectedSortDirection = initialSortDirection;
    let selectedKeywords = [...initialKeywords];
    let keywordOperator = initialKeywordOperator as FilterOperator;
    let selectedNodeTypes = [...initialNodeTypes];
    let nodeTypeOperator = initialNodeTypeOperator as FilterOperator;
    let showOnlyMyItems = initialUserFilter;
    let keywordInput = '';
    
    // Keyword search results for autocomplete
    let keywordSearchResults: string[] = [];
    let keywordSearchTimeout: NodeJS.Timeout | null = null;
    
    // Panel state
    let isPanelExpanded = true;
    
    // Event dispatcher for notifying parent components
    const dispatch = createEventDispatcher<{
        change: {
            sortType: string;
            sortDirection: string;
            keywords: string[];
            keywordOperator: string;
            nodeTypes: string[];
            nodeTypeOperator: string;
            showOnlyMyItems: boolean;
        };
    }>();
    
    // Function to toggle panel expansion
    function togglePanel() {
        isPanelExpanded = !isPanelExpanded;
    }
    
    // Function to handle keyword input changes
    function handleKeywordInputChange() {
        // Clear previous timeout if it exists
        if (keywordSearchTimeout) {
            clearTimeout(keywordSearchTimeout);
        }
        
        // If input is empty, clear search results
        if (!keywordInput.trim()) {
            keywordSearchResults = [];
            return;
        }
        
        // Set a timeout to search after typing stops
        keywordSearchTimeout = setTimeout(() => {
            searchKeywords(keywordInput);
        }, 300);
    }
    
    // Function to search keywords based on input
    function searchKeywords(query: string) {
        if (!query.trim()) {
            keywordSearchResults = [];
            return;
        }
        
        const lowerQuery = query.toLowerCase();
        
        // First try to use wordListStore.searchWords if available
        if (typeof wordListStore !== 'undefined' && 'searchWords' in wordListStore) {
            try {
                keywordSearchResults = wordListStore.searchWords(query, 10);
                return;
            } catch (error) {
                console.warn('[GraphControls] Error using wordListStore search:', error);
                // Fall back to manual search
            }
        }
        
        // Fall back to searching through availableKeywords
        // First, find keywords that start with the query
        const startsWith = availableKeywords
            .filter(k => k.toLowerCase().startsWith(lowerQuery))
            .slice(0, 5);
            
        // Then, find keywords that contain the query but don't start with it
        const contains = availableKeywords
            .filter(k => !k.toLowerCase().startsWith(lowerQuery) && k.toLowerCase().includes(lowerQuery))
            .slice(0, 5);
            
        // Combine results
        keywordSearchResults = [...startsWith, ...contains];
    }
    
    // Function to add a keyword to the filter
    function addKeyword(keyword: string) {
        if (!keyword || selectedKeywords.includes(keyword)) return;
        
        selectedKeywords = [...selectedKeywords, keyword];
        keywordInput = '';
        keywordSearchResults = [];
    }
    
    // Function to remove a keyword from the filter
    function removeKeyword(keyword: string) {
        selectedKeywords = selectedKeywords.filter(k => k !== keyword);
    }
    
    // Function to toggle the keyword operator
    function toggleKeywordOperator() {
        keywordOperator = keywordOperator === 'OR' ? 'AND' : 'OR';
    }
    
    // Function to toggle the node type operator
    function toggleNodeTypeOperator() {
        nodeTypeOperator = nodeTypeOperator === 'OR' ? 'AND' : 'OR';
    }
    
    // Function to toggle node type selection
    function toggleNodeType(nodeTypeId: string) {
        if (selectedNodeTypes.includes(nodeTypeId)) {
            selectedNodeTypes = selectedNodeTypes.filter(id => id !== nodeTypeId);
        } else {
            selectedNodeTypes = [...selectedNodeTypes, nodeTypeId];
        }
    }
    
    // Function to toggle user filter
    function toggleUserFilter() {
        showOnlyMyItems = !showOnlyMyItems;
    }
    
    // Function to handle sort changes
    function handleSortChange() {
        // We let the Apply button handle notification to parent
    }
    
    // Function to notify parent of changes
    function notifyChange() {
        dispatch('change', {
            sortType: selectedSortType,
            sortDirection: selectedSortDirection,
            keywords: selectedKeywords,
            keywordOperator: keywordOperator,
            nodeTypes: selectedNodeTypes,
            nodeTypeOperator: nodeTypeOperator,
            showOnlyMyItems: showOnlyMyItems
        });
    }
    
    // Function to clear all filters
    function clearAllFilters() {
        selectedKeywords = [];
        selectedNodeTypes = [];
        showOnlyMyItems = false;
        
        // Notify parent of changes immediately
        notifyChange();
    }
    
    // Function to handle keydown in keyword input (for keyboard navigation)
    function handleKeywordInputKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && keywordInput) {
            // If we have search results, use the first one
            if (keywordSearchResults.length > 0) {
                addKeyword(keywordSearchResults[0]);
            } else {
                // Otherwise use the raw input
                addKeyword(keywordInput);
            }
            event.preventDefault();
        }
    }
    
    // Initialize by trying to load words if keywords are enabled but none provided
    onMount(async () => {
        if (enableKeywordFilter && availableKeywords.length === 0) {
            isLoadingWords = true;
            try {
                // Load words from the wordListStore if available
                if (typeof wordListStore !== 'undefined' && 'loadAllWords' in wordListStore) {
                    const words = await wordListStore.loadAllWords();
                    availableKeywords = words;
                }
            } catch (error) {
                console.error('[GraphControls] Error loading words:', error);
            } finally {
                isLoadingWords = false;
            }
        }
    });
</script>

<div class="controls-container" class:collapsed={!isPanelExpanded}>
    <div class="controls-header">
        <h2>Graph Controls</h2>
        <button 
            class="toggle-button"
            on:click={togglePanel}
            aria-label={isPanelExpanded ? "Collapse panel" : "Expand panel"}
        >
            <span class="material-symbols-outlined">
                {isPanelExpanded ? 'chevron_right' : 'tune'}
            </span>
        </button>
    </div>
    
    {#if isPanelExpanded}
    <div class="controls-body">
        <!-- Sort Controls -->
        {#if enableSorting && sortOptions[viewType]?.length > 0}
        <div class="control-section">
            <h3>Sort {viewType.split('-')[0]}s</h3>
            <div class="sort-controls">
                <div class="select-wrapper">
                    <label for="sort-type">Sort by</label>
                    <select 
                        id="sort-type"
                        bind:value={selectedSortType}
                        on:change={handleSortChange}
                    >
                        {#each sortOptions[viewType] as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                </div>
                
                <div class="select-wrapper">
                    <label for="sort-direction">Direction</label>
                    <select 
                        id="sort-direction"
                        bind:value={selectedSortDirection}
                        on:change={handleSortChange}
                    >
                        {#each directionOptions as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                </div>
            </div>
        </div>
        {/if}
        
        <!-- Keyword Filter -->
        {#if enableKeywordFilter}
        <div class="control-section">
            <h3>Filter by Keywords</h3>
            
            <!-- Selected Keywords Display -->
            {#if selectedKeywords.length > 0}
                <div class="selected-keywords">
                    {#each selectedKeywords as keyword}
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
                    {#if selectedKeywords.length > 1}
                    <button 
                        class="operator-toggle"
                        on:click={toggleKeywordOperator}
                        aria-label="Toggle between AND and OR operators"
                    >
                        {keywordOperator}
                    </button>
                    {/if}
                </div>
            {/if}
            
            <!-- Keyword Input -->
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
            
            {#if isLoadingWords}
            <div class="loading-indicator">Loading keywords...</div>
            {/if}
        </div>
        {/if}
        
        <!-- Node Type Filter -->
        {#if enableNodeTypeFilter && availableNodeTypes.length > 0}
        <div class="control-section">
            <h3>Filter by Node Type</h3>
            
            <div class="node-type-controls">
                {#each availableNodeTypes as nodeType}
                <div class="node-type-option">
                    <label class="checkbox-container">
                        <input 
                            type="checkbox" 
                            checked={selectedNodeTypes.includes(nodeType.id)}
                            on:change={() => toggleNodeType(nodeType.id)}
                        />
                        <span class="checkmark"></span>
                        <span class="label-text">{nodeType.label}</span>
                    </label>
                </div>
                {/each}
                
                <!-- Operator Toggle (if multiple node types selected) -->
                {#if selectedNodeTypes.length > 1}
                <div class="node-type-operator">
                    <button 
                        class="operator-toggle"
                        on:click={toggleNodeTypeOperator}
                        aria-label="Toggle between AND and OR operators for node types"
                    >
                        {nodeTypeOperator}
                    </button>
                    <span class="operator-label">Show nodes matching {nodeTypeOperator.toLowerCase()} conditions</span>
                </div>
                {/if}
            </div>
        </div>
        {/if}
        
        <!-- User Filter -->
        {#if enableUserFilter && $userStore}
        <div class="control-section">
            <h3>My Content</h3>
            <div class="user-filter">
                <label class="toggle-switch">
                    <input 
                        type="checkbox" 
                        bind:checked={showOnlyMyItems}
                        on:change={toggleUserFilter}
                    />
                    <span class="slider"></span>
                </label>
                <span class="filter-label">
                    {showOnlyMyItems 
                        ? `Showing only my ${viewType.split('-')[0]}s` 
                        : `Showing all ${viewType.split('-')[0]}s`}
                </span>
            </div>
        </div>
        {/if}
        
        <!-- Control Buttons -->
        <div class="control-section">
            <div class="button-group">
                {#if (enableKeywordFilter && selectedKeywords.length > 0) || 
                     (enableNodeTypeFilter && selectedNodeTypes.length > 0) || 
                     (enableUserFilter && showOnlyMyItems)}
                <button 
                    class="clear-filters"
                    on:click={clearAllFilters}
                >
                    Clear All Filters
                </button>
                {/if}
                <button 
                    class="apply-filters"
                    on:click={notifyChange}
                >
                    Apply Changes
                </button>
            </div>
        </div>
    </div>
    {/if}
</div>

<style>
    .controls-container {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 320px;
        background: rgba(0, 0, 0, 0.8);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;
        backdrop-filter: blur(10px);
        color: white;
        font-family: 'Orbitron', sans-serif;
        z-index: 100;
        transition: all 0.3s ease;
    }
    
    .controls-container.collapsed {
        width: auto;
    }
    
    .controls-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        background: rgba(52, 152, 219, 0.2);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .controls-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
    }
    
    .toggle-button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .controls-body {
        padding: 15px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-height: 80vh;
        overflow-y: auto;
    }
    
    .control-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .control-section h3 {
        margin: 0;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        font-weight: 400;
    }
    
    .sort-controls {
        display: flex;
        gap: 10px;
    }
    
    .select-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    
    .select-wrapper label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
    }
    
    select {
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
    
    .selected-keywords {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 8px 0;
    }
    
    .keyword-chip {
        display: flex;
        align-items: center;
        background: rgba(46, 204, 113, 0.2);
        border: 1px solid rgba(46, 204, 113, 0.3);
        border-radius: 16px;
        padding: 4px 10px;
        font-size: 12px;
    }
    
    .remove-keyword {
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
    
    .operator-toggle {
        background: rgba(52, 152, 219, 0.2);
        border: 1px solid rgba(52, 152, 219, 0.3);
        border-radius: 16px;
        color: white;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
    }
    
    .keyword-input-container {
        display: flex;
        gap: 8px;
    }
    
    .autocomplete-wrapper {
        position: relative;
        flex: 1;
    }
    
    input[type="text"] {
        width: 100%;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 12px;
    }
    
    .autocomplete-dropdown {
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
    
    .autocomplete-item {
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
    
    .autocomplete-item:hover,
    .autocomplete-item:focus {
        background: rgba(52, 152, 219, 0.2);
        outline: none;
    }
    
    .loading-indicator {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
        margin-top: 4px;
    }
    
    .add-keyword {
        background: rgba(52, 152, 219, 0.2);
        border: 1px solid rgba(52, 152, 219, 0.3);
        border-radius: 4px;
        color: white;
        padding: 8px 12px;
        font-size: 12px;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
    }
    
    .add-keyword:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .node-type-controls {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .node-type-option {
        display: flex;
        align-items: center;
    }
    
    .checkbox-container {
        display: flex;
        align-items: center;
        position: relative;
        padding-left: 30px;
        cursor: pointer;
        font-size: 12px;
        user-select: none;
    }
    
    .checkbox-container input {
        position: absolute;
        opacity: 0;
        cursor: pointer;
        height: 0;
        width: 0;
    }
    
    .checkmark {
        position: absolute;
        top: 0;
        left: 0;
        height: 18px;
        width: 18px;
        background-color: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }
    
    .checkbox-container input:checked ~ .checkmark {
        background-color: rgba(52, 152, 219, 0.5);
        border-color: rgba(52, 152, 219, 0.7);
    }
    
    .checkmark:after {
        content: "";
        position: absolute;
        display: none;
    }
    
    .checkbox-container input:checked ~ .checkmark:after {
        display: block;
    }
    
    .checkbox-container .checkmark:after {
        left: 6px;
        top: 2px;
        width: 4px;
        height: 8px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
    }
    
    .node-type-operator {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 5px;
    }
    
    .operator-label {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
    }
    
    .user-filter {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .toggle-switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 22px;
    }
    
    .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    
    .slider {
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
    
    .slider:before {
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
    
    input:checked + .slider {
        background-color: rgba(46, 204, 113, 0.2);
        border-color: rgba(46, 204, 113, 0.3);
    }
    
    input:checked + .slider:before {
        transform: translateX(22px);
    }
    
    .filter-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
    }
    
    .button-group {
        display: flex;
        gap: 10px;
        margin-top: 10px;
    }
    
    .clear-filters {
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
    
    .apply-filters {
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
        /* Fix for vendor prefix issue - add standard property */
        font-feature-settings: 'liga';
        -webkit-font-feature-settings: 'liga';
        -webkit-font-smoothing: antialiased;
    }
</style>