<!-- src/lib/components/forms/createNode/shared/KeywordInput.svelte -->
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
    import { TEXT_LIMITS } from '$lib/constants/validation';
    import { wordListStore } from '$lib/stores/wordListStore';
    
    export let userKeywords: string[] = [];
    export let disabled = false;
    export let description = 'Add keywords to help categorize. AI will also extract keywords.';
    
    // POSITIONING: Received from ContentBox via CreateNodeNode
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;
    
    let searchQuery = '';
    let allKeywords: string[] = [];
    let isLoading = true;
    let showValidationError = false;
    let errorMessage = '';
    let showDropdown = false;
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    const MAX_KEYWORDS = 10;
    
    onMount(async () => {
        try {
            console.log('[KeywordInput] Loading keywords from store...');
            allKeywords = await wordListStore.loadAllWords();
            isLoading = false;
            console.log('[KeywordInput] Loaded', allKeywords.length, 'keywords');
        } catch (error) {
            console.error('[KeywordInput] Error loading keywords:', error);
            errorMessage = 'Failed to load keywords';
            isLoading = false;
        }
    });
    
    // Filter keywords based on search - show matches, sorted alphabetically
    $: filteredKeywords = searchQuery.trim()
        ? allKeywords
            .filter(keyword => 
                keyword.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !userKeywords.includes(keyword.toLowerCase())
            )
            .sort((a, b) => a.localeCompare(b))
        : allKeywords
            .filter(keyword => !userKeywords.includes(keyword.toLowerCase()))
            .sort((a, b) => a.localeCompare(b));
    
    // Check if search query is a new keyword not in the list
    $: isNewKeyword = searchQuery.trim() && 
        !allKeywords.some(k => k.toLowerCase() === searchQuery.trim().toLowerCase()) &&
        !userKeywords.includes(searchQuery.trim().toLowerCase());
    
    function selectKeyword(keyword: string) {
        showValidationError = false;
        errorMessage = '';
        
        if (userKeywords.length >= MAX_KEYWORDS) {
            showValidationError = true;
            errorMessage = `Maximum of ${MAX_KEYWORDS} keywords allowed`;
            return;
        }
        
        const normalized = keyword.trim().toLowerCase();
        
        if (normalized.length > TEXT_LIMITS.MAX_KEYWORD_LENGTH) {
            showValidationError = true;
            errorMessage = `Keyword must be ${TEXT_LIMITS.MAX_KEYWORD_LENGTH} characters or less`;
            return;
        }
        
        if (userKeywords.includes(normalized)) {
            showValidationError = true;
            errorMessage = 'This keyword already exists';
            return;
        }
        
        userKeywords = [...userKeywords, normalized];
        searchQuery = '';
        showDropdown = false;
    }
    
    function createNewKeyword() {
        const normalized = searchQuery.trim().toLowerCase();
        
        if (!normalized) {
            showValidationError = true;
            errorMessage = 'Keyword cannot be empty';
            return;
        }
        
        console.log('[KeywordInput] Creating new keyword:', normalized);
        selectKeyword(normalized);
    }
    
    function removeKeyword(keyword: string) {
        userKeywords = userKeywords.filter(k => k !== keyword);
        showValidationError = false;
        errorMessage = '';
    }
    
    function handleSearchFocus() {
        if (userKeywords.length < MAX_KEYWORDS) {
            showDropdown = true;
        }
    }
    
    function handleSearchBlur() {
        setTimeout(() => {
            showDropdown = false;
        }, 200);
    }
    
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (isNewKeyword) {
                createNewKeyword();
            } else if (filteredKeywords.length > 0) {
                selectKeyword(filteredKeywords[0]);
            }
        }
    }
    
    // Calculate Y positions using positioning config
    $: labelY = height * (positioning.label || 0.10);
    $: descriptionY = height * (positioning.description || 0.16);
    $: inputY = height * (positioning.dropdown || 0.20);
    $: inputHeight = Math.max(40, height * (positioning.dropdownHeight || 0.10));
    $: dropdownY = inputY + inputHeight - 44;  // Same offset as CategoryInput
    $: dropdownHeight = Math.max(250, height * 0.40);  // Same height as CategoryInput
    $: errorY = dropdownY + (showDropdown ? dropdownHeight + 10 : 10);
    $: chipsY = errorY + (showValidationError || isLoading ? 25 : 0);
    $: chipsHeight = Math.max(100, height * 0.25);
    
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
        Keywords (optional)
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
    >
        <input
            type="text"
            class="form-input"
            class:error={showValidationError}
            bind:value={searchQuery}
            on:focus={handleSearchFocus}
            on:blur={handleSearchBlur}
            on:keydown={handleKeydown}
            placeholder={userKeywords.length >= MAX_KEYWORDS ? 
                `Maximum ${MAX_KEYWORDS} keywords selected` : 
                "Search keywords..."}
            disabled={disabled || isLoading || userKeywords.length >= MAX_KEYWORDS}
        />
    </foreignObject>
    
    <!-- Dropdown List -->
    {#if showDropdown && !isLoading}
        <foreignObject
            x={-inputWidth/2}
            y={dropdownY}
            width={inputWidth}
            height={dropdownHeight}
        >
            <div class="dropdown-container">
                {#if filteredKeywords.length > 0}
                    {#each filteredKeywords.slice(0, 10) as keyword}
                        <button
                            class="keyword-option"
                            on:click={() => selectKeyword(keyword)}
                            type="button"
                        >
                            {keyword}
                        </button>
                    {/each}
                {/if}
                
                <!-- Create New Keyword Button (if query doesn't match existing) -->
                {#if isNewKeyword}
                    <button
                        class="create-new-link"
                        on:click={createNewKeyword}
                        type="button"
                    >
                        + Create new keyword "{searchQuery.trim()}"
                    </button>
                {/if}
                
                {#if filteredKeywords.length === 0 && !isNewKeyword}
                    <div class="no-results">No keywords found</div>
                {/if}
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
            Loading keywords...
        </text>
    {/if}
    
    <!-- Keywords Display -->
    <foreignObject
        x={-inputWidth/2}
        y={chipsY}
        width={inputWidth}
        height={chipsHeight}
    >
        <div class="keywords-container">
            {#if userKeywords.length === 0}
                <div class="no-keywords">No keywords added yet</div>
            {:else}
                {#each userKeywords as keyword}
                    <div class="keyword-chip">
                        <span class="keyword-text">{keyword}</span>
                        <button 
                            class="remove-button" 
                            on:click={() => removeKeyword(keyword)}
                            disabled={disabled}
                        >
                            ×
                        </button>
                    </div>
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
    
    :global(.keyword-option) {
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
    }
    
    :global(.keyword-option:hover) {
        background: rgba(255, 255, 255, 0.1);
    }
    
    :global(.create-new-link) {
        width: 100%;
        background: none;
        border: none;
        color: #4A90E2;
        padding: 6px 10px;
        text-align: left;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 500;
        transition: background 0.2s ease;
    }
    
    :global(.create-new-link:hover) {
        background: rgba(74, 144, 226, 0.1);
    }
    
    :global(.no-results) {
        padding: 8px 10px;
        color: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-style: italic;
        text-align: center;
    }
    
    :global(.keywords-container) {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-height: 100%;
        overflow-y: auto;
        padding: 4px;
    }
    
    :global(.keyword-chip) {
        display: flex;
        align-items: center;
        background: rgba(74, 144, 226, 0.2);
        border: 1px solid rgba(74, 144, 226, 0.3);
        border-radius: 14px;
        padding: 3px 8px;
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
    }
    
    :global(.keyword-text) {
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
    
    :global(.no-keywords) {
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
    
    /* Scrollbar styling for keywords container */
    :global(.keywords-container::-webkit-scrollbar) {
        width: 6px;
    }
    
    :global(.keywords-container::-webkit-scrollbar-track) {
        background: rgba(255, 255, 255, 0.05);
    }
    
    :global(.keywords-container::-webkit-scrollbar-thumb) {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
    }
    
    :global(.keywords-container::-webkit-scrollbar-thumb:hover) {
        background: rgba(255, 255, 255, 0.4);
    }
</style>