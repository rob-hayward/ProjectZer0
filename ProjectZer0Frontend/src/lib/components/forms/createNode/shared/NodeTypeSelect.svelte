<!-- src/lib/components/forms/createNode/shared/NodeTypeSelect.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import FormNavigation from './FormNavigation.svelte';

    export let nodeType = '';
    export let disabled = false;

    const dispatch = createEventDispatcher<{
        proceed: void;
        typeChange: { type: string };
    }>();

    const noop = () => {};

    function handleTypeChange() {
        dispatch('typeChange', { type: nodeType });
    }
</script>

<g>
    <!-- Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="0"
        class="form-label"
    >
        Select Node Type
    </text>

    <!-- Select Input -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput}
        width={FORM_STYLES.layout.fieldWidth}
        height="40"
    >
        <select 
            class="form-input"
            bind:value={nodeType}
            on:change={handleTypeChange}
            {disabled}
        >
            <option value="">Choose type...</option>
            <option value="word">Word</option>
            <option value="statement">Statement</option>
            <option value="quantity">Quantity</option>
        </select>
    </foreignObject>

    <!-- Navigation -->
    <g transform="translate(0, {FORM_STYLES.layout.verticalSpacing.betweenFields})">
        <FormNavigation
            onBack={noop}
            onNext={() => dispatch('proceed')}
            nextLabel="Continue"
            nextDisabled={!nodeType || disabled}
            showBackButton={false}
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

    :global(select.form-input) {
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
        cursor: pointer;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 24px;
        padding-right: 32px;
    }

    :global(select.form-input:focus) {
        outline: none;
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
    }

    :global(select.form-input option) {
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px;
    }

    :global(select.form-input:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>