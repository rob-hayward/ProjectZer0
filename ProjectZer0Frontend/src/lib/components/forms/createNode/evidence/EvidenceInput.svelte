<!-- src/lib/components/forms/evidence/EvidenceInput.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { TEXT_LIMITS } from '$lib/constants/validation';
	import FormNavigation from '../shared/FormNavigation.svelte';
    
    export let title = '';
    export let url = '';
    export let evidenceType = '';
    export let parentNodeText = '';
    export let parentNodeType = '';
    export let disabled = false;
    
    let showValidationErrors = false;
    
    // Evidence type options
    const EVIDENCE_TYPES = [
        { value: 'peer_reviewed_study', label: 'Peer-Reviewed Study' },
        { value: 'government_report', label: 'Government Report' },
        { value: 'news_article', label: 'News Article' },
        { value: 'expert_opinion', label: 'Expert Opinion' },
        { value: 'dataset', label: 'Dataset' },
        { value: 'video', label: 'Video' },
        { value: 'image', label: 'Image' },
        { value: 'other', label: 'Other' }
    ];
    
    $: isTitleOverLimit = title.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH;
    $: isTitleEmpty = title.trim().length === 0;
    $: isUrlEmpty = url.trim().length === 0;
    $: isUrlValid = url.trim() === '' || isValidUrl(url);
    $: isTypeEmpty = evidenceType === '';
    $: isValid = !isTitleOverLimit && !isTitleEmpty && !isUrlEmpty && isUrlValid && !isTypeEmpty;
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    function isValidUrl(urlString: string): boolean {
        try {
            const urlObj = new URL(urlString);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }
    
    function handleTitleInput(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.value.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
            title = input.value.slice(0, TEXT_LIMITS.MAX_STATEMENT_LENGTH);
        }
    }
    
    function attemptProceed() {
        if (isValid) {
            dispatch('proceed');
        } else {
            showValidationErrors = true;
        }
    }
    
    $: parentNodeTypeDisplay = parentNodeType === 'StatementNode' ? 'Statement' :
                               parentNodeType === 'AnswerNode' ? 'Answer' :
                               parentNodeType === 'QuantityNode' ? 'Quantity' :
                               'Node';
</script>

<g>
    <!-- Parent Node Context -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="-80"
        class="context-label"
    >
        Adding Evidence to {parentNodeTypeDisplay}:
    </text>
    
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y="-65"
        width={FORM_STYLES.layout.fieldWidth}
        height="50"
    >
        <div class="parent-context">
            {parentNodeText}
        </div>
    </foreignObject>
    
    <!-- Title Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="0"
        class="form-label"
    >
        Evidence Title
    </text>
    
    <!-- Title Input -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput}
        width={FORM_STYLES.layout.fieldWidth}
        height="40"
    >
        <input
            type="text"
            class="form-input"
            class:error={showValidationErrors && isTitleEmpty}
            bind:value={title}
            on:input={handleTitleInput}
            placeholder="Brief title describing this evidence"
            {disabled}
        />
    </foreignObject>
    
    <!-- Title Validation -->
    {#if showValidationErrors && isTitleEmpty}
        <text 
            x={FORM_STYLES.layout.leftAlign}
            y={FORM_STYLES.layout.verticalSpacing.labelToInput + 50}
            class="validation-message"
        >
            Title is required
        </text>
    {/if}
    
    <!-- Title Character Count -->
    <text 
        x={FORM_STYLES.layout.leftAlign + FORM_STYLES.layout.fieldWidth - 90}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput + 50}
        class="character-count"
        class:near-limit={title.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH - 20}
        class:over-limit={isTitleOverLimit}
        text-anchor="end"
    >
        {TEXT_LIMITS.MAX_STATEMENT_LENGTH - title.length} characters remaining
    </text>
    
    <!-- URL Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="75"
        class="form-label"
    >
        Evidence URL
    </text>
    
    <!-- URL Input -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput + 75}
        width={FORM_STYLES.layout.fieldWidth}
        height="40"
    >
        <input
            type="url"
            class="form-input"
            class:error={showValidationErrors && (isUrlEmpty || !isUrlValid)}
            bind:value={url}
            placeholder="https://example.com/evidence"
            {disabled}
        />
    </foreignObject>
    
    <!-- URL Validation -->
    {#if showValidationErrors && isUrlEmpty}
        <text 
            x={FORM_STYLES.layout.leftAlign}
            y={FORM_STYLES.layout.verticalSpacing.labelToInput + 125}
            class="validation-message"
        >
            URL is required
        </text>
    {:else if showValidationErrors && !isUrlValid}
        <text 
            x={FORM_STYLES.layout.leftAlign}
            y={FORM_STYLES.layout.verticalSpacing.labelToInput + 125}
            class="validation-message"
        >
            Please enter a valid URL (must start with http:// or https://)
        </text>
    {/if}
    
    <!-- Evidence Type Label -->
    <text 
        x={FORM_STYLES.layout.leftAlign}
        y="150"
        class="form-label"
    >
        Evidence Type
    </text>
    
    <!-- Evidence Type Select -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign}
        y={FORM_STYLES.layout.verticalSpacing.labelToInput + 150}
        width={FORM_STYLES.layout.fieldWidth}
        height="40"
    >
        <select 
            class="form-input select-input"
            class:error={showValidationErrors && isTypeEmpty}
            bind:value={evidenceType}
            {disabled}
        >
            <option value="">Select evidence type...</option>
            {#each EVIDENCE_TYPES as type}
                <option value={type.value}>{type.label}</option>
            {/each}
        </select>
    </foreignObject>
    
    <!-- Evidence Type Validation -->
    {#if showValidationErrors && isTypeEmpty}
        <text 
            x={FORM_STYLES.layout.leftAlign}
            y={FORM_STYLES.layout.verticalSpacing.labelToInput + 200}
            class="validation-message"
        >
            Evidence type is required
        </text>
    {/if}
    
    <!-- Navigation -->
    <g transform="translate(0, {FORM_STYLES.layout.verticalSpacing.betweenFields + 180})">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={attemptProceed}
            nextDisabled={disabled || !isValid}
        />
    </g>
</g>

<style>
    .context-label {
        font-size: 12px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(.parent-context) {
        background: rgba(103, 242, 142, 0.1);
        border: 1px solid rgba(103, 242, 142, 0.3);
        border-radius: 4px;
        padding: 8px;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 400;
        line-height: 1.4;
        font-style: italic;
        max-height: 50px;
        overflow-y: auto;
    }
    
    .form-label {
        font-size: 14px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .validation-message {
        font-size: 12px;
        text-anchor: start;
        fill: #ff4444;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .character-count {
        font-size: 12px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        fill: rgba(255, 255, 255, 0.6);
    }
    
    .character-count.near-limit {
        fill: #ffd700;
    }
    
    .character-count.over-limit {
        fill: #ff4444;
    }
    
    :global(input.form-input) {
        width: 100%;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid rgba(255, 255, 255, 0.3);
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
    
    :global(.select-input) {
        width: 100%;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid rgba(255, 255, 255, 0.3);
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
    
    :global(.select-input:focus) {
        outline: none;
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
    }
    
    :global(.select-input.error) {
        border-color: #ff4444;
    }
    
    :global(.select-input:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    :global(.select-input option) {
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px;
    }
</style>