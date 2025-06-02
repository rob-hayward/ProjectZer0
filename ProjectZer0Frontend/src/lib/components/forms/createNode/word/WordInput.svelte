<!-- src/lib/components/forms/createNode/word/WordInput.svelte -->
<script lang="ts">
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
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
        proceed: void;
        error: { message: string };
    }>();

    let isCheckingWord = false;
    let errorMessage: string | null = null;

    async function checkWordExistence() {
        if (!word.trim()) {
            errorMessage = 'Please enter a word';
            dispatch('error', { message: errorMessage });
            return;
        }

        isCheckingWord = true;
        errorMessage = null;
        
        try {
            const response = await fetchWithAuth(`/nodes/word/check/${encodeURIComponent(word.trim())}`);
            
            if (response.exists) {
                // Word exists - fetch its data
                const wordData = await fetchWithAuth(`/nodes/word/${encodeURIComponent(word.trim())}`);
                errorMessage = `Word "${word.trim()}" already exists. Redirecting to word page...`;
                dispatch('error', { message: errorMessage });
                
                // Update word store and navigate
                wordStore.set(wordData);
                
                setTimeout(() => {
                    if (browser) {
                        const targetUrl = `/graph/word?word=${encodeURIComponent(word.trim())}`;
                        console.log('[WordInput] Navigating to:', targetUrl);
                        
                        // Use direct window location for reliable navigation
                        window.location.href = targetUrl;
                    }
                }, 1500); // Slightly shorter timeout
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
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron */
        font-weight: 400;
    }

    :global(input.form-input) {
        width: 100%;
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