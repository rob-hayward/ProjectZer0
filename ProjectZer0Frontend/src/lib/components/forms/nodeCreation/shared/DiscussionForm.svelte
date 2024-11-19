<!-- ProjectZer0Frontend/src/lib/components/forms/nodeCreation/shared/DiscussionForm.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import FormNavigation from './FormNavigation.svelte';
  import CharacterCount from './CharacterCount.svelte';
  import { TEXT_LIMITS } from '$lib/constants/validation';

  export let discussion = '';
  export let disabled = false;
  export let placeholder = 'Start a discussion around this topic.';

  $: isOverLimit = discussion.length > TEXT_LIMITS.MAX_COMMENT_LENGTH;
  
  const dispatch = createEventDispatcher<{
    back: void;
    proceed: void;
  }>();

  function handleInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    if (textarea.value.length > TEXT_LIMITS.MAX_COMMENT_LENGTH) {
      discussion = textarea.value.slice(0, TEXT_LIMITS.MAX_COMMENT_LENGTH);
    }
  }
</script>

<div class="form-wrapper">
  <div class="form-step">
    <div class="form-group">
      <label for="discussion">Discussion</label>
      <textarea
        id="discussion"
        bind:value={discussion}
        on:input={handleInput}
        {placeholder}
        rows="3"
        {disabled}
        class:error={isOverLimit}
      />
      <CharacterCount
        currentLength={discussion.length}
        maxLength={TEXT_LIMITS.MAX_COMMENT_LENGTH}
      />
    </div>
  </div>

  <div class="navigation-wrapper">
    <FormNavigation
      onBack={() => dispatch('back')}
      onNext={() => dispatch('proceed')}
      nextLabel="Review"
      nextDisabled={disabled || isOverLimit}
    />
  </div>
</div>

<style>
  .form-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .form-step {
    margin-top: 7.6rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .navigation-wrapper {
    margin-top: 2rem;
  }

  label {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9rem;
    font-family: 'Orbitron', sans-serif;
  }

  textarea {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 4px;
    padding: 0.5rem;
    width: 100%;
    font-family: 'Orbitron', sans-serif;
    font-size: 0.9rem;
    transition: all 0.2s;
    resize: none;
  }

  textarea:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(0, 0, 0, 0.5);
  }

  textarea.error {
    border-color: #ff4444;
  }

  textarea.error:focus {
    border-color: #ff6666;
  }
</style>