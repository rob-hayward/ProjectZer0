<!-- src/lib/components/graph/nodes/controlNode/ControlNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import NodeHeader from '../ui/NodeHeader.svelte';
    
    // Props
    export let node: RenderableNode;
    
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
            includeNodeTypes: boolean;
            categories: string[];
            categoryMode: 'any' | 'all';
            includeCategoriesFilter: boolean;
            keywords: string[];
            keywordMode: 'any' | 'all';
            includeKeywordsFilter: boolean;
            sortBy: string;
            sortDirection: 'asc' | 'desc';
            showOnlyMyItems: boolean;
            userFilterMode: string;
        };
    }>();
    
    // Internal state - Track mode reactively
    $: isDetail = node.mode === 'detail';
    
    // Node type selection state
    let selectedNodeTypes = {
        statement: true,
        openquestion: true,
        answer: true,
        quantity: true,
        evidence: true
    };
    let includeNodeTypes = true;
    
    // Category filter state
    let selectedCategories: Array<{id: string; name: string}> = [];
    let categorySearch = '';
    let filteredCategories: Array<{id: string; name: string}> = [];
    let availableCategories: Array<{id: string; name: string}> = [];
    let categoryMode: 'any' | 'all' = 'any';
    let includeCategoriesFilter = true;
    
    // Keyword filter state
    let selectedKeywords: string[] = [];
    let keywordSearch = '';
    let filteredKeywords: string[] = [];
    let availableKeywords: string[] = [];
    let keywordMode: 'any' | 'all' = 'any';
    let includeKeywordsFilter = true;
    
    // Sort state
    let sortBy = 'inclusion_votes';
    let sortDirection: 'asc' | 'desc' = 'desc';
    
    // User filter state
    let showOnlyMyItems = false;
    let userFilterMode = 'all';
    
    // Debounce timer for filter changes
    let filterDebounceTimer: NodeJS.Timeout | null = null;
    
    // Hover state for preview mode
    let isHovering = false;
    
    // Unique filter ID (like InclusionVoteButtons)
    const glowFilterId = `control-glow-${Math.random().toString(36).slice(2)}`;
    
    // Control node has special sizes
    $: controlRadius = isDetail 
        ? COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 
        : COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2;
    
    // Create node with correct size (reactive)
    $: nodeWithCorrectSize = ({
        ...node,
        radius: isDetail 
            ? COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 
            : COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2
    });
    
    // Load available categories and keywords on mount
    onMount(async () => {
        await loadAvailableFilters();
    });
    
    async function loadAvailableFilters() {
        try {
            // TODO: Replace with actual API calls
            // const categoriesResponse = await fetch('/graph/universal/filters/categories');
            // availableCategories = await categoriesResponse.json();
            
            // const keywordsResponse = await fetch('/graph/universal/filters/keywords');
            // const keywordsData = await keywordsResponse.json();
            // availableKeywords = keywordsData.map((k: any) => k.word);
            
            // Placeholder data for testing
            availableCategories = [
                { id: 'cat-1', name: 'Technology' },
                { id: 'cat-2', name: 'Science' },
                { id: 'cat-3', name: 'Philosophy' },
                { id: 'cat-4', name: 'Ethics' },
                { id: 'cat-5', name: 'Politics' }
            ];
            
            availableKeywords = ['AI', 'ethics', 'climate', 'health', 'education', 'economy'];
        } catch (error) {
            console.error('[ControlNode] Failed to load filters:', error);
        }
    }
    
    function handleCategorySearch() {
        if (!categorySearch.trim()) {
            filteredCategories = [];
            return;
        }
        
        const search = categorySearch.toLowerCase();
        filteredCategories = availableCategories
            .filter(cat => 
                !selectedCategories.some(selected => selected.id === cat.id) &&
                cat.name.toLowerCase().includes(search)
            )
            .slice(0, 10); // Limit dropdown results
    }
    
    function addCategory(category: {id: string; name: string}) {
        if (selectedCategories.length < 5 && !selectedCategories.some(c => c.id === category.id)) {
            selectedCategories = [...selectedCategories, category];
            categorySearch = '';
            filteredCategories = [];
            triggerFilterUpdate();
        }
    }
    
    function removeCategory(categoryId: string) {
        selectedCategories = selectedCategories.filter(c => c.id !== categoryId);
        triggerFilterUpdate();
    }
    
    function handleKeywordSearch() {
        if (!keywordSearch.trim()) {
            filteredKeywords = [];
            return;
        }
        
        const search = keywordSearch.toLowerCase();
        filteredKeywords = availableKeywords
            .filter(kw => 
                !selectedKeywords.includes(kw) &&
                kw.toLowerCase().includes(search)
            )
            .slice(0, 10); // Limit dropdown results
    }
    
    function addKeyword(keyword: string) {
        if (selectedKeywords.length < 5 && !selectedKeywords.includes(keyword)) {
            selectedKeywords = [...selectedKeywords, keyword];
            keywordSearch = '';
            filteredKeywords = [];
            triggerFilterUpdate();
        }
    }
    
    function removeKeyword(keyword: string) {
        selectedKeywords = selectedKeywords.filter(kw => kw !== keyword);
        triggerFilterUpdate();
    }
    
    function triggerFilterUpdate() {
        // Debounce filter changes
        if (filterDebounceTimer) {
            clearTimeout(filterDebounceTimer);
        }
        
        filterDebounceTimer = setTimeout(() => {
            dispatchFilterChange();
        }, 500);
    }
    
    function dispatchFilterChange() {
        const activeNodeTypes = Object.entries(selectedNodeTypes)
            .filter(([_, isSelected]) => isSelected)
            .map(([type]) => type);
        
        dispatch('filterChange', {
            nodeTypes: activeNodeTypes,
            includeNodeTypes,
            categories: selectedCategories.map(c => c.id),
            categoryMode,
            includeCategoriesFilter,
            keywords: selectedKeywords,
            keywordMode,
            includeKeywordsFilter,
            sortBy,
            sortDirection,
            showOnlyMyItems,
            userFilterMode
        });
    }
    
    // Immediate dispatch for node types and sorting (no API call, just reorder)
    $: {
        selectedNodeTypes;
        includeNodeTypes;
        sortBy;
        sortDirection;
        
        if (isDetail) {
            dispatchFilterChange();
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
        
        // Prepare event data with position and nodeId (like ExpandCollapseButton)
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
        
        <svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
            <foreignObject {x} {y} {width} {height}>
                <div class="control-panel" {...{"xmlns": "http://www.w3.org/1999/xhtml"}}>
                    <!-- Section 1: Node Types -->
                    <div class="filter-section node-types">
                        <div class="section-header">Node Types</div>
                        <div class="node-type-circles">
                            <button 
                                class="circle-button"
                                class:selected={selectedNodeTypes.statement}
                                on:click={() => selectedNodeTypes.statement = !selectedNodeTypes.statement}
                                title="Statement"
                            >
                                <span class="circle-label">S</span>
                            </button>
                            <button 
                                class="circle-button"
                                class:selected={selectedNodeTypes.openquestion}
                                on:click={() => selectedNodeTypes.openquestion = !selectedNodeTypes.openquestion}
                                title="Question"
                            >
                                <span class="circle-label">Q</span>
                            </button>
                            <button 
                                class="circle-button"
                                class:selected={selectedNodeTypes.answer}
                                on:click={() => selectedNodeTypes.answer = !selectedNodeTypes.answer}
                                title="Answer"
                            >
                                <span class="circle-label">A</span>
                            </button>
                            <button 
                                class="circle-button"
                                class:selected={selectedNodeTypes.quantity}
                                on:click={() => selectedNodeTypes.quantity = !selectedNodeTypes.quantity}
                                title="Quantity"
                            >
                                <span class="circle-label">Qty</span>
                            </button>
                            <button 
                                class="circle-button"
                                class:selected={selectedNodeTypes.evidence}
                                on:click={() => selectedNodeTypes.evidence = !selectedNodeTypes.evidence}
                                title="Evidence"
                            >
                                <span class="circle-label">E</span>
                            </button>
                        </div>
                        <div class="mode-toggle-inline">
                            <label class="toggle-label-small">
                                <input type="checkbox" bind:checked={includeNodeTypes} />
                                <span>{includeNodeTypes ? 'Include' : 'Exclude'}</span>
                            </label>
                        </div>
                    </div>

                    <!-- Section 2: Categories -->
                    <div class="filter-section">
                        <div class="section-header">Categories (max 5)</div>
                        <div class="tag-input-container">
                            {#if selectedCategories.length < 5}
                                <input 
                                    type="text"
                                    class="search-input"
                                    placeholder="Search categories..."
                                    bind:value={categorySearch}
                                    on:input={handleCategorySearch}
                                />
                            {/if}
                            {#if categorySearch && filteredCategories.length > 0}
                                <div class="dropdown">
                                    {#each filteredCategories as category}
                                        <button 
                                            class="dropdown-item"
                                            on:click={() => addCategory(category)}
                                        >
                                            {category.name}
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                            <div class="tags">
                                {#each selectedCategories as category}
                                    <span class="tag">
                                        {category.name}
                                        <button class="tag-remove" on:click={() => removeCategory(category.id)}>×</button>
                                    </span>
                                {/each}
                            </div>
                        </div>
                        {#if selectedCategories.length > 1}
                            <div class="mode-toggle">
                                <label class="toggle-label">
                                    <input type="radio" bind:group={categoryMode} value="any" />
                                    <span>ANY</span>
                                </label>
                                <label class="toggle-label">
                                    <input type="radio" bind:group={categoryMode} value="all" />
                                    <span>ALL</span>
                                </label>
                            </div>
                        {/if}
                        <div class="mode-toggle">
                            <label class="toggle-label">
                                <input type="checkbox" bind:checked={includeCategoriesFilter} />
                                <span>{includeCategoriesFilter ? 'Include' : 'Exclude'}</span>
                            </label>
                        </div>
                    </div>

                    <!-- Section 3: Keywords -->
                    <div class="filter-section">
                        <div class="section-header">Keywords (max 5)</div>
                        <div class="tag-input-container">
                            {#if selectedKeywords.length < 5}
                                <input 
                                    type="text"
                                    class="search-input"
                                    placeholder="Search keywords..."
                                    bind:value={keywordSearch}
                                    on:input={handleKeywordSearch}
                                />
                            {/if}
                            {#if keywordSearch && filteredKeywords.length > 0}
                                <div class="dropdown">
                                    {#each filteredKeywords as keyword}
                                        <button 
                                            class="dropdown-item"
                                            on:click={() => addKeyword(keyword)}
                                        >
                                            {keyword}
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                            <div class="tags">
                                {#each selectedKeywords as keyword}
                                    <span class="tag">
                                        {keyword}
                                        <button class="tag-remove" on:click={() => removeKeyword(keyword)}>×</button>
                                    </span>
                                {/each}
                            </div>
                        </div>
                        {#if selectedKeywords.length > 1}
                            <div class="mode-toggle">
                                <label class="toggle-label">
                                    <input type="radio" bind:group={keywordMode} value="any" />
                                    <span>ANY</span>
                                </label>
                                <label class="toggle-label">
                                    <input type="radio" bind:group={keywordMode} value="all" />
                                    <span>ALL</span>
                                </label>
                            </div>
                        {/if}
                        <div class="mode-toggle">
                            <label class="toggle-label">
                                <input type="checkbox" bind:checked={includeKeywordsFilter} />
                                <span>{includeKeywordsFilter ? 'Include' : 'Exclude'}</span>
                            </label>
                        </div>
                    </div>

                    <!-- Section 4: Sorting -->
                    <div class="filter-section">
                        <div class="section-header">Sort By</div>
                        <select class="sort-select" bind:value={sortBy}>
                            <option value="inclusion_votes">Inclusion Votes</option>
                            <option value="content_votes">Content Votes</option>
                            <option value="chronological">Date Created</option>
                            <option value="latest_activity">Latest Activity</option>
                            <option value="participants">Participants</option>
                            <option value="total_votes">Total Votes</option>
                        </select>
                        <div class="mode-toggle">
                            <label class="toggle-label">
                                <input type="radio" bind:group={sortDirection} value="desc" />
                                <span>↓ Desc</span>
                            </label>
                            <label class="toggle-label">
                                <input type="radio" bind:group={sortDirection} value="asc" />
                                <span>↑ Asc</span>
                            </label>
                        </div>
                    </div>

                    <!-- Section 5: User Filter -->
                    <div class="filter-section">
                        <label class="toggle-label">
                            <input type="checkbox" bind:checked={showOnlyMyItems} />
                            <span>Show only my items</span>
                        </label>
                        {#if showOnlyMyItems}
                            <select class="sort-select" bind:value={userFilterMode}>
                                <option value="all">All interactions</option>
                                <option value="created">Created by me</option>
                                <option value="voted">Voted on by me</option>
                                <option value="interacted">Interacted with</option>
                            </select>
                        {/if}
                    </div>
                </div>
            </foreignObject>
        </svelte:fragment>
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
        <svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
            <!-- Filter definition at content slot level (like InclusionVoteButtons) -->
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
            
            <!-- Background circle for icon -->
            <circle
                cx={0}
                cy={0}
                r={controlRadius * 0.75}
                fill="var(--color-background-secondary)"
                stroke="var(--color-border-primary)"
                stroke-width="2"
                class="icon-background"
                class:hovered={isHovering}
            />
            
            <!-- CRITICAL: Apply filter to parent <g>, not foreignObject (like InclusionVoteButtons) -->
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
    </BasePreviewNode>
{/if}

<style>
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
        width: 100%;
        height: 100%;
        padding: 6px;
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        color: white;
        overflow-y: auto;
        overflow-x: hidden;
    }
    
    .filter-section {
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .filter-section.node-types {
        margin-bottom: 6px;
        padding-bottom: 4px;
    }
    
    .filter-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
    }
    
    .section-header {
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.7);
        margin-bottom: 4px;
    }
    
    .node-type-circles {
        display: flex;
        gap: 6px;
        margin-bottom: 4px;
        justify-content: space-between;
    }
    
    .circle-button {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        padding: 0;
    }
    
    .circle-button:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.4);
    }
    
    .circle-button.selected {
        background: rgba(66, 153, 225, 0.3);
        border-color: rgba(66, 153, 225, 0.8);
        color: white;
    }
    
    .circle-label {
        font-size: 9px;
        font-weight: 600;
    }
    
    .mode-toggle-inline {
        display: flex;
        gap: 6px;
        margin-top: 3px;
    }
    
    .toggle-label-small {
        display: flex;
        align-items: center;
        gap: 3px;
        cursor: pointer;
        font-size: 9px;
    }
    
    .toggle-label-small input {
        cursor: pointer;
    }
    
    .node-type-checkboxes {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        margin-bottom: 6px;
    }
    
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        padding: 2px;
    }
    
    .checkbox-label input[type="checkbox"],
    .checkbox-label input[type="radio"] {
        cursor: pointer;
    }
    
    .checkbox-label span {
        font-size: 10px;
    }
    
    .mode-toggle {
        display: flex;
        gap: 8px;
        margin-top: 4px;
        flex-wrap: wrap;
    }
    
    .toggle-label {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        font-size: 10px;
    }
    
    .tag-input-container {
        position: relative;
        max-width: 280px;
    }
    
    .search-input {
        width: 100%;
        max-width: 280px;
        padding: 3px 5px;
        font-size: 9px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        color: white;
        margin-bottom: 3px;
    }
    
    .search-input::placeholder {
        color: rgba(255, 255, 255, 0.4);
    }
    
    .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        max-width: 280px;
        max-height: 100px;
        overflow-y: auto;
        background: rgba(20, 20, 20, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        z-index: 1000;
        margin-top: 2px;
    }
    
    .dropdown-item {
        width: 100%;
        padding: 3px 6px;
        font-size: 9px;
        text-align: left;
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        transition: background 0.15s;
    }
    
    .dropdown-item:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    
    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        margin-top: 3px;
        min-height: 18px;
    }
    
    .tag {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 5px;
        background: rgba(66, 153, 225, 0.3);
        border: 1px solid rgba(66, 153, 225, 0.5);
        border-radius: 3px;
        font-size: 8px;
        color: white;
    }
    
    .tag-remove {
        background: none;
        border: none;
        color: white;
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        margin: 0;
        opacity: 0.7;
        transition: opacity 0.15s;
    }
    
    .tag-remove:hover {
        opacity: 1;
    }
    
    .sort-select {
        width: 100%;
        max-width: 280px;
        padding: 3px;
        font-size: 9px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        color: white;
        margin-bottom: 3px;
        cursor: pointer;
    }
    
    .sort-select option {
        background: #1a1a1a;
        color: white;
    }
</style>