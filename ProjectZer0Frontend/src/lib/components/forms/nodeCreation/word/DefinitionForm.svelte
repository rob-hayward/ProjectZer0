<!-- ProjectZer0Frontend/src/lib/components/forms/nodeCreation/word/DefinitionForm.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import FormNavigation from '../shared/FormNavigation.svelte';
  
    export let definition = '';
    export let disabled = false;
  
    const dispatch = createEventDispatcher<{
      back: void;
      proceed: void;
    }>();
</script>

<div class="form-wrapper">
  <div class="form-step">
    <div class="form-group">
      <label for="definition">Definition (optional)</label>
      <textarea
        id="definition"
        bind:value={definition}
        placeholder="Enter your definition of this word within the context of its use in ProjectZer0."
        rows="3"
        {disabled}
      />
    </div>
  </div>

  <div class="navigation-wrapper">
    <FormNavigation
      onBack={() => dispatch('back')}
      onNext={() => dispatch('proceed')}
      nextDisabled={disabled}
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
    margin-top: 7.5rem;
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
</style>