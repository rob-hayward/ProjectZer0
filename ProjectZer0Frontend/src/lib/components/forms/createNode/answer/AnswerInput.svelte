<!-- ProjectZer0Frontend/src/lib/components/forms/answer/AnswerInput.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { TEXT_LIMITS } from '$lib/constants/validation';
    import FormNavigation from '$lib/components/forms/createNode/shared/FormNavigation.svelte';
    
    export let answerText = '';
    export let questionText = '';
    export let disabled = false;
    
    let showValidationErrors = false;
    
    $: isOverLimit = answerText.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH;
    $: isEmpty = answerText.trim().length === 0;
    $: isValid = !isOverLimit && !isEmpty;
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    function handleInput(event: Event) {
        const textarea = event.target as HTMLTextAreaElement;
        if (textarea.value.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
            answerText = textarea.value.slice(0, TEXT_LIMITS.MAX_STATEMENT_LENGTH);
        }
    }
    
    function attemptProceed() {
        if (isValid) {
            dispatch('proceed');
        } else {
            showValidationErrors = true;
        }
    }
</script>

<g>
    <!-- Parent Question Context -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="-50"
        class="context-label"
    >
        Answering Question:
    </text>
    
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y="-35"
        width={FORM_STYLES.layout.fieldWidth}
        height="50"
    >
        <div class="question-context">
            {questionText}
        </div>
    </foreignObject>
    
    <!-- Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="30"
        class="form-label"
    >
        Your Answer
    </text>
    
    <!-- Textarea Input -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput + 30}
        width={FORM_STYLES.layout.fieldWidth}
        height="120"
    >
        <textarea
            class="form-textarea"
            class:error={showValidationErrors && isEmpty}
            bind:value={answerText}
            on:input={handleInput}
            placeholder="Enter your answer to this question..."
            {disabled}
        />
    </foreignObject>
    
    <!-- Validation Message -->
    {#if showValidationErrors && isEmpty}
        <text 
            x={FORM_STYLES.layout.leftAlign}
            y={FORM_STYLES.layout.verticalSpacing.labelToInput + 160}
            class="validation-message"
        >
            Answer text is required
        </text>
    {/if}
    
    <!-- Character Count -->
    <text 
        x={FORM_STYLES.layout.leftAlign + FORM_STYLES.layout.fieldWidth - 90}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput + 190}
        class="character-count"
        class:near-limit={answerText.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH - 20}
        class:over-limit={isOverLimit}
        text-anchor="end"
    >
        {TEXT_LIMITS.MAX_STATEMENT_LENGTH - answerText.length} characters remaining
    </text>
    
    <!-- Navigation -->
    <g transform="translate(0, {FORM_STYLES.layout.verticalSpacing.betweenFields + 140})">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={attemptProceed}
            nextDisabled={disabled || isOverLimit}
        />
    </g>
</g>

<style>
    .context-label {
        font-size: 12px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(.question-context) {
        background: rgba(182, 140, 255, 0.1);
        border: 1px solid rgba(182, 140, 255, 0.3);
        border-radius: 4px;
        padding: 8px;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 400;
        line-height: 1.4;
        font-style: italic;
        max-height: 50px;
        overflow-y: auto;
    }
    
    .form-label {
        font-size: 14px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .validation-message {
        font-size: 12px;
        text-anchor: start;
        fill: #ff4444;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .character-count {
        font-size: 12px;
        font-family: 'Inter', sans-serif;
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