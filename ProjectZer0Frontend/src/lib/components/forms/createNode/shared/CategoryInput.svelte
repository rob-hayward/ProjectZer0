<!-- src/lib/components/forms/createNode/shared/CategoryInput.svelte -->
<!--
POSITIONING ARCHITECTURE:
- This component is POSITIONALLY DUMB - all coordinates come from ContentBox
- Receives: positioning (fractions), width, height from parent via ContentBox
- Coordinate system: LEFT-EDGE X, TOP Y
  • X origin: Left edge of contentText section (after padding)
  • Y origin: TOP of contentText section
  • X: Standard left-to-right (0 = left edge, positive = right)
  • Y: Top-origin (0 = top, 0.5 = middle, 1.0 = bottom)
- Calculate absolute Y positions as: y = height * positioning.element
- ContentBox is the SINGLE SOURCE OF TRUTH - adjust values there, not here
-->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { fetchWithAuth } from '$lib/services/api';
    
    export let selectedCategories: string[] = [];
    export let disabled = false;
    export let description = 'Add categories to help organize content (max 3).';
    
    // POSITIONING: Received from ContentBox via CreateNodeNode
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;
    
    let searchQuery = '';
    let allCategories: Array<{ id: string; name: string; description?: string }> = [];
    let isLoading = true;
    let showValidationError = false;
    let errorMessage = '';
    let showDropdown = false;
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
        createCategory: void;
    }>();
    
    const MAX_CATEGORIES = 3;
    
    onMount(async () => {
        try {
            const categories = await fetchWithAuth('/categories');
            allCategories = categories || [];
            isLoading = false;
        } catch (error) {
            console.error('Error fetching categories:', error);
            errorMessage = 'Failed to load categories';
            isLoading = false;
        }
    });
    
    function getCategoryById(id: string) {
        return allCategories.find(c => c.id === id);
    }
    
    $: filteredCategories = allCategories.filter(category => {
        if (selectedCategories.includes(category.id)) return false;
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return category.name.toLowerCase().includes(query) ||
                   (category.description?.toLowerCase().includes(query) ?? false);
        }
        
        return true;
    });
    
    function selectCategory(categoryId: string) {
        showValidationError = false;
        errorMessage = '';
        
        if (selectedCategories.length >= MAX_CATEGORIES) {
            showValidationError = true;
            errorMessage = `Maximum of ${MAX_CATEGORIES} categories allowed`;
            return;
        }
        
        if (selectedCategories.includes(categoryId)) {
            showValidationError = true;
            errorMessage = 'This category is already selected';
            return;
        }
        
        selectedCategories = [...selectedCategories, categoryId];
        searchQuery = '';
        showDropdown = false;
    }
    
    function removeCategory(categoryId: string) {
        selectedCategories = selectedCategories.filter(id => id !== categoryId);
        showValidationError = false;
        errorMessage = '';
    }
    
    function handleSearchFocus() {
        if (selectedCategories.length < MAX_CATEGORIES) {
            showDropdown = true;
        }
    }
    
    function handleSearchBlur() {
        setTimeout(() => {
            showDropdown = false;
        }, 200);
    }
    
    function handleCreateNew() {
        console.log('[CategoryInput] User wants to create new category - dispatching event');
        dispatch('createCategory');
    }
    
    // Calculate Y positions using positioning config
    $: labelY = height * (positioning.label || 0.10);
    $: descriptionY = height * (positioning.description || 0.16);
    $: inputY = height * (positioning.dropdown || 0.20);
    $: inputHeight = Math.max(40, height * (positioning.dropdownHeight || 0.10));
    $: dropdownY = inputY + inputHeight - 4;  // Offset for seamless dropdown connection
    $: dropdownHeight = Math.max(250, height * 0.40);  // Tall dropdown menu
    // FIXED: Error message position depends on whether dropdown is showing
    $: errorY = showDropdown ? (dropdownY + dropdownHeight + 10) : (inputY + inputHeight + 10);
    // Position chips AFTER dropdown when it's visible, otherwise right after input
    $: chipsY = showDropdown 
    ? dropdownY + dropdownHeight + 10  // After dropdown
    : inputY + inputHeight + (showValidationError || isLoading ? 35 : 10);  // After input
    $: chipsHeight = Math.max(80, height * 0.15);
    
    // Input width (centered, responsive)
    $: inputWidth = Math.min(340, width * 0.85);
</script>

