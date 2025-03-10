<!-- src/lib/components/forms/createNode/statement/KeywordInput.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import FormNavigation from '../shared/FormNavigation.svelte';
	import { TEXT_LIMITS } from '$lib/constants/validation';
    
    // Array of user keywords
    export let userKeywords: string[] = [];
    export let disabled = false;
    
    // Local state for the current keyword being entered
    let currentKeyword = '';
    let showValidationError = false;
    let errorMessage = '';
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    // Maximum number of keywords a user can add
    const MAX_KEYWORDS = 10;
    
    // Add keyword to the list
    function addKeyword() {
        // Reset error state
        showValidationError = false;
        errorMessage = '';
        
        // Check if max keywords reached
        if (userKeywords.length >= MAX_KEYWORDS) {
            showValidationError = true;
            errorMessage = `Maximum of ${MAX_KEYWORDS} keywords allowed`;
            return;
        }
        
        // Normalize and validate the keyword
        const normalized = currentKeyword.trim().toLowerCase();
        
        if (!normalized) {
            showValidationError = true;
            errorMessage = 'Keyword cannot be empty';
            return;
        }
        
        if (normalized.length > TEXT_LIMITS.MAX_KEYWORD_LENGTH) {
            showValidationError = true;
            errorMessage = `Keyword must be ${TEXT_LIMITS.MAX_KEYWORD_LENGTH} characters or less`;
            return;
        }
        
        // Check for duplicates
        if (userKeywords.includes(normalized)) {
            showValidationError = true;
            errorMessage = 'This keyword already exists';
            return;
        }
        
        // Add keyword and clear input
        userKeywords = [...userKeywords, normalized];
        currentKeyword = '';
    }
    
    // Remove keyword from the list
    function removeKeyword(keyword: string) {
        userKeywords = userKeywords.filter(k => k !== keyword);
    }
    
    // Handle key presses - add keyword on Enter
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            addKeyword();
        }
    }
    
    // Proceed to next step
    function handleProceed() {
        // Add current keyword if it's not empty
        if (currentKeyword.trim()) {
            addKeyword();
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
        Keywords (optional)
    </text>
    
    <!-- Description text -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="0"
        class="description-text"
    >
        Add keywords to help categorize your statement. AI will also extract keywords.
    </text>
    
    <!-- Keyword Input -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y="15"
        width={FORM_STYLES.layout.fieldWidth - 80}
        height="40"
    >
        <input
            type="text"
            class="form-input"
            class:error={showValidationError}
            bind:value={currentKeyword}
            on:keydown={handleKeydown}
            placeholder="Enter a keyword"
            {disabled}
        />
    </foreignObject>
    
    <!-- Add Button -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign + FORM_STYLES.layout.fieldWidth - 70}
        y="15"
        width="70"
        height="40"
    >
        <button
            class="add-button"
            on:click={addKeyword}
            disabled={!currentKeyword.trim() || disabled}
        >
            Add
        </button>
    </foreignObject>
    
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
    
    <!-- Keywords List -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y="75"
        width={FORM_STYLES.layout.fieldWidth}
        height="150"
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
    
    <!-- Navigation -->
    <g transform="translate(0, {FORM_STYLES.layout.verticalSpacing.betweenFields + 110})">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={handleProceed}
            nextDisabled={disabled}
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
    
    .description-text {
        font-size: 11px;
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
    
    :global(input.form-input) {
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
    }
    
    :global(input.form-input:focus) {
        outline: none;
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
    }
    
    :global(input.form-input.error) {
        border-color: #ff4444;
    }
    
    :global(button.add-button) {
        width: 100%;
        height: 40px;
        background: rgba(74, 144, 226, 0.3);
        border: 1px solid rgba(74, 144, 226, 0.4);
        border-radius: 4px;
        color: white;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    :global(button.add-button:hover:not(:disabled)) {
        background: rgba(74, 144, 226, 0.4);
    }
    
    :global(button.add-button:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    :global(.keywords-container) {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        max-height: 150px;
        overflow-y: auto;
        padding: 4px;
    }
    
    :global(.keyword-chip) {
        display: flex;
        align-items: center;
        background: rgba(74, 144, 226, 0.2);
        border: 1px solid rgba(74, 144, 226, 0.3);
        border-radius: 16px;
        padding: 4px 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 12px;
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
    
    :global(.no-keywords) {
        color: rgba(255, 255, 255, 0.5);
        font-family: 'Orbitron', sans-serif;
        font-size: 12px;
        font-style: italic;
        padding: 4px;
    }
</style>