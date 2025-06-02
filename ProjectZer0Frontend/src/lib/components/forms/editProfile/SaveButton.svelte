<!-- src/lib/components/forms/editProfile/SaveButton.svelte -->
<script lang="ts">
    import { FORM_STYLES } from '$lib/styles/forms';
    
    export let loading: boolean;
    export let disabled: boolean;
    export let onClick: () => Promise<void>;
 </script>
 
 <foreignObject 
    x={-FORM_STYLES.layout.buttonWidth / 2} 
    y={FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + 190} 
    width={FORM_STYLES.layout.buttonWidth} 
    height="40"
 >
    <button
        class="save-button"
        on:click={onClick}
        {disabled}
    >
        {#if loading}
            Loading...
        {:else}
            Save Changes
        {/if}
    </button>
 </foreignObject>
 
 <style>
    :global(button.save-button) {
        width: 100%;
        background: rgba(74, 144, 226, 0.3);
        border: 1px solid rgba(74, 144, 226, 0.4);
        border-radius: 4px;
        color: white;
        padding: 8px 16px;
        cursor: pointer;
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron to Inter */
        font-size: 0.9rem;
        font-weight: 500;  /* Slightly bolder for button */
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 100px;
        box-sizing: border-box;
        margin: 0;
    }
 
    :global(button.save-button:hover:not(:disabled)) {
        transform: translateY(-1px);
        background: rgba(74, 144, 226, 0.4);
    }
 
    :global(button.save-button:active:not(:disabled)) {
        transform: translateY(0);
    }
 
    :global(button.save-button:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
 </style>