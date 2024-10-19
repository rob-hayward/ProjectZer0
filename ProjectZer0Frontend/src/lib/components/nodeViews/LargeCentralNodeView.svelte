<!-- src/lib/components/nodeViews/LargeCentralNodeView.svelte -->
<script lang="ts">
  export let title: string;
  export let size: number;
</script>

<div class="large-central-node-view" style="--node-size: {size}px">
<div class="sun-ring">
  <div class="content-area">
    <h1>{title}</h1>
    <div class="node-content">
      <slot></slot>
    </div>
  </div>
</div>
</div>

<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto:wght@300;400;700&display=swap');

:root {
  --background-color: #010B19;
  --ring-color: #00FFFF;
  --text-color: #E0E0E0;
  --accent-color: #B026FF;
  --ring-thickness: 4px;
  --content-padding: 60px;
}

.large-central-node-view {
  width: var(--node-size);
  height: var(--node-size);
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.sun-ring {
  background: linear-gradient(45deg, var(--ring-color), var(--accent-color));
  border-radius: 50%;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 0 50px var(--ring-color), inset 0 0 20px var(--ring-color);
  animation: pulse 4s infinite alternate;
}

@keyframes pulse {
  from {
    box-shadow: 0 0 50px var(--ring-color), inset 0 0 20px var(--ring-color);
  }
  to {
    box-shadow: 0 0 100px var(--ring-color), inset 0 0 40px var(--ring-color);
  }
}

.content-area {
  background-color: var(--background-color);
  border-radius: 50%;
  width: calc(100% - 2 * var(--ring-thickness));
  height: calc(100% - 2 * var(--ring-thickness));
  padding: var(--content-padding);
  color: var(--text-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  box-sizing: border-box;
  position: relative;
}

.content-area::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center, rgba(0,255,255,0.1) 0%, rgba(1,11,25,0) 70%);
  pointer-events: none;
}

h1 {
  font-family: 'Orbitron', sans-serif;
  font-size: 2.5em;
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-shadow: 0 0 10px var(--ring-color);
}

.node-content {
  width: 100%;
  overflow-y: auto;
  flex-grow: 1;
  font-family: 'Roboto', sans-serif;
}

@media (max-width: 768px) {
  :root {
    --ring-thickness: 3px;
    --content-padding: 30px;
  }

  h1 {
    font-size: 1.8em;
  }
}
</style>