<!-- src/lib/components/forms/createNode/word/WordInput.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let word = '';
    export let disabled = false;
    
    // POSITIONING: Received from ContentBox via CreateNodeNode
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;

    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    // Calculate Y positions using positioning config (matching NodeTypeSelect)
    $: labelY = height * (positioning.label || -0.12);
    $: inputY = height * (positioning.dropdown || -0.02);
    $: inputHeight = Math.max(40, height * (positioning.dropdownHeight || 0.10));
    
    // Input width (centered, wider to match dropdown) - responsive to available width
    $: inputWidth = Math.min(300, width * 0.75);
</script>

<g>
    <!-- Label -->
    <text 
        x="0"
        y={labelY}
        class="form-label"
        text-anchor="middle"
    >
        Word
    </text>

    <!-- Input Field -->
    <foreignObject
        x={-inputWidth/2}
        y={inputY}
        width={inputWidth}
        height={inputHeight}
    >
        <input 
            type="text"
            class="form-input"
            bind:value={word}
            placeholder="Enter important keyword for ProjectZer0"
            {disabled}
        />
    </foreignObject>
</g>

<style>
    .form-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }

    :global(input.form-input) {
        width: 100%;
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
    }

    :global(input.form-input:focus) {
        outline: none;
        border-color: rgba(66, 153, 225, 0.6);
        background: rgba(255, 255, 255, 0.08);
    }

    :global(input.form-input:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    :global(input.form-input::placeholder) {
        color: rgba(255, 255, 255, 0.4);
    }
</style>