<!-- src/lib/components/forms/createNode/word/WordInput.svelte -->
<script lang="ts">
    import { goto } from '$app/navigation';
    import { createEventDispatcher } from 'svelte';
    import { fetchWithAuth } from '$lib/services/api';
    import { wordStore } from '$lib/stores/wordStore';
    import { FORM_STYLES } from '$lib/styles/forms';
    import FormNavigation from '../shared/FormNavigation.svelte';
    import MessageDisplay from '../shared/MessageDisplay.svelte';

    export let word = '';
    export let disabled = false;

    const dispatch = createEventDispatcher<{
        back: void;
        wordExists: { word: string };
        proceed: void;
        error: { message: string };
    }>();

    let isCheckingWord = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    async function checkWordExistence() {
        if (!word.trim()) {
            errorMessage = 'Please enter a word';
            dispatch('error', { message: errorMessage });
            return;
        }

        isCheckingWord = true;
        errorMessage = null;
        successMessage = null;
        
        try {
            const response = await fetchWithAuth(`/nodes/word/check/${encodeURIComponent(word.trim())}`);
            
            if (response.exists) {
                // Word exists - fetch its data
                const wordData = await fetchWithAuth(`/nodes/word/${encodeURIComponent(word.trim())}`);
                successMessage = `Word "${word.trim()}" already exists. Redirecting...`;
                
                // Update word store and navigate
                wordStore.set(wordData);
                setTimeout(() => {
                    goto('/graph/word');
                }, 2000);
                
                dispatch('wordExists', { word: word.trim() });
            } else {
                dispatch('proceed');
            }
        } catch (e) {
            errorMessage = e instanceof Error ? e.message : 'Failed to check word existence';
            dispatch('error', { message: errorMessage });
        } finally {
            isCheckingWord = false;
        }
    }
</script>

<g>
    <!-- Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="0"
        class="form-label"
    >
        Word
    </text>

    <!-- Input Field -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput}
        width={FORM_STYLES.layout.fieldWidth}
        height="40"
    >
        <input 
            type="text"
            class="form-input"
            class:error={errorMessage}
            bind:value={word}
            placeholder="Enter important keyword for ProjectZer0"
            {disabled}
        />
    </foreignObject>

    <!-- Error/Success Message -->
    {#if errorMessage || successMessage}
        <g transform="translate(0, {FORM_STYLES.layout.verticalSpacing.labelToInput + 50})">
            <MessageDisplay {errorMessage} {successMessage} />
        </g>
    {/if}

    <!-- Navigation -->
    <g transform="translate(0, {FORM_STYLES.layout.verticalSpacing.betweenFields})">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={checkWordExistence}
            nextLabel={isCheckingWord ? "Checking..." : "Check Word"}
            loading={isCheckingWord}
            nextDisabled={!word.trim() || disabled}
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

    :global(input.form-input:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>