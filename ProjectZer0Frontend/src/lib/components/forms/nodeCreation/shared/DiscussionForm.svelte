<!-- ProjectZer0Frontend/src/lib/components/forms/nodeCreation/shared/DiscussionForm.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import FormNavigation from './FormNavigation.svelte';
  
    export let discussion = '';
    export let disabled = false;
    export let placeholder = 'Start a discussion around this topic.';
  
    const dispatch = createEventDispatcher<{
      back: void;
      proceed: void;
    }>();
  </script>
  
  <div class="centered-content">
    <div class="form-group">
      <label for="discussion">Discussion</label>
      <textarea
        id="discussion"
        bind:value={discussion}
        {placeholder}
        rows="3"
        {disabled}
      />
    </div>
  
    <FormNavigation
      onBack={() => dispatch('back')}
      onNext={() => dispatch('proceed')}
      nextLabel="Review"
      nextDisabled={disabled}
    />
  </div>
  
  <style>
    .centered-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 100%;
      gap: 2rem;
    }
  
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
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