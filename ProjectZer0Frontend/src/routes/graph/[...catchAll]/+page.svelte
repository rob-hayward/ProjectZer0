<!-- src/routes/graph/[...catchAll]/+page.svelte -->
<script lang="ts">
    // This component should never actually render
    // as the +page.ts file should always redirect
</script>

<div class="fallback">
    <h1>Redirecting...</h1>
    <p>You'll be redirected to the dashboard momentarily.</p>
</div>

<style>
    .fallback {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: black;
        color: white;
        font-family: 'Orbitron', sans-serif;
    }
    
    h1 {
        font-size: 2rem;
        margin-bottom: 1rem;
    }
    
    p {
        font-size: 1rem;
    }
</style>