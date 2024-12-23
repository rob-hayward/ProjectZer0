<!-- src/lib/components/forms/editProfile/EmailInput.svelte -->
<script lang="ts">
    import { FORM_STYLES } from '$lib/styles/forms';
    
    export let email = '';
    export let disabled = false;
</script>

<g>
    <!-- Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y={FORM_STYLES.layout.verticalSpacing.betweenFields}
        class="label"
    >
        Email:
    </text>

    <!-- Input Field -->
    <foreignObject 
        x={FORM_STYLES.layout.leftAlign} 
        y={FORM_STYLES.layout.verticalSpacing.betweenFields + FORM_STYLES.layout.verticalSpacing.labelToInput} 
        width={FORM_STYLES.layout.fieldWidth} 
        height="40"
    >
        <input
            type="email"
            bind:value={email}
            placeholder="Enter email"
            class="input"
            {disabled}
        />
    </foreignObject>
</g>

<style>
    .label {
        font-size: 14px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Orbitron', sans-serif;
    }

    :global(input.input) {
        width: 100%;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Orbitron', sans-serif;
        transition: all 0.2s ease;
        box-sizing: border-box;
        display: block;
        margin: 0;
    }

    :global(input.input:focus) {
        outline: none;
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
    }
</style>