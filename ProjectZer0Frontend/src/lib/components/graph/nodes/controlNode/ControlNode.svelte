<!-- src/lib/components/graph/nodes/controlNode/ControlNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import NodeHeader from '../ui/NodeHeader.svelte';
    import ContentBox from '../ui/ContentBox.svelte';
    import type { NetworkSortType, NetworkSortDirection } from '$lib/stores/statementNetworkStore';
    
    // Props
    export let node: RenderableNode;
    export let sortType: NetworkSortType = 'netPositive';
    export let sortDirection: NetworkSortDirection = 'desc';
    export let keywords: string[] = [];
    export let keywordOperator: string = 'OR';
    export let showOnlyMyItems: boolean = false;
    export let availableKeywords: string[] = [];
    
    // Internal state - Track mode reactively
    $: isDetail = node.mode === 'detail';
    
    // Form state variables
    let keywordInput = '';
    let keywordSearchResults: string[] = [];
    let searchTimeout: NodeJS.Timeout | null = null;
    let pendingChanges = false;
    let keywordError: string | null = null;
    let keywordExists = false;
    
    // Hover state for preview mode
    let isHovering = false;
    
    // Control node has special sizes
    $: controlRadius = isDetail 
        ? COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 
        : COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2;
    
    // Create a derived node with proper size
    $: nodeWithCorrectSize = {
        ...node,
        radius: controlRadius,
        style: {
            ...node.style,
            previewSize: COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2,
            detailSize: COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2
        }
    };
    
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
    
    // Function to handle mode changes
    function handleModeChange() {
        // Apply any pending changes on collapse
        if (isDetail && pendingChanges) {
            applyChanges();
        }
        
        const newMode: NodeMode = isDetail ? 'preview' : 'detail';
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
    }
    
    // Handle keyword input changes with debounce
    function handleKeywordInputChange(event: Event) {
        keywordError = null;
        keywordExists = false;
        
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
        
        // Create a combined list with priority order
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
    
    // Handle keyboard events for the preview node button
    function handlePreviewKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleModeChange();
        }
    }
    
    onMount(async () => {
        console.debug('[ControlNode] Mounted with:', {
            id: node.id,
            mode: node.mode,
            radius: node.radius,
            isDetail,
            correctRadius: nodeWithCorrectSize.radius
        });
        
        // Initialize working copies
        editSortType = sortType;
        editSortDirection = sortDirection;
        editKeywords = [...keywords];
        editKeywordOperator = keywordOperator;
        editShowOnlyMyItems = showOnlyMyItems;
    });
    
    // Debug logging for mode changes
    $: console.debug('[ControlNode] Mode/size update:', {
        mode: node.mode,
        isDetail,
        nodeRadius: node.radius,
        correctRadius: isDetail 
            ? COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 
            : COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2
    });
</script>

{#if isDetail}
    <!-- DETAIL MODE - Keep existing implementation for now -->
    <BaseDetailNode node={nodeWithCorrectSize} on:modeChange={handleModeChange}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="Graph Controls" {radius} mode="detail" />
        </svelte:fragment>
        
        <svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
            <!-- We'll implement the full detail view in the next step -->
            <text 
                x={0}
                y={0}
                class="detail-placeholder"
                text-anchor="middle"
                fill="var(--color-text-primary)"
                font-size="16"
            >
                Detail Mode
            </text>
            <text 
                x={0}
                y={25}
                class="detail-placeholder"
                text-anchor="middle"
                fill="var(--color-text-secondary)"
                font-size="12"
            >
                (Full controls coming next)
            </text>
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE - New minimal icon design -->
    <BasePreviewNode node={nodeWithCorrectSize} canExpand={false} on:modeChange={handleModeChange}>
        <svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
            <!-- Glow filter definition (exact pattern from NavigationNode) -->
            <defs>
                <filter id="control-icon-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <!-- Strong outer glow -->
                    <feGaussianBlur in="SourceAlpha" stdDeviation="18" result="blur1"/>
                    <feFlood flood-color="var(--color-accent-primary)" flood-opacity="0.6" result="color1"/>
                    <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
         
                    <!-- Medium glow -->
                    <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur2"/>
                    <feFlood flood-color="var(--color-accent-primary)" flood-opacity="0.8" result="color2"/>
                    <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
         
                    <!-- Sharp inner glow -->
                    <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur3"/>
                    <feFlood flood-color="var(--color-accent-primary)" flood-opacity="1" result="color3"/>
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
            
            <!-- Background circle for icon (outside the glow group) -->
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
            
            <!-- Material Icon with glow filter applied to foreignObject (exact NavigationNode pattern) -->
            <foreignObject 
                x={-controlRadius * 0.5} 
                y={-controlRadius * 0.5} 
                width={controlRadius} 
                height={controlRadius}
                class="icon-container"
                style:filter={isHovering ? 'url(#control-icon-glow)' : 'none'}
            >
                <div class="icon-wrapper" {...{"xmlns": "http://www.w3.org/1999/xhtml"}}>
                    <span 
                        class="material-symbols-outlined control-icon"
                        class:hovered={isHovering}
                        style:color={isHovering ? 'var(--color-accent-primary)' : 'white'}
                    >
                        graph_5
                    </span>
                </div>
            </foreignObject>
            
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
    
    /* Material Icons styling - exact pattern from NavigationNode */
    :global(.material-symbols-outlined.control-icon) {
        font-size: 28px;
        /* Only transition color, not filter */
        transition: color 0.3s ease;
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    :global(.material-symbols-outlined.control-icon.hovered) {
        /* Keep same size on hover - only color changes */
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
    
    /* Detail mode placeholder styles */
    .detail-placeholder {
        pointer-events: none;
        user-select: none;
    }
</style>