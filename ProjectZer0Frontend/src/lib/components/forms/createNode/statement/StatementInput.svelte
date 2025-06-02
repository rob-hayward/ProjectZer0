<!-- src/lib/components/forms/createNode/statement/StatementInput.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { TEXT_LIMITS } from '$lib/constants/validation';
    import FormNavigation from '../shared/FormNavigation.svelte';
    import CharacterCount from '../shared/CharacterCount.svelte';
    
    // Statement text input
    export let statement = '';
    export let disabled = false;
    
    // Add a flag to track if validation errors should be shown
    let showValidationErrors = false;
    
    // For statements, we want to require content
    $: isOverLimit = statement.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH;
    $: isEmpty = statement.trim().length === 0;
    $: isValid = !isOverLimit && !isEmpty;
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    function handleInput(event: Event) {
        const textarea = event.target as HTMLTextAreaElement;
        if (textarea.value.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
            statement = textarea.value.slice(0, TEXT_LIMITS.MAX_STATEMENT_LENGTH);
        }
    }
    
    // Attempt to proceed - check validation first
    function attemptProceed() {
        if (isValid) {
            dispatch('proceed');
        } else {
            // Only show validation errors when user tries to proceed
            showValidationErrors = true;
        }
    }
</script>

<g>
    <!-- Label - No "optional" text since it's required -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="-20"
        class="form-label"
    >
        Statement
    </text>
    
    <!-- Textarea Input -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput}
        width={FORM_STYLES.layout.fieldWidth}
        height="120"
    >
        <textarea
            class="form-textarea"
            class:error={showValidationErrors && isEmpty}
            bind:value={statement}
            on:input={handleInput}
            placeholder="Enter your statement about a concept in ProjectZer0."
            {disabled}
        />
    </foreignObject>
    
    <!-- Validation Message - Only shown when empty AND validation should be shown -->
    {#if showValidationErrors && isEmpty}
        <text 
            x={FORM_STYLES.layout.leftAlign}
            y={FORM_STYLES.layout.verticalSpacing.labelToInput + 130}
            class="validation-message"
        >
            Statement text is required
        </text>
    {/if}
    
    <!-- Character Count -->
    <text 
        x={FORM_STYLES.layout.leftAlign + FORM_STYLES.layout.fieldWidth - 90}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput + 160}
        class="character-count"
        class:near-limit={statement.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH - 20}
        class:over-limit={isOverLimit}
        text-anchor="end"
    >
        {TEXT_LIMITS.MAX_STATEMENT_LENGTH - statement.length} characters remaining
    </text>
    
    <!-- Navigation -->
    <g transform="translate(0, {FORM_STYLES.layout.verticalSpacing.betweenFields + 110})">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={attemptProceed}
            nextDisabled={disabled || isOverLimit}
        />
    </g>
</g>

<style>
    .form-label {
        font-size: 14px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron */
        font-weight: 400;
    }
    
    .validation-message {
        font-size: 12px;
        text-anchor: start;
        fill: #ff4444;
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron */
        font-weight: 400;
    }
    
    .character-count {
        font-size: 12px;
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron */
        font-weight: 400;
        fill: rgba(255, 255, 255, 0.6);
    }
    
    .character-count.near-limit {
        fill: #ffd700;
    }
    
    .character-count.over-limit {
        fill: #ff4444;
    }
    
    :global(textarea.form-textarea) {
        width: 100%;
        height: 120px;
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
        resize: none;
    }
    
    :global(textarea.form-textarea:focus) {
        outline: none;
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
    }
    
    :global(textarea.form-textarea.error) {
        border-color: #ff4444;
    }
    
    :global(textarea.form-textarea:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>