<!-- src/lib/components/graph/nodes/controlNode/ControlNode.svelte -->
<!-- REORGANIZED: Control node structure - contentText only (no voting sections) -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import NodeHeader from '../ui/NodeHeader.svelte';
    import { fetchWithAuth } from '$lib/services/api';
    import { userStore } from '$lib/stores/userStore';
    
    // UPDATED: Import the stores for keywords and categories
    import { wordListStore } from '$lib/stores/wordListStore';
    import { categoryListStore, type Category } from '$lib/stores/categoryListStore';
    
    // Props
    export let node: RenderableNode;
    export let isLoading: boolean = false;  // Track if filters are currently loading
    export let applyMode: 'auto' | 'manual' = 'manual';  // Manual apply is now default
    
    // Extract position from node for event handling
    $: nodeX = node.position?.x;
    $: nodeY = node.position?.y;
    
    const dispatch = createEventDispatcher<{
        modeChange: { 
            mode: NodeMode;
            position?: { x: number; y: number };
            nodeId?: string;
        };
        filterChange: {
            nodeTypes: string[];
            categories: string[];
            keywords: string[];
            sortBy: string;
            sortDirection: 'asc' | 'desc';
            showOnlyMyItems: boolean;
            userFilterMode: string;
        };
    }>();
    
    // Internal state - Track mode reactively
    $: isDetail = node.mode === 'detail';
    
    // Node type selection state (checked = included) - default all selected to match initial graph state
    let selectedNodeTypes = {
        statement: true,
        openquestion: true,
        answer: true,
        quantity: true,
        evidence: true
    };
    
    // Category filter state - SIMPLIFIED: selected = required
    let selectedCategories: Category[] = [];
    let categorySearch = '';
    let filteredCategories: Category[] = [];
    let availableCategories: Category[] = [];
    let categoryDropdownOpen = false;
    let loadingCategories = false;
    
    // Keyword filter state - SIMPLIFIED: selected = required
    let selectedKeywords: string[] = [];
    let keywordSearch = '';
    let filteredKeywords: string[] = [];
    let availableKeywords: string[] = [];
    let keywordDropdownOpen = false;
    let loadingKeywords = false;
    
    // Sort state
    let sortBy = 'inclusion_votes';
    let sortDirection: 'asc' | 'desc' = 'desc';
    
    // User filter state
    let showOnlyMyItems = false;
    let userFilterMode = 'all';
    
    // Auto-apply debounce state (only used in auto mode)
    let filterDebounceTimer: NodeJS.Timeout | null = null;
    const DEBOUNCE_DELAY = 1000;  // 1 second
    
    // Manual apply state (only used in manual mode)
    let hasPendingChanges = false;
    
    // Hover state for preview mode
    let isHovering = false;
    
    // Unique filter ID (like InclusionVoteButtons)
    const glowFilterId = `control-glow-${Math.random().toString(36).slice(2)}`;
    
    // Control node has special sizes
    $: controlRadius = isDetail 
        ? COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2
        : COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2;
    
    // Create a modified node with correct size
    $: nodeWithCorrectSize = {
        ...node,
        radius: controlRadius
    } as RenderableNode;
    
    // Load available filters when entering detail mode
    $: if (isDetail) {
        loadAvailableFilters();
    }
    
    // Helper function to get node type colors from constants
    function getNodeTypeColors(nodeType: string): {
        background: string;
        border: string;
        text: string;
        hover: string;
        gradient: { start: string; end: string };
    } {
        const typeMap: { [key: string]: 'STATEMENT' | 'OPENQUESTION' | 'ANSWER' | 'QUANTITY' | 'EVIDENCE' } = {
            'statement': 'STATEMENT',
            'openquestion': 'OPENQUESTION',
            'answer': 'ANSWER',
            'quantity': 'QUANTITY',
            'evidence': 'EVIDENCE'
        };
        
        const constantKey = typeMap[nodeType];
        return NODE_CONSTANTS.COLORS[constantKey] as {
            background: string;
            border: string;
            text: string;
            hover: string;
            gradient: { start: string; end: string };
        };
    }
    
    // Helper function to increase opacity of a hex color for selected state
    function getSelectedBackground(backgroundColor: string): string {
        // Replace the last 2 characters (opacity) with a higher value
        // Original: XX (e.g., 33 ≈ 20% opacity)
        // Selected: 80 (≈ 50% opacity) for a noticeable but not overwhelming increase
        return backgroundColor.slice(0, -2) + '80';
    }
    
    // UPDATED: Load available categories and keywords using stores with API fallback
    async function loadAvailableFilters() {
        const user = $userStore;
        if (!user) {
            console.warn('[ControlNode] No user available for loading filters');
            return;
        }
        
        // Load categories using store (with caching)
        loadingCategories = true;
        try {
            console.log('[ControlNode] Loading categories from store...');
            
            // Try to get from store first (may have cache)
            const categories = await categoryListStore.loadAllCategories();
            
            if (categories && categories.length > 0) {
                availableCategories = categories;
                console.log('[ControlNode] Loaded categories from store:', availableCategories.length);
            } else {
                // Fallback to direct API call if store returns empty
                console.log('[ControlNode] Store returned empty, trying direct API call...');
                const categoriesResponse = await fetchWithAuth('/graph/universal/filters/categories');
                if (categoriesResponse && Array.isArray(categoriesResponse)) {
                    availableCategories = categoriesResponse.map((cat: any) => ({
                        id: cat.id,
                        name: cat.name
                    }));
                    console.log('[ControlNode] Loaded categories from API:', availableCategories.length);
                } else {
                    console.warn('[ControlNode] No categories available from API');
                    availableCategories = [];
                }
            }
        } catch (error) {
            console.error('[ControlNode] Error loading categories:', error);
            availableCategories = [];
        } finally {
            loadingCategories = false;
        }
        
        // Load keywords using store (with caching)
        loadingKeywords = true;
        try {
            console.log('[ControlNode] Loading keywords from store...');
            
            // Try to get from store first (may have cache)
            const keywords = await wordListStore.loadAllWords();
            
            if (keywords && keywords.length > 0) {
                availableKeywords = keywords;
                console.log('[ControlNode] Loaded keywords from store:', availableKeywords.length);
            } else {
                // Fallback to direct API call if store returns empty
                console.log('[ControlNode] Store returned empty, trying direct API call...');
                const keywordsResponse = await fetchWithAuth('/graph/universal/filters/keywords');
                if (keywordsResponse && Array.isArray(keywordsResponse)) {
                    availableKeywords = keywordsResponse.map((kw: any) => {
                        if (typeof kw === 'string') return kw;
                        if (kw && typeof kw === 'object' && 'word' in kw) return kw.word;
                        return null;
                    }).filter(Boolean) as string[];
                    console.log('[ControlNode] Loaded keywords from API:', availableKeywords.length);
                } else {
                    console.warn('[ControlNode] No keywords available from API');
                    availableKeywords = [];
                }
            }
        } catch (error) {
            console.error('[ControlNode] Error loading keywords:', error);
            availableKeywords = [];
        } finally {
            loadingKeywords = false;
        }
    }
    
    // Filter categories based on search - show ALL matches, sorted alphabetically
    $: {
        if (categorySearch.trim()) {
            const searchLower = categorySearch.toLowerCase();
            filteredCategories = availableCategories
                .filter(cat => 
                    cat.name.toLowerCase().includes(searchLower) &&
                    !selectedCategories.some(sel => sel.id === cat.id)
                )
                .sort((a, b) => a.name.localeCompare(b.name));
        } else {
            filteredCategories = availableCategories
                .filter(cat => !selectedCategories.some(sel => sel.id === cat.id))
                .sort((a, b) => a.name.localeCompare(b.name));
        }
    }
    
    // Filter keywords based on search - show ALL matches, sorted alphabetically
    $: {
        if (keywordSearch.trim()) {
            const searchLower = keywordSearch.toLowerCase();
            filteredKeywords = availableKeywords
                .filter(kw => 
                    kw.toLowerCase().includes(searchLower) &&
                    !selectedKeywords.includes(kw)
                )
                .sort((a, b) => a.localeCompare(b));
        } else {
            filteredKeywords = availableKeywords
                .filter(kw => !selectedKeywords.includes(kw))
                .sort((a, b) => a.localeCompare(b));
        }
    }
    
    function selectCategory(category: Category) {
        if (selectedCategories.length < 5) {
            selectedCategories = [...selectedCategories, category];
            categorySearch = '';
            categoryDropdownOpen = false;
            triggerFilterUpdate();
        }
    }
    
    function removeCategory(categoryId: string) {
        selectedCategories = selectedCategories.filter(c => c.id !== categoryId);
        triggerFilterUpdate();
    }
    
    function selectKeyword(keyword: string) {
        if (selectedKeywords.length < 5) {
            selectedKeywords = [...selectedKeywords, keyword];
            keywordSearch = '';
            keywordDropdownOpen = false;
            triggerFilterUpdate();
        }
    }
    
    function removeKeyword(keyword: string) {
        selectedKeywords = selectedKeywords.filter(kw => kw !== keyword);
        triggerFilterUpdate();
    }
    
    // UPDATED: Simplified to handle both auto and manual modes
    function triggerFilterUpdate() {
        // Manual mode: just mark as having pending changes
        if (applyMode === 'manual') {
            hasPendingChanges = true;
            return;
        }
        
        // Auto mode: debounce and dispatch after delay
        if (isLoading) {
            console.log('[ControlNode] Skipping filter update - load in progress');
            return;
        }
        
        // Clear any existing debounce timer
        if (filterDebounceTimer) {
            clearTimeout(filterDebounceTimer);
        }
        
        // Start new debounce timer
        filterDebounceTimer = setTimeout(() => {
            dispatchFilterChange();
        }, DEBOUNCE_DELAY);
    }
    
    // Manual apply function
    function applyFiltersManually() {
        if (isLoading || !hasPendingChanges) return;
        
        console.log('[ControlNode] Applying filters manually');
        hasPendingChanges = false;
        dispatchFilterChange();
    }
    
    // Dispatch filter change event to parent
    function dispatchFilterChange() {
        const activeNodeTypes = Object.entries(selectedNodeTypes)
            .filter(([_, isSelected]) => isSelected)
            .map(([type]) => type);
        
        console.log('[ControlNode] Dispatching filter change:', {
            nodeTypes: activeNodeTypes,
            categories: selectedCategories.map(c => c.id),
            keywords: selectedKeywords,
            sortBy,
            sortDirection
        });
        
        dispatch('filterChange', {
            nodeTypes: activeNodeTypes,
            categories: selectedCategories.map(c => c.id),
            keywords: selectedKeywords,
            sortBy,
            sortDirection,
            showOnlyMyItems,
            userFilterMode
        });
    }
    
    // Reactive update for node types and sorting changes
    $: {
        selectedNodeTypes;
        sortBy;
        sortDirection;
        
        if (isDetail) {
            triggerFilterUpdate();
        }
    }
    
    function handleModeChange() {
        const newMode: NodeMode = isDetail ? 'preview' : 'detail';
        
        console.log('[ControlNode] Mode change clicked:', {
            currentMode: node.mode,
            newMode,
            nodeId: node.id,
            position: { x: nodeX, y: nodeY }
        });
        
        // Prepare event data with position and nodeId
        const eventData: { 
            mode: NodeMode; 
            position?: { x: number; y: number };
            nodeId?: string;
        } = { mode: newMode };
        
        // Include position if available
        if (nodeX !== undefined && nodeY !== undefined) {
            eventData.position = { x: nodeX, y: nodeY };
        }
        
        // Include node ID
        eventData.nodeId = node.id;
        
        dispatch('modeChange', eventData);
    }
    
    function handlePreviewKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleModeChange();
        }
    }
