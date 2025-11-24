<!-- src/lib/components/forms/createNode/shared/CategoryInput.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { COLORS } from '$lib/constants/colors';
    import FormNavigation from './FormNavigation.svelte';
    import { fetchWithAuth } from '$lib/services/api';
    
    // Array of selected category IDs
    export let selectedCategories: string[] = [];
    export let disabled = false;
    export let description = 'Add categories to help organize content (max 3).';
    
    // Local state
    let searchQuery = '';
    let allCategories: Array<{ id: string; name: string; description?: string }> = [];
    let isLoading = true;
    let showValidationError = false;
    let errorMessage = '';
    let showDropdown = false;
    let isCreatingNew = false;
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    // Maximum number of categories
    const MAX_CATEGORIES = 3;
    
    // Fetch all categories on mount
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
    
    // Get category details by ID
    function getCategoryById(id: string) {
        return allCategories.find(c => c.id === id);
    }
    
    // Filter categories based on search query
    $: filteredCategories = allCategories.filter(category => {
        // Don't show already selected categories
        if (selectedCategories.includes(category.id)) return false;
        
        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return category.name.toLowerCase().includes(query) ||
                   (category.description?.toLowerCase().includes(query) ?? false);
        }
        
        return true;
    });
    
    // Add category to selection
    function selectCategory(categoryId: string) {
        // Reset error state
        showValidationError = false;
        errorMessage = '';
        
        // Check if max categories reached
        if (selectedCategories.length >= MAX_CATEGORIES) {
            showValidationError = true;
            errorMessage = `Maximum of ${MAX_CATEGORIES} categories allowed`;
            return;
        }
        
        // Check for duplicates (shouldn't happen due to filtering, but safety check)
        if (selectedCategories.includes(categoryId)) {
            showValidationError = true;
            errorMessage = 'This category is already selected';
            return;
        }
        
        // Add category
        selectedCategories = [...selectedCategories, categoryId];
        searchQuery = '';
        showDropdown = false;
    }
    
    // Remove category from selection
    function removeCategory(categoryId: string) {
        selectedCategories = selectedCategories.filter(id => id !== categoryId);
        showValidationError = false;
        errorMessage = '';
    }
    
    // Handle search input focus
    function handleSearchFocus() {
        if (selectedCategories.length < MAX_CATEGORIES) {
            showDropdown = true;
        }
    }
    
    // Handle search input blur (with delay to allow click)
    function handleSearchBlur() {
        setTimeout(() => {
            showDropdown = false;
        }, 200);
    }
    
    // Handle creating new category
    function handleCreateNew() {
        isCreatingNew = true;
        showValidationError = true;
        errorMessage = 'Category creation will be available in the next phase';
        // TODO: Implement category creation flow in Phase 5
    }
    
    // Proceed to next step
    function handleProceed() {
        dispatch('proceed');
    }
</script>

<g>
    <!-- Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="-20"
        class="form-label"
    >
        Categories (optional)
    </text>
    
    <!-- Description text -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="0"
        class="description-text"
    >
        {description}
    </text>
    
    <!-- Search Input -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y="15"
        width={FORM_STYLES.layout.fieldWidth}
        height="40"
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
            x={FORM_STYLES.layout.leftAlign}
            y="57"
            width={FORM_STYLES.layout.fieldWidth}
            height="150"
        >
            <div class="dropdown-container">
                {#each filteredCategories.slice(0, 5) as category}
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
            x={FORM_STYLES.layout.leftAlign}
            y="65"
            class="error-message"
        >
            {errorMessage}
        </text>
    {/if}
    
    <!-- Loading Message -->
    {#if isLoading}
        <text 
            x={FORM_STYLES.layout.leftAlign}
            y="65"
            class="loading-message"
        >
            Loading categories...
        </text>
    {/if}
    
    <!-- Selected Categories Display -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y={showDropdown ? "215" : "75"}
        width={FORM_STYLES.layout.fieldWidth}
        height="150"
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
    
    <!-- Navigation -->
    <g transform="translate(0, {showDropdown ? 335 : 195})">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={handleProceed}
            nextDisabled={disabled || isLoading}
        />
    </g>
</g>

<style>
    .form-label {
        font-size: 14px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .description-text {
        font-size: 11px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .error-message {
        font-size: 12px;
        text-anchor: start;
        fill: #ff4444;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .loading-message {
        font-size: 12px;
        text-anchor: start;
        fill: #ffd700;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(input.form-input) {
        width: 100%;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid rgba(255, 255, 255, 0.3);
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
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
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
        max-height: 150px;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.95);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }
    
    :global(.category-option) {
        width: 100%;
        background: none;
        border: none;
        color: white;
        padding: 8px 12px;
        text-align: left;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        font-size: 0.85rem;
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
    }
    
    :global(.category-desc) {
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.75rem;
    }
    
    :global(.create-new-link) {
        width: 100%;
        background: none;
        border: none;
        color: #FF8A3D;
        padding: 10px 12px;
        text-align: left;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        font-size: 0.85rem;
        font-weight: 500;
        transition: background 0.2s ease;
    }
    
    :global(.create-new-link:hover) {
        background: rgba(255, 138, 61, 0.1);
    }
    
    :global(.categories-container) {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        max-height: 150px;
        overflow-y: auto;
        padding: 4px;
    }
    
    :global(.category-chip) {
        display: flex;
        align-items: center;
        background: rgba(255, 138, 61, 0.2);
        border: 1px solid rgba(255, 138, 61, 0.3);
        border-radius: 16px;
        padding: 4px 8px;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
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
        font-size: 16px;
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
        font-size: 12px;
        font-weight: 400;
        font-style: italic;
        padding: 4px;
    }
</style>