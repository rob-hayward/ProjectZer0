<!-- src/lib/components/forms/createNode/shared/DiscussionInput.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { TEXT_LIMITS } from '$lib/constants/validation';
    import FormNavigation from './FormNavigation.svelte';
    
    export let discussion = '';
    export let disabled = false;
    export let placeholder = 'Start a discussion around this word and its definition.';

    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();

    $: isOverLimit = discussion.length > TEXT_LIMITS.MAX_COMMENT_LENGTH;

    function handleInput(event: Event) {
        const textarea = event.target as HTMLTextAreaElement;
        if (textarea.value.length > TEXT_LIMITS.MAX_COMMENT_LENGTH) {
            discussion = textarea.value.slice(0, TEXT_LIMITS.MAX_COMMENT_LENGTH);
        }
    }
</script>

<g>
    <!-- Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="-20"
        class="form-label"
    >
        Discussion (optional)
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
            class:error={isOverLimit}
            bind:value={discussion}
            on:input={handleInput}
            {placeholder}
            {disabled}
        />
    </foreignObject>

    <!-- Character Count -->
    <text 
        x={FORM_STYLES.layout.leftAlign + FORM_STYLES.layout.fieldWidth - 90}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput + 160}
        class="character-count"
        class:near-limit={discussion.length > TEXT_LIMITS.MAX_COMMENT_LENGTH - 20}
        class:over-limit={isOverLimit}
        text-anchor="end"
    >
        {TEXT_LIMITS.MAX_COMMENT_LENGTH - discussion.length} characters remaining
    </text>

    <!-- Navigation -->
    <g transform="translate(0, {FORM_STYLES.layout.verticalSpacing.betweenFields + 110})">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={() => dispatch('proceed')}
            nextLabel="Review"
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
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron */
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