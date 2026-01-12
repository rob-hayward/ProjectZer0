<!-- src/lib/components/graph/nodes/controlNode/ControlNode.svelte -->
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
    export let currentNodeTypes: Set<string> | undefined = undefined;
    export let currentSortBy: string | undefined = undefined;
    export let currentSortDirection: 'asc' | 'desc' | undefined = undefined;
    export let currentKeywords: string[] | undefined = undefined;
    export let currentShowOnlyMyItems: boolean | undefined = undefined;
    export let currentUserFilterMode: string | undefined = undefined;
    
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
        evidence: true,
        word: false,
        category: false,
        definition: false
    };

    // NEW: Update selectedNodeTypes when currentNodeTypes prop changes
    $: if (currentNodeTypes) {
        selectedNodeTypes = {
            statement: currentNodeTypes.has('statement'),
            openquestion: currentNodeTypes.has('openquestion'),
            answer: currentNodeTypes.has('answer'),
            quantity: currentNodeTypes.has('quantity'),
            evidence: currentNodeTypes.has('evidence'),
            word: currentNodeTypes.has('word'),
            category: currentNodeTypes.has('category'),
            definition: currentNodeTypes.has('definition')
        };
    }

    
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
    
    // Dropdown positioning state for fixed positioning
    let categoryInputRef: HTMLInputElement | null = null;
    let keywordInputRef: HTMLInputElement | null = null;
    let categoryDropdownPosition = { top: 0, left: 0, width: 0 };
    let keywordDropdownPosition = { top: 0, left: 0, width: 0 };
    
    // Dropdown portal containers (attached to document.body to escape SVG)
    let categoryDropdownContainer: HTMLDivElement | null = null;
    let keywordDropdownContainer: HTMLDivElement | null = null;
    
    // Create dropdown containers on mount
    onMount(() => {
        // Create category dropdown container
        categoryDropdownContainer = document.createElement('div');
        categoryDropdownContainer.id = 'control-category-dropdown';
        categoryDropdownContainer.style.cssText = 'position: fixed; z-index: 100000; pointer-events: auto;';
        document.body.appendChild(categoryDropdownContainer);
        
        // Create keyword dropdown container
        keywordDropdownContainer = document.createElement('div');
        keywordDropdownContainer.id = 'control-keyword-dropdown';
        keywordDropdownContainer.style.cssText = 'position: fixed; z-index: 100000; pointer-events: auto;';
        document.body.appendChild(keywordDropdownContainer);
        
        return () => {
            // Cleanup on destroy
            if (categoryDropdownContainer) {
                document.body.removeChild(categoryDropdownContainer);
            }
            if (keywordDropdownContainer) {
                document.body.removeChild(keywordDropdownContainer);
            }
        };
    });
    
    // Calculate dropdown position when it opens
    function updateCategoryDropdownPosition() {
        if (categoryInputRef) {
            const rect = categoryInputRef.getBoundingClientRect();
            categoryDropdownPosition = {
                top: rect.bottom + 2,
                left: rect.left,
                width: rect.width
            };
        }
    }
    
    function updateKeywordDropdownPosition() {
        if (keywordInputRef) {
            const rect = keywordInputRef.getBoundingClientRect();
            keywordDropdownPosition = {
                top: rect.bottom + 2,
                left: rect.left,
                width: rect.width
            };
        }
    }
    
    // Reactive: Render category dropdown
    $: if (categoryDropdownContainer && categoryDropdownOpen) {
        const html = `
            <div class="dropdown-portal" style="top: ${categoryDropdownPosition.top}px; left: ${categoryDropdownPosition.left}px; width: ${categoryDropdownPosition.width}px;">
                ${loadingCategories ? 
                    '<div class="dropdown-item loading">Loading categories...</div>' :
                    filteredCategories.length === 0 ?
                    '<div class="dropdown-item loading">No categories found</div>' :
                    filteredCategories.map(cat => 
                        `<button class="dropdown-item" data-category-id="${cat.id}">${cat.name}</button>`
                    ).join('')
                }
            </div>
        `;
        categoryDropdownContainer.innerHTML = html;
        
        // Add click handlers
        categoryDropdownContainer.querySelectorAll('[data-category-id]').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const categoryId = (e.target as HTMLElement).getAttribute('data-category-id');
                const category = filteredCategories.find(c => c.id === categoryId);
                if (category) selectCategory(category);
            });
        });
    } else if (categoryDropdownContainer) {
        categoryDropdownContainer.innerHTML = '';
    }
    
    // Reactive: Render keyword dropdown
    $: if (keywordDropdownContainer && keywordDropdownOpen) {
        const html = `
            <div class="dropdown-portal" style="top: ${keywordDropdownPosition.top}px; left: ${keywordDropdownPosition.left}px; width: ${keywordDropdownPosition.width}px;">
                ${loadingKeywords ? 
                    '<div class="dropdown-item loading">Loading keywords...</div>' :
                    filteredKeywords.length === 0 ?
                    '<div class="dropdown-item loading">No keywords found</div>' :
                    filteredKeywords.map(kw => 
                        `<button class="dropdown-item" data-keyword="${kw}">${kw}</button>`
                    ).join('')
                }
            </div>
        `;
        keywordDropdownContainer.innerHTML = html;
        
        // Add click handlers
        keywordDropdownContainer.querySelectorAll('[data-keyword]').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const keyword = (e.target as HTMLElement).getAttribute('data-keyword');
                if (keyword) selectKeyword(keyword);
            });
        });
    } else if (keywordDropdownContainer) {
        keywordDropdownContainer.innerHTML = '';
    }
    
    // Sort state
    let sortBy = 'inclusion_votes';
    let sortDirection: 'asc' | 'desc' = 'desc';
    
    // User filter state
    let showOnlyMyItems = false;
    let userFilterMode = 'all';
    
    // NEW: Sync state from props
    $: if (currentKeywords) {
        selectedKeywords = [...currentKeywords];
    }

    $: if (currentSortBy !== undefined) {
        const sortByReverseMapping: Record<string, string> = {
            'netVotes': 'inclusion_votes',
            'chronological': 'chronological',
            'participants': 'participants'
        };
        sortBy = sortByReverseMapping[currentSortBy] || 'inclusion_votes';
    }

    $: if (currentSortDirection !== undefined) {
        sortDirection = currentSortDirection;
    }

    $: if (currentShowOnlyMyItems !== undefined) {
        showOnlyMyItems = currentShowOnlyMyItems;
    }

    $: if (currentUserFilterMode !== undefined) {
        userFilterMode = currentUserFilterMode;
    }
    
    // Auto-apply debounce state (only used in auto mode)
    let filterDebounceTimer: NodeJS.Timeout | null = null;
    const DEBOUNCE_DELAY = 1000;  // 1 second
    
    // Manual apply state (only used in manual mode)
    let hasPendingChanges = false;
    
    // Hover state for preview mode AND detail mode button
    let isHovering = false;
    let isApplyButtonHovering = false;
    
    // Unique filter IDs
    const glowFilterId = `control-glow-${Math.random().toString(36).slice(2)}`;
    const applyGlowFilterId = `control-apply-glow-${Math.random().toString(36).slice(2)}`;
    
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
        const typeMap: { [key: string]: 'STATEMENT' | 'OPENQUESTION' | 'ANSWER' | 'QUANTITY' | 'EVIDENCE' | 'WORD' | 'CATEGORY' | 'DEFINITION' } = {
            'statement': 'STATEMENT',
            'openquestion': 'OPENQUESTION',
            'answer': 'ANSWER',
            'quantity': 'QUANTITY',
            'evidence': 'EVIDENCE',
            'word': 'WORD',
            'category': 'CATEGORY',
            'definition': 'DEFINITION'
        };
        
        const constantKey = typeMap[nodeType];
        const colors = NODE_CONSTANTS.COLORS[constantKey];
        
        // ✅ Handle nested DEFINITION structure
        if (constantKey === 'DEFINITION') {
            return (colors as any).live; // Use 'live' variant for control node
        }
        
        return colors as {
            background: string;
            border: string;
            text: string;
            hover: string;
            gradient: { start: string; end: string };
        };
    }
    
    // Helper function to increase opacity of a hex color for selected state
    function getSelectedBackground(backgroundColor: string): string {
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
            const categories = await categoryListStore.loadAllCategories();
            availableCategories = categories; // Store already returns Category[] with { id, name }
            console.log('[ControlNode] âœ… Loaded', availableCategories.length, 'categories');
        } catch (error) {
            console.error('[ControlNode] âŒ Error loading categories:', error);
            availableCategories = [];
        } finally {
            loadingCategories = false;
        }
        
        // Load keywords using store (with caching)
        loadingKeywords = true;
        try {
            const keywords = await wordListStore.loadAllWords();
            availableKeywords = keywords; // Store already returns string[]
            console.log('[ControlNode] âœ… Loaded', availableKeywords.length, 'keywords');
        } catch (error) {
            console.error('[ControlNode] âŒ Error loading keywords:', error);
            availableKeywords = [];
        } finally {
            loadingKeywords = false;
        }
    }
    
    // Filter categories based on search - show ALL matches, sorted alphabetically
    $: filteredCategories = categorySearch.trim()
        ? availableCategories
            .filter(cat => 
                cat.name.toLowerCase().includes(categorySearch.toLowerCase()) &&
                !selectedCategories.some(sel => sel.id === cat.id)
            )
            .sort((a, b) => a.name.localeCompare(b.name))
        : availableCategories
            .filter(cat => !selectedCategories.some(sel => sel.id === cat.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    
    // Debug logging
    $: console.log('[ControlNode] Category filter update:', {
        availableCount: availableCategories.length,
        selectedCount: selectedCategories.length,
        searchTerm: categorySearch,
        filteredCount: filteredCategories.length,
        dropdownOpen: categoryDropdownOpen
    });
    
    // Filter keywords based on search - show ALL matches, sorted alphabetically
    $: filteredKeywords = keywordSearch.trim()
        ? availableKeywords
            .filter(kw => 
                kw.toLowerCase().includes(keywordSearch.toLowerCase()) &&
                !selectedKeywords.includes(kw)
            )
            .sort((a, b) => a.localeCompare(b))
        : availableKeywords
            .filter(kw => !selectedKeywords.includes(kw))
            .sort((a, b) => a.localeCompare(b));
    
    // Debug logging
    $: console.log('[ControlNode] Keyword filter update:', {
        availableCount: availableKeywords.length,
        selectedCount: selectedKeywords.length,
        searchTerm: keywordSearch,
        filteredCount: filteredKeywords.length,
        dropdownOpen: keywordDropdownOpen
    });
    
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
        
        const eventData: { 
            mode: NodeMode; 
            position?: { x: number; y: number };
            nodeId?: string;
        } = { mode: newMode };
        
        if (nodeX !== undefined && nodeY !== undefined) {
            eventData.position = { x: nodeX, y: nodeY };
        }
        
        eventData.nodeId = node.id;
        
        dispatch('modeChange', eventData);
    }
    
    function handlePreviewKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleModeChange();
        }
    }

    function handleApplyKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            applyFiltersManually();
        }
    }

    // Get icon for apply button based on state
    $: applyButtonIcon = 'graph_5';
    $: applyButtonColor = isLoading ? 'rgba(100, 200, 100, 0.9)' : hasPendingChanges ? 'rgba(66, 153, 225, 0.9)' : 'rgba(255, 255, 255, 0.3)';
    $: applyTooltipText = isLoading ? 'Applying Filters...' : hasPendingChanges ? 'Apply Filters' : 'No Changes';
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
            <!-- Main control panel in foreignObject -->
            <foreignObject {x} {y} {width} {height}>
                <div class="control-panel" {...{"xmlns": "http://www.w3.org/1999/xhtml"}} style="width: {width}px; height: {height}px; padding-top: {height * 0.15}px;">
                    <div class="control-panel-inner">
                        <!-- Section 1: Node Types (Circular buttons in 2 rows, condensed spacing) -->
                        <div class="filter-section node-types">
                            <div class="section-header">
                                Node Types
                                {#if isLoading}
                                    <span class="loading-indicator-inline">ðŸ”„ Applying...</span>
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
                                        <span class="circle-label">S</span>
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
                                        <span class="circle-label">E</span>
                                    </button>
                                    <span class="circle-tooltip">Evidence</span>
                                </div>

                                <!-- Category -->
                                <div class="circle-wrapper">
                                    <button 
                                        class="circle-button"
                                        class:selected={selectedNodeTypes.category}
                                        class:disabled={isLoading}
                                        disabled={isLoading}
                                        on:click={() => selectedNodeTypes.category = !selectedNodeTypes.category}
                                        aria-label="Category"
                                        data-node-type="category"
                                        style="
                                            --node-bg: {getNodeTypeColors('category').background};
                                            --node-bg-selected: {getSelectedBackground(getNodeTypeColors('category').background)};
                                            --node-border: {getNodeTypeColors('category').border};
                                            --node-text: {getNodeTypeColors('category').text};
                                        "
                                    >
                                        <span class="circle-label">C</span>
                                    </button>
                                    <span class="circle-tooltip">Category</span>
                                </div>
                                
                                <!-- Word -->
                                <div class="circle-wrapper">
                                    <button 
                                        class="circle-button"
                                        class:selected={selectedNodeTypes.word}
                                        class:disabled={isLoading}
                                        disabled={isLoading}
                                        on:click={() => selectedNodeTypes.word = !selectedNodeTypes.word}
                                        aria-label="Word"
                                        data-node-type="word"
                                        style="
                                            --node-bg: {getNodeTypeColors('word').background};
                                            --node-bg-selected: {getSelectedBackground(getNodeTypeColors('word').background)};
                                            --node-border: {getNodeTypeColors('word').border};
                                            --node-text: {getNodeTypeColors('word').text};
                                        "
                                    >
                                        <span class="circle-label">W</span>
                                    </button>
                                    <span class="circle-tooltip">Word</span>
                                </div>
                                
                                <!-- Definition -->
                                <div class="circle-wrapper">
                                    <button 
                                        class="circle-button"
                                        class:selected={selectedNodeTypes.definition}
                                        class:disabled={isLoading}
                                        disabled={isLoading}
                                        on:click={() => selectedNodeTypes.definition = !selectedNodeTypes.definition}
                                        aria-label="Definition"
                                        data-node-type="definition"
                                        style="
                                            --node-bg: {getNodeTypeColors('definition').background};
                                            --node-bg-selected: {getSelectedBackground(getNodeTypeColors('definition').background)};
                                            --node-border: {getNodeTypeColors('definition').border};
                                            --node-text: {getNodeTypeColors('definition').text};
                                        "
                                    >
                                        <span class="circle-label">D</span>
                                    </button>
                                    <span class="circle-tooltip">Definition</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Section 2: Categories (Searchable dropdown showing all options) -->
                        <div class="filter-section">
                            <div class="section-header">Categories {selectedCategories.length > 0 ? `(${selectedCategories.length}/5)` : ''}</div>
                            
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
                            
                            {#if selectedCategories.length < 5}
                                <div class="dropdown-container">
                                    <input 
                                        bind:this={categoryInputRef}
                                        type="text"
                                        class="search-input-standard"
                                        placeholder="Search or select..."
                                        bind:value={categorySearch}
                                        on:focus={() => {
                                            console.log('[ControlNode] Category input focused');
                                            categoryDropdownOpen = true;
                                            updateCategoryDropdownPosition();
                                        }}
                                        on:blur={(e) => {
                                            console.log('[ControlNode] Category input blur');
                                            setTimeout(() => {
                                                categoryDropdownOpen = false;
                                            }, 250);
                                        }}
                                        disabled={loadingCategories}
                                    />
                                    <!-- Dropdown will render outside SVG -->
                                </div>
                            {/if}
                        </div>
                        
                        <!-- Section 3: Keywords (Searchable dropdown showing all options) -->
                        <div class="filter-section">
                            <div class="section-header">Keywords {selectedKeywords.length > 0 ? `(${selectedKeywords.length}/5)` : ''}</div>
                            
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
                            
                            {#if selectedKeywords.length < 5}
                                <div class="dropdown-container">
                                    <input 
                                        bind:this={keywordInputRef}
                                        type="text"
                                        class="search-input-standard"
                                        placeholder="Search or select..."
                                        bind:value={keywordSearch}
                                        on:focus={() => {
                                            console.log('[ControlNode] Keyword input focused');
                                            keywordDropdownOpen = true;
                                            updateKeywordDropdownPosition();
                                        }}
                                        on:blur={() => {
                                            console.log('[ControlNode] Keyword input blur');
                                            setTimeout(() => {
                                                keywordDropdownOpen = false;
                                            }, 250);
                                        }}
                                        disabled={loadingKeywords}
                                    />
                                    <!-- Dropdown will render outside SVG -->
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

            <!-- Apply Filters Button (positioned at bottom, only in manual mode) -->
            {#if applyMode === 'manual'}
                <!-- Filter definitions -->
                <defs>
                    <filter id={applyGlowFilterId} x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
                        <feFlood flood-color={applyButtonColor} flood-opacity="0.6" result="color1"/>
                        <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
                        
                        <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
                        <feFlood flood-color={applyButtonColor} flood-opacity="0.8" result="color2"/>
                        <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
                        
                        <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
                        <feFlood flood-color={applyButtonColor} flood-opacity="1" result="color3"/>
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
                <circle
                    cx={0}
                    cy={controlRadius - 40}
                    r={30}
                    fill="transparent"
                    class="apply-button-detection"
                    on:mouseenter={() => isApplyButtonHovering = true}
                    on:mouseleave={() => isApplyButtonHovering = false}
                    on:click={applyFiltersManually}
                    on:keydown={handleApplyKeydown}
                    tabindex="0"
                    role="button"
                    aria-label={applyTooltipText}
                    aria-pressed="false"
                    style="cursor: {hasPendingChanges && !isLoading ? 'pointer' : 'default'};"
                    class:disabled={!hasPendingChanges || isLoading}
                />

                <g style:filter={(isApplyButtonHovering && hasPendingChanges && !isLoading) ? `url(#${applyGlowFilterId})` : 'none'}>
                    <foreignObject 
                        x={-20}
                        y={controlRadius - 60}
                        width={40}
                        height={40}
                        class="apply-icon-container"
                    >
                        <div class="apply-icon-wrapper" {...{"xmlns": "http://www.w3.org/1999/xhtml"}}>
                            <span 
                                class="material-symbols-outlined apply-icon"
                                class:hovered={isApplyButtonHovering && hasPendingChanges}
                                class:loading={isLoading}
                                class:pending={hasPendingChanges && !isLoading}
                                style:color={applyButtonColor}
                            >
                                {applyButtonIcon}
                            </span>
                        </div>
                    </foreignObject>
                </g>

                <!-- Tooltip -->
                {#if isApplyButtonHovering}
                    <g transform="translate(0, {controlRadius + 10})">
                        <rect
                            x={-50}
                            y={-10}
                            width="100"
                            height="20"
                            rx="4"
                            fill="rgba(0, 0, 0, 0.9)"
                            class="apply-tooltip-background"
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
                            class="apply-tooltip-text"
                        >
                            {applyTooltipText}
                        </text>
                    </g>
                {/if}
            {/if}
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
                    <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
                    <feFlood flood-color="white" flood-opacity="0.6" result="color1"/>
                    <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
                    
                    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
                    <feFlood flood-color="white" flood-opacity="0.8" result="color2"/>
                    <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
                    
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
    /* Preview mode styles */
    .hover-detection {
        transition: all 0.2s ease;
        outline: none;
    }
    
    .hover-detection:focus {
        outline: 2px solid rgba(255, 255, 255, 0.3);
        outline-offset: 4px;
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

    /* Apply button styles (positioned at bottom in detail mode) */
    .apply-button-detection {
        transition: all 0.2s ease;
        outline: none;
    }

    .apply-button-detection:focus {
        outline: 2px solid rgba(255, 255, 255, 0.3);
        outline-offset: 4px;
    }

    .apply-button-detection.disabled {
        cursor: not-allowed !important;
        opacity: 0.5;
    }

    .apply-icon-container {
        overflow: visible;
        pointer-events: none;
    }

    .apply-icon-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    :global(.material-symbols-outlined.apply-icon) {
        font-size: 32px;
        transition: all 0.3s ease;
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    :global(.material-symbols-outlined.apply-icon.hovered.pending) {
        font-size: 36px;
        font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 48;
    }

    :global(.material-symbols-outlined.apply-icon.loading) {
        animation: spin 2s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .tooltip-background,
    .apply-tooltip-background {
        filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
        pointer-events: none;
    }
    
    .tooltip-text,
    .apply-tooltip-text {
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
    
    .control-panel-inner {
        padding: 0 5px;
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
    
    .node-type-circles {
        display: flex;
        flex-wrap: nowrap;  /* ✅ Changed from wrap to nowrap */
        gap: 6px;           /* ✅ Reduced gap slightly for tighter spacing */
        justify-content: center;  /* ✅ Center the buttons */
        max-width: 100%;
    }
    
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
    
    .circle-button:hover {
        opacity: 1;
        border-width: 2.5px;
    }
    
    .circle-button.selected {
        opacity: 1;
        border-width: 2.5px;
        box-shadow: 0 0 8px var(--node-border);
        color: white;
        background: var(--node-bg-selected);
    }
    
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
    
    .filter-section.node-types {
        margin-bottom: 8px;
        padding-bottom: 6px;
    }
    
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
    
    .dropdown-container {
        position: relative;
        width: 100%;
    }
    
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
    
    .dropdown-portal {
        position: fixed;  /* Fixed positioning now works since we're outside SVG */
        margin-top: 0;  /* Position is set via inline styles */
        background: rgba(20, 20, 30, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        max-height: 180px;
        overflow-y: auto;
        z-index: 100000;  /* Above everything including blocking overlay */
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
    
    .dropdown-portal::-webkit-scrollbar {
        width: 4px;
    }
    
    .dropdown-portal::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }
    
    .dropdown-portal::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
    }
    
    /* Global styles for dropdowns rendered to document.body */
    :global(#control-category-dropdown .dropdown-portal),
    :global(#control-keyword-dropdown .dropdown-portal) {
        position: fixed;
        background: rgba(20, 20, 30, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        max-height: 180px;
        overflow-y: auto;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        pointer-events: auto;
    }
    
    :global(#control-category-dropdown .dropdown-item),
    :global(#control-keyword-dropdown .dropdown-item) {
        display: block;
        width: 100%;
        padding: 8px 12px;
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.9);
        font-size: 11px;
        text-align: left;
        cursor: pointer;
        transition: background 0.2s;
    }
    
    :global(#control-category-dropdown .dropdown-item:hover),
    :global(#control-keyword-dropdown .dropdown-item:hover) {
        background: rgba(66, 153, 225, 0.2);
    }
    
    :global(#control-category-dropdown .dropdown-item.loading),
    :global(#control-keyword-dropdown .dropdown-item.loading) {
        color: rgba(255, 255, 255, 0.5);
        cursor: default;
        font-style: italic;
    }
</style>