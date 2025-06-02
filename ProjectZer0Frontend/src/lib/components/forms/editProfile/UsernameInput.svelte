<!-- src/lib/components/forms/editProfile/UsernameInput.svelte -->
<script lang="ts">
    import { FORM_STYLES } from '$lib/styles/forms';
    
    export let username = '';
    export let disabled = false;
 </script>
 
 <text 
    x={FORM_STYLES.layout.leftAlign}
    class="label"
 >
    Username:
 </text>
 
 <foreignObject 
    x={FORM_STYLES.layout.leftAlign} 
    y={FORM_STYLES.layout.verticalSpacing.labelToInput} 
    width={FORM_STYLES.layout.fieldWidth} 
    height="40"
 >
    <input
        type="text"
        id="username-input"
        bind:value={username}
        placeholder="Enter username"
        class="input"
        {disabled}
    />
 </foreignObject>
 
 <style>
    .label {
        font-size: 14px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron to Inter */
        font-weight: 400;  /* Added for consistency */
    }
 
    :global(input.input) {
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
    }
 
    :global(input.input:focus) {
        outline: none;
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
    }
 </style>