<g>
    <!-- Label -->
    <text 
        x="0"
        y={labelY}
        class="form-label"
        text-anchor="middle"
    >
        Categories (optional)
    </text>
    
    <!-- Description text -->
    <text 
        x="0"
        y={descriptionY}
        class="description-text"
        text-anchor="middle"
    >
        {description}
    </text>
    
    <!-- Search Input -->
    <foreignObject
        x={-inputWidth/2}
        y={inputY}
        width={inputWidth}
        height={inputHeight}
        style="pointer-events: auto;"
    >
        <input
            type="text"
            class="form-input"
            class:error={showValidationError}
            bind:value={searchQuery}
            on:focus={handleSearchFocus}
            on:blur={handleSearchBlur}
            placeholder={selectedCategories.length >= MAX_CATEGORIES ? 
                `Maximum ${MAX_CATEGORIES} categories selected` : 
                "Search categories..."}
            disabled={disabled || isLoading || selectedCategories.length >= MAX_CATEGORIES}
        />
    </foreignObject>
    
    <!-- Dropdown List -->
    {#if showDropdown && !isLoading && filteredCategories.length > 0}
        <foreignObject
            x={-inputWidth/2}
            y={dropdownY}
            width={inputWidth}
            height={dropdownHeight}
            style="pointer-events: auto; overflow: visible;"
        >
            <div class="dropdown-container" style="position: relative; z-index: 9999;">
                {#each filteredCategories.slice(0, 10) as category}
                    <button
                        class="category-option"
                        on:click={() => selectCategory(category.id)}
                        type="button"
                    >
                        <span class="category-name">{category.name}</span>
                        {#if category.description}
                            <span class="category-desc">{category.description}</span>
                        {/if}
                    </button>
                {/each}
                
                <!-- Create New Category Link -->
                <button
                    class="create-new-link"
                    on:click={handleCreateNew}
                    type="button"
                >
                    + Create new category
                </button>
            </div>
        </foreignObject>
    {/if}
    
    <!-- Error Message -->
    {#if showValidationError}
        <text 
            x="0"
            y={errorY}
            class="error-message"
            text-anchor="middle"
        >
            {errorMessage}
        </text>
    {/if}
    
    <!-- Loading Message -->
    {#if isLoading}
        <text 
            x="0"
            y={errorY}
            class="loading-message"
            text-anchor="middle"
        >
            Loading categories...
        </text>
    {/if}
    
    <!-- Selected Categories Display -->
    <foreignObject
        x={-inputWidth/2}
        y={chipsY}
        width={inputWidth}
        height={chipsHeight}
    >
        <div class="categories-container">
            {#if selectedCategories.length === 0}
                <div class="no-categories">No categories selected yet</div>
            {:else}
                {#each selectedCategories as categoryId}
                    {@const category = getCategoryById(categoryId)}
                    {#if category}
                        <div class="category-chip">
                            <span class="category-text">{category.name}</span>
                            <button 
                                class="remove-button" 
                                on:click={() => removeCategory(categoryId)}
                                disabled={disabled}
                                type="button"
                            >
                                ×
                            </button>
                        </div>
                    {/if}
                {/each}
            {/if}
        </div>
    </foreignObject>
</g>

<style>
    .form-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .description-text {
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .error-message {
        font-size: 11px;
        fill: #ff4444;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .loading-message {
        font-size: 11px;
        fill: #ffd700;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(input.form-input) {
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        font-weight: 400;
        transition: all 0.2s ease;
        box-sizing: border-box;
        display: block;
        margin: 0;
    }
    
    :global(input.form-input:focus) {
        outline: none;
        border-color: rgba(66, 153, 225, 0.6);
        background: rgba(255, 255, 255, 0.08);
    }
    
    :global(input.form-input.error) {
        border-color: #ff4444;
    }
    
    :global(input.form-input:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    :global(.dropdown-container) {
        width: 100%;
        max-height: 100%;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }
    
    :global(.category-option) {
        width: 100%;
        background: none;
        border: none;
        color: white;
        padding: 4px 10px;
        text-align: left;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        transition: background 0.2s ease;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    
    :global(.category-option:hover) {
        background: rgba(255, 255, 255, 0.1);
    }
    
    :global(.category-name) {
        color: white;
        font-weight: 500;
        font-size: 11px;
    }
    
    :global(.category-desc) {
        color: rgba(255, 255, 255, 0.6);
        font-size: 9px;
        line-height: 1.3;
    }
    
    :global(.create-new-link) {
        width: 100%;
        background: none;
        border: none;
        color: #FF8A3D;
        padding: 6px 10px;
        text-align: left;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 500;
        transition: background 0.2s ease;
    }
    
    :global(.create-new-link:hover) {
        background: rgba(255, 138, 61, 0.1);
    }
    
    :global(.categories-container) {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-height: 100%;
        overflow-y: auto;
        padding: 4px;
    }
    
    :global(.category-chip) {
        display: flex;
        align-items: center;
        background: rgba(255, 138, 61, 0.2);
        border: 1px solid rgba(255, 138, 61, 0.3);
        border-radius: 14px;
        padding: 3px 8px;
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
    }
    
    :global(.category-text) {
        color: white;
        margin-right: 4px;
    }
    
    :global(.remove-button) {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        padding: 0;
        margin-left: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    :global(.remove-button:hover) {
        color: white;
    }
    
    :global(.no-categories) {
        color: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
        font-style: italic;
        padding: 4px;
    }
    
    /* Scrollbar styling for dropdown */
    :global(.dropdown-container::-webkit-scrollbar) {
        width: 6px;
    }
    
    :global(.dropdown-container::-webkit-scrollbar-track) {
        background: rgba(255, 255, 255, 0.05);
    }
    
    :global(.dropdown-container::-webkit-scrollbar-thumb) {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
    }
    
    :global(.dropdown-container::-webkit-scrollbar-thumb:hover) {
        background: rgba(255, 255, 255, 0.4);
    }
</style>