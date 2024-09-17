<script lang="ts">
  import { onMount } from 'svelte';
  import ThreeJsHomeScene from '$lib/components/ThreeJsHomeScene.svelte';
  import { initAuth0, handleAuth0Login } from '$lib/services/auth0';

  onMount(async () => {
    await initAuth0();
  });
</script>

<div class="home-page">
  <ThreeJsHomeScene />
  <div class="centered-content">
    <h1>PROJECT ZER0</h1>
    <h2>EXPERIMENT / GAME / REVOLUTION</h2>
    <button class="enter-button" on:click={handleAuth0Login}>ENTER</button>
  </div>
</div>

<style>
  .home-page {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    color: white;
  }

  .centered-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: translateY(10vh);
  }

  h1, h2 {
    font-family: 'Orbitron', sans-serif;
    font-weight: 900;
  }

  h1 {
    font-size: 4.5vw;
    margin-bottom: 0;
  }

  h2 {
    font-size: 2vw;
    margin-bottom: 10vh;
  }

  .enter-button {
    font-family: 'Orbitron', sans-serif;
    font-size: 2vw;
    font-weight: 900;
    color: white;
    background: none;
    border: none;
    cursor: pointer;
    padding: 10px 20px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .enter-button:hover {
    text-shadow: 0 0 20px rgba(255, 255, 255, 1);
  }

  .enter-button:focus {
    outline: none;
  }

  @media (max-width: 768px) {
    h1 { font-size: 8vw; }
    h2 { font-size: 3vw; }
    .enter-button { font-size: 3vw; }
  }
</style>