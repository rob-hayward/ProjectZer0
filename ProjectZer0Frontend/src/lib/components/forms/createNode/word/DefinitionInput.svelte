<!-- src/lib/components/forms/createNode/word/DefinitionInput.svelte -->
<!--
POSITIONING ARCHITECTURE:
- This component is POSITIONALLY DUMB - all coordinates come from ContentBox
- Receives: positioning (fractions), width, height from parent via ContentBox
- Coordinate system: LEFT-EDGE X, CENTER Y
  • X origin: Left edge of contentText section (after padding)
  • Y origin: VERTICAL CENTER of contentText section
  • X: Standard left-to-right (0 = left edge, positive = right)
  • Y: Center-origin (0 = center, negative = UP, positive = DOWN)
- Calculate absolute Y positions as: y = height * positioning.element
- ContentBox is the SINGLE SOURCE OF TRUTH - adjust values there, not here
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { TEXT_LIMITS } from '$lib/constants/validation';
 
    // Updated to use definitionText for consistency
    export let definitionText = '';
    export let disabled = false;
    
    // POSITIONING: Received from ContentBox via CreateNodeNode
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;
 
    $: isOverLimit = definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH;
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
 
    function handleInput(event: Event) {
        const textarea = event.target as HTMLTextAreaElement;
        if (textarea.value.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH) {
            definitionText = textarea.value.slice(0, TEXT_LIMITS.MAX_DEFINITION_LENGTH);
        }
    }
    
   // ============================================================================
    // CALCULATE Y POSITIONS - TOP-ORIGIN (NOT CENTER-ORIGIN!)
    // ============================================================================
    // Y positions calculated as: y = height * positioning.element
    // Where positioning values are relative to TOP:
    //   0.0 = top of section
    //   0.5 = middle of section  
    //   1.0 = bottom of section
    // This matches your config: dropdown: 0.50 = 50% from top
    // ============================================================================

    $: labelY = height * (positioning.label || 0.30);
    $: textareaY = height * (positioning.textarea || 0.50);
    $: textareaHeight = Math.max(100, height * (positioning.textareaHeight || 0.20));
    $: charCountY = textareaY + textareaHeight + 15;

    // Textarea width (centered, responsive)
    $: textareaWidth = Math.min(340, width * 0.85);
</script>
 
<g>
    <!-- Label -->
    <text 
        x="0"
        y={labelY}
        class="form-label"
        text-anchor="middle"
    >
        Definition (optional)
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
            class:error={isOverLimit}
            bind:value={definitionText}
            on:input={handleInput}
            placeholder="Enter your definition of this word within the context of its use in ProjectZer0."
            {disabled}
        />
    </foreignObject>

    <!-- Character Count - centered below textarea -->
    <text 
        x="0"
        y={charCountY}
        class="character-count"
        class:near-limit={definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH - 20}
        class:over-limit={isOverLimit}
        text-anchor="middle"
    >
        {TEXT_LIMITS.MAX_DEFINITION_LENGTH - definitionText.length} characters remaining
    </text>
</g>
 
<style>
    .form-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
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
        border-color: rgba(66, 153, 225, 0.6);
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