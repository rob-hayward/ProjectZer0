<!-- ProjectZer0Frontend/src/lib/components/forms/createNode/category/CategoryCreationInput.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { fetchWithAuth } from '$lib/services/api';
    
    // UPDATED: Import wordListStore - words use themselves as IDs
    import { wordListStore } from '$lib/stores/wordListStore';
    
    export let selectedWordIds: string[] = [];
    export let parentCategoryId: string | null = null;
    export let disabled = false;
    
    // POSITIONING: Received from ContentBox via CreateNodeNode
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;
    
    let searchQuery = '';
    let allWords: string[] = [];  // UPDATED: Just strings - words are self-identifying
    let allCategories: Array<{ id: string; name: string }> = [];
    let isLoading = true;
    let showValidationError = false;
    let errorMessage = '';
    let showWordDropdown = false;
    
    // Dropdown positioning state for fixed positioning
    let wordInputRef: HTMLInputElement | null = null;
    let wordDropdownPosition = { top: 0, left: 0, width: 0 };
    let wordDropdownContainer: HTMLDivElement | null = null;
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    const MIN_WORDS = 1;
    const MAX_WORDS = 5;
    
    // UPDATED: Category name is just the joined word strings
    $: categoryName = selectedWordIds.join(' ');
    
    // Calculate Y positions using positioning config (matching WordInput pattern)
    $: labelY = height * (positioning.label || 0.10);
    $: inputY = height * (positioning.dropdown || 0.30);  // Input stays at original position
    $: inputHeight = Math.max(40, height * (positioning.dropdownHeight || 0.10));
    $: chipsHeight = Math.max(80, height * (positioning.chipsHeight || 0.15));
    $: chipsY = inputY + chipsHeight - 150;  // Chips ABOVE input (can go outside ContentBox)
    $: errorY = inputY + inputHeight + 10;
    $: previewY = errorY + 20;
    $: parentY = previewY + 80;
    
    // Input width (centered, responsive)
    $: inputWidth = Math.min(340, width * 0.85);
    
    onMount(() => {
        // Create word dropdown container attached to document.body
        wordDropdownContainer = document.createElement('div');
        wordDropdownContainer.id = 'category-word-dropdown';
        wordDropdownContainer.style.cssText = 'position: fixed; z-index: 100000; pointer-events: auto;';
        document.body.appendChild(wordDropdownContainer);
        
        // Load data asynchronously
        (async () => {
            try {
                console.log('[CategoryCreationInput] Starting data fetch...');
                
                // Fetch categories
                const categoriesData = await fetchWithAuth('/categories');
                
                // UPDATED: Load words using store (returns string[])
                const wordsData = await wordListStore.loadAllWords();
                
                console.log('[CategoryCreationInput] Raw words response:', wordsData);
                console.log('[CategoryCreationInput] Raw categories response:', categoriesData);
                
                // Process words - they're just strings
                if (Array.isArray(wordsData) && wordsData.length > 0) {
                    allWords = wordsData;
                    console.log('[CategoryCreationInput] ✅ Loaded', allWords.length, 'words');
                } else {
                    console.warn('[CategoryCreationInput] ⚠️ No words returned from store');
                    errorMessage = 'No words available';
                }
                
                // Process categories
                if (Array.isArray(categoriesData)) {
                    allCategories = categoriesData;
                    console.log('[CategoryCreationInput] ✅ Loaded', allCategories.length, 'categories');
                } else {
                    console.warn('[CategoryCreationInput] ⚠️ No categories returned');
                    allCategories = [];
                }
                
                isLoading = false;
            } catch (error) {
                console.error('[CategoryCreationInput] ❌ Error fetching data:', error);
                console.error('[CategoryCreationInput] Error details:', {
                    message: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined
                });
                errorMessage = 'Failed to load words and categories';
                isLoading = false;
            }
        })();
        
        // Return cleanup function directly (not from a promise)
        return () => {
            // Cleanup on destroy
            if (wordDropdownContainer) {
                document.body.removeChild(wordDropdownContainer);
            }
        };
    });
    
    // Filter words based on search - show ALL matches, sorted alphabetically
    $: filteredWords = searchQuery.trim()
        ? allWords
            .filter(word => 
                word.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !selectedWordIds.includes(word)
            )
            .sort((a, b) => a.localeCompare(b))
        : allWords
            .filter(word => !selectedWordIds.includes(word))
            .sort((a, b) => a.localeCompare(b));
    
    // Debug logging
    $: console.log('[CategoryCreationInput] Word filter update:', {
        availableCount: allWords.length,
        selectedCount: selectedWordIds.length,
        searchTerm: searchQuery,
        filteredCount: filteredWords.length,
        dropdownOpen: showWordDropdown
    });
    
    // Calculate dropdown position when it opens
    function updateWordDropdownPosition() {
        if (wordInputRef) {
            const rect = wordInputRef.getBoundingClientRect();
            wordDropdownPosition = {
                top: rect.bottom + 2,
                left: rect.left,
                width: rect.width
            };
        }
    }
    
    // Reactive: Render word dropdown
    $: if (wordDropdownContainer && showWordDropdown) {
        const html = `
            <div class="dropdown-portal" style="top: ${wordDropdownPosition.top}px; left: ${wordDropdownPosition.left}px; width: ${wordDropdownPosition.width}px;">
                ${isLoading ? 
                    '<div class="dropdown-item loading">Loading words...</div>' :
                    filteredWords.length === 0 ?
                    '<div class="dropdown-item loading">No words found</div>' :
                    filteredWords.slice(0, 8).map(word => 
                        `<button class="dropdown-item" data-word="${word}">${word}</button>`
                    ).join('')
                }
            </div>
        `;
        wordDropdownContainer.innerHTML = html;
        
        // Add click handlers
        wordDropdownContainer.querySelectorAll('[data-word]').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const word = (e.target as HTMLElement).getAttribute('data-word');
                if (word) selectWord(word);
            });
        });
    } else if (wordDropdownContainer) {
        wordDropdownContainer.innerHTML = '';
    }
    
    function selectWord(word: string) {
        showValidationError = false;
        errorMessage = '';
        
        if (selectedWordIds.length >= MAX_WORDS) {
            showValidationError = true;
            errorMessage = `Maximum of ${MAX_WORDS} words allowed`;
            return;
        }
        
        if (selectedWordIds.includes(word)) {
            showValidationError = true;
            errorMessage = 'This word is already selected';
            return;
        }
        
        selectedWordIds = [...selectedWordIds, word];
        searchQuery = '';
        // DON'T close dropdown - allow multiple selections
        // showWordDropdown = false;
        
        console.log('[CategoryCreationInput] Selected word:', word, 'Total:', selectedWordIds.length);
    }
    
    function removeWord(word: string, event?: Event) {
        // Prevent event from bubbling and triggering other handlers
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        
        console.log('[CategoryCreationInput] Removing word:', word);
        selectedWordIds = selectedWordIds.filter(w => w !== word);
        showValidationError = false;
        errorMessage = '';
    }
    
    function handleSearchFocus() {
        if (selectedWordIds.length < MAX_WORDS) {
            console.log('[CategoryCreationInput] Word input focused');
            showWordDropdown = true;
            updateWordDropdownPosition();
        }
    }
    
    function handleSearchBlur(event: FocusEvent) {
        console.log('[CategoryCreationInput] Word input blur');
        // Only close dropdown if focus is moving outside the component
        // Check if the new focus target is the dropdown or a chip remove button
        const relatedTarget = event.relatedTarget as HTMLElement;
        if (relatedTarget && relatedTarget.closest('.word-chip')) {
            // Focus moved to a chip remove button - don't close dropdown
            console.log('[CategoryCreationInput] Focus moved to chip, keeping dropdown open');
            return;
        }
        
        setTimeout(() => {
            showWordDropdown = false;
        }, 250);
    }
    
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && showWordDropdown) {
            showWordDropdown = false;
            (event.target as HTMLInputElement).blur();
        }
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
        x="0"
        y={labelY}
        class="form-label"
        text-anchor="middle"
    >
        Select Words (1-5 required)
    </text>
    
    <!-- Selected Words Display - MOVED ABOVE INPUT -->
    <foreignObject
        x={-inputWidth/2}
        y={chipsY}
        width={inputWidth}
        height={chipsHeight}
    >
        <div class="words-container">
            {#if selectedWordIds.length === 0}
                <div class="no-words">No words selected yet</div>
            {:else}
                {#each selectedWordIds as word}
                    <div class="word-chip">
                        <span class="word-text">{word}</span>
                        <button 
                            class="remove-button" 
                            on:click={(e) => removeWord(word, e)}
                            on:mousedown={(e) => e.preventDefault()}
                            disabled={disabled}
                            type="button"
                            tabindex="-1"
                        >
                            ×
                        </button>
                    </div>
                {/each}
            {/if}
        </div>
    </foreignObject>
    
    <!-- Search Input - NOW BELOW CHIPS -->
    <foreignObject
        x={-inputWidth/2}
        y={inputY}
        width={inputWidth}
        height={inputHeight}
    >
        <input
            bind:this={wordInputRef}
            type="text"
            class="form-input"
            class:error={showValidationError}
            bind:value={searchQuery}
            on:focus={handleSearchFocus}
            on:blur={handleSearchBlur}
            on:keydown={handleKeydown}
            placeholder={selectedWordIds.length >= MAX_WORDS ? 
                `Maximum ${MAX_WORDS} words selected` : 
                "Search words..."}
            disabled={disabled || isLoading || selectedWordIds.length >= MAX_WORDS}
        />
    </foreignObject>
    
    <!-- Dropdown will render outside SVG via portal -->
    
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
            Loading words...
        </text>
    {/if}
    
    <!-- Category Name Preview -->
    {#if categoryName}
    <!-- Line 1: Label -->
    <text y={previewY} class="preview-label">
        Category Name:
    </text>

    <!-- Line 2: Value (18px below) -->
    <text y={previewY + 18} class="preview-value">
        {categoryName}
    </text>
    {/if}
    
    <!-- Parent Category Selection -->
    <text 
        x="0"
        y={parentY}
        class="form-label"
        text-anchor="middle"
    >
        Parent Category (optional)
    </text>
    
    <foreignObject
        x={-inputWidth/2}
        y={parentY + 15}
        width={inputWidth}
        height={inputHeight}
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

<style>
    .form-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
   .preview-label {
        font-size: 14px;
        font-family: 'Inter', sans-serif;
        fill: rgba(255, 138, 61, 0.9);
        font-weight: 500;
    }

    .preview-value {
        font-size: 16px;  
        font-family: 'Inter', sans-serif;        
        fill: rgba(255, 138, 61, 1);  /* Brighter */
        font-weight: 600;         /* Bolder */
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
    
    :global(input.form-input::placeholder) {
        color: rgba(255, 255, 255, 0.4);
    }
    
    :global(.words-container) {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        max-height: 100%;
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
        padding: 2px 4px;
        margin-left: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        border-radius: 50%;
        min-width: 18px;
        min-height: 18px;
    }
    
    :global(.remove-button:hover:not(:disabled)) {
        color: white;
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.1);
    }
    
    :global(.remove-button:active:not(:disabled)) {
        transform: scale(0.95);
    }
    
    :global(.remove-button:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    :global(.no-words) {
        color: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 400;
        font-style: italic;
        padding: 4px;
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
        background-size: 20px;
        padding-right: 32px;
    }
    
    :global(.select-input:focus) {
        outline: none;
        border-color: rgba(66, 153, 225, 0.6);
        background: rgba(255, 255, 255, 0.08);
    }
    
    :global(.select-input option) {
        background: rgba(20, 20, 30, 0.98);
        color: white;
        padding: 8px;
    }
    
    /* Global styles for dropdown rendered to document.body */
    :global(#category-word-dropdown .dropdown-portal) {
        position: fixed;
        background: rgba(20, 20, 30, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        max-height: 180px;
        overflow-y: auto;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        pointer-events: auto;
    }
    
    :global(#category-word-dropdown .dropdown-item) {
        display: block;
        width: 100%;
        padding: 8px 12px;
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.9);
        font-size: 11px;
        font-family: 'Inter', sans-serif;
        text-align: left;
        cursor: pointer;
        transition: background 0.2s;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    :global(#category-word-dropdown .dropdown-item:last-child) {
        border-bottom: none;
    }
    
    :global(#category-word-dropdown .dropdown-item:hover) {
        background: rgba(255, 138, 61, 0.2);
    }
    
    :global(#category-word-dropdown .dropdown-item.loading) {
        color: rgba(255, 255, 255, 0.5);
        cursor: default;
        font-style: italic;
    }
    
    :global(#category-word-dropdown .dropdown-portal::-webkit-scrollbar) {
        width: 4px;
    }
    
    :global(#category-word-dropdown .dropdown-portal::-webkit-scrollbar-track) {
        background: rgba(255, 255, 255, 0.05);
    }
    
    :global(#category-word-dropdown .dropdown-portal::-webkit-scrollbar-thumb) {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
    }
</style>