<!-- src/lib/components/nodeViews/BaseNodeView.svelte -->
<script lang="ts">
    import { NavGraphDashboard } from '$lib/components/navigation';
    
    export let title: string;
  </script>
  
  <div class="node-view">
    <div class="eclipse-ring">
      <div class="content-area">
        <h1>{title}</h1>
        <div class="node-content">
          <slot></slot>
        </div>
      </div>
    </div>
    <div class="mini-nav">
      <NavGraphDashboard />
    </div>
  </div>
  
  <style>
    :root {
      --background-color: #000000;
      --ring-color: #ffffff;
      --text-color: #ffffff;
      --ring-thickness: 10px;
      --content-padding: 40px;
      --ring-size: 80vmin;  /* Slightly reduced to accommodate the nav */
    }
  
    .node-view {
      background-color: var(--background-color);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      position: relative;  /* This is for positioning the mini-nav */
    }
  
    .eclipse-ring {
      background-color: var(--ring-color);
      border-radius: 50%;
      width: var(--ring-size);
      height: var(--ring-size);
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 0 50px var(--ring-color);
    }
  
    .content-area {
      background-color: var(--background-color);
      border-radius: 50%;
      width: calc(var(--ring-size) - 2 * var(--ring-thickness));
      height: calc(var(--ring-size) - 2 * var(--ring-thickness));
      padding: var(--content-padding);
      color: var(--text-color);
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow-y: auto;
      box-sizing: border-box;
    }
  
    h1 {
      margin-bottom: 20px;
    }
  
    .node-content {
      width: 100%;
      overflow-y: auto;
      flex-grow: 1;
    }
  
    .mini-nav {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 200px;  /* Adjust this value to make the nav graph smaller */
      height: 200px; /* Adjust this value to make the nav graph smaller */
      z-index: 10;
    }
  
    @media (max-width: 768px) {
      :root {
        --ring-thickness: 5px;
        --content-padding: 20px;
      }
  
      .mini-nav {
        width: 150px;  /* Even smaller on mobile devices */
        height: 150px;
      }
    }
  </style>