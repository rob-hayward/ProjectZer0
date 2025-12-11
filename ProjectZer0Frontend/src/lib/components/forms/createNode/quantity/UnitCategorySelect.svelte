<!-- src/lib/components/forms/createNode/quantity/UnitCategorySelect.svelte -->
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
    
    // Unit selection
    export let unitCategoryId = '';
    export let defaultUnitId = '';
    export let disabled = false;
    
    // POSITIONING: Received from ContentBox via CreateNodeNode
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;
    
    // Add flags to track if validation errors should be shown
    let showCategoryValidationError = false;
    let showUnitValidationError = false;
    
    // For unit selection, both fields are required
    $: isCategoryValid = unitCategoryId && unitCategoryId.trim() !== '';
    $: isUnitValid = defaultUnitId && defaultUnitId.trim() !== '';
    $: isValid = isCategoryValid && isUnitValid;
    
    // Store fetched categories and units
    let categories: { id: string; name: string; description: string }[] = [];
    let units: { id: string; name: string; symbol: string }[] = [];
    let isLoading = true;
    let errorMessage = '';
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    // Load all categories on mount
    onMount(async () => {
        try {
            const fetchedCategories = await fetchWithAuth('/units/categories');
            categories = fetchedCategories || [];
            isLoading = false;
        } catch (error) {
            console.error('Error fetching unit categories:', error);
            errorMessage = 'Failed to load unit categories';
            isLoading = false;
        }
    });
    
    // Load units when category changes
    async function handleCategoryChange() {
        // Reset unit selection
        defaultUnitId = '';
        units = [];
        
        // Skip if no category selected
        if (!unitCategoryId) return;
        
        try {
            // Fetch units for selected category
            const fetchedUnits = await fetchWithAuth(`/units/categories/${unitCategoryId}/units`);
            units = fetchedUnits || [];
            
            // Auto-select default unit if available
            const category = categories.find(c => c.id === unitCategoryId);
            if (category && units.length > 0) {
                // Find the default unit for this category
                const defaultUnit = units.find(u => u.id === category.id);
                if (defaultUnit) {
                    defaultUnitId = defaultUnit.id;
                } else {
                    // Otherwise select the first unit
                    defaultUnitId = units[0].id;
                }
            }
        } catch (error) {
            console.error(`Error fetching units for category ${unitCategoryId}:`, error);
            errorMessage = 'Failed to load units for selected category';
        }
    }
    
    // Calculate Y positions using positioning config
    $: categoryLabelY = height * (positioning.categoryLabel || 0.10);
    $: categoryDropdownY = height * (positioning.categoryDropdown || 0.16);
    $: categoryDropdownHeight = Math.max(40, height * (positioning.categoryDropdownHeight || 0.10));
    $: categoryValidationY = categoryDropdownY + categoryDropdownHeight + 8;
    
    $: unitLabelY = height * (positioning.unitLabel || 0.35);
    $: unitDropdownY = height * (positioning.unitDropdown || 0.41);
    $: unitDropdownHeight = Math.max(40, height * (positioning.unitDropdownHeight || 0.10));
    $: unitValidationY = unitDropdownY + unitDropdownHeight + 8;
    
    $: helpText1Y = height * (positioning.helpText1 || 0.60);
    $: helpText2Y = height * (positioning.helpText2 || 0.65);
    $: errorY = height * (positioning.error || 0.75);
    
    // Dropdown width (centered, responsive)
    $: dropdownWidth = Math.min(340, width * 0.85);
</script>

<g>
    <!-- Category Label -->
    <text 
        x="0"
        y={categoryLabelY}
        class="form-label"
        text-anchor="middle"
    >
        Unit Category
    </text>
    
    <!-- Category Select -->
    <foreignObject
        x={-dropdownWidth/2}
        y={categoryDropdownY}
        width={dropdownWidth}
        height={categoryDropdownHeight}
    >
        <select 
            class="form-input select-input"
            class:error={showCategoryValidationError}
            bind:value={unitCategoryId}
            on:change={handleCategoryChange}
            {disabled}
        >
            <option value="">Select a unit category</option>
            {#each categories as category}
                <option value={category.id}>{category.name} - {category.description}</option>
            {/each}
        </select>
    </foreignObject>
    
    <!-- Category Validation Message -->
    {#if showCategoryValidationError}
        <text 
            x="0"
            y={categoryValidationY}
            class="validation-message"
            text-anchor="middle"
        >
            Unit category is required
        </text>
    {/if}
    
    <!-- Default Unit Label -->
    <text 
        x="0"
        y={unitLabelY}
        class="form-label"
        text-anchor="middle"
    >
        Default Unit
    </text>
    
    <!-- Default Unit Select -->
    <foreignObject
        x={-dropdownWidth/2}
        y={unitDropdownY}
        width={dropdownWidth}
        height={unitDropdownHeight}
    >
        <select 
            class="form-input select-input"
            class:error={showUnitValidationError}
            bind:value={defaultUnitId}
            disabled={disabled || !unitCategoryId || units.length === 0}
        >
            <option value="">Select a default unit</option>
            {#each units as unit}
                <option value={unit.id}>{unit.name} ({unit.symbol})</option>
            {/each}
        </select>
    </foreignObject>
    
    <!-- Unit Validation Message -->
    {#if showUnitValidationError}
        <text 
            x="0"
            y={unitValidationY}
            class="validation-message"
            text-anchor="middle"
        >
            Default unit is required
        </text>
    {/if}
    
    <!-- Help text -->
    <text 
        x="0"
        y={helpText1Y}
        class="help-text"
        text-anchor="middle"
    >
        Choose the default unit for responses to your question.
    </text>
    <text 
        x="0"
        y={helpText2Y}
        class="help-text"
        text-anchor="middle"
    >
        Users will still be able to respond using any unit in the same category.
    </text>
    
    <!-- Error Message -->
    {#if errorMessage}
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
            Loading unit categories...
        </text>
    {/if}
</g>

<style>
    .form-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .validation-message {
        font-size: 12px;
        fill: #ff4444;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .help-text {
        font-size: 11px;
        fill: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .error-message {
        font-size: 12px;
        fill: #ff4444;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .loading-message {
        font-size: 12px;
        fill: #ffd700;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(.select-input) {
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
        cursor: pointer;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 24px;
        padding-right: 32px;
    }
    
    :global(.select-input:focus) {
        outline: none;
        border-color: rgba(66, 153, 225, 0.6);
        background: rgba(255, 255, 255, 0.08);
    }
    
    :global(.select-input.error) {
        border-color: #ff4444;
    }
    
    :global(.select-input:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    :global(.select-input option) {
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px;
    }
</style>