</script>

{#if isDetail}
    <!-- DETAIL MODE - Full filter controls -->
    <BaseDetailNode 
        node={nodeWithCorrectSize} 
        {nodeX}
        {nodeY}
        on:modeChange={handleModeChange}
    >
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="Graph Controls" {radius} mode="detail" />
        </svelte:fragment>
        
        <!-- REORGANIZED: Section 1 - Content Text (All control panel UI) -->
        <svelte:fragment slot="contentText" let:x let:y let:width let:height>
            <foreignObject {x} {y} {width} {height}>
                <div class="control-panel" {...{"xmlns": "http://www.w3.org/1999/xhtml"}} style="width: {width}px; height: {height}px; padding-top: {height * 0.15}px;">
                    <div class="control-panel-inner">
                        <!-- Section 1: Node Types (Circular buttons in 2 rows, condensed spacing) -->
                        <div class="filter-section node-types">
                            <div class="section-header">
                                Node Types
                                {#if isLoading}
                                    <span class="loading-indicator-inline">🔄 Applying...</span>
                                {/if}
                            </div>
                            <div class="node-type-circles">
                                <div class="circle-wrapper">
                                    <button 
                                        class="circle-button"
                                        class:selected={selectedNodeTypes.statement}
                                        class:disabled={isLoading}
                                        disabled={isLoading}
                                        on:click={() => selectedNodeTypes.statement = !selectedNodeTypes.statement}
                                        aria-label="Statement"
                                        data-node-type="statement"
                                        style="
                                            --node-bg: {getNodeTypeColors('statement').background};
                                            --node-bg-selected: {getSelectedBackground(getNodeTypeColors('statement').background)};
                                            --node-border: {getNodeTypeColors('statement').border};
                                            --node-text: {getNodeTypeColors('statement').text};
                                        "
                                    >
                                        <span class="circle-label">ST</span>
                                    </button>
                                    <span class="circle-tooltip">Statement</span>
                                </div>
                                <div class="circle-wrapper">
                                    <button 
                                        class="circle-button"
                                        class:selected={selectedNodeTypes.openquestion}
                                        class:disabled={isLoading}
                                        disabled={isLoading}
                                        on:click={() => selectedNodeTypes.openquestion = !selectedNodeTypes.openquestion}
                                        aria-label="Question"
                                        data-node-type="openquestion"
                                        style="
                                            --node-bg: {getNodeTypeColors('openquestion').background};
                                            --node-bg-selected: {getSelectedBackground(getNodeTypeColors('openquestion').background)};
                                            --node-border: {getNodeTypeColors('openquestion').border};
                                            --node-text: {getNodeTypeColors('openquestion').text};
                                        "
                                    >
                                        <span class="circle-label">Q</span>
                                    </button>
                                    <span class="circle-tooltip">Question</span>
                                </div>
                                <div class="circle-wrapper">
                                    <button 
                                        class="circle-button"
                                        class:selected={selectedNodeTypes.answer}
                                        class:disabled={isLoading}
                                        disabled={isLoading}
                                        on:click={() => selectedNodeTypes.answer = !selectedNodeTypes.answer}
                                        aria-label="Answer"
                                        data-node-type="answer"
                                        style="
                                            --node-bg: {getNodeTypeColors('answer').background};
                                            --node-bg-selected: {getSelectedBackground(getNodeTypeColors('answer').background)};
                                            --node-border: {getNodeTypeColors('answer').border};
                                            --node-text: {getNodeTypeColors('answer').text};
                                        "
                                    >
                                        <span class="circle-label">A</span>
                                    </button>
                                    <span class="circle-tooltip">Answer</span>
                                </div>
                                <div class="circle-wrapper">
                                    <button 
                                        class="circle-button"
                                        class:selected={selectedNodeTypes.quantity}
                                        class:disabled={isLoading}
                                        disabled={isLoading}
                                        on:click={() => selectedNodeTypes.quantity = !selectedNodeTypes.quantity}
                                        aria-label="Quantity"
                                        data-node-type="quantity"
                                        style="
                                            --node-bg: {getNodeTypeColors('quantity').background};
                                            --node-bg-selected: {getSelectedBackground(getNodeTypeColors('quantity').background)};
                                            --node-border: {getNodeTypeColors('quantity').border};
                                            --node-text: {getNodeTypeColors('quantity').text};
                                        "
                                    >
                                        <span class="circle-label">QT</span>
                                    </button>
                                    <span class="circle-tooltip">Quantity</span>
                                </div>
                                <div class="circle-wrapper">
                                    <button 
                                        class="circle-button"
                                        class:selected={selectedNodeTypes.evidence}
                                        class:disabled={isLoading}
                                        disabled={isLoading}
                                        on:click={() => selectedNodeTypes.evidence = !selectedNodeTypes.evidence}
                                        aria-label="Evidence"
                                        data-node-type="evidence"
                                        style="
                                            --node-bg: {getNodeTypeColors('evidence').background};
                                            --node-bg-selected: {getSelectedBackground(getNodeTypeColors('evidence').background)};
                                            --node-border: {getNodeTypeColors('evidence').border};
                                            --node-text: {getNodeTypeColors('evidence').text};
                                        "
                                    >
                                        <span class="circle-label">EV</span>
                                    </button>
                                    <span class="circle-tooltip">Evidence</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Manual Apply Button (only shown in manual mode) -->
                        {#if applyMode === 'manual'}
                            <div class="apply-controls">
                                <button 
                                    class="apply-button"
                                    class:has-changes={hasPendingChanges}
                                    class:loading={isLoading}
                                    disabled={isLoading || !hasPendingChanges}
                                    on:click={applyFiltersManually}
                                >
                                    {#if isLoading}
                                        <span class="spinner">⏳</span>
                                        Applying...
                                    {:else if hasPendingChanges}
                                        <span class="icon">✓</span>
                                        Apply Filters
                                    {:else}
                                        <span class="icon">✓</span>
                                        No Changes
                                    {/if}
                                </button>
                                
                                {#if hasPendingChanges && !isLoading}
                                    <div class="changes-hint">
                                        Click to apply your filter changes
                                    </div>
                                {/if}
                            </div>
                        {/if}
                        
                        <!-- Section 2: Categories (Searchable dropdown showing all options) -->
                        <div class="filter-section">
                            <div class="section-header">Categories {selectedCategories.length > 0 ? `(${selectedCategories.length}/5)` : ''}</div>
                            
                            <!-- Selected categories as tags -->
                            {#if selectedCategories.length > 0}
                                <div class="tag-list">
                                    {#each selectedCategories as category}
                                        <span class="tag">
                                            {category.name}
                                            <button 
                                                class="tag-remove"
                                                on:click={() => removeCategory(category.id)}
                                                aria-label="Remove {category.name}"
                                            >×</button>
                                        </span>
                                    {/each}
                                </div>
                            {/if}
                            
                            <!-- Category search and dropdown (always show when less than 5 selected) -->
                            {#if selectedCategories.length < 5}
                                <div class="dropdown-container">
                                    <input 
                                        type="text"
                                        class="search-input-standard"
                                        placeholder="Search or select..."
                                        bind:value={categorySearch}
                                        on:focus={() => categoryDropdownOpen = true}
                                        on:blur={() => setTimeout(() => categoryDropdownOpen = false, 200)}
                                        disabled={loadingCategories}
                                    />
                                    
                                    {#if categoryDropdownOpen}
                                        <div class="dropdown-full">
                                            {#if loadingCategories}
                                                <div class="dropdown-item loading">Loading categories...</div>
                                            {:else if filteredCategories.length === 0}
                                                <div class="dropdown-item loading">No categories found</div>
                                            {:else}
                                                {#each filteredCategories as category}
                                                    <button 
                                                        class="dropdown-item"
                                                        on:click={() => selectCategory(category)}
                                                    >
                                                        {category.name}
                                                    </button>
                                                {/each}
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                        
                        <!-- Section 3: Keywords (Searchable dropdown showing all options) -->
                        <div class="filter-section">
                            <div class="section-header">Keywords {selectedKeywords.length > 0 ? `(${selectedKeywords.length}/5)` : ''}</div>
                            
                            <!-- Selected keywords as tags -->
                            {#if selectedKeywords.length > 0}
                                <div class="tag-list">
                                    {#each selectedKeywords as keyword}
                                        <span class="tag">
                                            {keyword}
                                            <button 
                                                class="tag-remove"
                                                on:click={() => removeKeyword(keyword)}
                                                aria-label="Remove {keyword}"
                                            >×</button>
                                        </span>
                                    {/each}
                                </div>
                            {/if}
                            
                            <!-- Keyword search and dropdown (always show when less than 5 selected) -->
                            {#if selectedKeywords.length < 5}
                                <div class="dropdown-container">
                                    <input 
                                        type="text"
                                        class="search-input-standard"
                                        placeholder="Search or select..."
                                        bind:value={keywordSearch}
                                        on:focus={() => keywordDropdownOpen = true}
                                        on:blur={() => setTimeout(() => keywordDropdownOpen = false, 200)}
                                        disabled={loadingKeywords}
                                    />
                                    
                                    {#if keywordDropdownOpen}
                                        <div class="dropdown-full">
                                            {#if loadingKeywords}
                                                <div class="dropdown-item loading">Loading keywords...</div>
                                            {:else if filteredKeywords.length === 0}
                                                <div class="dropdown-item loading">No keywords found</div>
                                            {:else}
                                                {#each filteredKeywords as keyword}
                                                    <button 
                                                        class="dropdown-item"
                                                        on:click={() => selectKeyword(keyword)}
                                                    >
                                                        {keyword}
                                                    </button>
                                                {/each}
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                        
                        <!-- Section 4: Sort Options -->
                        <div class="filter-section">
                            <div class="section-header">Sort By</div>
                            <div class="sort-controls">
                                <select class="sort-dropdown" bind:value={sortBy}>
                                    <option value="inclusion_votes">Inclusion Votes</option>
                                    <option value="content_votes">Content Votes</option>
                                    <option value="chronological">Date Created</option>
                                    <option value="latest_activity">Latest Activity</option>
                                    <option value="participants">Participants</option>
                                </select>
                                <button 
                                    class="direction-toggle"
                                    on:click={() => sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'}
                                    aria-label="Toggle sort direction"
                                >
                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                </button>
                            </div>
                        </div>
                        
                        <!-- Section 5: User Filter -->
                        <div class="filter-section">
                            <div class="section-header">User Filter</div>
                            <label class="checkbox-label">
                                <input 
                                    type="checkbox" 
                                    bind:checked={showOnlyMyItems}
                                />
                                <span>Show only my items</span>
                            </label>
                            
                            {#if showOnlyMyItems}
                                <select class="user-mode-dropdown" bind:value={userFilterMode}>
                                    <option value="all">All interactions</option>
                                    <option value="created">Created by me</option>
                                    <option value="voted">Voted on by me</option>
                                    <option value="interacted">Interacted with</option>
                                </select>
                            {/if}
                        </div>
                    </div>
                </div>
            </foreignObject>
        </svelte:fragment>

        <!-- Section 2: No inclusion voting for control node -->
        <!-- Section 3: No content voting for control node -->
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE - Minimal icon design -->
    <BasePreviewNode 
        node={nodeWithCorrectSize} 
        canExpand={false} 
        {nodeX}
        {nodeY}
        on:modeChange={handleModeChange}
    >
        <!-- REORGANIZED: Section 1 - Content Text (Icon display) -->
        <svelte:fragment slot="contentText" let:x let:y let:width let:height>
            <!-- Filter definition at content slot level -->
            <defs>
                <filter id={glowFilterId} x="-100%" y="-100%" width="300%" height="300%">
                    <!-- Strong outer glow -->
                    <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
                    <feFlood flood-color="white" flood-opacity="0.6" result="color1"/>
                    <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
                    
                    <!-- Medium glow -->
                    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
                    <feFlood flood-color="white" flood-opacity="0.8" result="color2"/>
                    <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
                    
                    <!-- Sharp inner glow -->
                    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
                    <feFlood flood-color="white" flood-opacity="1" result="color3"/>
                    <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
                    
                    <feMerge>
                        <feMergeNode in="shadow1"/>
                        <feMergeNode in="shadow2"/>
                        <feMergeNode in="shadow3"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <!-- svelte-ignore a11y-mouse-events-have-key-events -->
            <!-- Invisible hover detection area with proper accessibility -->
            <circle
                cx={0}
                cy={0}
                r={controlRadius}
                fill="transparent"
                class="hover-detection"
                on:mouseenter={() => isHovering = true}
                on:mouseleave={() => isHovering = false}
                on:click={handleModeChange}
                on:keydown={handlePreviewKeydown}
                tabindex="0"
                role="button"
                aria-label="Expand Controls"
                aria-pressed="false"
                style="cursor: pointer;"
            />
            
            <!-- Apply filter to parent <g>, not foreignObject -->
            <g style:filter={isHovering ? `url(#${glowFilterId})` : 'none'}>
                <foreignObject 
                    x={-controlRadius * 0.5} 
                    y={-controlRadius * 0.5} 
                    width={controlRadius} 
                    height={controlRadius}
                    class="icon-container"
                >
                    <div class="icon-wrapper" {...{"xmlns": "http://www.w3.org/1999/xhtml"}}>
                        <span 
                            class="material-symbols-outlined control-icon"
                            class:hovered={isHovering}
                            style:color={isHovering ? 'white' : 'white'}
                        >
                            graph_5
                        </span>
                    </div>
                </foreignObject>
            </g>
            
            <!-- Hover tooltip -->
            {#if isHovering}
                <g transform="translate(0, {controlRadius + 20})">
                    <rect
                        x={-50}
                        y={-10}
                        width="100"
                        height="20"
                        rx="4"
                        fill="rgba(0, 0, 0, 0.9)"
                        stroke="var(--color-border-primary)"
                        stroke-width="1"
                        class="tooltip-background"
                    />
                    <text
                        x={0}
                        y={3}
                        text-anchor="middle"
                        dominant-baseline="middle"
                        fill="white"
                        font-size="11"
                        font-weight="500"
                        font-family="Inter, system-ui, sans-serif"
                        class="tooltip-text"
                    >
                        Expand Controls
                    </text>
                </g>
            {/if}
        </svelte:fragment>

        <!-- Section 2: No inclusion voting for control node -->
        <!-- Section 3: No content voting for control node -->
    </BasePreviewNode>
{/if}

<style>
    /* [All the existing styles remain exactly the same] */
    /* Preview mode styles */
    .hover-detection {
        transition: all 0.2s ease;
        outline: none;
    }
    
    .hover-detection:focus {
        outline: 2px solid rgba(255, 255, 255, 0.3);
        outline-offset: 4px;
    }
    
    .icon-background {
        transition: all 0.2s ease;
        pointer-events: none;
    }
    
    .icon-background.hovered {
        fill: var(--color-background-tertiary);
        stroke-width: 2.5;
    }
    
    /* Icon container styling - critical for Material Icons */
    .icon-container {
        overflow: visible;
        pointer-events: none;
    }
    
    .icon-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }
    
    /* Material Icons styling */
    :global(.material-symbols-outlined.control-icon) {
        font-size: 28px;
        transition: color 0.3s ease;
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    :global(.material-symbols-outlined.control-icon.hovered) {
        font-size: 28px;
        font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 48;
    }
    
    .tooltip-background {
        filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
        pointer-events: none;
    }
    
    .tooltip-text {
        pointer-events: none;
        user-select: none;
        letter-spacing: 0.02em;
    }
    
    /* Detail mode control panel styles */
    .control-panel {
        padding: 6px 10px;
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        color: white;
        overflow: hidden;
        box-sizing: border-box;
    }
    
    /* Inner wrapper to reduce content width with side padding */
    .control-panel-inner {
        padding: 0 25px;
        box-sizing: border-box;
    }
    
    .filter-section {
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .filter-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }
    
    .section-header {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.8);
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .loading-indicator-inline {
        font-size: 9px;
        font-weight: 500;
        text-transform: none;
        color: rgba(66, 153, 225, 0.9);
        letter-spacing: 0;
        animation: spin-emoji 2s linear infinite;
    }
    
    @keyframes spin-emoji {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    /* Node type circles - condensed 2-row layout */
    .node-type-circles {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        justify-content: space-between;
        max-width: 100%;
    }
    
    /* Wrapper for circle + tooltip */
    .circle-wrapper {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }
    
    .circle-button {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        /* Use CSS variables set from NODE_CONSTANTS */
        background: var(--node-bg);
        border: 2px solid var(--node-border);
        color: rgba(255, 255, 255, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        padding: 0;
        flex-shrink: 0;
        opacity: 0.4;
    }
    
    /* Hover states - increase opacity and border thickness */
    .circle-button:hover {
        opacity: 1;
        border-width: 2.5px;
    }
    
    /* Selected states - vibrant and glowing */
    .circle-button.selected {
        opacity: 1;
        border-width: 2.5px;
        box-shadow: 0 0 8px var(--node-border);
        color: white;
        background: var(--node-bg-selected);
    }
    
    /* Disabled states */
    .circle-button.disabled {
        opacity: 0.4;
        cursor: not-allowed;
        pointer-events: none;
    }
    
    .circle-button.disabled.selected {
        opacity: 0.5;
    }
    
    .circle-label {
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.3px;
    }
    
    /* Hover tooltip for node type circles */
    .circle-tooltip {
        font-size: 8px;
        font-weight: 500;
        color: white;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
        text-align: center;
    }
    
    .circle-wrapper:hover .circle-tooltip {
        opacity: 1;
    }
    
    /* Manual Apply Button Section */
    .apply-controls {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.15);
        border-bottom: 1px solid rgba(255, 255, 255, 0.15);
        margin: 8px 0;
    }
    
    .apply-button {
        width: 100%;
        padding: 8px 16px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        
        /* Default state - no changes */
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.5);
    }
    
    .apply-button.has-changes {
        /* Has changes - ready to apply */
        background: rgba(66, 153, 225, 0.2);
        border: 1px solid rgba(66, 153, 225, 0.6);
        color: white;
        box-shadow: 0 0 12px rgba(66, 153, 225, 0.3);
    }
    
    .apply-button.has-changes:hover:not(:disabled) {
        background: rgba(66, 153, 225, 0.3);
        border-color: rgba(66, 153, 225, 0.8);
        box-shadow: 0 0 16px rgba(66, 153, 225, 0.4);
        transform: translateY(-1px);
    }
    
    .apply-button.loading {
        /* Loading state */
        background: rgba(100, 200, 100, 0.2);
        border: 1px solid rgba(100, 200, 100, 0.6);
        color: rgba(255, 255, 255, 0.8);
        cursor: wait;
    }
    
    .apply-button:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
    
    .apply-button .icon {
        font-size: 14px;
    }
    
    .apply-button .spinner {
        display: inline-block;
        animation: spin-button 1s linear infinite;
    }
    
    @keyframes spin-button {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .changes-hint {
        font-size: 9px;
        color: rgba(255, 200, 100, 0.8);
        text-align: center;
        font-style: italic;
        animation: pulse 1.5s ease-in-out infinite;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    
    /* Compact node types section */
    .filter-section.node-types {
        margin-bottom: 8px;
        padding-bottom: 6px;
    }
    
    /* Checkbox label for user filter */
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        padding: 3px 4px;
        border-radius: 3px;
        transition: background 0.2s;
    }
    
    .checkbox-label:hover {
        background: rgba(255, 255, 255, 0.05);
    }
    
    .checkbox-label input[type="checkbox"] {
        cursor: pointer;
        width: 14px;
        height: 14px;
    }
    
    .checkbox-label span {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.9);
    }
    
    /* Tag system for categories and keywords */
    .tag-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 6px;
    }
    
    .tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        background: rgba(66, 153, 225, 0.3);
        border: 1px solid rgba(66, 153, 225, 0.6);
        border-radius: 12px;
        font-size: 10px;
        color: white;
    }
    
    .tag-remove {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        padding: 0;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    }
    
    .tag-remove:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    /* Search input and dropdown container */
    .dropdown-container {
        position: relative;
        width: 100%;
    }
    
    /* Standardized search input - full width within container */
    .search-input-standard {
        width: 100%;
        padding: 5px 8px;
        font-size: 10px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        outline: none;
        transition: all 0.2s;
        box-sizing: border-box;
    }
    
    .search-input-standard:focus {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(66, 153, 225, 0.6);
    }
    
    .search-input-standard::placeholder {
        color: rgba(255, 255, 255, 0.4);
    }
    
    .search-input-standard:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    /* Full dropdown showing all options with scrolling */
    .dropdown-full {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 2px;
        background: rgba(20, 20, 30, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        max-height: 180px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    
    .dropdown-item {
        width: 100%;
        padding: 6px 8px;
        text-align: left;
        background: none;
        border: none;
        color: white;
        font-size: 10px;
        cursor: pointer;
        transition: background 0.2s;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .dropdown-item:last-child {
        border-bottom: none;
    }
    
    .dropdown-item:hover {
        background: rgba(66, 153, 225, 0.3);
    }
    
    .dropdown-item.loading {
        color: rgba(255, 255, 255, 0.5);
        cursor: default;
    }
    
    .dropdown-item.loading:hover {
        background: none;
    }
    
    /* Sort controls - standardized width */
    .sort-controls {
        display: flex;
        gap: 6px;
        align-items: center;
        width: 100%;
    }
    
    .sort-dropdown {
        flex: 1;
        padding: 5px 8px;
        font-size: 10px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        cursor: pointer;
        outline: none;
        box-sizing: border-box;
    }
    
    .sort-dropdown:focus {
        border-color: rgba(66, 153, 225, 0.6);
    }
    
    .direction-toggle {
        width: 32px;
        height: 28px;
        padding: 0;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    
    .direction-toggle:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.4);
    }
    
    /* User mode dropdown - standardized width */
    .user-mode-dropdown {
        width: 100%;
        margin-top: 6px;
        padding: 5px 8px;
        font-size: 10px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        cursor: pointer;
        outline: none;
        box-sizing: border-box;
    }
    
    .user-mode-dropdown:focus {
        border-color: rgba(66, 153, 225, 0.6);
    }
    
    /* Dropdown scrollbar */
    .dropdown-full::-webkit-scrollbar {
        width: 4px;
    }
    
    .dropdown-full::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }
    
    .dropdown-full::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
    }
</style>