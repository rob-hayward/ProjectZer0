<!-- ProjectZer0Frontend/src/lib/components/forms/createNode/answer/AnswerInput.svelte -->
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
    import { createEventDispatcher } from 'svelte';
    import { TEXT_LIMITS } from '$lib/constants/validation';
    
    export let answerText = '';
    export let questionText = '';
    export let disabled = false;
    
    // POSITIONING: Received from ContentBox via CreateNodeNode (may be empty)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;
    
    let showValidationErrors = false;
    
    $: isOverLimit = answerText.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH;
    $: isEmpty = answerText.trim().length === 0;
    
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
    
    // Hardcoded Y positions for reliable spacing
    $: contextLabelY = height * 0.05;
    $: contextBoxY = height * 0.11;
    $: contextBoxHeight = height * 0.30;  // 30% of height for question context
    $: labelY = height * 0.44;  // Moved up from 0.56
    $: textareaY = height * 0.51;  // Moved up from 0.64
    $: textareaHeight = height * 0.35;  // Increased from 0.24 for answer input
    $: charCountY = textareaY + textareaHeight + 15;
    $: validationY = textareaY + textareaHeight + 35;
    
    // Debug logging
    $: if (height) {
        console.log('[AnswerInput] Spacing values:', {
            height,
            contextBoxHeight,
            textareaHeight,
            contextBoxY,
            textareaY
        });
    }
    
    // Widths (centered, responsive)
    $: contextWidth = Math.min(340, width * 0.85);
    $: textareaWidth = Math.min(340, width * 0.85);
</script>

<g>
    <!-- Parent Question Context Label -->
    <text 
        x="0"
        y={contextLabelY}
        class="context-label"
        text-anchor="middle"
    >
        Answering Question:
    </text>
    
    <!-- Parent Question Context Box - centered horizontally -->
    <foreignObject
        x={-contextWidth/2}
        y={contextBoxY}
        width={contextWidth}
        height={contextBoxHeight}
    >
        <div class="question-context">
            {questionText}
        </div>
    </foreignObject>
    
    <!-- Label -->
    <text 
        x="0"
        y={labelY}
        class="form-label"
        text-anchor="middle"
    >
        Your Answer
    </text>
    
    <!-- Textarea Input - centered horizontally -->
    <foreignObject
        x={-textareaWidth/2}
        y={textareaY}
        width={textareaWidth}
        height={textareaHeight}
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
    
    <!-- Character Count - centered below textarea -->
    <text 
        x="0"
        y={charCountY}
        class="character-count"
        class:near-limit={answerText.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH - 20}
        class:over-limit={isOverLimit}
        text-anchor="middle"
    >
        {TEXT_LIMITS.MAX_STATEMENT_LENGTH - answerText.length} characters remaining
    </text>
    
    <!-- Validation Message - Only shown when empty AND validation should be shown -->
    {#if showValidationErrors && isEmpty}
        <text 
            x="0"
            y={validationY}
            class="validation-message"
            text-anchor="middle"
        >
            Answer text is required
        </text>
    {/if}
</g>

<style>
    .context-label {
        font-size: 11px;
        fill: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(.question-context) {
        background: rgba(182, 140, 255, 0.1);
        border: 1px solid rgba(182, 140, 255, 0.3);
        border-radius: 4px;
        padding: 6px 8px;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
        line-height: 1.3;
        font-style: italic;
        max-height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
    }
    
    :global(.question-context::-webkit-scrollbar) {
        width: 4px;
    }
    
    :global(.question-context::-webkit-scrollbar-track) {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 2px;
    }
    
    :global(.question-context::-webkit-scrollbar-thumb) {
        background: rgba(182, 140, 255, 0.3);
        border-radius: 2px;
    }
    
    :global(.question-context::-webkit-scrollbar-thumb:hover) {
        background: rgba(182, 140, 255, 0.5);
    }
    
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
        height: 100%;
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
        resize: none;
    }
    
    :global(textarea.form-textarea:focus) {
        outline: none;
        border-color: rgba(182, 140, 255, 0.6);
        background: rgba(255, 255, 255, 0.08);
    }
    
    :global(textarea.form-textarea.error) {
        border-color: #ff4444;
    }
    
    :global(textarea.form-textarea:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    :global(textarea.form-textarea::placeholder) {
        color: rgba(255, 255, 255, 0.4);
    }
</style>