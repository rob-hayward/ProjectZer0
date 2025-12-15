<!-- src/lib/components/forms/createNode/definition/DefinitionInput.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { TEXT_LIMITS } from '$lib/constants/validation';
    import { COLORS } from '$lib/constants/colors';
    
    export let definitionText = '';
    export let word = ''; // Word being defined
    export let disabled = false;
    export let positioning: Record<string, number> = {}; // Not used, hardcoded positions
    export let width: number = 400;
    export let height: number = 400;
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    // Hardcoded Y positions (don't rely on positioning fallbacks)
    $: wordContextY = height * 0.08;
    $: labelY = height * 0.20;
    $: inputY = height * 0.25;
    $: inputHeight = height * 0.40;
    $: charCountY = height * 0.68;
    
    $: isOverLimit = definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH;
    $: isEmpty = definitionText.trim().length === 0;
    $: isValid = !isOverLimit && !isEmpty;
    
    function handleInput(event: Event) {
        const textarea = event.target as HTMLTextAreaElement;
        if (textarea.value.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH) {
            definitionText = textarea.value.slice(0, TEXT_LIMITS.MAX_DEFINITION_LENGTH);
        }
    }
    
    function attemptProceed() {
        if (isValid) {
            dispatch('proceed');
        }
    }
</script>

<g>
    <!-- Word Context Display -->
    <text 
        x="0"
        y={wordContextY}
        class="word-context"
        text-anchor="middle"
    >
        Defining: <tspan class="word-highlight" style:fill={COLORS.PRIMARY.WORD}>{word}</tspan>
    </text>
    
    <!-- Label -->
    <text 
        x="0"
        y={labelY}
        class="form-label"
        text-anchor="middle"
    >
        Definition
    </text>
    
    <!-- Textarea Input -->
    <foreignObject
        x={-width/2}
        y={inputY}
        width={width}
        height={inputHeight}
    >
        <textarea
            class="form-textarea"
            class:error={isEmpty && definitionText.length > 0}
            bind:value={definitionText}
            on:input={handleInput}
            placeholder="Enter your definition for this word..."
            {disabled}
        />
    </foreignObject>
    
    <!-- Character Count -->
    <text 
        x="0"
        y={charCountY}
        class="char-count"
        class:over-limit={isOverLimit}
        text-anchor="middle"
    >
        {definitionText.length} / {TEXT_LIMITS.MAX_DEFINITION_LENGTH}
    </text>
</g>

<style>
    .word-context {
        font-size: 16px;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .word-highlight {
        /* fill color applied via inline style using COLORS.PRIMARY.WORD */
        font-weight: 600;
    }
    
    .form-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .char-count {
        font-size: 12px;
        fill: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .char-count.over-limit {
        fill: #ff4444;
    }
    
    :global(.form-textarea) {
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        padding: 12px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 400;
        resize: none;
        box-sizing: border-box;
        transition: all 0.2s ease;
    }
    
    :global(.form-textarea:focus) {
        outline: none;
        border-color: var(--definition-color, #B68CFF);
        background: rgba(255, 255, 255, 0.08);
    }
    
    :global(.form-textarea.error) {
        border-color: #ff4444;
    }
    
    :global(.form-textarea::placeholder) {
        color: rgba(255, 255, 255, 0.4);
    }
</style>