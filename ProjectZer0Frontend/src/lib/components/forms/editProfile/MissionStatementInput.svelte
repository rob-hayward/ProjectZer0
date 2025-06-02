<!-- src/lib/components/forms/editProfile/MissionStatementInput.svelte -->
<script lang="ts">
    import { FORM_STYLES } from '$lib/styles/forms';

    export let statement = '';
    export let disabled = false;
    
    const MAX_LENGTH = 280;
    $: remaining = MAX_LENGTH - statement.length;
    $: isNearLimit = remaining <= 20;
    $: isOverLimit = remaining < 0;
</script>

<g>
    <!-- Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y={FORM_STYLES.layout.verticalSpacing.betweenFields * 2}
        class="label"
    >
        Mission Statement:
    </text>

    <!-- Input Field -->
    <foreignObject 
        x={FORM_STYLES.layout.leftAlign} 
        y={FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + FORM_STYLES.layout.verticalSpacing.labelToInput} 
        width={FORM_STYLES.layout.fieldWidth} 
        height="150"
    >
        <textarea
            id="mission-statement-input"
            bind:value={statement}
            placeholder="Enter mission statement"
            class="textarea"
            maxlength={MAX_LENGTH}
            {disabled}
        />
    </foreignObject>

    <!-- Character Count -->
    <text
        x={FORM_STYLES.layout.leftAlign + FORM_STYLES.layout.fieldWidth}
        y={FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + 145}
        class="character-count"
        class:near-limit={isNearLimit}
        class:over-limit={isOverLimit}
    >
        {remaining} characters remaining
    </text>
</g>

<style>
    .label {
        font-size: 14px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron to Inter */
        font-weight: 400;  /* Added for consistency */
    }

    .character-count {
        font-size: 12px;
        text-anchor: end;
        fill: rgba(255, 255, 255, 0.6);
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron to Inter */
        font-weight: 400;  /* Added for consistency */
    }

    .character-count.near-limit {
        fill: #ffd700;
    }

    .character-count.over-limit {
        fill: #ff4444;
    }

    :global(textarea.textarea) {
        width: 100%;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron to Inter */
        font-size: 0.9rem;
        font-weight: 400;  /* Added for consistency */
        transition: all 0.2s ease;
        box-sizing: border-box;
        display: block;
        margin: 0;
        height: 120px;
        resize: none;
    }

    :global(textarea.textarea:focus) {
        outline: none;
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
    }
</style>