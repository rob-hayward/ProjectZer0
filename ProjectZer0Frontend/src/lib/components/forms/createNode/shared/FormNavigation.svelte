<!-- src/lib/components/forms/createNode/shared/FormNavigation.svelte -->
<script lang="ts">
    import { FORM_STYLES } from '$lib/styles/forms';

    export let onBack: () => void;
    export let onNext: () => void;
    export let backLabel = "Back";
    export let nextLabel = "Next";
    export let loading = false;
    export let nextDisabled = false;
</script>

<g transform="translate({FORM_STYLES.layout.leftAlign}, 0)">
    <!-- Back Button -->
    <foreignObject
        x="0"
        y="0"
        width={FORM_STYLES.layout.buttonWidth}
        height="50"
    >
        <div class="button-wrapper">
            <button 
                class="form-button"
                on:click={onBack}
                disabled={loading}
            >
                {backLabel}
            </button>
        </div>
    </foreignObject>

    <!-- Next Button -->
    <foreignObject
        x={FORM_STYLES.layout.fieldWidth - FORM_STYLES.layout.buttonWidth}
        y="0"
        width={FORM_STYLES.layout.buttonWidth}
        height="50"
    >
        <div class="button-wrapper">
            <button 
                class="form-button primary"
                on:click={onNext}
                disabled={loading || nextDisabled}
            >
                {#if loading}
                    Loading...
                {:else}
                    {nextLabel}
                {/if}
            </button>
        </div>
    </foreignObject>
</g>

<style>
    .button-wrapper {
        padding-top: 8px;
        height: 100%;
    }

    :global(.form-button) {
        width: 100%;
        padding: 8px 16px;
        border-radius: 4px;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 100px;
        box-sizing: border-box;
        margin: 0;
        color: white;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.3);
    }

    :global(.form-button.primary) {
        background: rgba(74, 144, 226, 0.3);
        border: 1px solid rgba(74, 144, 226, 0.4);
    }

    :global(.form-button:hover:not(:disabled)) {
        background: rgba(0, 0, 0, 0.6);
        transform: translateY(-1px);
        border: 1px solid rgba(255, 255, 255, 0.3);
    }

    :global(.form-button.primary:hover:not(:disabled)) {
        background: rgba(74, 144, 226, 0.4);
        border: 1px solid rgba(74, 144, 226, 0.4);
    }

    :global(.form-button:active:not(:disabled)) {
        transform: translateY(0);
    }

    :global(.form-button:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>