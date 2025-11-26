<!-- ProjectZer0Frontend/src/lib/components/forms/category/CategoryInput.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import FormNavigation from '$lib/components/forms/createNode/shared/FormNavigation.svelte';
    import { fetchWithAuth } from '$lib/services/api';
    
    export let selectedWordIds: string[] = [];
    export let parentCategoryId: string | null = null;
    export let disabled = false;
    
    let searchQuery = '';
    let allWords: Array<{ id: string; word: string }> = [];
    let allCategories: Array<{ id: string; name: string }> = [];
    let isLoading = true;
    let showValidationError = false;
    let errorMessage = '';
    let showWordDropdown = false;
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    const MIN_WORDS = 1;
    const MAX_WORDS = 5;
    
    $: categoryName = selectedWordIds
        .map(id => allWords.find(w => w.id === id)?.word)
        .filter(Boolean)
        .join(' ');
    
    onMount(async () => {
        try {
            const [words, categories] = await Promise.all([
                fetchWithAuth('/words'),
                fetchWithAuth('/categories')
            ]);
            
            allWords = words || [];
            allCategories = categories || [];
            isLoading = false;
        } catch (error) {
            console.error('Error fetching data:', error);
            errorMessage = 'Failed to load words and categories';
            isLoading = false;
        }
    });
    
    function getWordById(id: string) {
        return allWords.find(w => w.id === id);
    }
    
    $: filteredWords = allWords.filter(word => {
        if (selectedWordIds.includes(word.id)) return false;
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return word.word.toLowerCase().includes(query);
        }
        
        return true;
    });
    
    function selectWord(wordId: string) {
        showValidationError = false;
        errorMessage = '';
        
        if (selectedWordIds.length >= MAX_WORDS) {
            showValidationError = true;
            errorMessage = `Maximum of ${MAX_WORDS} words allowed`;
            return;
        }
        
        if (selectedWordIds.includes(wordId)) {
            showValidationError = true;
            errorMessage = 'This word is already selected';
            return;
        }
        
        selectedWordIds = [...selectedWordIds, wordId];
        searchQuery = '';
        showWordDropdown = false;
    }
    
    function removeWord(wordId: string) {
        selectedWordIds = selectedWordIds.filter(id => id !== wordId);
        showValidationError = false;
        errorMessage = '';
    }
    
    function handleSearchFocus() {
        if (selectedWordIds.length < MAX_WORDS) {
            showWordDropdown = true;
        }
    }
    
    function handleSearchBlur() {
        setTimeout(() => {
            showWordDropdown = false;
        }, 200);
    }
    
    function attemptProceed() {
        if (selectedWordIds.length < MIN_WORDS) {
            showValidationError = true;
            errorMessage = `Please select at least ${MIN_WORDS} word`;
            return;
        }
        
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
        Select Words (1-5 required)
    </text>
    
    <!-- Description -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="0"
        class="description-text"
    >
        Choose words that together define this category
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
            placeholder={selectedWordIds.length >= MAX_WORDS ? 
                `Maximum ${MAX_WORDS} words selected` : 
                "Search words..."}
            disabled={disabled || isLoading || selectedWordIds.length >= MAX_WORDS}
        />
    </foreignObject>
    
    <!-- Dropdown List -->
    {#if showWordDropdown && !isLoading && filteredWords.length > 0}
        <foreignObject
            x={FORM_STYLES.layout.leftAlign}
            y="57"
            width={FORM_STYLES.layout.fieldWidth}
            height="150"
        >
            <div class="dropdown-container">
                {#each filteredWords.slice(0, 8) as word}
                    <button
                        class="word-option"
                        on:click={() => selectWord(word.id)}
                        type="button"
                    >
                        {word.word}
                    </button>
                {/each}
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
            Loading words...
        </text>
    {/if}
    
    <!-- Selected Words Display -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y={showWordDropdown ? "215" : "75"}
        width={FORM_STYLES.layout.fieldWidth}
        height="100"
    >
        <div class="words-container">
            {#if selectedWordIds.length === 0}
                <div class="no-words">No words selected yet</div>
            {:else}
                {#each selectedWordIds as wordId}
                    {@const word = getWordById(wordId)}
                    {#if word}
                        <div class="word-chip">
                            <span class="word-text">{word.word}</span>
                            <button 
                                class="remove-button" 
                                on:click={() => removeWord(wordId)}
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
    
    <!-- Category Name Preview -->
    {#if categoryName}
        <g transform="translate(0, {showWordDropdown ? 185 : 45})">
            <text 
                x={FORM_STYLES.layout.leftAlign}
                y="0"
                class="preview-label"
            >
                Category Name Preview:
            </text>
            
            <foreignObject
                x={FORM_STYLES.layout.leftAlign}
                y="10"
                width={FORM_STYLES.layout.fieldWidth}
                height="40"
            >
                <div class="name-preview">
                    "{categoryName}"
                </div>
            </foreignObject>
        </g>
    {/if}
    
    <!-- Parent Category Selection -->
    <g transform="translate(0, {showWordDropdown ? 260 : 120})">
        <text 
            x={FORM_STYLES.layout.leftAlign}
            y="0"
            class="form-label"
        >
            Parent Category (optional)
        </text>
        
        <foreignObject
            x={FORM_STYLES.layout.leftAlign}
            y="15"
            width={FORM_STYLES.layout.fieldWidth}
            height="40"
        >
            <select 
                class="form-input select-input"
                bind:value={parentCategoryId}
                {disabled}
            >
                <option value={null}>No parent category</option>
                {#each allCategories as category}
                    <option value={category.id}>{category.name}</option>
                {/each}
            </select>
        </foreignObject>
    </g>
    
    <!-- Navigation -->
    <g transform="translate(0, {showWordDropdown ? 390 : 250})">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={attemptProceed}
            nextDisabled={disabled || isLoading || selectedWordIds.length < MIN_WORDS}
            showBackButton={false}
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
    
    .preview-label {
        font-size: 12px;
        text-anchor: start;
        fill: rgba(255, 138, 61, 0.8);
        font-family: 'Inter', sans-serif;
        font-weight: 500;
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
    
    :global(.word-option) {
        width: 100%;
        background: none;
        border: none;
        color: white;
        padding: 10px 12px;
        text-align: left;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        transition: background 0.2s ease;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    :global(.word-option:hover) {
        background: rgba(255, 138, 61, 0.2);
    }
    
    :global(.words-container) {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        max-height: 100px;
        overflow-y: auto;
        padding: 4px;
    }
    
    :global(.word-chip) {
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
    
    :global(.word-text) {
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
    
    :global(.no-words) {
        color: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 400;
        font-style: italic;
        padding: 4px;
    }
    
    :global(.name-preview) {
        background: rgba(255, 138, 61, 0.1);
        border: 1px solid rgba(255, 138, 61, 0.3);
        border-radius: 4px;
        padding: 8px;
        color: rgba(255, 138, 61, 1);
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
    }
    
    :global(.select-input) {
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
    
    :global(.select-input option) {
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px;
    }
</style>