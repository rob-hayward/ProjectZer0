<!-- src/lib/components/forms/createNode/quantity/UnitCategorySelect.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import FormNavigation from '../shared/FormNavigation.svelte';
    import { fetchWithAuth } from '$lib/services/api';
    
    // Unit selection
    export let unitCategoryId = '';
    export let defaultUnitId = '';
    export let disabled = false;
    
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
    
    // Attempt to proceed - check validation first
    function attemptProceed() {
        if (isValid) {
            dispatch('proceed');
        } else {
            // Only show validation errors when user tries to proceed
            showCategoryValidationError = !isCategoryValid;
            showUnitValidationError = !isUnitValid;
        }
    }
</script>

<g>
    <!-- Category Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="-40"
        class="form-label"
    >
        Unit Category
    </text>
    
    <!-- Category Select -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput - 40}
        width={FORM_STYLES.layout.fieldWidth}
        height="40"
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
            x={FORM_STYLES.layout.leftAlign}
            y={FORM_STYLES.layout.verticalSpacing.labelToInput}
            class="validation-message"
        >
            Unit category is required
        </text>
    {/if}
    
    <!-- Default Unit Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="50"
        class="form-label"
    >
        Default Unit
    </text>
    
    <!-- Default Unit Select - Fixed duplicate disabled attribute -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput + 50}
        width={FORM_STYLES.layout.fieldWidth}
        height="40"
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
            x={FORM_STYLES.layout.leftAlign}
            y={FORM_STYLES.layout.verticalSpacing.labelToInput + 100}
            class="validation-message"
        >
            Default unit is required
        </text>
    {/if}
    
    <!-- Help text -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="120"
        class="help-text"
    >
        Choose the default unit for responses to your question.
    </text>
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="140"
        class="help-text"
    >
        Users will still be able to respond using any unit in the same category.
    </text>
    
    <!-- Error Message -->
    {#if errorMessage}
        <text 
            x={FORM_STYLES.layout.leftAlign}
            y="170"
            class="error-message"
        >
            {errorMessage}
        </text>
    {/if}
    
    <!-- Loading Message -->
    {#if isLoading}
        <text 
            x={FORM_STYLES.layout.leftAlign}
            y="170"
            class="loading-message"
        >
            Loading unit categories...
        </text>
    {/if}
    
    <!-- Navigation -->
    <g transform="translate(0, {FORM_STYLES.layout.verticalSpacing.betweenFields + 110})">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={attemptProceed}
            nextDisabled={disabled || !isValid || isLoading}
        />
    </g>
</g>

<style>
    .form-label {
        font-size: 14px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Orbitron', sans-serif;
    }
    
    .validation-message {
        font-size: 12px;
        text-anchor: start;
        fill: #ff4444;
        font-family: 'Orbitron', sans-serif;
    }
    
    .help-text {
        font-size: 12px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.5);
        font-family: 'Orbitron', sans-serif;
    }
    
    .error-message {
        font-size: 12px;
        text-anchor: start;
        fill: #ff4444;
        font-family: 'Orbitron', sans-serif;
    }
    
    .loading-message {
        font-size: 12px;
        text-anchor: start;
        fill: #ffd700;
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.select-input) {
        width: 100%;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
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
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
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