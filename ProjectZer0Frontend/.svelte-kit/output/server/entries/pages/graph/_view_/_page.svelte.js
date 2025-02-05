import { n as noop, s as subscribe } from "../../../../chunks/utils.js";
import { c as create_ssr_component, a as createEventDispatcher, o as onDestroy, b as each, e as escape, d as add_attribute, v as validate_component, f as add_styles, g as spread, h as escape_object } from "../../../../chunks/ssr.js";
import { g as goto, p as page } from "../../../../chunks/stores.js";
import { C as COLORS, u as userStore } from "../../../../chunks/colors.js";
import "d3";
import { w as writable } from "../../../../chunks/index2.js";
import { f as fetchWithAuth } from "../../../../chunks/api.js";
const is_client = typeof window !== "undefined";
let now = is_client ? () => window.performance.now() : () => Date.now();
let raf = is_client ? (cb) => requestAnimationFrame(cb) : noop;
const tasks = /* @__PURE__ */ new Set();
function run_tasks(now2) {
  tasks.forEach((task) => {
    if (!task.c(now2)) {
      tasks.delete(task);
      task.f();
    }
  });
  if (tasks.size !== 0) raf(run_tasks);
}
function loop(callback) {
  let task;
  if (tasks.size === 0) raf(run_tasks);
  return {
    promise: new Promise((fulfill) => {
      tasks.add(task = { c: callback, f: fulfill });
    }),
    abort() {
      tasks.delete(task);
    }
  };
}
const CIRCLE_RADIUS = 290;
const NODE_CONSTANTS = {
  SIZES: {
    DASHBOARD: {
      size: 600
      // Large fixed size for dashboard
    },
    WORD: {
      preview: 135,
      detail: 600
    },
    DEFINITION: {
      live: {
        preview: 320,
        detail: 600
      },
      alternative: {
        preview: 320,
        detail: 600
      }
    }
  },
  STROKE: {
    preview: {
      normal: 3,
      hover: 6
    },
    detail: {
      normal: 2,
      hover: 3
    }
  },
  PADDING: {
    preview: 10,
    detail: 40
  },
  LINE_HEIGHT: {
    preview: 16,
    detail: 24
  },
  EFFECTS: {
    glow: {
      normal: {
        blur: 5,
        strength: 0.6,
        spread: 2
      },
      hover: {
        blur: 8,
        strength: 0.8,
        spread: 3
      }
    }
  },
  COLORS: {
    DASHBOARD: {
      background: `${COLORS.PRIMARY.BLUE}33`,
      border: `${COLORS.PRIMARY.BLUE}FF`,
      text: `${COLORS.PRIMARY.BLUE}FF`,
      hover: `${COLORS.PRIMARY.BLUE}FF`,
      gradient: {
        start: `${COLORS.PRIMARY.BLUE}66`,
        end: `${COLORS.PRIMARY.BLUE}33`
      }
    },
    WORD: {
      background: `${COLORS.PRIMARY.BLUE}33`,
      border: `${COLORS.PRIMARY.BLUE}FF`,
      text: `${COLORS.PRIMARY.BLUE}FF`,
      hover: `${COLORS.PRIMARY.BLUE}FF`,
      gradient: {
        start: `${COLORS.PRIMARY.BLUE}66`,
        end: `${COLORS.PRIMARY.BLUE}33`
      }
    },
    DEFINITION: {
      live: {
        background: `${COLORS.PRIMARY.BLUE}33`,
        border: `${COLORS.PRIMARY.BLUE}FF`,
        text: `${COLORS.PRIMARY.BLUE}FF`,
        hover: `${COLORS.PRIMARY.BLUE}FF`,
        gradient: {
          start: `${COLORS.PRIMARY.BLUE}66`,
          end: `${COLORS.PRIMARY.BLUE}33`
        }
      },
      alternative: {
        background: `${COLORS.PRIMARY.PURPLE}33`,
        border: `${COLORS.PRIMARY.PURPLE}FF`,
        text: `${COLORS.PRIMARY.PURPLE}FF`,
        hover: `${COLORS.PRIMARY.PURPLE}FF`,
        gradient: {
          start: `${COLORS.PRIMARY.PURPLE}66`,
          end: `${COLORS.PRIMARY.PURPLE}33`
        }
      }
    }
  },
  FONTS: {
    title: {
      family: "Orbitron",
      size: "12px",
      weight: "500"
    },
    value: {
      family: "Orbitron",
      size: "14px",
      weight: "300"
    },
    hover: {
      family: "Orbitron",
      size: "10px",
      weight: "400"
    },
    word: {
      family: "Orbitron",
      size: "14px",
      weight: "500"
    }
  },
  SVG: {
    filters: {
      glow: {
        deviation: 3,
        strength: 0.5
      },
      hover: {
        deviation: 5,
        strength: 0.7
      }
    },
    animation: {
      duration: "0.3s",
      easing: "ease-out"
    }
  }
};
const NODE_STYLE = {
  RADIUS: 3,
  GLOW_RADIUS: 5,
  GLOW_OPACITY: 0.25
};
const MOVEMENT_STYLE = {
  BASE_VELOCITY: 0.15,
  // Initial velocity range (-0.15 to 0.15)
  VELOCITY_SCALE: 0.5,
  // Scale factor for velocity (like the 0.5 in the reference)
  DRIFT_FORCE: 8e-3,
  // Small random adjustments
  MAX_SPEED: 0.25
  // Maximum allowed speed
};
const DEFAULT_BACKGROUND_CONFIG = {
  nodeCount: 35,
  viewportScale: 1.5,
  minConnections: 2,
  maxConnections: 4,
  viewport: {
    origin: {
      x: -0.5,
      y: -0.5
    },
    scale: 1,
    preserveAspectRatio: "xMidYMid meet"
  },
  animation: {
    baseVelocity: MOVEMENT_STYLE.BASE_VELOCITY,
    velocityScale: MOVEMENT_STYLE.VELOCITY_SCALE,
    driftForce: MOVEMENT_STYLE.DRIFT_FORCE,
    maxSpeed: MOVEMENT_STYLE.MAX_SPEED
  },
  nodeStyles: [
    {
      mainRadius: NODE_STYLE.RADIUS,
      glowRadius: NODE_STYLE.GLOW_RADIUS,
      mainColor: COLORS.PRIMARY.BLUE,
      glowColor: COLORS.PRIMARY.BLUE,
      glowOpacity: NODE_STYLE.GLOW_OPACITY
    },
    {
      mainRadius: NODE_STYLE.RADIUS,
      glowRadius: NODE_STYLE.GLOW_RADIUS,
      mainColor: COLORS.PRIMARY.PURPLE,
      glowColor: COLORS.PRIMARY.PURPLE,
      glowOpacity: NODE_STYLE.GLOW_OPACITY
    },
    {
      mainRadius: NODE_STYLE.RADIUS,
      glowRadius: NODE_STYLE.GLOW_RADIUS,
      mainColor: COLORS.PRIMARY.GREEN,
      glowColor: COLORS.PRIMARY.GREEN,
      glowOpacity: NODE_STYLE.GLOW_OPACITY
    }
  ],
  edgeStyle: {
    width: 1.2,
    color: COLORS.GRAPH.EDGE.DEFAULT,
    glowColor: COLORS.UI.TEXT.TERTIARY,
    glowWidth: 1,
    opacity: 0.08
  }
};
const css$k = {
  code: ".graph-layout.svelte-hgk02u{width:100%;height:100%;pointer-events:none}.nodes.svelte-hgk02u{pointer-events:all}.edges.svelte-hgk02u{pointer-events:none}.edge.svelte-hgk02u{fill:none;stroke:rgba(255, 255, 255, 0.2);stroke-width:1;transition:stroke-width 0.3s ease-out;vector-effect:non-scaling-stroke}.edge.live.svelte-hgk02u{stroke:rgba(255, 255, 255, 0.3);stroke-width:1.5}.node{transition:transform 0.3s ease-out}",
  map: `{"version":3,"file":"GraphLayout.svelte","sources":["GraphLayout.svelte"],"sourcesContent":["<script lang=\\"ts\\">import { onMount, onDestroy, createEventDispatcher } from \\"svelte\\";\\nimport { GraphLayout } from \\"./GraphLayout\\";\\nconst dispatch = createEventDispatcher();\\nexport let data;\\nexport let width;\\nexport let height;\\nexport let viewType;\\nexport let isPreviewMode = false;\\nlet layout;\\nlet nodePositions = /* @__PURE__ */ new Map();\\nlet expandedNodes = /* @__PURE__ */ new Map();\\nlet mounted = false;\\nlet lastUpdateTime = Date.now();\\nlet updateCount = 0;\\nfunction initializeLayout() {\\n  console.log(\\"Initializing layout:\\", { width, height, viewType, isPreviewMode });\\n  layout = new GraphLayout(width, height, viewType, isPreviewMode);\\n  layout.updateDefinitionModes(expandedNodes);\\n  requestAnimationFrame(() => updateLayout(true));\\n}\\nfunction updateLayout(forceUpdate = false) {\\n  if (!layout || !data) return;\\n  const now = Date.now();\\n  const timeSinceLastUpdate = now - lastUpdateTime;\\n  if (!forceUpdate && timeSinceLastUpdate < 16) {\\n    return;\\n  }\\n  console.log(\\"Updating layout:\\", {\\n    updateCount: ++updateCount,\\n    nodeCount: data.nodes.length,\\n    linkCount: data.links?.length || 0,\\n    timeSinceLastUpdate\\n  });\\n  nodePositions = layout.updateLayout(data);\\n  lastUpdateTime = now;\\n  if (nodePositions.size > 0) {\\n    const positionSample = Array.from(nodePositions.entries())[0];\\n    console.log(\\"Sample position:\\", {\\n      nodeId: positionSample[0],\\n      position: positionSample[1]\\n    });\\n  }\\n}\\nfunction handleNodeModeChange(nodeId, mode) {\\n  console.log(\\"Node mode change:\\", { nodeId, mode });\\n  expandedNodes.set(nodeId, mode);\\n  expandedNodes = new Map(expandedNodes);\\n  if (layout) {\\n    layout.updateDefinitionModes(expandedNodes);\\n    requestAnimationFrame(() => updateLayout(true));\\n  }\\n}\\nfunction getNodeTransform(nodeId) {\\n  const position = nodePositions.get(nodeId);\\n  if (!position) {\\n    console.warn(\\"No position found for node:\\", nodeId);\\n    return \\"\\";\\n  }\\n  return position.svgTransform;\\n}\\nonMount(() => {\\n  console.log(\\"GraphLayout mounting\\");\\n  mounted = true;\\n  initializeLayout();\\n});\\nonDestroy(() => {\\n  console.log(\\"GraphLayout destroying\\");\\n  if (layout) {\\n    layout.stop();\\n  }\\n});\\n$: if (mounted && layout && isPreviewMode !== void 0) {\\n  console.log(\\"Preview mode changed:\\", isPreviewMode);\\n  layout.updatePreviewMode(isPreviewMode);\\n  requestAnimationFrame(() => updateLayout(true));\\n}\\n$: if (mounted && layout && data) {\\n  requestAnimationFrame(() => updateLayout());\\n}\\n$: if (width && height && layout) {\\n  console.log(\\"Dimensions changed:\\", { width, height });\\n  layout.resize(width, height);\\n}\\n<\/script>\\n\\n<g class=\\"graph-layout\\">\\n    {#if data.links && data.links.length > 0}\\n        <g class=\\"edges\\" aria-hidden=\\"true\\">\\n            {#each data.links as link}\\n                {@const sourcePos = nodePositions.get(typeof link.source === 'string' ? link.source : link.source.id)}\\n                {@const targetPos = nodePositions.get(typeof link.target === 'string' ? link.target : link.target.id)}\\n                {#if sourcePos && targetPos}\\n                    <path\\n                        class=\\"edge {link.type}\\"\\n                        d=\\"M{sourcePos.x},{sourcePos.y}L{targetPos.x},{targetPos.y}\\"\\n                    />\\n                {/if}\\n            {/each}\\n        </g>\\n    {/if}\\n\\n    {#if data.nodes && data.nodes.length > 0}\\n        <g class=\\"nodes\\">\\n            {#each data.nodes as node (node.id)}\\n                {@const position = nodePositions.get(node.id)}\\n                {#if position}\\n                    <g \\n                        class=\\"node {node.type} {node.group}\\"\\n                        transform={position.svgTransform}\\n                    >\\n                        <slot\\n                            {node}\\n                            transform={position.svgTransform}\\n                        />\\n                    </g>\\n                {/if}\\n            {/each}\\n        </g>\\n    {/if}\\n</g>\\n\\n<style>\\n    .graph-layout {\\n        width: 100%;\\n        height: 100%;\\n        pointer-events: none;\\n    }\\n\\n    .nodes {\\n        pointer-events: all;\\n    }\\n\\n    .edges {\\n        pointer-events: none;\\n    }\\n\\n    .edge {\\n        fill: none;\\n        stroke: rgba(255, 255, 255, 0.2);\\n        stroke-width: 1;\\n        transition: stroke-width 0.3s ease-out;\\n        vector-effect: non-scaling-stroke;\\n    }\\n\\n    .edge.live {\\n        stroke: rgba(255, 255, 255, 0.3);\\n        stroke-width: 1.5;\\n    }\\n\\n    :global(.node) {\\n        transition: transform 0.3s ease-out;\\n    }\\n</style>"],"names":[],"mappings":"AA0HI,2BAAc,CACV,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,cAAc,CAAE,IACpB,CAEA,oBAAO,CACH,cAAc,CAAE,GACpB,CAEA,oBAAO,CACH,cAAc,CAAE,IACpB,CAEA,mBAAM,CACF,IAAI,CAAE,IAAI,CACV,MAAM,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAChC,YAAY,CAAE,CAAC,CACf,UAAU,CAAE,YAAY,CAAC,IAAI,CAAC,QAAQ,CACtC,aAAa,CAAE,kBACnB,CAEA,KAAK,mBAAM,CACP,MAAM,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAChC,YAAY,CAAE,GAClB,CAEQ,KAAO,CACX,UAAU,CAAE,SAAS,CAAC,IAAI,CAAC,QAC/B"}`
};
const GraphLayout_1 = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  createEventDispatcher();
  let { data } = $$props;
  let { width } = $$props;
  let { height } = $$props;
  let { viewType } = $$props;
  let { isPreviewMode = false } = $$props;
  let nodePositions = /* @__PURE__ */ new Map();
  onDestroy(() => {
    console.log("GraphLayout destroying");
  });
  if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
  if ($$props.width === void 0 && $$bindings.width && width !== void 0) $$bindings.width(width);
  if ($$props.height === void 0 && $$bindings.height && height !== void 0) $$bindings.height(height);
  if ($$props.viewType === void 0 && $$bindings.viewType && viewType !== void 0) $$bindings.viewType(viewType);
  if ($$props.isPreviewMode === void 0 && $$bindings.isPreviewMode && isPreviewMode !== void 0) $$bindings.isPreviewMode(isPreviewMode);
  $$result.css.add(css$k);
  return `<g class="graph-layout svelte-hgk02u">${data.links && data.links.length > 0 ? `<g class="edges svelte-hgk02u" aria-hidden="true">${each(data.links, (link) => {
    let sourcePos = nodePositions.get(typeof link.source === "string" ? link.source : link.source.id), targetPos = nodePositions.get(typeof link.target === "string" ? link.target : link.target.id);
    return `  ${sourcePos && targetPos ? `<path class="${"edge " + escape(link.type, true) + " svelte-hgk02u"}" d="${"M" + escape(sourcePos.x, true) + "," + escape(sourcePos.y, true) + "L" + escape(targetPos.x, true) + "," + escape(targetPos.y, true)}"></path>` : ``}`;
  })}</g>` : ``}${data.nodes && data.nodes.length > 0 ? `<g class="nodes svelte-hgk02u">${each(data.nodes, (node) => {
    let position = nodePositions.get(node.id);
    return ` ${position ? `<g class="${"node " + escape(node.type, true) + " " + escape(node.group, true) + " svelte-hgk02u"}"${add_attribute("transform", position.svgTransform, 0)}>${slots.default ? slots.default({ node, transform: position.svgTransform }) : ``}</g>` : ``}`;
  })}</g>` : ``}</g>`;
});
const css$j = {
  code: ".graph-container.svelte-1gyns6w{width:100%;height:100vh;background:black;overflow:hidden;position:relative}.graph-svg.svelte-1gyns6w{width:100%;height:100%;cursor:grab;touch-action:none;position:absolute}.graph-svg.svelte-1gyns6w:active{cursor:grabbing}.background-layer.svelte-1gyns6w{pointer-events:none}.content-layer.svelte-1gyns6w{pointer-events:all}.graph-svg *{transform-box:fill-box;transform-origin:50% 50%}",
  map: '{"version":3,"file":"Graph.svelte","sources":["Graph.svelte"],"sourcesContent":["<!-- src/lib/components/graph/Graph.svelte -->\\n<script lang=\\"ts\\">import { onMount, onDestroy } from \\"svelte\\";\\nimport * as d3 from \\"d3\\";\\nimport { DEFAULT_BACKGROUND_CONFIG } from \\"./backgrounds/backgroundConfig\\";\\nimport { SvgBackground } from \\"./backgrounds/SvgBackground\\";\\nimport GraphLayout from \\"./layouts/GraphLayout.svelte\\";\\nexport let data;\\nexport let width = 6e3;\\nexport let height = 4800;\\nexport let viewType;\\nexport let backgroundConfig = {};\\nexport let isPreviewMode = false;\\nlet mounted = false;\\nlet container;\\nlet svg;\\nlet backgroundGroup;\\nlet contentGroup;\\nlet background = null;\\nlet transform = d3.zoomIdentity;\\nlet viewBox = \\"0 0 3000 2400\\";\\nconst mergedConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };\\nfunction updateDimensions() {\\n  if (!container) return;\\n  const rect = container.getBoundingClientRect();\\n  const containerWidth = Math.max(rect.width, 1e3);\\n  const containerHeight = Math.max(rect.height, 800);\\n  width = containerWidth;\\n  height = containerHeight;\\n  if (background) {\\n    background.resize(width, height);\\n  }\\n  console.log(\\"Dimensions updated:\\", { width, height });\\n  updateViewBox();\\n}\\nfunction initializeBackground() {\\n  if (!backgroundGroup) {\\n    console.log(\\"No background group found\\");\\n    return;\\n  }\\n  console.log(\\"Creating background with config:\\", mergedConfig);\\n  if (background) {\\n    background.destroy();\\n  }\\n  try {\\n    background = new SvgBackground(\\n      backgroundGroup,\\n      width,\\n      height,\\n      mergedConfig\\n    );\\n    console.log(\\"Background created:\\", background);\\n    background.start();\\n  } catch (error) {\\n    console.error(\\"Error initializing background:\\", error);\\n  }\\n}\\nfunction initializeZoom() {\\n  if (!svg || !contentGroup) return;\\n  const zoom = d3.zoom().scaleExtent([0.1, 4]).on(\\"zoom\\", (event) => {\\n    transform = event.transform;\\n    d3.select(contentGroup).attr(\\"transform\\", transform.toString());\\n  });\\n  d3.select(svg).call(zoom).call(zoom.transform, d3.zoomIdentity).on(\\"contextmenu\\", (event) => event.preventDefault());\\n}\\nfunction updateViewBox() {\\n  if (!width || !height) {\\n    console.log(\\"Skipping viewBox update - no dimensions\\");\\n    return;\\n  }\\n  const originX = -Math.round(width / 2);\\n  const originY = -Math.round(height / 2);\\n  const scaledWidth = Math.round(width);\\n  const scaledHeight = Math.round(height);\\n  viewBox = `${originX} ${originY} ${scaledWidth} ${scaledHeight}`;\\n  console.log(\\"ViewBox updated:\\", { originX, originY, scaledWidth, scaledHeight, viewBox });\\n}\\nonMount(() => {\\n  console.log(\\"Graph mounting with data:\\", data);\\n  mounted = true;\\n  updateDimensions();\\n  if (typeof window !== \\"undefined\\") {\\n    window.addEventListener(\\"resize\\", updateDimensions);\\n    if (width && height) {\\n      console.log(\\"Initializing graph with dimensions:\\", { width, height });\\n      initializeBackground();\\n      initializeZoom();\\n    }\\n  }\\n});\\nonDestroy(() => {\\n  if (typeof window !== \\"undefined\\") {\\n    window.removeEventListener(\\"resize\\", updateDimensions);\\n  }\\n  if (background) {\\n    background.destroy();\\n  }\\n});\\n$: {\\n  if (data) {\\n    console.log(\\"Graph data updated:\\", data);\\n  }\\n}\\n$: {\\n  if (mounted && width && height) {\\n    updateDimensions();\\n  }\\n}\\n<\/script>\\n\\n<div bind:this={container} class=\\"graph-container\\">\\n    <svg \\n        bind:this={svg}\\n        {width} \\n        {height}\\n        {viewBox}\\n        preserveAspectRatio=\\"xMidYMid meet\\"\\n        class=\\"graph-svg\\"\\n    >\\n        <defs>\\n            <!-- Add filters or patterns here -->\\n        </defs>\\n\\n        <!-- Background layer with explicit dimensions -->\\n        <g class=\\"background-layer\\">\\n            <svg \\n                width=\\"100%\\"\\n                height=\\"100%\\"\\n                overflow=\\"visible\\"\\n            >\\n                <g bind:this={backgroundGroup} />\\n            </svg>\\n        </g>\\n\\n        <!-- Content layer (gets transformed by zoom) -->\\n        <g \\n            bind:this={contentGroup} \\n            class=\\"content-layer\\"\\n        >\\n            <GraphLayout\\n                {data}\\n                {width}\\n                {height}\\n                {viewType}\\n                {isPreviewMode}\\n            >\\n                <svelte:fragment let:node let:transform>\\n                    <slot {node} {transform} />\\n                </svelte:fragment>\\n            </GraphLayout>\\n        </g>\\n    </svg>\\n</div>\\n\\n<style>\\n    .graph-container {\\n        width: 100%;\\n        height: 100vh;\\n        background: black;\\n        overflow: hidden;\\n        position: relative;\\n    }\\n\\n    .graph-svg {\\n        width: 100%;\\n        height: 100%;\\n        cursor: grab;\\n        touch-action: none;\\n        position: absolute;\\n    }\\n\\n    .graph-svg:active {\\n        cursor: grabbing;\\n    }\\n\\n    .background-layer {\\n        pointer-events: none;\\n    }\\n\\n    .content-layer {\\n        pointer-events: all;\\n    }\\n\\n    :global(.graph-svg *) {\\n        transform-box: fill-box;\\n        transform-origin: 50% 50%;\\n    }\\n</style>"],"names":[],"mappings":"AA0JI,+BAAiB,CACb,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,KAAK,CACb,UAAU,CAAE,KAAK,CACjB,QAAQ,CAAE,MAAM,CAChB,QAAQ,CAAE,QACd,CAEA,yBAAW,CACP,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,MAAM,CAAE,IAAI,CACZ,YAAY,CAAE,IAAI,CAClB,QAAQ,CAAE,QACd,CAEA,yBAAU,OAAQ,CACd,MAAM,CAAE,QACZ,CAEA,gCAAkB,CACd,cAAc,CAAE,IACpB,CAEA,6BAAe,CACX,cAAc,CAAE,GACpB,CAEQ,YAAc,CAClB,aAAa,CAAE,QAAQ,CACvB,gBAAgB,CAAE,GAAG,CAAC,GAC1B"}'
};
const Graph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { data } = $$props;
  let { width = 6e3 } = $$props;
  let { height = 4800 } = $$props;
  let { viewType } = $$props;
  let { backgroundConfig = {} } = $$props;
  let { isPreviewMode = false } = $$props;
  let container;
  let svg;
  let backgroundGroup;
  let contentGroup;
  let viewBox = "0 0 3000 2400";
  ({
    ...DEFAULT_BACKGROUND_CONFIG,
    ...backgroundConfig
  });
  function updateDimensions() {
    return;
  }
  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", updateDimensions);
    }
  });
  if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
  if ($$props.width === void 0 && $$bindings.width && width !== void 0) $$bindings.width(width);
  if ($$props.height === void 0 && $$bindings.height && height !== void 0) $$bindings.height(height);
  if ($$props.viewType === void 0 && $$bindings.viewType && viewType !== void 0) $$bindings.viewType(viewType);
  if ($$props.backgroundConfig === void 0 && $$bindings.backgroundConfig && backgroundConfig !== void 0) $$bindings.backgroundConfig(backgroundConfig);
  if ($$props.isPreviewMode === void 0 && $$bindings.isPreviewMode && isPreviewMode !== void 0) $$bindings.isPreviewMode(isPreviewMode);
  $$result.css.add(css$j);
  {
    {
      if (data) {
        console.log("Graph data updated:", data);
      }
    }
  }
  return `  <div class="graph-container svelte-1gyns6w"${add_attribute("this", container, 0)}><svg${add_attribute("width", width, 0)}${add_attribute("height", height, 0)}${add_attribute("viewBox", viewBox, 0)} preserveAspectRatio="xMidYMid meet" class="graph-svg svelte-1gyns6w"${add_attribute("this", svg, 0)}><defs></defs><g class="background-layer svelte-1gyns6w"><svg width="100%" height="100%" overflow="visible"><g${add_attribute("this", backgroundGroup, 0)}></g></svg></g><g class="content-layer svelte-1gyns6w"${add_attribute("this", contentGroup, 0)}>${validate_component(GraphLayout_1, "GraphLayout").$$render(
    $$result,
    {
      data,
      width,
      height,
      viewType,
      isPreviewMode
    },
    {},
    {
      default: ({ node, transform }) => {
        return `${slots.default ? slots.default({ node, transform }) : ``}`;
      }
    }
  )}</g></svg> </div>`;
});
function is_date(obj) {
  return Object.prototype.toString.call(obj) === "[object Date]";
}
function tick_spring(ctx, last_value, current_value, target_value) {
  if (typeof current_value === "number" || is_date(current_value)) {
    const delta = target_value - current_value;
    const velocity = (current_value - last_value) / (ctx.dt || 1 / 60);
    const spring2 = ctx.opts.stiffness * delta;
    const damper = ctx.opts.damping * velocity;
    const acceleration = (spring2 - damper) * ctx.inv_mass;
    const d = (velocity + acceleration) * ctx.dt;
    if (Math.abs(d) < ctx.opts.precision && Math.abs(delta) < ctx.opts.precision) {
      return target_value;
    } else {
      ctx.settled = false;
      return is_date(current_value) ? new Date(current_value.getTime() + d) : current_value + d;
    }
  } else if (Array.isArray(current_value)) {
    return current_value.map(
      (_, i) => tick_spring(ctx, last_value[i], current_value[i], target_value[i])
    );
  } else if (typeof current_value === "object") {
    const next_value = {};
    for (const k in current_value) {
      next_value[k] = tick_spring(ctx, last_value[k], current_value[k], target_value[k]);
    }
    return next_value;
  } else {
    throw new Error(`Cannot spring ${typeof current_value} values`);
  }
}
function spring(value, opts = {}) {
  const store = writable(value);
  const { stiffness = 0.15, damping = 0.8, precision = 0.01 } = opts;
  let last_time;
  let task;
  let current_token;
  let last_value = value;
  let target_value = value;
  let inv_mass = 1;
  let inv_mass_recovery_rate = 0;
  let cancel_task = false;
  function set(new_value, opts2 = {}) {
    target_value = new_value;
    const token = current_token = {};
    if (value == null || opts2.hard || spring2.stiffness >= 1 && spring2.damping >= 1) {
      cancel_task = true;
      last_time = now();
      last_value = new_value;
      store.set(value = target_value);
      return Promise.resolve();
    } else if (opts2.soft) {
      const rate = opts2.soft === true ? 0.5 : +opts2.soft;
      inv_mass_recovery_rate = 1 / (rate * 60);
      inv_mass = 0;
    }
    if (!task) {
      last_time = now();
      cancel_task = false;
      task = loop((now2) => {
        if (cancel_task) {
          cancel_task = false;
          task = null;
          return false;
        }
        inv_mass = Math.min(inv_mass + inv_mass_recovery_rate, 1);
        const ctx = {
          inv_mass,
          opts: spring2,
          settled: true,
          dt: (now2 - last_time) * 60 / 1e3
        };
        const next_value = tick_spring(ctx, last_value, value, target_value);
        last_time = now2;
        last_value = value;
        store.set(value = next_value);
        if (ctx.settled) {
          task = null;
        }
        return !ctx.settled;
      });
    }
    return new Promise((fulfil) => {
      task.promise.then(() => {
        if (token === current_token) fulfil();
      });
    });
  }
  const spring2 = {
    set,
    update: (fn, opts2) => set(fn(target_value, value), opts2),
    subscribe: store.subscribe,
    stiffness,
    damping,
    precision
  };
  return spring2;
}
const css$i = {
  code: ".base-node.svelte-23hgqn{transform-origin:center}.background-layer-1.svelte-23hgqn{fill:rgba(0, 0, 0, 0.5)}.background-layer-2.svelte-23hgqn{fill:rgba(0, 0, 0, 0.8)}.background-layer-3.svelte-23hgqn{fill:rgba(0, 0, 0, 0.9)}.content-background.svelte-23hgqn{fill:rgba(0, 0, 0, 0.95)}.outer-ring.svelte-23hgqn{stroke-width:6;vector-effect:non-scaling-stroke;transition:all 0.3s ease-out}.middle-ring.svelte-23hgqn{fill:none;stroke:rgba(255, 255, 255, 0.15);stroke-width:1}.base-node *{vector-effect:non-scaling-stroke}",
  map: '{"version":3,"file":"BaseNode.svelte","sources":["BaseNode.svelte"],"sourcesContent":["<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseNode.svelte -->\\n<script lang=\\"ts\\">import { createEventDispatcher } from \\"svelte\\";\\nexport let transform;\\nexport let style;\\nconst radius = style.previewSize / 2;\\nconst filterId = `glow-${Math.random().toString(36).slice(2)}`;\\nconst gradientId = `gradient-${Math.random().toString(36).slice(2)}`;\\n$: highlightColor = style.highlightColor || \\"#FFFFFF\\";\\nconst dispatch = createEventDispatcher();\\nfunction handleClick() {\\n  dispatch(\\"click\\");\\n}\\n<\/script>\\n \\n<!-- svelte-ignore a11y-click-events-have-key-events -->\\n<!-- svelte-ignore a11y-no-static-element-interactions -->\\n<g \\n    class=\\"base-node\\"\\n    {transform}\\n    on:click={handleClick}\\n>\\n    <defs>\\n        <filter id={filterId} x=\\"-100%\\" y=\\"-100%\\" width=\\"300%\\" height=\\"300%\\">\\n            <!-- Strong outer glow -->\\n            <feGaussianBlur in=\\"SourceAlpha\\" stdDeviation=\\"8\\" result=\\"blur1\\"/>\\n            <feFlood flood-color={highlightColor} flood-opacity=\\"0.6\\" result=\\"color1\\"/>\\n            <feComposite in=\\"color1\\" in2=\\"blur1\\" operator=\\"in\\" result=\\"shadow1\\"/>\\n \\n            <!-- Medium glow -->\\n            <feGaussianBlur in=\\"SourceAlpha\\" stdDeviation=\\"4\\" result=\\"blur2\\"/>\\n            <feFlood flood-color={highlightColor} flood-opacity=\\"0.8\\" result=\\"color2\\"/>\\n            <feComposite in=\\"color2\\" in2=\\"blur2\\" operator=\\"in\\" result=\\"shadow2\\"/>\\n \\n            <!-- Sharp inner glow -->\\n            <feGaussianBlur in=\\"SourceAlpha\\" stdDeviation=\\"1\\" result=\\"blur3\\"/>\\n            <feFlood flood-color={highlightColor} flood-opacity=\\"1\\" result=\\"color3\\"/>\\n            <feComposite in=\\"color3\\" in2=\\"blur3\\" operator=\\"in\\" result=\\"shadow3\\"/>\\n \\n            <feMerge>\\n                <feMergeNode in=\\"shadow1\\"/>\\n                <feMergeNode in=\\"shadow2\\"/>\\n                <feMergeNode in=\\"shadow3\\"/>\\n                <feMergeNode in=\\"SourceGraphic\\"/>\\n            </feMerge>\\n        </filter>\\n \\n        <!-- Gradient for the outer ring -->\\n        <radialGradient id={gradientId}>\\n            <stop offset=\\"0%\\" stop-color=\\"rgba(0,0,0,0)\\"/>\\n            <stop offset=\\"85%\\" stop-color={highlightColor} stop-opacity=\\"0.5\\"/>\\n            <stop offset=\\"100%\\" stop-color={highlightColor} stop-opacity=\\"0.1\\"/>\\n        </radialGradient>\\n    </defs>\\n \\n    <!-- Base layers for depth -->\\n    <circle\\n        r={radius}\\n        class=\\"background-layer-1\\"\\n    />\\n    \\n    <circle\\n        r={radius - 4}\\n        class=\\"background-layer-2\\"\\n    />\\n    \\n    <circle\\n        r={radius - 8}\\n        class=\\"background-layer-3\\"\\n    />\\n \\n    <!-- Main content background -->\\n    <circle\\n        r={radius - 12}\\n        class=\\"content-background\\"\\n    />\\n \\n    <!-- Decorative rings -->\\n    <circle\\n        r={radius}\\n        class=\\"outer-ring\\"\\n        style:stroke={highlightColor}\\n        style:stroke-opacity=\\"5.5\\"\\n        filter={`url(#${filterId})`}\\n    />\\n \\n    <circle\\n        r={radius}\\n        class=\\"middle-ring\\"\\n    />\\n    \\n    <slot {radius} />\\n</g>\\n \\n<style>\\n    .base-node {\\n        transform-origin: center;\\n    }\\n    \\n    /* Base layers for subtle depth effect */\\n    .background-layer-1 {\\n        fill: rgba(0, 0, 0, 0.5);  /* Lighter outer layer */\\n    }\\n    \\n    .background-layer-2 {\\n        fill: rgba(0, 0, 0, 0.8);  /* Darker middle layer */\\n    }\\n    \\n    .background-layer-3 {\\n        fill: rgba(0, 0, 0, 0.9);  /* Even darker inner layer */\\n    }\\n \\n    /* Main content background */\\n    .content-background {\\n        fill: rgba(0, 0, 0, 0.95);  /* Almost black content background for best contrast */\\n    }\\n \\n    /* Decorative rings */\\n    .outer-ring {\\n        stroke-width: 6;\\n        vector-effect: non-scaling-stroke;\\n        transition: all 0.3s ease-out;\\n    }\\n \\n    .middle-ring {\\n        fill: none;\\n        stroke: rgba(255, 255, 255, 0.15);\\n        stroke-width: 1;\\n    }\\n \\n    :global(.base-node *) {\\n        vector-effect: non-scaling-stroke;\\n    }\\n</style>"],"names":[],"mappings":"AA8FI,wBAAW,CACP,gBAAgB,CAAE,MACtB,CAGA,iCAAoB,CAChB,IAAI,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAC3B,CAEA,iCAAoB,CAChB,IAAI,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAC3B,CAEA,iCAAoB,CAChB,IAAI,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAC3B,CAGA,iCAAoB,CAChB,IAAI,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,IAAI,CAC5B,CAGA,yBAAY,CACR,YAAY,CAAE,CAAC,CACf,aAAa,CAAE,kBAAkB,CACjC,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,QACzB,CAEA,0BAAa,CACT,IAAI,CAAE,IAAI,CACV,MAAM,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,IAAI,CAAC,CACjC,YAAY,CAAE,CAClB,CAEQ,YAAc,CAClB,aAAa,CAAE,kBACnB"}'
};
const BaseNode = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let highlightColor;
  let { transform } = $$props;
  let { style } = $$props;
  const radius = style.previewSize / 2;
  const filterId = `glow-${Math.random().toString(36).slice(2)}`;
  const gradientId = `gradient-${Math.random().toString(36).slice(2)}`;
  createEventDispatcher();
  if ($$props.transform === void 0 && $$bindings.transform && transform !== void 0) $$bindings.transform(transform);
  if ($$props.style === void 0 && $$bindings.style && style !== void 0) $$bindings.style(style);
  $$result.css.add(css$i);
  highlightColor = style.highlightColor || "#FFFFFF";
  return `    <g class="base-node svelte-23hgqn"${add_attribute("transform", transform, 0)}><defs><filter${add_attribute("id", filterId, 0)} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur1"></feGaussianBlur><feFlood${add_attribute("flood-color", highlightColor, 0)} flood-opacity="0.6" result="color1"></feFlood><feComposite in="color1" in2="blur1" operator="in" result="shadow1"></feComposite><feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur2"></feGaussianBlur><feFlood${add_attribute("flood-color", highlightColor, 0)} flood-opacity="0.8" result="color2"></feFlood><feComposite in="color2" in2="blur2" operator="in" result="shadow2"></feComposite><feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur3"></feGaussianBlur><feFlood${add_attribute("flood-color", highlightColor, 0)} flood-opacity="1" result="color3"></feFlood><feComposite in="color3" in2="blur3" operator="in" result="shadow3"></feComposite><feMerge><feMergeNode in="shadow1"></feMergeNode><feMergeNode in="shadow2"></feMergeNode><feMergeNode in="shadow3"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter><radialGradient${add_attribute("id", gradientId, 0)}><stop offset="0%" stop-color="rgba(0,0,0,0)"></stop><stop offset="85%"${add_attribute("stop-color", highlightColor, 0)} stop-opacity="0.5"></stop><stop offset="100%"${add_attribute("stop-color", highlightColor, 0)} stop-opacity="0.1"></stop></radialGradient></defs><circle${add_attribute("r", radius, 0)} class="background-layer-1 svelte-23hgqn"></circle><circle${add_attribute("r", radius - 4, 0)} class="background-layer-2 svelte-23hgqn"></circle><circle${add_attribute("r", radius - 8, 0)} class="background-layer-3 svelte-23hgqn"></circle><circle${add_attribute("r", radius - 12, 0)} class="content-background svelte-23hgqn"></circle><circle${add_attribute("r", radius, 0)} class="outer-ring svelte-23hgqn"${add_attribute("filter", `url(#${filterId})`, 0)}${add_styles({
    "stroke": highlightColor,
    "stroke-opacity": `5.5`
  })}></circle><circle${add_attribute("r", radius, 0)} class="middle-ring svelte-23hgqn"></circle>${slots.default ? slots.default({ radius }) : ``}</g>`;
});
const css$h = {
  code: ".detail-node.svelte-1ebasdh{will-change:transform}.detail-node text{fill:white;font-family:'Orbitron', sans-serif;text-anchor:middle}",
  map: `{"version":3,"file":"BaseDetailNode.svelte","sources":["BaseDetailNode.svelte"],"sourcesContent":["<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseDetailNode.svelte -->\\n<script lang=\\"ts\\">import { onMount } from \\"svelte\\";\\nimport { spring } from \\"svelte/motion\\";\\nimport BaseSvgNode from \\"./BaseNode.svelte\\";\\nimport { CIRCLE_RADIUS } from \\"./BaseNodeConstants\\";\\nexport let style;\\nconst baseOpacity = spring(0, { stiffness: 0.3, damping: 0.8 });\\nonMount(() => {\\n  baseOpacity.set(1);\\n});\\n$: detailStyle = {\\n  ...style,\\n  previewSize: CIRCLE_RADIUS * 2\\n};\\n$: radius = CIRCLE_RADIUS;\\n<\/script>\\n \\n<g \\n    class=\\"detail-node\\"\\n    style:opacity={$baseOpacity}\\n    style:transform-origin=\\"center\\"\\n>\\n    <BaseSvgNode \\n        transform=\\"\\" \\n        style={detailStyle}\\n    >\\n        <slot {radius} />\\n    </BaseSvgNode>\\n</g>\\n \\n<style>\\n    .detail-node {\\n        will-change: transform;\\n    }\\n \\n    :global(.detail-node text) {\\n        fill: white;\\n        font-family: 'Orbitron', sans-serif;\\n        text-anchor: middle;\\n    }\\n</style>"],"names":[],"mappings":"AA+BI,2BAAa,CACT,WAAW,CAAE,SACjB,CAEQ,iBAAmB,CACvB,IAAI,CAAE,KAAK,CACX,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,WAAW,CAAE,MACjB"}`
};
const BaseDetailNode = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let detailStyle;
  let radius;
  let $baseOpacity, $$unsubscribe_baseOpacity;
  let { style } = $$props;
  const baseOpacity = spring(0, { stiffness: 0.3, damping: 0.8 });
  $$unsubscribe_baseOpacity = subscribe(baseOpacity, (value) => $baseOpacity = value);
  if ($$props.style === void 0 && $$bindings.style && style !== void 0) $$bindings.style(style);
  $$result.css.add(css$h);
  detailStyle = { ...style, previewSize: CIRCLE_RADIUS * 2 };
  radius = CIRCLE_RADIUS;
  $$unsubscribe_baseOpacity();
  return `  <g class="detail-node svelte-1ebasdh"${add_styles({
    "opacity": $baseOpacity,
    "transform-origin": `center`
  })}>${validate_component(BaseNode, "BaseSvgNode").$$render($$result, { transform: "", style: detailStyle }, {}, {
    default: () => {
      return `${slots.default ? slots.default({ radius }) : ``}`;
    }
  })}</g>`;
});
const css$g = {
  code: "text.svelte-1w67vw4{font-family:'Orbitron', sans-serif;fill:white}.title.svelte-1w67vw4{font-size:30px;text-anchor:middle}.label.svelte-1w67vw4{font-size:14px;opacity:0.7}.value.svelte-1w67vw4{font-size:14px;text-anchor:middle}.left-align.svelte-1w67vw4{text-anchor:start}",
  map: `{"version":3,"file":"DashboardNode.svelte","sources":["DashboardNode.svelte"],"sourcesContent":["<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/dashboard/DashboardNode.svelte -->\\n<script lang=\\"ts\\">import BaseSvgDetailNode from \\"../base/BaseDetailNode.svelte\\";\\nimport { NODE_CONSTANTS } from \\"../base/BaseNodeConstants\\";\\nexport let node;\\nexport let userActivity;\\nconst METRICS_SPACING = {\\n  labelX: -200,\\n  equalsX: 0,\\n  valueX: 30\\n};\\nfunction getWrappedText(text, maxWidth, x) {\\n  const words = text.split(\\" \\");\\n  const lines = [];\\n  let currentLine = \\"\\";\\n  let lineCount = 0;\\n  const tempText = document.createElementNS(\\"http://www.w3.org/2000/svg\\", \\"text\\");\\n  tempText.setAttribute(\\"font-family\\", \\"Orbitron\\");\\n  tempText.setAttribute(\\"font-size\\", \\"14px\\");\\n  tempText.setAttribute(\\"x\\", \\"-1000\\");\\n  tempText.setAttribute(\\"y\\", \\"-1000\\");\\n  const svg = document.querySelector(\\"svg\\");\\n  if (!svg) return lines;\\n  svg.appendChild(tempText);\\n  words.forEach((word) => {\\n    const testLine = currentLine + (currentLine ? \\" \\" : \\"\\") + word;\\n    tempText.textContent = testLine;\\n    const testWidth = tempText.getComputedTextLength();\\n    if (testWidth > maxWidth && currentLine !== \\"\\") {\\n      lines.push({\\n        text: currentLine,\\n        x,\\n        dy: lineCount * 20\\n      });\\n      currentLine = word;\\n      lineCount++;\\n    } else {\\n      currentLine = testLine;\\n    }\\n  });\\n  if (currentLine) {\\n    lines.push({\\n      text: currentLine,\\n      x,\\n      dy: lineCount * 20\\n    });\\n  }\\n  svg.removeChild(tempText);\\n  return lines;\\n}\\n$: missionStatementLines = getWrappedText(\\n  node.mission_statement || \\"no mission statement set.\\",\\n  420,\\n  METRICS_SPACING.labelX\\n);\\nconst style = {\\n  previewSize: NODE_CONSTANTS.SIZES.DASHBOARD.size,\\n  detailSize: NODE_CONSTANTS.SIZES.DASHBOARD.size,\\n  colors: NODE_CONSTANTS.COLORS.DASHBOARD,\\n  padding: NODE_CONSTANTS.PADDING,\\n  lineHeight: NODE_CONSTANTS.LINE_HEIGHT,\\n  stroke: NODE_CONSTANTS.STROKE\\n};\\n<\/script>\\n\\n<BaseSvgDetailNode {style}>\\n    <svelte:fragment let:radius let:isHovered>\\n        <!-- Title -->\\n        <text \\n            dy={-radius + 120} \\n            class=\\"title\\"\\n        >\\n            ProjectZer0\\n        </text>\\n\\n        <!-- Name -->\\n        <g transform=\\"translate(0, {-radius + 170})\\">\\n            <text \\n                x={METRICS_SPACING.labelX}\\n                class=\\"label left-align\\"\\n            >\\n                name:\\n            </text>\\n            <text \\n                x={METRICS_SPACING.labelX}\\n                dy=\\"25\\"\\n                class=\\"value left-align\\"\\n            >\\n                {node.preferred_username || node.name || node.nickname || 'User'}\\n            </text>\\n        </g>\\n\\n        <!-- Mission Statement -->\\n        <g transform=\\"translate(0, {-radius + 230})\\">\\n            <text \\n                x={METRICS_SPACING.labelX}\\n                class=\\"label left-align\\"\\n            >\\n                mission statement:\\n            </text>\\n            {#each missionStatementLines as line, i}\\n                <text \\n                    x={line.x}\\n                    dy={25 + line.dy}\\n                    class=\\"value left-align\\"\\n                >\\n                    {line.text}\\n                </text>\\n            {/each}\\n        </g>\\n\\n        <!-- Activity Stats -->\\n        {#if userActivity}\\n            <g transform=\\"translate(0, {-radius + 390})\\">\\n                <text \\n                    x={METRICS_SPACING.labelX}\\n                    class=\\"label left-align\\"\\n                >\\n                    activity stats:\\n                </text>\\n                <g transform=\\"translate(0, 30)\\">\\n                    <text \\n                        x={METRICS_SPACING.labelX}\\n                        class=\\"value left-align\\"\\n                    >\\n                        nodes created\\n                    </text>\\n                    <text \\n                        class=\\"value\\"\\n                    >\\n                        =\\n                    </text>\\n                    <text \\n                        x={METRICS_SPACING.valueX}\\n                        class=\\"value left-align\\"\\n                    >\\n                        {userActivity.nodesCreated}\\n                    </text>\\n                </g>\\n                <g transform=\\"translate(0, 60)\\">\\n                    <text \\n                        x={METRICS_SPACING.labelX}\\n                        class=\\"value left-align\\"\\n                    >\\n                        votes cast\\n                    </text>\\n                    <text \\n                        class=\\"value\\"\\n                    >\\n                        =\\n                    </text>\\n                    <text \\n                        x={METRICS_SPACING.valueX}\\n                        class=\\"value left-align\\"\\n                    >\\n                        {userActivity.votesCast}\\n                    </text>\\n                </g>\\n            </g>\\n        {/if}\\n    </svelte:fragment>\\n</BaseSvgDetailNode>\\n\\n<style>\\n    text {\\n        font-family: 'Orbitron', sans-serif;\\n        fill: white;\\n    }\\n\\n    .title {\\n        font-size: 30px;\\n        text-anchor: middle;\\n    }\\n\\n    .label {\\n        font-size: 14px;\\n        opacity: 0.7;\\n    }\\n\\n    .value {\\n        font-size: 14px;\\n        text-anchor: middle;\\n    }\\n\\n    .left-align {\\n        text-anchor: start;\\n    }\\n</style>"],"names":[],"mappings":"AAmKI,mBAAK,CACD,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,IAAI,CAAE,KACV,CAEA,qBAAO,CACH,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,MACjB,CAEA,qBAAO,CACH,SAAS,CAAE,IAAI,CACf,OAAO,CAAE,GACb,CAEA,qBAAO,CACH,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,MACjB,CAEA,0BAAY,CACR,WAAW,CAAE,KACjB"}`
};
function getWrappedText(text, maxWidth, x) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";
  let lineCount = 0;
  const tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  tempText.setAttribute("font-family", "Orbitron");
  tempText.setAttribute("font-size", "14px");
  tempText.setAttribute("x", "-1000");
  tempText.setAttribute("y", "-1000");
  const svg = document.querySelector("svg");
  if (!svg) return lines;
  svg.appendChild(tempText);
  words.forEach((word) => {
    const testLine = currentLine + (currentLine ? " " : "") + word;
    tempText.textContent = testLine;
    const testWidth = tempText.getComputedTextLength();
    if (testWidth > maxWidth && currentLine !== "") {
      lines.push({ text: currentLine, x, dy: lineCount * 20 });
      currentLine = word;
      lineCount++;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) {
    lines.push({ text: currentLine, x, dy: lineCount * 20 });
  }
  svg.removeChild(tempText);
  return lines;
}
const DashboardNode = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let missionStatementLines;
  let { node } = $$props;
  let { userActivity } = $$props;
  const METRICS_SPACING = { labelX: -200, equalsX: 0, valueX: 30 };
  const style = {
    previewSize: NODE_CONSTANTS.SIZES.DASHBOARD.size,
    detailSize: NODE_CONSTANTS.SIZES.DASHBOARD.size,
    colors: NODE_CONSTANTS.COLORS.DASHBOARD,
    padding: NODE_CONSTANTS.PADDING,
    lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
    stroke: NODE_CONSTANTS.STROKE
  };
  if ($$props.node === void 0 && $$bindings.node && node !== void 0) $$bindings.node(node);
  if ($$props.userActivity === void 0 && $$bindings.userActivity && userActivity !== void 0) $$bindings.userActivity(userActivity);
  $$result.css.add(css$g);
  missionStatementLines = getWrappedText(node.mission_statement || "no mission statement set.", 420, METRICS_SPACING.labelX);
  return `  ${validate_component(BaseDetailNode, "BaseSvgDetailNode").$$render($$result, { style }, {}, {
    default: ({ radius, isHovered }) => {
      return ` <text${add_attribute("dy", -radius + 120, 0)} class="title svelte-1w67vw4">ProjectZer0</text>  <g transform="${"translate(0, " + escape(-radius + 170, true) + ")"}"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="label left-align svelte-1w67vw4">name:
            </text><text${add_attribute("x", METRICS_SPACING.labelX, 0)} dy="25" class="value left-align svelte-1w67vw4">${escape(node.preferred_username || node.name || node.nickname || "User")}</text></g>  <g transform="${"translate(0, " + escape(-radius + 230, true) + ")"}"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="label left-align svelte-1w67vw4">mission statement:
            </text>${each(missionStatementLines, (line, i) => {
        return `<text${add_attribute("x", line.x, 0)}${add_attribute("dy", 25 + line.dy, 0)} class="value left-align svelte-1w67vw4">${escape(line.text)}</text>`;
      })}</g>  ${userActivity ? `<g transform="${"translate(0, " + escape(-radius + 390, true) + ")"}"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="label left-align svelte-1w67vw4">activity stats:
                </text><g transform="translate(0, 30)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="value left-align svelte-1w67vw4">nodes created
                    </text><text class="value svelte-1w67vw4">=
                    </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="value left-align svelte-1w67vw4">${escape(userActivity.nodesCreated)}</text></g><g transform="translate(0, 60)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="value left-align svelte-1w67vw4">votes cast
                    </text><text class="value svelte-1w67vw4">=
                    </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="value left-align svelte-1w67vw4">${escape(userActivity.votesCast)}</text></g></g>` : ``}`;
    }
  })}`;
});
async function updateUserProfile(userData) {
  try {
    console.log("Updating user profile...");
    const updatedUserData = await fetchWithAuth("/users/update-profile", {
      method: "POST",
      body: JSON.stringify(userData)
    });
    console.log("User profile updated:", updatedUserData);
    return updatedUserData;
  } catch (error) {
    console.error("Error updating user profile:", error);
    return null;
  }
}
const FORM_STYLES = {
  layout: {
    leftAlign: -200,
    // Single constant for left alignment
    fieldWidth: 400,
    // Width of form fields
    buttonWidth: 150,
    // Width for the save button
    verticalSpacing: {
      betweenFields: 75,
      // Space between each field group
      labelToInput: 10
      // Space between label and its input
    }
  },
  inputs: {
    background: "rgba(0, 0, 0, 0.9)",
    border: {
      default: "2px solid rgba(255, 255, 255, 0.3)",
      focus: "3px solid rgba(255, 255, 255, 0.8)",
      error: "2px solid #ff4444"
    },
    text: "white",
    borderRadius: "4px",
    padding: "8px",
    font: {
      family: "Orbitron",
      size: "0.9rem"
    },
    shadow: {
      focus: "0 0 0 1px rgba(255, 255, 255, 0.3)"
    }
  },
  buttons: {
    save: {
      background: "rgba(74, 144, 226, 0.3)",
      border: "1px solid rgba(74, 144, 226, 0.4)",
      hoverBg: "rgba(74, 144, 226, 0.4)"
    }
  },
  text: {
    label: {
      size: "14px",
      color: "rgba(255, 255, 255, 0.7)"
    },
    characterCount: {
      size: "12px",
      color: "rgba(255, 255, 255, 0.6)",
      warning: "#ffd700",
      error: "#ff4444"
    }
  }
};
const css$f = {
  code: ".label.svelte-1n43n7y{font-size:14px;text-anchor:start;fill:rgba(255, 255, 255, 0.7);font-family:'Orbitron', sans-serif}input.input{width:100%;background:rgba(0, 0, 0, 0.9);border:2px solid rgba(255, 255, 255, 0.3);border-radius:4px;color:white;padding:8px;font-family:'Orbitron', sans-serif;transition:all 0.2s ease;box-sizing:border-box;display:block;margin:0}input.input:focus{outline:none;border:3px solid rgba(255, 255, 255, 0.8);box-shadow:0 0 0 1px rgba(255, 255, 255, 0.3)}",
  map: `{"version":3,"file":"UsernameInput.svelte","sources":["UsernameInput.svelte"],"sourcesContent":["<!-- src/lib/components/forms/editProfile/UsernameInput.svelte -->\\n<script lang=\\"ts\\">import { FORM_STYLES } from \\"$lib/styles/forms\\";\\nexport let username = \\"\\";\\nexport let disabled = false;\\n<\/script>\\n \\n <text \\n    x={FORM_STYLES.layout.leftAlign}\\n    class=\\"label\\"\\n >\\n    Username:\\n </text>\\n \\n <foreignObject \\n    x={FORM_STYLES.layout.leftAlign} \\n    y={FORM_STYLES.layout.verticalSpacing.labelToInput} \\n    width={FORM_STYLES.layout.fieldWidth} \\n    height=\\"40\\"\\n >\\n    <input\\n        type=\\"text\\"\\n        id=\\"username-input\\"\\n        bind:value={username}\\n        placeholder=\\"Enter username\\"\\n        class=\\"input\\"\\n        {disabled}\\n    />\\n </foreignObject>\\n \\n <style>\\n    .label {\\n        font-size: 14px;\\n        text-anchor: start;\\n        fill: rgba(255, 255, 255, 0.7);\\n        font-family: 'Orbitron', sans-serif;\\n    }\\n \\n    :global(input.input) {\\n        width: 100%;\\n        background: rgba(0, 0, 0, 0.9);\\n        border: 2px solid rgba(255, 255, 255, 0.3);\\n        border-radius: 4px;\\n        color: white;\\n        padding: 8px;\\n        font-family: 'Orbitron', sans-serif;\\n        transition: all 0.2s ease;\\n        box-sizing: border-box;\\n        display: block;\\n        margin: 0;\\n    }\\n \\n    :global(input.input:focus) {\\n        outline: none;\\n        border: 3px solid rgba(255, 255, 255, 0.8);\\n        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);\\n    }\\n </style>"],"names":[],"mappings":"AA8BI,qBAAO,CACH,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,KAAK,CAClB,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC9B,WAAW,CAAE,UAAU,CAAC,CAAC,UAC7B,CAEQ,WAAa,CACjB,KAAK,CAAE,IAAI,CACX,UAAU,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAC9B,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,aAAa,CAAE,GAAG,CAClB,KAAK,CAAE,KAAK,CACZ,OAAO,CAAE,GAAG,CACZ,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,IAAI,CACzB,UAAU,CAAE,UAAU,CACtB,OAAO,CAAE,KAAK,CACd,MAAM,CAAE,CACZ,CAEQ,iBAAmB,CACvB,OAAO,CAAE,IAAI,CACb,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,UAAU,CAAE,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjD"}`
};
const UsernameInput = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { username = "" } = $$props;
  let { disabled = false } = $$props;
  if ($$props.username === void 0 && $$bindings.username && username !== void 0) $$bindings.username(username);
  if ($$props.disabled === void 0 && $$bindings.disabled && disabled !== void 0) $$bindings.disabled(disabled);
  $$result.css.add(css$f);
  return `  <text${add_attribute("x", FORM_STYLES.layout.leftAlign, 0)} class="label svelte-1n43n7y">Username:</text> <foreignObject${add_attribute("x", FORM_STYLES.layout.leftAlign, 0)}${add_attribute("y", FORM_STYLES.layout.verticalSpacing.labelToInput, 0)}${add_attribute("width", FORM_STYLES.layout.fieldWidth, 0)} height="40"><input type="text" id="username-input" placeholder="Enter username" class="input" ${disabled ? "disabled" : ""}${add_attribute("value", username, 0)}></foreignObject>`;
});
const css$e = {
  code: ".label.svelte-1jbaojg{font-size:14px;text-anchor:start;fill:rgba(255, 255, 255, 0.7);font-family:'Orbitron', sans-serif}input.input{width:100%;background:rgba(0, 0, 0, 0.9);border:2px solid rgba(255, 255, 255, 0.3);border-radius:4px;color:white;padding:8px;font-family:'Orbitron', sans-serif;transition:all 0.2s ease;box-sizing:border-box;display:block;margin:0}input.input:focus{outline:none;border:3px solid rgba(255, 255, 255, 0.8);box-shadow:0 0 0 1px rgba(255, 255, 255, 0.3)}",
  map: `{"version":3,"file":"EmailInput.svelte","sources":["EmailInput.svelte"],"sourcesContent":["<!-- src/lib/components/forms/editProfile/EmailInput.svelte -->\\n<script lang=\\"ts\\">import { FORM_STYLES } from \\"$lib/styles/forms\\";\\nexport let email = \\"\\";\\nexport let disabled = false;\\n<\/script>\\n\\n<g>\\n    <!-- Label -->\\n    <text \\n        x={FORM_STYLES.layout.leftAlign}\\n        y={FORM_STYLES.layout.verticalSpacing.betweenFields}\\n        class=\\"label\\"\\n    >\\n        Email:\\n    </text>\\n\\n    <!-- Input Field -->\\n    <foreignObject \\n        x={FORM_STYLES.layout.leftAlign} \\n        y={FORM_STYLES.layout.verticalSpacing.betweenFields + FORM_STYLES.layout.verticalSpacing.labelToInput} \\n        width={FORM_STYLES.layout.fieldWidth} \\n        height=\\"40\\"\\n    >\\n        <input\\n            type=\\"email\\"\\n            bind:value={email}\\n            placeholder=\\"Enter email\\"\\n            class=\\"input\\"\\n            {disabled}\\n        />\\n    </foreignObject>\\n</g>\\n\\n<style>\\n    .label {\\n        font-size: 14px;\\n        text-anchor: start;\\n        fill: rgba(255, 255, 255, 0.7);\\n        font-family: 'Orbitron', sans-serif;\\n    }\\n\\n    :global(input.input) {\\n        width: 100%;\\n        background: rgba(0, 0, 0, 0.9);\\n        border: 2px solid rgba(255, 255, 255, 0.3);\\n        border-radius: 4px;\\n        color: white;\\n        padding: 8px;\\n        font-family: 'Orbitron', sans-serif;\\n        transition: all 0.2s ease;\\n        box-sizing: border-box;\\n        display: block;\\n        margin: 0;\\n    }\\n\\n    :global(input.input:focus) {\\n        outline: none;\\n        border: 3px solid rgba(255, 255, 255, 0.8);\\n        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);\\n    }\\n</style>"],"names":[],"mappings":"AAkCI,qBAAO,CACH,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,KAAK,CAClB,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC9B,WAAW,CAAE,UAAU,CAAC,CAAC,UAC7B,CAEQ,WAAa,CACjB,KAAK,CAAE,IAAI,CACX,UAAU,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAC9B,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,aAAa,CAAE,GAAG,CAClB,KAAK,CAAE,KAAK,CACZ,OAAO,CAAE,GAAG,CACZ,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,IAAI,CACzB,UAAU,CAAE,UAAU,CACtB,OAAO,CAAE,KAAK,CACd,MAAM,CAAE,CACZ,CAEQ,iBAAmB,CACvB,OAAO,CAAE,IAAI,CACb,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,UAAU,CAAE,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjD"}`
};
const EmailInput = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { email = "" } = $$props;
  let { disabled = false } = $$props;
  if ($$props.email === void 0 && $$bindings.email && email !== void 0) $$bindings.email(email);
  if ($$props.disabled === void 0 && $$bindings.disabled && disabled !== void 0) $$bindings.disabled(disabled);
  $$result.css.add(css$e);
  return `  <g><text${add_attribute("x", FORM_STYLES.layout.leftAlign, 0)}${add_attribute("y", FORM_STYLES.layout.verticalSpacing.betweenFields, 0)} class="label svelte-1jbaojg">Email:
    </text><foreignObject${add_attribute("x", FORM_STYLES.layout.leftAlign, 0)}${add_attribute("y", FORM_STYLES.layout.verticalSpacing.betweenFields + FORM_STYLES.layout.verticalSpacing.labelToInput, 0)}${add_attribute("width", FORM_STYLES.layout.fieldWidth, 0)} height="40"><input type="email" placeholder="Enter email" class="input" ${disabled ? "disabled" : ""}${add_attribute("value", email, 0)}></foreignObject></g>`;
});
const css$d = {
  code: ".label.svelte-34co8w{font-size:14px;text-anchor:start;fill:rgba(255, 255, 255, 0.7);font-family:'Orbitron', sans-serif}.character-count.svelte-34co8w{font-size:12px;text-anchor:end;fill:rgba(255, 255, 255, 0.6);font-family:'Orbitron', sans-serif}.character-count.near-limit.svelte-34co8w{fill:#ffd700}.character-count.over-limit.svelte-34co8w{fill:#ff4444}textarea.textarea{width:100%;background:rgba(0, 0, 0, 0.9);border:2px solid rgba(255, 255, 255, 0.3);border-radius:4px;color:white;padding:8px;font-family:'Orbitron', sans-serif;transition:all 0.2s ease;box-sizing:border-box;display:block;margin:0;height:120px;resize:none}textarea.textarea:focus{outline:none;border:3px solid rgba(255, 255, 255, 0.8);box-shadow:0 0 0 1px rgba(255, 255, 255, 0.3)}",
  map: `{"version":3,"file":"MissionStatementInput.svelte","sources":["MissionStatementInput.svelte"],"sourcesContent":["<!-- src/lib/components/forms/editProfile/MissionStatementInput.svelte -->\\n<script lang=\\"ts\\">import { FORM_STYLES } from \\"$lib/styles/forms\\";\\nexport let statement = \\"\\";\\nexport let disabled = false;\\nconst MAX_LENGTH = 280;\\n$: remaining = MAX_LENGTH - statement.length;\\n$: isNearLimit = remaining <= 20;\\n$: isOverLimit = remaining < 0;\\n<\/script>\\n\\n<g>\\n    <!-- Label -->\\n    <text \\n        x={FORM_STYLES.layout.leftAlign}\\n        y={FORM_STYLES.layout.verticalSpacing.betweenFields * 2}\\n        class=\\"label\\"\\n    >\\n        Mission Statement:\\n    </text>\\n\\n    <!-- Input Field -->\\n    <foreignObject \\n        x={FORM_STYLES.layout.leftAlign} \\n        y={FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + FORM_STYLES.layout.verticalSpacing.labelToInput} \\n        width={FORM_STYLES.layout.fieldWidth} \\n        height=\\"150\\"\\n    >\\n        <textarea\\n            id=\\"mission-statement-input\\"\\n            bind:value={statement}\\n            placeholder=\\"Enter mission statement\\"\\n            class=\\"textarea\\"\\n            maxlength={MAX_LENGTH}\\n            {disabled}\\n        />\\n    </foreignObject>\\n\\n    <!-- Character Count -->\\n    <text\\n        x={FORM_STYLES.layout.leftAlign + FORM_STYLES.layout.fieldWidth}\\n        y={FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + 145}\\n        class=\\"character-count\\"\\n        class:near-limit={isNearLimit}\\n        class:over-limit={isOverLimit}\\n    >\\n        {remaining} characters remaining\\n    </text>\\n</g>\\n\\n<style>\\n    .label {\\n        font-size: 14px;\\n        text-anchor: start;\\n        fill: rgba(255, 255, 255, 0.7);\\n        font-family: 'Orbitron', sans-serif;\\n    }\\n\\n    .character-count {\\n        font-size: 12px;\\n        text-anchor: end;\\n        fill: rgba(255, 255, 255, 0.6);\\n        font-family: 'Orbitron', sans-serif;\\n    }\\n\\n    .character-count.near-limit {\\n        fill: #ffd700;\\n    }\\n\\n    .character-count.over-limit {\\n        fill: #ff4444;\\n    }\\n\\n    :global(textarea.textarea) {\\n        width: 100%;\\n        background: rgba(0, 0, 0, 0.9);\\n        border: 2px solid rgba(255, 255, 255, 0.3);\\n        border-radius: 4px;\\n        color: white;\\n        padding: 8px;\\n        font-family: 'Orbitron', sans-serif;\\n        transition: all 0.2s ease;\\n        box-sizing: border-box;\\n        display: block;\\n        margin: 0;\\n        height: 120px;\\n        resize: none;\\n    }\\n\\n    :global(textarea.textarea:focus) {\\n        outline: none;\\n        border: 3px solid rgba(255, 255, 255, 0.8);\\n        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);\\n    }\\n</style>"],"names":[],"mappings":"AAkDI,oBAAO,CACH,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,KAAK,CAClB,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC9B,WAAW,CAAE,UAAU,CAAC,CAAC,UAC7B,CAEA,8BAAiB,CACb,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,GAAG,CAChB,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC9B,WAAW,CAAE,UAAU,CAAC,CAAC,UAC7B,CAEA,gBAAgB,yBAAY,CACxB,IAAI,CAAE,OACV,CAEA,gBAAgB,yBAAY,CACxB,IAAI,CAAE,OACV,CAEQ,iBAAmB,CACvB,KAAK,CAAE,IAAI,CACX,UAAU,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAC9B,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,aAAa,CAAE,GAAG,CAClB,KAAK,CAAE,KAAK,CACZ,OAAO,CAAE,GAAG,CACZ,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,IAAI,CACzB,UAAU,CAAE,UAAU,CACtB,OAAO,CAAE,KAAK,CACd,MAAM,CAAE,CAAC,CACT,MAAM,CAAE,KAAK,CACb,MAAM,CAAE,IACZ,CAEQ,uBAAyB,CAC7B,OAAO,CAAE,IAAI,CACb,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,UAAU,CAAE,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjD"}`
};
const MAX_LENGTH = 280;
const MissionStatementInput = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let remaining;
  let isNearLimit;
  let isOverLimit;
  let { statement = "" } = $$props;
  let { disabled = false } = $$props;
  if ($$props.statement === void 0 && $$bindings.statement && statement !== void 0) $$bindings.statement(statement);
  if ($$props.disabled === void 0 && $$bindings.disabled && disabled !== void 0) $$bindings.disabled(disabled);
  $$result.css.add(css$d);
  remaining = MAX_LENGTH - statement.length;
  isNearLimit = remaining <= 20;
  isOverLimit = remaining < 0;
  return `  <g><text${add_attribute("x", FORM_STYLES.layout.leftAlign, 0)}${add_attribute("y", FORM_STYLES.layout.verticalSpacing.betweenFields * 2, 0)} class="label svelte-34co8w">Mission Statement:
    </text><foreignObject${add_attribute("x", FORM_STYLES.layout.leftAlign, 0)}${add_attribute("y", FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + FORM_STYLES.layout.verticalSpacing.labelToInput, 0)}${add_attribute("width", FORM_STYLES.layout.fieldWidth, 0)} height="150"><textarea id="mission-statement-input" placeholder="Enter mission statement" class="textarea"${add_attribute("maxlength", MAX_LENGTH, 0)} ${disabled ? "disabled" : ""}>${escape(statement || "")}</textarea></foreignObject><text${add_attribute("x", FORM_STYLES.layout.leftAlign + FORM_STYLES.layout.fieldWidth, 0)}${add_attribute("y", FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + 145, 0)} class="${[
    "character-count svelte-34co8w",
    (isNearLimit ? "near-limit" : "") + " " + (isOverLimit ? "over-limit" : "")
  ].join(" ").trim()}">${escape(remaining)} characters remaining</text></g>`;
});
const css$c = {
  code: "button.save-button{width:100%;background:rgba(74, 144, 226, 0.3);border:1px solid rgba(74, 144, 226, 0.4);border-radius:4px;color:white;padding:8px 16px;cursor:pointer;font-family:'Orbitron', sans-serif;transition:all 0.2s ease;display:flex;align-items:center;justify-content:center;min-width:100px;box-sizing:border-box;margin:0}button.save-button:hover:not(:disabled){transform:translateY(-1px);background:rgba(74, 144, 226, 0.4)}button.save-button:active:not(:disabled){transform:translateY(0)}button.save-button:disabled{opacity:0.5;cursor:not-allowed}",
  map: `{"version":3,"file":"SaveButton.svelte","sources":["SaveButton.svelte"],"sourcesContent":["<!-- src/lib/components/forms/editProfile/SaveButton.svelte -->\\n<script lang=\\"ts\\">import { FORM_STYLES } from \\"$lib/styles/forms\\";\\nexport let loading;\\nexport let disabled;\\nexport let onClick;\\n<\/script>\\n \\n <foreignObject \\n    x={-FORM_STYLES.layout.buttonWidth / 2} \\n    y={FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + 190} \\n    width={FORM_STYLES.layout.buttonWidth} \\n    height=\\"40\\"\\n >\\n    <button\\n        class=\\"save-button\\"\\n        on:click={onClick}\\n        {disabled}\\n    >\\n        {#if loading}\\n            Loading...\\n        {:else}\\n            Save Changes\\n        {/if}\\n    </button>\\n </foreignObject>\\n \\n <style>\\n    :global(button.save-button) {\\n        width: 100%;\\n        background: rgba(74, 144, 226, 0.3);\\n        border: 1px solid rgba(74, 144, 226, 0.4);\\n        border-radius: 4px;\\n        color: white;\\n        padding: 8px 16px;\\n        cursor: pointer;\\n        font-family: 'Orbitron', sans-serif;\\n        transition: all 0.2s ease;\\n        display: flex;\\n        align-items: center;\\n        justify-content: center;\\n        min-width: 100px;\\n        box-sizing: border-box;\\n        margin: 0;\\n    }\\n \\n    :global(button.save-button:hover:not(:disabled)) {\\n        transform: translateY(-1px);\\n        background: rgba(74, 144, 226, 0.4);\\n    }\\n \\n    :global(button.save-button:active:not(:disabled)) {\\n        transform: translateY(0);\\n    }\\n \\n    :global(button.save-button:disabled) {\\n        opacity: 0.5;\\n        cursor: not-allowed;\\n    }\\n </style>"],"names":[],"mappings":"AA2BY,kBAAoB,CACxB,KAAK,CAAE,IAAI,CACX,UAAU,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACnC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACzC,aAAa,CAAE,GAAG,CAClB,KAAK,CAAE,KAAK,CACZ,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,MAAM,CAAE,OAAO,CACf,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,IAAI,CACzB,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,eAAe,CAAE,MAAM,CACvB,SAAS,CAAE,KAAK,CAChB,UAAU,CAAE,UAAU,CACtB,MAAM,CAAE,CACZ,CAEQ,uCAAyC,CAC7C,SAAS,CAAE,WAAW,IAAI,CAAC,CAC3B,UAAU,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACtC,CAEQ,wCAA0C,CAC9C,SAAS,CAAE,WAAW,CAAC,CAC3B,CAEQ,2BAA6B,CACjC,OAAO,CAAE,GAAG,CACZ,MAAM,CAAE,WACZ"}`
};
const SaveButton = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { loading } = $$props;
  let { disabled } = $$props;
  let { onClick } = $$props;
  if ($$props.loading === void 0 && $$bindings.loading && loading !== void 0) $$bindings.loading(loading);
  if ($$props.disabled === void 0 && $$bindings.disabled && disabled !== void 0) $$bindings.disabled(disabled);
  if ($$props.onClick === void 0 && $$bindings.onClick && onClick !== void 0) $$bindings.onClick(onClick);
  $$result.css.add(css$c);
  return `  <foreignObject${add_attribute("x", -FORM_STYLES.layout.buttonWidth / 2, 0)}${add_attribute("y", FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + 190, 0)}${add_attribute("width", FORM_STYLES.layout.buttonWidth, 0)} height="40"><button class="save-button" ${disabled ? "disabled" : ""}>${loading ? `Loading...` : `Save Changes`}</button></foreignObject>`;
});
const css$b = {
  code: ".title.svelte-f1lcoa{font-size:30px;text-anchor:middle;fill:white}.success.svelte-f1lcoa{font-size:14px;text-anchor:middle;fill:var(--success-color, #4CAF50)}",
  map: '{"version":3,"file":"EditProfileNode.svelte","sources":["EditProfileNode.svelte"],"sourcesContent":["<!-- src/lib/components/graph/nodes/editProfile/EditProfileNode.svelte -->\\n<script lang=\\"ts\\">import BaseSvgDetailNode from \\"../base/BaseDetailNode.svelte\\";\\nimport { NODE_CONSTANTS } from \\"../base/BaseNodeConstants\\";\\nimport { createEventDispatcher } from \\"svelte\\";\\nimport { updateUserProfile } from \\"$lib/services/userProfile\\";\\nimport { goto } from \\"$app/navigation\\";\\nimport { userStore } from \\"$lib/stores/userStore\\";\\nimport UsernameInput from \\"$lib/components/forms/editProfile/UsernameInput.svelte\\";\\nimport EmailInput from \\"$lib/components/forms/editProfile/EmailInput.svelte\\";\\nimport MissionStatementInput from \\"$lib/components/forms/editProfile/MissionStatementInput.svelte\\";\\nimport { FORM_STYLES } from \\"$lib/styles/forms\\";\\nimport SaveButton from \\"$lib/components/forms/editProfile/SaveButton.svelte\\";\\nexport let node;\\nlet preferred_username = node.preferred_username || \\"\\";\\nlet email = node.email || \\"\\";\\nlet mission_statement = node.mission_statement || \\"\\";\\nlet updateSuccess = false;\\nlet loading = false;\\nconst style = {\\n  previewSize: NODE_CONSTANTS.SIZES.WORD.detail,\\n  detailSize: NODE_CONSTANTS.SIZES.WORD.detail,\\n  colors: NODE_CONSTANTS.COLORS.WORD,\\n  padding: NODE_CONSTANTS.PADDING,\\n  lineHeight: NODE_CONSTANTS.LINE_HEIGHT,\\n  stroke: NODE_CONSTANTS.STROKE\\n};\\nasync function handleUpdateUserProfile() {\\n  loading = true;\\n  try {\\n    const updatedUser = await updateUserProfile({\\n      sub: node.sub,\\n      preferred_username,\\n      email,\\n      mission_statement\\n    });\\n    if (updatedUser) {\\n      userStore.set(updatedUser);\\n      updateSuccess = true;\\n      setTimeout(() => goto(\\"/graph/dashboard\\"), 2e3);\\n    }\\n  } catch (error) {\\n    console.error(\\"Failed to update profile:\\", error);\\n  } finally {\\n    loading = false;\\n  }\\n}\\n<\/script>\\n\\n<BaseSvgDetailNode {style}>\\n    <svelte:fragment let:radius let:isHovered>\\n        <!-- Title -->\\n        <text \\n            dy={-radius + 120} \\n            class=\\"title\\"\\n        >\\n            Edit Profile\\n        </text>\\n\\n        <!-- Form Fields -->\\n        <g transform=\\"translate(0, {-radius + 150})\\">\\n            <UsernameInput\\n                bind:username={preferred_username}\\n                disabled={loading}\\n            />\\n\\n            <EmailInput\\n                bind:email\\n                disabled={loading}\\n            />\\n\\n            <MissionStatementInput\\n                bind:statement={mission_statement}\\n                disabled={loading}\\n            />\\n\\n            <SaveButton\\n                loading={loading}\\n                disabled={loading}\\n                onClick={handleUpdateUserProfile}\\n            />\\n\\n            {#if updateSuccess}\\n                <text\\n                    x=\\"0\\"\\n                    y={FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + 190}\\n                    class=\\"success\\"\\n                >\\n                    Profile updated successfully! Redirecting...\\n                </text>\\n            {/if}\\n        </g>\\n    </svelte:fragment>\\n</BaseSvgDetailNode>\\n\\n<style>\\n    .title {\\n        font-size: 30px;\\n        text-anchor: middle;\\n        fill: white;\\n    }\\n\\n    .success {\\n        font-size: 14px;\\n        text-anchor: middle;\\n        fill: var(--success-color, #4CAF50);\\n    }\\n</style>"],"names":[],"mappings":"AA+FI,oBAAO,CACH,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,MAAM,CACnB,IAAI,CAAE,KACV,CAEA,sBAAS,CACL,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,MAAM,CACnB,IAAI,CAAE,IAAI,eAAe,CAAC,QAAQ,CACtC"}'
};
const EditProfileNode = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { node } = $$props;
  let preferred_username = node.preferred_username || "";
  let email = node.email || "";
  let mission_statement = node.mission_statement || "";
  let updateSuccess = false;
  let loading = false;
  const style = {
    previewSize: NODE_CONSTANTS.SIZES.WORD.detail,
    detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
    colors: NODE_CONSTANTS.COLORS.WORD,
    padding: NODE_CONSTANTS.PADDING,
    lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
    stroke: NODE_CONSTANTS.STROKE
  };
  async function handleUpdateUserProfile() {
    loading = true;
    try {
      const updatedUser = await updateUserProfile({
        sub: node.sub,
        preferred_username,
        email,
        mission_statement
      });
      if (updatedUser) {
        userStore.set(updatedUser);
        updateSuccess = true;
        setTimeout(() => goto("/graph/dashboard"), 2e3);
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
    } finally {
      loading = false;
    }
  }
  if ($$props.node === void 0 && $$bindings.node && node !== void 0) $$bindings.node(node);
  $$result.css.add(css$b);
  let $$settled;
  let $$rendered;
  let previous_head = $$result.head;
  do {
    $$settled = true;
    $$result.head = previous_head;
    $$rendered = `  ${validate_component(BaseDetailNode, "BaseSvgDetailNode").$$render($$result, { style }, {}, {
      default: ({ radius, isHovered }) => {
        return ` <text${add_attribute("dy", -radius + 120, 0)} class="title svelte-f1lcoa">Edit Profile</text>  <g transform="${"translate(0, " + escape(-radius + 150, true) + ")"}">${validate_component(UsernameInput, "UsernameInput").$$render(
          $$result,
          {
            disabled: loading,
            username: preferred_username
          },
          {
            username: ($$value) => {
              preferred_username = $$value;
              $$settled = false;
            }
          },
          {}
        )}${validate_component(EmailInput, "EmailInput").$$render(
          $$result,
          { disabled: loading, email },
          {
            email: ($$value) => {
              email = $$value;
              $$settled = false;
            }
          },
          {}
        )}${validate_component(MissionStatementInput, "MissionStatementInput").$$render(
          $$result,
          {
            disabled: loading,
            statement: mission_statement
          },
          {
            statement: ($$value) => {
              mission_statement = $$value;
              $$settled = false;
            }
          },
          {}
        )}${validate_component(SaveButton, "SaveButton").$$render(
          $$result,
          {
            loading,
            disabled: loading,
            onClick: handleUpdateUserProfile
          },
          {},
          {}
        )}${updateSuccess ? `<text x="0"${add_attribute("y", FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + 190, 0)} class="success svelte-f1lcoa">Profile updated successfully! Redirecting...</text>` : ``}</g>`;
      }
    })}`;
  } while (!$$settled);
  return $$rendered;
});
const css$a = {
  code: ".button-wrapper.svelte-15go4qa{padding-top:8px;height:100%}.form-button{width:100%;padding:8px 16px;border-radius:4px;font-family:'Orbitron', sans-serif;font-size:0.9rem;cursor:pointer;transition:all 0.2s ease;display:flex;align-items:center;justify-content:center;min-width:100px;box-sizing:border-box;margin:0;color:white;background:rgba(0, 0, 0, 0.4);border:1px solid rgba(255, 255, 255, 0.3)}.form-button.primary{background:rgba(74, 144, 226, 0.3);border:1px solid rgba(74, 144, 226, 0.4)}.form-button:hover:not(:disabled){background:rgba(0, 0, 0, 0.6);transform:translateY(-1px);border:1px solid rgba(255, 255, 255, 0.3)}.form-button.primary:hover:not(:disabled){background:rgba(74, 144, 226, 0.4);border:1px solid rgba(74, 144, 226, 0.4)}.form-button:active:not(:disabled){transform:translateY(0)}.form-button:disabled{opacity:0.5;cursor:not-allowed}",
  map: `{"version":3,"file":"FormNavigation.svelte","sources":["FormNavigation.svelte"],"sourcesContent":["<!-- src/lib/components/forms/createNode/shared/FormNavigation.svelte -->\\n<script lang=\\"ts\\">import { FORM_STYLES } from \\"$lib/styles/forms\\";\\nexport let onBack;\\nexport let onNext;\\nexport let backLabel = \\"Back\\";\\nexport let nextLabel = \\"Next\\";\\nexport let loading = false;\\nexport let nextDisabled = false;\\nexport let showBackButton = true;\\n<\/script>\\n\\n<g transform=\\"translate({FORM_STYLES.layout.leftAlign}, 0)\\">\\n    {#if showBackButton}\\n        <!-- Back Button -->\\n        <foreignObject\\n            x=\\"0\\"\\n            y=\\"0\\"\\n            width={FORM_STYLES.layout.buttonWidth}\\n            height=\\"50\\"\\n        >\\n            <div class=\\"button-wrapper\\">\\n                <button \\n                    class=\\"form-button\\"\\n                    on:click={onBack}\\n                    disabled={loading}\\n                >\\n                    {backLabel}\\n                </button>\\n            </div>\\n        </foreignObject>\\n    {/if}\\n\\n    <!-- Next Button -->\\n    <foreignObject\\n        x={showBackButton ? (FORM_STYLES.layout.fieldWidth - FORM_STYLES.layout.buttonWidth) : (FORM_STYLES.layout.fieldWidth / 2 - FORM_STYLES.layout.buttonWidth / 2)}\\n        y=\\"0\\"\\n        width={FORM_STYLES.layout.buttonWidth}\\n        height=\\"50\\"\\n    >\\n        <div class=\\"button-wrapper\\">\\n            <button \\n                class=\\"form-button primary\\"\\n                on:click={onNext}\\n                disabled={loading || nextDisabled}\\n            >\\n                {#if loading}\\n                    Loading...\\n                {:else}\\n                    {nextLabel}\\n                {/if}\\n            </button>\\n        </div>\\n    </foreignObject>\\n</g>\\n\\n<style>\\n    .button-wrapper {\\n        padding-top: 8px;\\n        height: 100%;\\n    }\\n\\n    :global(.form-button) {\\n        width: 100%;\\n        padding: 8px 16px;\\n        border-radius: 4px;\\n        font-family: 'Orbitron', sans-serif;\\n        font-size: 0.9rem;\\n        cursor: pointer;\\n        transition: all 0.2s ease;\\n        display: flex;\\n        align-items: center;\\n        justify-content: center;\\n        min-width: 100px;\\n        box-sizing: border-box;\\n        margin: 0;\\n        color: white;\\n        background: rgba(0, 0, 0, 0.4);\\n        border: 1px solid rgba(255, 255, 255, 0.3);\\n    }\\n\\n    :global(.form-button.primary) {\\n        background: rgba(74, 144, 226, 0.3);\\n        border: 1px solid rgba(74, 144, 226, 0.4);\\n    }\\n\\n    :global(.form-button:hover:not(:disabled)) {\\n        background: rgba(0, 0, 0, 0.6);\\n        transform: translateY(-1px);\\n        border: 1px solid rgba(255, 255, 255, 0.3);\\n    }\\n\\n    :global(.form-button.primary:hover:not(:disabled)) {\\n        background: rgba(74, 144, 226, 0.4);\\n        border: 1px solid rgba(74, 144, 226, 0.4);\\n    }\\n\\n    :global(.form-button:active:not(:disabled)) {\\n        transform: translateY(0);\\n    }\\n\\n    :global(.form-button:disabled) {\\n        opacity: 0.5;\\n        cursor: not-allowed;\\n    }\\n</style>"],"names":[],"mappings":"AAwDI,8BAAgB,CACZ,WAAW,CAAE,GAAG,CAChB,MAAM,CAAE,IACZ,CAEQ,YAAc,CAClB,KAAK,CAAE,IAAI,CACX,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,aAAa,CAAE,GAAG,CAClB,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,SAAS,CAAE,MAAM,CACjB,MAAM,CAAE,OAAO,CACf,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,IAAI,CACzB,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,eAAe,CAAE,MAAM,CACvB,SAAS,CAAE,KAAK,CAChB,UAAU,CAAE,UAAU,CACtB,MAAM,CAAE,CAAC,CACT,KAAK,CAAE,KAAK,CACZ,UAAU,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAC9B,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC7C,CAEQ,oBAAsB,CAC1B,UAAU,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACnC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC5C,CAEQ,iCAAmC,CACvC,UAAU,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAC9B,SAAS,CAAE,WAAW,IAAI,CAAC,CAC3B,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC7C,CAEQ,yCAA2C,CAC/C,UAAU,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACnC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC5C,CAEQ,kCAAoC,CACxC,SAAS,CAAE,WAAW,CAAC,CAC3B,CAEQ,qBAAuB,CAC3B,OAAO,CAAE,GAAG,CACZ,MAAM,CAAE,WACZ"}`
};
const FormNavigation = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { onBack } = $$props;
  let { onNext } = $$props;
  let { backLabel = "Back" } = $$props;
  let { nextLabel = "Next" } = $$props;
  let { loading = false } = $$props;
  let { nextDisabled = false } = $$props;
  let { showBackButton = true } = $$props;
  if ($$props.onBack === void 0 && $$bindings.onBack && onBack !== void 0) $$bindings.onBack(onBack);
  if ($$props.onNext === void 0 && $$bindings.onNext && onNext !== void 0) $$bindings.onNext(onNext);
  if ($$props.backLabel === void 0 && $$bindings.backLabel && backLabel !== void 0) $$bindings.backLabel(backLabel);
  if ($$props.nextLabel === void 0 && $$bindings.nextLabel && nextLabel !== void 0) $$bindings.nextLabel(nextLabel);
  if ($$props.loading === void 0 && $$bindings.loading && loading !== void 0) $$bindings.loading(loading);
  if ($$props.nextDisabled === void 0 && $$bindings.nextDisabled && nextDisabled !== void 0) $$bindings.nextDisabled(nextDisabled);
  if ($$props.showBackButton === void 0 && $$bindings.showBackButton && showBackButton !== void 0) $$bindings.showBackButton(showBackButton);
  $$result.css.add(css$a);
  return `  <g transform="${"translate(" + escape(FORM_STYLES.layout.leftAlign, true) + ", 0)"}">${showBackButton ? ` <foreignObject x="0" y="0"${add_attribute("width", FORM_STYLES.layout.buttonWidth, 0)} height="50"><div class="button-wrapper svelte-15go4qa"><button class="form-button" ${loading ? "disabled" : ""}>${escape(backLabel)}</button></div></foreignObject>` : ``}<foreignObject${add_attribute(
    "x",
    showBackButton ? FORM_STYLES.layout.fieldWidth - FORM_STYLES.layout.buttonWidth : FORM_STYLES.layout.fieldWidth / 2 - FORM_STYLES.layout.buttonWidth / 2,
    0
  )} y="0"${add_attribute("width", FORM_STYLES.layout.buttonWidth, 0)} height="50"><div class="button-wrapper svelte-15go4qa"><button class="form-button primary" ${loading || nextDisabled ? "disabled" : ""}>${loading ? `Loading...` : `${escape(nextLabel)}`}</button></div></foreignObject></g>`;
});
const css$9 = {
  code: `.form-label.svelte-118fzwu{font-size:14px;text-anchor:start;fill:rgba(255, 255, 255, 0.7);font-family:'Orbitron', sans-serif}select.form-input{width:100%;background:rgba(0, 0, 0, 0.9);border:2px solid rgba(255, 255, 255, 0.3);border-radius:4px;color:white;padding:8px;font-family:'Orbitron', sans-serif;font-size:0.9rem;transition:all 0.2s ease;box-sizing:border-box;display:block;margin:0;cursor:pointer;-webkit-appearance:none;-moz-appearance:none;appearance:none;background-image:url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");background-repeat:no-repeat;background-position:right 8px center;background-size:24px;padding-right:32px}select.form-input:focus{outline:none;border:3px solid rgba(255, 255, 255, 0.8);box-shadow:0 0 0 1px rgba(255, 255, 255, 0.3)}select.form-input option{background:rgba(0, 0, 0, 0.9);color:white;padding:8px}select.form-input:disabled{opacity:0.5;cursor:not-allowed}`,
  map: `{"version":3,"file":"NodeTypeSelect.svelte","sources":["NodeTypeSelect.svelte"],"sourcesContent":["<!-- src/lib/components/forms/createNode/shared/NodeTypeSelect.svelte -->\\n<script lang=\\"ts\\">import { createEventDispatcher } from \\"svelte\\";\\nimport { FORM_STYLES } from \\"$lib/styles/forms\\";\\nimport FormNavigation from \\"./FormNavigation.svelte\\";\\nexport let nodeType = \\"\\";\\nexport let disabled = false;\\nconst dispatch = createEventDispatcher();\\nconst noop = () => {\\n};\\nfunction handleTypeChange() {\\n  dispatch(\\"typeChange\\", { type: nodeType });\\n}\\n<\/script>\\n\\n<g>\\n    <!-- Label -->\\n    <text \\n        x={FORM_STYLES.layout.leftAlign}\\n        y=\\"0\\"\\n        class=\\"form-label\\"\\n    >\\n        Select Node Type\\n    </text>\\n\\n    <!-- Select Input -->\\n    <foreignObject\\n        x={FORM_STYLES.layout.leftAlign}\\n        y={FORM_STYLES.layout.verticalSpacing.labelToInput}\\n        width={FORM_STYLES.layout.fieldWidth}\\n        height=\\"40\\"\\n    >\\n        <select \\n            class=\\"form-input\\"\\n            bind:value={nodeType}\\n            on:change={handleTypeChange}\\n            {disabled}\\n        >\\n            <option value=\\"\\">Choose type...</option>\\n            <option value=\\"word\\">Word</option>\\n            <option value=\\"statement\\">Statement</option>\\n            <option value=\\"quantity\\">Quantity</option>\\n        </select>\\n    </foreignObject>\\n\\n    <!-- Navigation -->\\n    <g transform=\\"translate(0, {FORM_STYLES.layout.verticalSpacing.betweenFields})\\">\\n        <FormNavigation\\n            onBack={noop}\\n            onNext={() => dispatch('proceed')}\\n            nextLabel=\\"Continue\\"\\n            nextDisabled={!nodeType || disabled}\\n            showBackButton={false}\\n        />\\n    </g>\\n</g>\\n\\n<style>\\n    .form-label {\\n        font-size: 14px;\\n        text-anchor: start;\\n        fill: rgba(255, 255, 255, 0.7);\\n        font-family: 'Orbitron', sans-serif;\\n    }\\n\\n    :global(select.form-input) {\\n        width: 100%;\\n        background: rgba(0, 0, 0, 0.9);\\n        border: 2px solid rgba(255, 255, 255, 0.3);\\n        border-radius: 4px;\\n        color: white;\\n        padding: 8px;\\n        font-family: 'Orbitron', sans-serif;\\n        font-size: 0.9rem;\\n        transition: all 0.2s ease;\\n        box-sizing: border-box;\\n        display: block;\\n        margin: 0;\\n        cursor: pointer;\\n        -webkit-appearance: none;\\n        -moz-appearance: none;\\n        appearance: none;\\n        background-image: url(\\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e\\");\\n        background-repeat: no-repeat;\\n        background-position: right 8px center;\\n        background-size: 24px;\\n        padding-right: 32px;\\n    }\\n\\n    :global(select.form-input:focus) {\\n        outline: none;\\n        border: 3px solid rgba(255, 255, 255, 0.8);\\n        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);\\n    }\\n\\n    :global(select.form-input option) {\\n        background: rgba(0, 0, 0, 0.9);\\n        color: white;\\n        padding: 8px;\\n    }\\n\\n    :global(select.form-input:disabled) {\\n        opacity: 0.5;\\n        cursor: not-allowed;\\n    }\\n</style>"],"names":[],"mappings":"AAyDI,0BAAY,CACR,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,KAAK,CAClB,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC9B,WAAW,CAAE,UAAU,CAAC,CAAC,UAC7B,CAEQ,iBAAmB,CACvB,KAAK,CAAE,IAAI,CACX,UAAU,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAC9B,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,aAAa,CAAE,GAAG,CAClB,KAAK,CAAE,KAAK,CACZ,OAAO,CAAE,GAAG,CACZ,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,SAAS,CAAE,MAAM,CACjB,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,IAAI,CACzB,UAAU,CAAE,UAAU,CACtB,OAAO,CAAE,KAAK,CACd,MAAM,CAAE,CAAC,CACT,MAAM,CAAE,OAAO,CACf,kBAAkB,CAAE,IAAI,CACxB,eAAe,CAAE,IAAI,CACrB,UAAU,CAAE,IAAI,CAChB,gBAAgB,CAAE,6JAA6J,CAC/K,iBAAiB,CAAE,SAAS,CAC5B,mBAAmB,CAAE,KAAK,CAAC,GAAG,CAAC,MAAM,CACrC,eAAe,CAAE,IAAI,CACrB,aAAa,CAAE,IACnB,CAEQ,uBAAyB,CAC7B,OAAO,CAAE,IAAI,CACb,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,UAAU,CAAE,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjD,CAEQ,wBAA0B,CAC9B,UAAU,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAC9B,KAAK,CAAE,KAAK,CACZ,OAAO,CAAE,GACb,CAEQ,0BAA4B,CAChC,OAAO,CAAE,GAAG,CACZ,MAAM,CAAE,WACZ"}`
};
const NodeTypeSelect = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { nodeType = "" } = $$props;
  let { disabled = false } = $$props;
  const dispatch = createEventDispatcher();
  const noop2 = () => {
  };
  if ($$props.nodeType === void 0 && $$bindings.nodeType && nodeType !== void 0) $$bindings.nodeType(nodeType);
  if ($$props.disabled === void 0 && $$bindings.disabled && disabled !== void 0) $$bindings.disabled(disabled);
  $$result.css.add(css$9);
  return `  <g><text${add_attribute("x", FORM_STYLES.layout.leftAlign, 0)} y="0" class="form-label svelte-118fzwu">Select Node Type
    </text><foreignObject${add_attribute("x", FORM_STYLES.layout.leftAlign, 0)}${add_attribute("y", FORM_STYLES.layout.verticalSpacing.labelToInput, 0)}${add_attribute("width", FORM_STYLES.layout.fieldWidth, 0)} height="40"><select class="form-input" ${disabled ? "disabled" : ""}><option value="" data-svelte-h="svelte-3gv1dn">Choose type...</option><option value="word" data-svelte-h="svelte-183aq5q">Word</option><option value="statement" data-svelte-h="svelte-1wqksxw">Statement</option><option value="quantity" data-svelte-h="svelte-b76txe">Quantity</option></select></foreignObject><g transform="${"translate(0, " + escape(FORM_STYLES.layout.verticalSpacing.betweenFields, true) + ")"}">${validate_component(FormNavigation, "FormNavigation").$$render(
    $$result,
    {
      onBack: noop2,
      onNext: () => dispatch("proceed"),
      nextLabel: "Continue",
      nextDisabled: !nodeType || disabled,
      showBackButton: false
    },
    {},
    {}
  )}</g></g>`;
});
function createWordStore() {
  const { subscribe: subscribe2, set: baseSet } = writable(null);
  function updateUrl(word, view) {
    console.log("WordStore: Updating URL with:", { word, view });
    if (word) {
      const newUrl = `/graph/${view}?word=${encodeURIComponent(word)}`;
      const currentUrl = new URL(window.location.href);
      const currentWord = currentUrl.searchParams.get("word");
      console.log("WordStore: URL check:", {
        newUrl,
        currentWord,
        word,
        needsUpdate: currentWord !== word
      });
      if (currentWord !== word) {
        try {
          const state = { word };
          window.history.replaceState(state, "", newUrl);
          console.log("WordStore: URL updated successfully via history API");
        } catch (error) {
          console.error("WordStore: Error updating URL:", error);
        }
      } else {
        console.log("WordStore: URL already correct");
      }
    }
  }
  let currentWordId = null;
  return {
    subscribe: subscribe2,
    set: (wordData, view = "word") => {
      console.log("WordStore: Setting word data:", {
        wordData,
        view,
        currentWordId,
        newWordId: wordData?.id,
        currentUrl: window.location.href
      });
      baseSet(wordData);
      if (wordData) {
        setTimeout(() => {
          updateUrl(wordData.word, view);
        }, 0);
        currentWordId = wordData.id;
      } else {
        currentWordId = null;
      }
    },
    reset: () => {
      console.log("WordStore: Resetting word data");
      currentWordId = null;
      baseSet(null);
    },
    getCurrentWord: () => {
      let currentWord = null;
      subscribe2((value) => {
        currentWord = value;
      })();
      return currentWord;
    }
  };
}
const wordStore = createWordStore();
const css$8 = {
  code: ".message.svelte-1sqlw30{font-family:'Orbitron', sans-serif;font-size:14px;transition:fill 0.2s ease}.error.svelte-1sqlw30{fill:#ff4444}.success.svelte-1sqlw30{fill:#4CAF50}",
  map: `{"version":3,"file":"MessageDisplay.svelte","sources":["MessageDisplay.svelte"],"sourcesContent":["<!-- src/lib/components/forms/createNode/shared/MessageDisplay.svelte -->\\n<script lang=\\"ts\\">import { FORM_STYLES } from \\"$lib/styles/forms\\";\\nexport let errorMessage = null;\\nexport let successMessage = null;\\n<\/script>\\n\\n{#if errorMessage || successMessage}\\n  <g transform=\\"translate({FORM_STYLES.layout.leftAlign}, 0)\\">\\n      <text \\n          class=\\"message\\"\\n          class:error={errorMessage}\\n          class:success={successMessage}\\n          x={FORM_STYLES.layout.fieldWidth / 2}\\n          y=\\"0\\"\\n          text-anchor=\\"middle\\"\\n      >\\n          {errorMessage || successMessage}\\n      </text>\\n  </g>\\n{/if}\\n\\n<style>\\n  .message {\\n      font-family: 'Orbitron', sans-serif;\\n      font-size: 14px;\\n      transition: fill 0.2s ease;\\n  }\\n\\n  .error {\\n      fill: #ff4444;\\n  }\\n\\n  .success {\\n      fill: #4CAF50;\\n  }\\n</style>"],"names":[],"mappings":"AAsBE,uBAAS,CACL,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,SAAS,CAAE,IAAI,CACf,UAAU,CAAE,IAAI,CAAC,IAAI,CAAC,IAC1B,CAEA,qBAAO,CACH,IAAI,CAAE,OACV,CAEA,uBAAS,CACL,IAAI,CAAE,OACV"}`
};
const MessageDisplay = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { errorMessage = null } = $$props;
  let { successMessage = null } = $$props;
  if ($$props.errorMessage === void 0 && $$bindings.errorMessage && errorMessage !== void 0) $$bindings.errorMessage(errorMessage);
  if ($$props.successMessage === void 0 && $$bindings.successMessage && successMessage !== void 0) $$bindings.successMessage(successMessage);
  $$result.css.add(css$8);
  return `  ${errorMessage || successMessage ? `<g transform="${"translate(" + escape(FORM_STYLES.layout.leftAlign, true) + ", 0)"}"><text class="${[
    "message svelte-1sqlw30",
    (errorMessage ? "error" : "") + " " + (successMessage ? "success" : "")
  ].join(" ").trim()}"${add_attribute("x", FORM_STYLES.layout.fieldWidth / 2, 0)} y="0" text-anchor="middle">${escape(errorMessage || successMessage)}</text></g>` : ``}`;
});
const css$7 = {
  code: ".title.svelte-137x9w8{font-size:30px;fill:white;font-family:'Orbitron', sans-serif}.step-indicator.svelte-137x9w8{fill:rgba(255, 255, 255, 0.2);transition:all 0.3s ease}.step-indicator.active.svelte-137x9w8{fill:rgba(255, 255, 255, 0.8)}.node{transition:all 2s ease-in-out}.outer-ring{transition:stroke 2s ease-in-out}text{transition:fill 2s ease-in-out}",
  map: '{"version":3,"file":"CreateNodeNode.svelte","sources":["CreateNodeNode.svelte"],"sourcesContent":["<!-- src/lib/components/forms/createNode/createNode/CreateNodeNode.svelte -->\\n<script lang=\\"ts\\">import { onMount, onDestroy } from \\"svelte\\";\\nimport BaseSvgDetailNode from \\"../base/BaseDetailNode.svelte\\";\\nimport { NODE_CONSTANTS } from \\"../base/BaseNodeConstants\\";\\nimport { COLORS } from \\"$lib/constants/colors\\";\\nimport { FORM_STYLES } from \\"$lib/styles/forms\\";\\nimport NodeTypeSelect from \\"$lib/components/forms/createNode/shared/NodeTypeSelect.svelte\\";\\nimport WordInput from \\"$lib/components/forms/createNode/word/WordInput.svelte\\";\\nimport DefinitionInput from \\"$lib/components/forms/createNode/word/DefinitionInput.svelte\\";\\nimport DiscussionInput from \\"$lib/components/forms/createNode/shared/DiscussionInput.svelte\\";\\nimport WordReview from \\"$lib/components/forms/createNode/word/WordReview.svelte\\";\\nimport MessageDisplay from \\"$lib/components/forms/createNode/shared/MessageDisplay.svelte\\";\\nexport let node;\\nlet currentStep = 1;\\nlet formData = {\\n  nodeType: \\"\\",\\n  word: \\"\\",\\n  definition: \\"\\",\\n  discussion: \\"\\",\\n  publicCredit: false\\n};\\nlet isLoading = false;\\nlet errorMessage = null;\\nlet successMessage = null;\\nlet colorIndex = 0;\\nlet intervalId;\\n$: if (formData.nodeType === \\"\\") {\\n  if (!intervalId) {\\n    const colors = [\\n      {\\n        base: COLORS.PRIMARY.BLUE,\\n        full: `${COLORS.PRIMARY.BLUE}FF`,\\n        semi: `${COLORS.PRIMARY.BLUE}66`,\\n        light: `${COLORS.PRIMARY.BLUE}33`\\n      },\\n      {\\n        base: COLORS.PRIMARY.PURPLE,\\n        full: `${COLORS.PRIMARY.PURPLE}FF`,\\n        semi: `${COLORS.PRIMARY.PURPLE}66`,\\n        light: `${COLORS.PRIMARY.PURPLE}33`\\n      },\\n      {\\n        base: COLORS.PRIMARY.TURQUOISE,\\n        full: `${COLORS.PRIMARY.TURQUOISE}FF`,\\n        semi: `${COLORS.PRIMARY.TURQUOISE}66`,\\n        light: `${COLORS.PRIMARY.TURQUOISE}33`\\n      },\\n      {\\n        base: COLORS.PRIMARY.GREEN,\\n        full: `${COLORS.PRIMARY.GREEN}FF`,\\n        semi: `${COLORS.PRIMARY.GREEN}66`,\\n        light: `${COLORS.PRIMARY.GREEN}33`\\n      },\\n      {\\n        base: COLORS.PRIMARY.YELLOW,\\n        full: `${COLORS.PRIMARY.YELLOW}FF`,\\n        semi: `${COLORS.PRIMARY.YELLOW}66`,\\n        light: `${COLORS.PRIMARY.YELLOW}33`\\n      },\\n      {\\n        base: COLORS.PRIMARY.ORANGE,\\n        full: `${COLORS.PRIMARY.ORANGE}FF`,\\n        semi: `${COLORS.PRIMARY.ORANGE}66`,\\n        light: `${COLORS.PRIMARY.ORANGE}33`\\n      },\\n      {\\n        base: COLORS.PRIMARY.RED,\\n        full: `${COLORS.PRIMARY.RED}FF`,\\n        semi: `${COLORS.PRIMARY.RED}66`,\\n        light: `${COLORS.PRIMARY.RED}33`\\n      }\\n    ];\\n    intervalId = setInterval(() => {\\n      colorIndex = (colorIndex + 1) % colors.length;\\n      style = {\\n        ...style,\\n        colors: {\\n          ...style.colors,\\n          border: colors[colorIndex].full,\\n          text: colors[colorIndex].full,\\n          hover: colors[colorIndex].full,\\n          gradient: {\\n            start: colors[colorIndex].semi,\\n            end: colors[colorIndex].light\\n          }\\n        }\\n      };\\n    }, 2e3);\\n  }\\n} else {\\n  if (intervalId) {\\n    clearInterval(intervalId);\\n    intervalId = void 0;\\n  }\\n}\\n$: style = {\\n  previewSize: NODE_CONSTANTS.SIZES.WORD.detail,\\n  detailSize: NODE_CONSTANTS.SIZES.WORD.detail,\\n  colors: formData.nodeType === \\"word\\" ? NODE_CONSTANTS.COLORS.WORD : {\\n    background: NODE_CONSTANTS.COLORS.WORD.background,\\n    border: NODE_CONSTANTS.COLORS.WORD.border,\\n    text: NODE_CONSTANTS.COLORS.WORD.text,\\n    hover: NODE_CONSTANTS.COLORS.WORD.hover,\\n    gradient: NODE_CONSTANTS.COLORS.WORD.gradient\\n  },\\n  padding: NODE_CONSTANTS.PADDING,\\n  lineHeight: NODE_CONSTANTS.LINE_HEIGHT,\\n  stroke: NODE_CONSTANTS.STROKE,\\n  highlightColor: formData.nodeType === \\"word\\" ? COLORS.PRIMARY.BLUE : formData.nodeType === \\"\\" ? [\\n    COLORS.PRIMARY.BLUE,\\n    COLORS.PRIMARY.PURPLE,\\n    COLORS.PRIMARY.GREEN,\\n    COLORS.PRIMARY.TURQUOISE,\\n    COLORS.PRIMARY.YELLOW,\\n    COLORS.PRIMARY.ORANGE\\n  ][colorIndex] : void 0\\n};\\n$: stepTitle = currentStep === 1 ? \\"Create New Node\\" : currentStep === 2 ? \\"Enter Word\\" : currentStep === 3 ? \\"Add Definition\\" : currentStep === 4 ? \\"Start Discussion\\" : \\"Review Creation\\";\\n$: showStepIndicators = currentStep < 5;\\nfunction handleBack() {\\n  if (currentStep > 1) {\\n    currentStep--;\\n    errorMessage = null;\\n  }\\n}\\nfunction handleNext() {\\n  if (currentStep < 5) {\\n    currentStep++;\\n    errorMessage = null;\\n  }\\n}\\nonDestroy(() => {\\n  if (intervalId) {\\n    clearInterval(intervalId);\\n  }\\n});\\n<\/script>\\n\\n<BaseSvgDetailNode {style}>\\n    <svelte:fragment let:radius>\\n        <g transform=\\"translate(0, {-radius + (currentStep === 5 ? 100 : 120)})\\">\\n            <!-- Title -->\\n            <text \\n                class=\\"title\\"\\n                text-anchor=\\"middle\\"\\n            >\\n                {stepTitle}\\n            </text>\\n        \\n            <!-- Step Indicators -->\\n            {#if showStepIndicators}\\n                <g transform=\\"translate(0, 40)\\">\\n                    {#each Array(5) as _, i}\\n                        <circle\\n                            cx={-40 + (i * 20)}\\n                            cy=\\"0\\"\\n                            r=\\"4\\"\\n                            class=\\"step-indicator\\"\\n                            class:active={currentStep >= i + 1}\\n                        />\\n                    {/each}\\n                </g>\\n            {/if}\\n        \\n            <!-- Error/Success Messages -->\\n            <g transform=\\"translate(0, {showStepIndicators ? 70 : 40})\\">\\n                <MessageDisplay {errorMessage} {successMessage} />\\n            </g>\\n\\n            <!-- Dynamic Form Content -->\\n            <g transform=\\"translate(0, {showStepIndicators ? 100 : 60})\\">\\n                {#if currentStep === 1}\\n                    <NodeTypeSelect\\n                        bind:nodeType={formData.nodeType}\\n                        disabled={isLoading}\\n                        on:proceed={handleNext}\\n                    />\\n                {:else if currentStep === 2}\\n                <WordInput\\n                    bind:word={formData.word}\\n                    disabled={isLoading}\\n                    on:back={handleBack}\\n                    on:proceed={handleNext}\\n                    on:error={e => errorMessage = e.detail.message}\\n                />\\n                {:else if currentStep === 3}\\n                    <DefinitionInput\\n                        bind:definition={formData.definition}\\n                        disabled={isLoading}\\n                        on:back={handleBack}\\n                        on:proceed={handleNext}\\n                    />\\n                {:else if currentStep === 4}\\n                    <DiscussionInput\\n                        bind:discussion={formData.discussion}\\n                        disabled={isLoading}\\n                        on:back={handleBack}\\n                        on:proceed={handleNext}\\n                    />\\n                {:else if currentStep === 5}\\n                    <WordReview\\n                        {...formData}\\n                        userId={node.sub}\\n                        disabled={isLoading}\\n                        on:back={handleBack}\\n                        on:success={e => successMessage = e.detail.message}\\n                        on:error={e => errorMessage = e.detail.message}\\n                    />\\n                {/if}\\n            </g>\\n        </g>\\n    </svelte:fragment>\\n</BaseSvgDetailNode>\\n\\n<style>\\n    .title {\\n        font-size: 30px;\\n        fill: white;\\n        font-family: \'Orbitron\', sans-serif;\\n    }\\n\\n    .step-indicator {\\n        fill: rgba(255, 255, 255, 0.2);\\n        transition: all 0.3s ease;\\n    }\\n\\n    .step-indicator.active {\\n        fill: rgba(255, 255, 255, 0.8);\\n    }\\n\\n    :global(.node) {\\n        transition: all 2s ease-in-out;\\n    }\\n    \\n    :global(.outer-ring) {\\n        transition: stroke 2s ease-in-out;\\n    }\\n    \\n    :global(text) {\\n        transition: fill 2s ease-in-out;\\n    }\\n</style>"],"names":[],"mappings":"AAuNI,qBAAO,CACH,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KAAK,CACX,WAAW,CAAE,UAAU,CAAC,CAAC,UAC7B,CAEA,8BAAgB,CACZ,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC9B,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,IACzB,CAEA,eAAe,sBAAQ,CACnB,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC,CAEQ,KAAO,CACX,UAAU,CAAE,GAAG,CAAC,EAAE,CAAC,WACvB,CAEQ,WAAa,CACjB,UAAU,CAAE,MAAM,CAAC,EAAE,CAAC,WAC1B,CAEQ,IAAM,CACV,UAAU,CAAE,IAAI,CAAC,EAAE,CAAC,WACxB"}'
};
let isLoading = false;
const CreateNodeNode = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let style;
  let stepTitle;
  let showStepIndicators;
  let { node } = $$props;
  let currentStep = 1;
  let formData = {
    nodeType: "",
    word: "",
    definition: "",
    discussion: "",
    publicCredit: false
  };
  let errorMessage = null;
  let successMessage = null;
  let colorIndex = 0;
  let intervalId;
  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });
  if ($$props.node === void 0 && $$bindings.node && node !== void 0) $$bindings.node(node);
  $$result.css.add(css$7);
  let $$settled;
  let $$rendered;
  let previous_head = $$result.head;
  do {
    $$settled = true;
    $$result.head = previous_head;
    {
      if (formData.nodeType === "") {
        if (!intervalId) {
          const colors = [
            {
              base: COLORS.PRIMARY.BLUE,
              full: `${COLORS.PRIMARY.BLUE}FF`,
              semi: `${COLORS.PRIMARY.BLUE}66`,
              light: `${COLORS.PRIMARY.BLUE}33`
            },
            {
              base: COLORS.PRIMARY.PURPLE,
              full: `${COLORS.PRIMARY.PURPLE}FF`,
              semi: `${COLORS.PRIMARY.PURPLE}66`,
              light: `${COLORS.PRIMARY.PURPLE}33`
            },
            {
              base: COLORS.PRIMARY.TURQUOISE,
              full: `${COLORS.PRIMARY.TURQUOISE}FF`,
              semi: `${COLORS.PRIMARY.TURQUOISE}66`,
              light: `${COLORS.PRIMARY.TURQUOISE}33`
            },
            {
              base: COLORS.PRIMARY.GREEN,
              full: `${COLORS.PRIMARY.GREEN}FF`,
              semi: `${COLORS.PRIMARY.GREEN}66`,
              light: `${COLORS.PRIMARY.GREEN}33`
            },
            {
              base: COLORS.PRIMARY.YELLOW,
              full: `${COLORS.PRIMARY.YELLOW}FF`,
              semi: `${COLORS.PRIMARY.YELLOW}66`,
              light: `${COLORS.PRIMARY.YELLOW}33`
            },
            {
              base: COLORS.PRIMARY.ORANGE,
              full: `${COLORS.PRIMARY.ORANGE}FF`,
              semi: `${COLORS.PRIMARY.ORANGE}66`,
              light: `${COLORS.PRIMARY.ORANGE}33`
            },
            {
              base: COLORS.PRIMARY.RED,
              full: `${COLORS.PRIMARY.RED}FF`,
              semi: `${COLORS.PRIMARY.RED}66`,
              light: `${COLORS.PRIMARY.RED}33`
            }
          ];
          intervalId = setInterval(
            () => {
              colorIndex = (colorIndex + 1) % colors.length;
              style = {
                ...style,
                colors: {
                  ...style.colors,
                  border: colors[colorIndex].full,
                  text: colors[colorIndex].full,
                  hover: colors[colorIndex].full,
                  gradient: {
                    start: colors[colorIndex].semi,
                    end: colors[colorIndex].light
                  }
                }
              };
            },
            2e3
          );
        }
      } else {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = void 0;
        }
      }
    }
    style = {
      previewSize: NODE_CONSTANTS.SIZES.WORD.detail,
      detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
      colors: formData.nodeType === "word" ? NODE_CONSTANTS.COLORS.WORD : {
        background: NODE_CONSTANTS.COLORS.WORD.background,
        border: NODE_CONSTANTS.COLORS.WORD.border,
        text: NODE_CONSTANTS.COLORS.WORD.text,
        hover: NODE_CONSTANTS.COLORS.WORD.hover,
        gradient: NODE_CONSTANTS.COLORS.WORD.gradient
      },
      padding: NODE_CONSTANTS.PADDING,
      lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
      stroke: NODE_CONSTANTS.STROKE,
      highlightColor: formData.nodeType === "word" ? COLORS.PRIMARY.BLUE : formData.nodeType === "" ? [
        COLORS.PRIMARY.BLUE,
        COLORS.PRIMARY.PURPLE,
        COLORS.PRIMARY.GREEN,
        COLORS.PRIMARY.TURQUOISE,
        COLORS.PRIMARY.YELLOW,
        COLORS.PRIMARY.ORANGE
      ][colorIndex] : void 0
    };
    stepTitle = "Create New Node";
    showStepIndicators = currentStep < 5;
    $$rendered = `  ${validate_component(BaseDetailNode, "BaseSvgDetailNode").$$render($$result, { style }, {}, {
      default: ({ radius }) => {
        return `<g transform="${"translate(0, " + escape(-radius + 120, true) + ")"}"><text class="title svelte-137x9w8" text-anchor="middle">${escape(stepTitle)}</text>${showStepIndicators ? `<g transform="translate(0, 40)">${each(Array(5), (_, i) => {
          return `<circle${add_attribute("cx", -40 + i * 20, 0)} cy="0" r="4" class="${[
            "step-indicator svelte-137x9w8",
            currentStep >= i + 1 ? "active" : ""
          ].join(" ").trim()}"></circle>`;
        })}</g>` : ``}<g transform="${"translate(0, " + escape(showStepIndicators ? 70 : 40, true) + ")"}">${validate_component(MessageDisplay, "MessageDisplay").$$render($$result, { errorMessage, successMessage }, {}, {})}</g><g transform="${"translate(0, " + escape(showStepIndicators ? 100 : 60, true) + ")"}">${`${validate_component(NodeTypeSelect, "NodeTypeSelect").$$render(
          $$result,
          {
            disabled: isLoading,
            nodeType: formData.nodeType
          },
          {
            nodeType: ($$value) => {
              formData.nodeType = $$value;
              $$settled = false;
            }
          },
          {}
        )}`}</g></g>`;
      }
    })}`;
  } while (!$$settled);
  return $$rendered;
});
const BasePreviewNode = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let radius;
  let { style } = $$props;
  let { transform } = $$props;
  if ($$props.style === void 0 && $$bindings.style && style !== void 0) $$bindings.style(style);
  if ($$props.transform === void 0 && $$bindings.transform && transform !== void 0) $$bindings.transform(transform);
  radius = style.previewSize / 2;
  return `${validate_component(BaseNode, "BaseNode").$$render($$result, { style, transform }, {}, {
    default: () => {
      return `${slots.title ? slots.title({ radius }) : ``} ${slots.content ? slots.content({ radius }) : ``} ${slots.score ? slots.score({ radius }) : ``} ${slots.button ? slots.button({ radius }) : ``}`;
    }
  })}`;
});
const css$6 = {
  code: ".mode-button.svelte-1j2tcq6.svelte-1j2tcq6{cursor:pointer}.button-circle.svelte-1j2tcq6.svelte-1j2tcq6{fill:transparent;stroke:rgba(255, 255, 255, 0.8);stroke-width:2;transition:all 0.3s ease-out;transform-origin:center;transform-box:fill-box}.mode-button.svelte-1j2tcq6:hover .button-circle.svelte-1j2tcq6{stroke:rgba(255, 255, 255, 1);stroke-width:2.5}.button-text.svelte-1j2tcq6.svelte-1j2tcq6{text-anchor:middle;fill:rgba(255, 255, 255, 0.9);dominant-baseline:middle;user-select:none}",
  map: '{"version":3,"file":"ExpandCollapseButton.svelte","sources":["ExpandCollapseButton.svelte"],"sourcesContent":["<script lang=\\"ts\\">import { spring } from \\"svelte/motion\\";\\nimport { NODE_CONSTANTS } from \\"../base/BaseNodeConstants\\";\\nimport { createEventDispatcher } from \\"svelte\\";\\nexport let mode;\\nexport let y = 0;\\nconst dispatch = createEventDispatcher();\\nlet isHovered = false;\\nconst scale = spring(1, {\\n  stiffness: 0.3,\\n  damping: 0.6\\n});\\nconst filterId = `button-glow-${Math.random().toString(36).slice(2)}`;\\n$: {\\n  if (mode === \\"expand\\") {\\n    scale.set(isHovered ? 1.5 : 1);\\n  } else {\\n    scale.set(isHovered ? 1 : 1.5);\\n  }\\n}\\nfunction handleClick() {\\n  dispatch(\\"click\\");\\n  dispatch(\\"modeChange\\", {\\n    mode: mode === \\"expand\\" ? \\"detail\\" : \\"preview\\"\\n  });\\n}\\n<\/script>\\n\\n<!-- svelte-ignore a11y-click-events-have-key-events -->\\n<!-- svelte-ignore a11y-no-static-element-interactions -->\\n<g \\n    class=\\"mode-button\\"\\n    transform=\\"translate(0, {y})\\"\\n    on:mouseenter={() => isHovered = true}\\n    on:mouseleave={() => isHovered = false}\\n    on:click={handleClick}\\n>\\n    <defs>\\n        <filter id={filterId} x=\\"-50%\\" y=\\"-50%\\" width=\\"200%\\" height=\\"200%\\">\\n            <!-- Strong outer glow -->\\n            <feGaussianBlur in=\\"SourceAlpha\\" stdDeviation=\\"2\\" result=\\"blur1\\"/>\\n            <feFlood flood-color=\\"#FFFFFF\\" flood-opacity=\\"0.6\\" result=\\"color1\\"/>\\n            <feComposite in=\\"color1\\" in2=\\"blur1\\" operator=\\"in\\" result=\\"glow1\\"/>\\n\\n            <!-- Medium glow -->\\n            <feGaussianBlur in=\\"SourceAlpha\\" stdDeviation=\\"1\\" result=\\"blur2\\"/>\\n            <feFlood flood-color=\\"#FFFFFF\\" flood-opacity=\\"0.8\\" result=\\"color2\\"/>\\n            <feComposite in=\\"color2\\" in2=\\"blur2\\" operator=\\"in\\" result=\\"glow2\\"/>\\n\\n            <feMerge>\\n                <feMergeNode in=\\"glow1\\"/>\\n                <feMergeNode in=\\"glow2\\"/>\\n                <feMergeNode in=\\"SourceGraphic\\"/>\\n            </feMerge>\\n        </filter>\\n    </defs>\\n\\n    <circle \\n        r=\\"8\\"\\n        class=\\"button-circle\\"\\n        style:transform=\\"scale({$scale})\\"\\n        style:filter={isHovered ? `url(#${filterId})` : \'none\'}\\n    />\\n    \\n    {#if isHovered}\\n        <text\\n            y=\\"20\\"\\n            class=\\"button-text\\"\\n            style:font-family={NODE_CONSTANTS.FONTS.hover.family}\\n            style:font-size={NODE_CONSTANTS.FONTS.hover.size}\\n            style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}\\n        >\\n            {mode}\\n        </text>\\n    {/if}\\n</g>\\n\\n<style>\\n    .mode-button {\\n        cursor: pointer;\\n    }\\n\\n    .button-circle {\\n        fill: transparent;\\n        stroke: rgba(255, 255, 255, 0.8);\\n        stroke-width: 2;\\n        transition: all 0.3s ease-out;\\n        transform-origin: center;\\n        transform-box: fill-box;\\n    }\\n\\n    .mode-button:hover .button-circle {\\n        stroke: rgba(255, 255, 255, 1);\\n        stroke-width: 2.5;\\n    }\\n\\n    .button-text {\\n        text-anchor: middle;\\n        fill: rgba(255, 255, 255, 0.9);\\n        dominant-baseline: middle;\\n        user-select: none;\\n    }\\n</style>"],"names":[],"mappings":"AA6EI,0CAAa,CACT,MAAM,CAAE,OACZ,CAEA,4CAAe,CACX,IAAI,CAAE,WAAW,CACjB,MAAM,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAChC,YAAY,CAAE,CAAC,CACf,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,QAAQ,CAC7B,gBAAgB,CAAE,MAAM,CACxB,aAAa,CAAE,QACnB,CAEA,2BAAY,MAAM,CAAC,6BAAe,CAC9B,MAAM,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,CAAC,CAAC,CAC9B,YAAY,CAAE,GAClB,CAEA,0CAAa,CACT,WAAW,CAAE,MAAM,CACnB,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC9B,iBAAiB,CAAE,MAAM,CACzB,WAAW,CAAE,IACjB"}'
};
const ExpandCollapseButton = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $scale, $$unsubscribe_scale;
  let { mode } = $$props;
  let { y = 0 } = $$props;
  createEventDispatcher();
  const scale = spring(1, { stiffness: 0.3, damping: 0.6 });
  $$unsubscribe_scale = subscribe(scale, (value) => $scale = value);
  const filterId = `button-glow-${Math.random().toString(36).slice(2)}`;
  if ($$props.mode === void 0 && $$bindings.mode && mode !== void 0) $$bindings.mode(mode);
  if ($$props.y === void 0 && $$bindings.y && y !== void 0) $$bindings.y(y);
  $$result.css.add(css$6);
  {
    {
      if (mode === "expand") {
        scale.set(1);
      } else {
        scale.set(1.5);
      }
    }
  }
  $$unsubscribe_scale();
  return `  <g class="mode-button svelte-1j2tcq6" transform="${"translate(0, " + escape(y, true) + ")"}"><defs><filter${add_attribute("id", filterId, 0)} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur1"></feGaussianBlur><feFlood flood-color="#FFFFFF" flood-opacity="0.6" result="color1"></feFlood><feComposite in="color1" in2="blur1" operator="in" result="glow1"></feComposite><feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur2"></feGaussianBlur><feFlood flood-color="#FFFFFF" flood-opacity="0.8" result="color2"></feFlood><feComposite in="color2" in2="blur2" operator="in" result="glow2"></feComposite><feMerge><feMergeNode in="glow1"></feMergeNode><feMergeNode in="glow2"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs><circle r="8" class="button-circle svelte-1j2tcq6"${add_styles({
    "transform": `scale(${$scale})`,
    "filter": "none"
  })}></circle>${``}</g>`;
});
const css$5 = {
  code: "text.svelte-h5j0qi{text-anchor:middle;dominant-baseline:middle;user-select:none}.title.svelte-h5j0qi{fill:rgba(255, 255, 255, 0.7)}.content.svelte-h5j0qi{fill:white}.score.svelte-h5j0qi{fill:rgba(255, 255, 255, 0.7)}",
  map: '{"version":3,"file":"WordPreview.svelte","sources":["WordPreview.svelte"],"sourcesContent":["<!-- src/lib/components/graph/nodes/word/WordPreview.svelte -->\\n<script lang=\\"ts\\">import { onMount, createEventDispatcher } from \\"svelte\\";\\nimport { NODE_CONSTANTS } from \\"../base/BaseNodeConstants\\";\\nimport BasePreviewNode from \\"../base/BasePreviewNode.svelte\\";\\nimport ExpandCollapseButton from \\"../common/ExpandCollapseButton.svelte\\";\\nimport { userStore } from \\"$lib/stores/userStore\\";\\nimport { fetchWithAuth } from \\"$lib/services/api\\";\\nexport let data;\\nexport let style;\\nexport let transform = \\"\\";\\nconst MAX_RETRIES = 3;\\nconst RETRY_DELAY = 1e3;\\nlet netVotes = 0;\\nlet scoreDisplay = \\"0\\";\\nconst dispatch = createEventDispatcher();\\nfunction handleExpandClick() {\\n  dispatch(\\"modeChange\\", { mode: \\"detail\\" });\\n}\\nfunction getNeo4jNumber(value) {\\n  if (value && typeof value === \\"object\\" && \\"low\\" in value) {\\n    return Number(value.low);\\n  }\\n  return Number(value || 0);\\n}\\nasync function initializeVoteStatus(retryCount = 0) {\\n  if (!$userStore) return;\\n  try {\\n    const response = await fetchWithAuth(`/nodes/word/${data.word}/vote`);\\n    if (!response) {\\n      throw new Error(\\"No response from vote status endpoint\\");\\n    }\\n    console.log(\\"[WordPreview] Vote status response:\\", response);\\n    const posVotes = getNeo4jNumber(response.positiveVotes);\\n    const negVotes = getNeo4jNumber(response.negativeVotes);\\n    console.log(\\"[WordPreview] Parsed vote numbers:\\", { posVotes, negVotes });\\n    data.positiveVotes = posVotes;\\n    data.negativeVotes = negVotes;\\n    netVotes = posVotes - negVotes;\\n    console.log(\\"[WordPreview] Updated state:\\", {\\n      positiveVotes: data.positiveVotes,\\n      negativeVotes: data.negativeVotes,\\n      netVotes,\\n      currentScoreDisplay: scoreDisplay\\n    });\\n  } catch (error) {\\n    console.error(\\"[WordPreview] Error fetching vote status:\\", error);\\n    if (retryCount < MAX_RETRIES) {\\n      console.log(`[WordPreview] Retrying vote status fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);\\n      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));\\n      await initializeVoteStatus(retryCount + 1);\\n    }\\n  }\\n}\\nonMount(async () => {\\n  console.warn(\\"\\\\u{1F3AF} [WordPreview] MOUNT:\\", {\\n    word: data.word,\\n    initialPositiveVotes: data.positiveVotes,\\n    initialNegativeVotes: data.negativeVotes\\n  });\\n  const initialPos = getNeo4jNumber(data.positiveVotes);\\n  const initialNeg = getNeo4jNumber(data.negativeVotes);\\n  netVotes = initialPos - initialNeg;\\n  console.warn(\\"\\\\u{1F3AF} [WordPreview] INITIAL CALCS:\\", {\\n    initialPos,\\n    initialNeg,\\n    netVotes,\\n    scoreDisplay\\n  });\\n  await initializeVoteStatus();\\n});\\n$: {\\n  const oldScoreDisplay = scoreDisplay;\\n  scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();\\n  console.warn(\\"\\\\u{1F3AF} [WordPreview] SCORE UPDATE:\\", {\\n    netVotes,\\n    oldScoreDisplay,\\n    newScoreDisplay: scoreDisplay\\n  });\\n}\\n<\/script>\\n\\n<BasePreviewNode \\n    {style}\\n    {transform}\\n>\\n    <svelte:fragment slot=\\"title\\">\\n        <text\\n            y={-style.previewSize/4 - 15}\\n            class=\\"title\\"\\n            style:font-family={NODE_CONSTANTS.FONTS.title.family}\\n            style:font-size={NODE_CONSTANTS.FONTS.title.size}\\n            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}\\n        >\\n            Word\\n        </text>\\n    </svelte:fragment>\\n\\n    <svelte:fragment slot=\\"content\\">\\n        <text\\n            y={-style.previewSize/4 + 40}\\n            class=\\"content\\"\\n            style:font-family={NODE_CONSTANTS.FONTS.word.family}\\n            style:font-size={NODE_CONSTANTS.FONTS.word.size}\\n            style:font-weight={NODE_CONSTANTS.FONTS.word.weight}\\n        >\\n            {data.word}\\n        </text>\\n    </svelte:fragment>\\n\\n    <svelte:fragment slot=\\"score\\">\\n        <text\\n            y={style.previewSize/4 + 10}\\n            class=\\"score\\"\\n            style:font-family={NODE_CONSTANTS.FONTS.word.family}\\n            style:font-size={NODE_CONSTANTS.FONTS.value.size}\\n            style:font-weight={NODE_CONSTANTS.FONTS.value.weight}\\n        >\\n            {scoreDisplay}\\n        </text>\\n    </svelte:fragment>\\n\\n    <svelte:fragment slot=\\"button\\" let:radius>\\n        <ExpandCollapseButton \\n            mode=\\"expand\\"\\n            y={radius}\\n            on:click={handleExpandClick}\\n        />\\n    </svelte:fragment>\\n</BasePreviewNode>\\n\\n<style>\\n    text {\\n        text-anchor: middle;\\n        dominant-baseline: middle;\\n        user-select: none;\\n    }\\n\\n    .title {\\n        fill: rgba(255, 255, 255, 0.7);\\n    }\\n\\n    .content {\\n        fill: white;\\n    }\\n\\n    .score {\\n        fill: rgba(255, 255, 255, 0.7);\\n    }\\n</style>"],"names":[],"mappings":"AAmII,kBAAK,CACD,WAAW,CAAE,MAAM,CACnB,iBAAiB,CAAE,MAAM,CACzB,WAAW,CAAE,IACjB,CAEA,oBAAO,CACH,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC,CAEA,sBAAS,CACL,IAAI,CAAE,KACV,CAEA,oBAAO,CACH,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC"}'
};
const WordPreview = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $$unsubscribe_userStore;
  $$unsubscribe_userStore = subscribe(userStore, (value) => value);
  let { data } = $$props;
  let { style } = $$props;
  let { transform = "" } = $$props;
  let netVotes = 0;
  let scoreDisplay = "0";
  createEventDispatcher();
  if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
  if ($$props.style === void 0 && $$bindings.style && style !== void 0) $$bindings.style(style);
  if ($$props.transform === void 0 && $$bindings.transform && transform !== void 0) $$bindings.transform(transform);
  $$result.css.add(css$5);
  {
    {
      const oldScoreDisplay = scoreDisplay;
      scoreDisplay = netVotes.toString();
      console.warn("🎯 [WordPreview] SCORE UPDATE:", {
        netVotes,
        oldScoreDisplay,
        newScoreDisplay: scoreDisplay
      });
    }
  }
  $$unsubscribe_userStore();
  return `  ${validate_component(BasePreviewNode, "BasePreviewNode").$$render($$result, { style, transform }, {}, {
    button: ({ radius }) => {
      return `${validate_component(ExpandCollapseButton, "ExpandCollapseButton").$$render($$result, { mode: "expand", y: radius }, {}, {})} `;
    },
    score: () => {
      return `<text${add_attribute("y", style.previewSize / 4 + 10, 0)} class="score svelte-h5j0qi"${add_styles({
        "font-family": NODE_CONSTANTS.FONTS.word.family,
        "font-size": NODE_CONSTANTS.FONTS.value.size,
        "font-weight": NODE_CONSTANTS.FONTS.value.weight
      })}>${escape(scoreDisplay)}</text> `;
    },
    content: () => {
      return `<text${add_attribute("y", -style.previewSize / 4 + 40, 0)} class="content svelte-h5j0qi"${add_styles({
        "font-family": NODE_CONSTANTS.FONTS.word.family,
        "font-size": NODE_CONSTANTS.FONTS.word.size,
        "font-weight": NODE_CONSTANTS.FONTS.word.weight
      })}>${escape(data.word)}</text> `;
    },
    title: () => {
      return `<text${add_attribute("y", -style.previewSize / 4 - 15, 0)} class="title svelte-h5j0qi"${add_styles({
        "font-family": NODE_CONSTANTS.FONTS.title.family,
        "font-size": NODE_CONSTANTS.FONTS.title.size,
        "font-weight": NODE_CONSTANTS.FONTS.title.weight
      })}>Word</text>`;
    }
  })}`;
});
function getVoteValue(votes) {
  if (typeof votes === "number") return votes;
  if (isVoteWithLow(votes)) {
    return votes.low;
  }
  return 0;
}
function getNetVotes(node) {
  if ("positiveVotes" in node && "negativeVotes" in node) {
    const pos = getVoteValue(node.positiveVotes);
    const neg = getVoteValue(node.negativeVotes);
    return pos - neg;
  }
  return getVoteValue(node.votes);
}
function getDisplayName(userId, userDetails, isAnonymous = false) {
  if (isAnonymous) return "Anonymous";
  if (userId === "FreeDictionaryAPI") return "Free Dictionary API";
  return "User";
}
function isVoteWithLow(vote) {
  return typeof vote === "object" && vote !== null && "low" in vote && typeof vote.low === "number";
}
const css$4 = {
  code: "text.svelte-lowxag{text-anchor:middle;font-family:'Orbitron', sans-serif}.title.svelte-lowxag{fill:rgba(255, 255, 255, 0.7)}.main-word.svelte-lowxag{font-size:30px;fill:white;filter:drop-shadow(0 0 10px rgba(255, 255, 255, 0.3))}.context-text.svelte-lowxag{font-size:14px;fill:rgba(255, 255, 255, 0.9)}.stats-label.svelte-lowxag{font-size:14px;fill:white}.stats-text.svelte-lowxag{font-size:14px;fill:rgba(255, 255, 255, 0.7)}.stats-value.svelte-lowxag{font-size:14px;fill:white}.creator-label.svelte-lowxag{font-size:10px;fill:rgba(255, 255, 255, 0.5)}.left-align.svelte-lowxag{text-anchor:start}.button-wrapper{padding-top:4px;height:100%}.vote-button{width:100%;padding:8px 12px;border-radius:4px;font-family:'Orbitron', sans-serif;font-size:0.9rem;cursor:pointer;transition:all 0.2s ease;display:flex;align-items:center;justify-content:center;min-width:100px;box-sizing:border-box;margin:0;color:white;background:rgba(255, 255, 255, 0.05);border:1px solid rgba(255, 255, 255, 0.1);white-space:nowrap}.vote-button.agree{background:rgba(46, 204, 113, 0.1);border:1px solid rgba(46, 204, 113, 0.2)}.vote-button.disagree{background:rgba(231, 76, 60, 0.1);border:1px solid rgba(231, 76, 60, 0.2)}.vote-button.no-vote{background:rgba(255, 255, 255, 0.05);border:1px solid rgba(255, 255, 255, 0.1)}.vote-button:hover:not(:disabled){transform:translateY(-1px)}.vote-button.agree:hover:not(:disabled){background:rgba(46, 204, 113, 0.2);border:1px solid rgba(46, 204, 113, 0.3)}.vote-button.disagree:hover:not(:disabled){background:rgba(231, 76, 60, 0.2);border:1px solid rgba(231, 76, 60, 0.3)}.vote-button.no-vote:hover:not(:disabled){background:rgba(255, 255, 255, 0.1);border:1px solid rgba(255, 255, 255, 0.2)}.vote-button:active:not(:disabled){transform:translateY(0)}.vote-button.agree.active{background:rgba(46, 204, 113, 0.3);border-color:rgba(46, 204, 113, 0.4)}.vote-button.disagree.active{background:rgba(231, 76, 60, 0.3);border-color:rgba(231, 76, 60, 0.4)}.vote-button.no-vote.active{background:rgba(255, 255, 255, 0.15);border-color:rgba(255, 255, 255, 0.3)}.vote-button:disabled{opacity:0.5;cursor:not-allowed}",
  map: `{"version":3,"file":"WordDetail.svelte","sources":["WordDetail.svelte"],"sourcesContent":["<script lang=\\"ts\\">import { onMount, createEventDispatcher } from \\"svelte\\";\\nimport { NODE_CONSTANTS } from \\"../base/BaseNodeConstants\\";\\nimport { getUserDetails } from \\"$lib/services/userLookup\\";\\nimport { getDisplayName } from \\"../utils/nodeUtils\\";\\nimport { fetchWithAuth } from \\"$lib/services/api\\";\\nimport { userStore } from \\"$lib/stores/userStore\\";\\nimport BaseDetailNode from \\"../base/BaseDetailNode.svelte\\";\\nimport ExpandCollapseButton from \\"../common/ExpandCollapseButton.svelte\\";\\nexport let data;\\nexport let style;\\nconst dispatch = createEventDispatcher();\\nconst METRICS_SPACING = {\\n  labelX: -200,\\n  equalsX: 0,\\n  valueX: 30\\n};\\nlet wordCreatorDetails = null;\\nlet userVoteStatus = \\"none\\";\\nlet isVoting = false;\\nlet userName;\\nlet netVotes;\\nlet wordStatus;\\nconst MAX_RETRIES = 3;\\nconst RETRY_DELAY = 1e3;\\nfunction getNeo4jNumber(value) {\\n  if (value && typeof value === \\"object\\" && \\"low\\" in value) {\\n    return Number(value.low);\\n  }\\n  return Number(value || 0);\\n}\\nasync function initializeVoteStatus(retryCount = 0) {\\n  if (!$userStore) return;\\n  try {\\n    const response = await fetchWithAuth(\`/nodes/word/\${data.word}/vote\`);\\n    if (!response) {\\n      throw new Error(\\"No response from vote status endpoint\\");\\n    }\\n    userVoteStatus = response.status || \\"none\\";\\n    data.positiveVotes = getNeo4jNumber(response.positiveVotes);\\n    data.negativeVotes = getNeo4jNumber(response.negativeVotes);\\n  } catch (error) {\\n    console.error(\\"Error fetching vote status:\\", error);\\n    if (retryCount < MAX_RETRIES) {\\n      console.log(\`Retrying vote status fetch (attempt \${retryCount + 1}/\${MAX_RETRIES})\`);\\n      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));\\n      await initializeVoteStatus(retryCount + 1);\\n    }\\n  }\\n}\\nfunction handleCollapse() {\\n  dispatch(\\"modeChange\\", { mode: \\"preview\\" });\\n}\\nasync function handleVote(voteType) {\\n  if (!$userStore || isVoting) return;\\n  isVoting = true;\\n  const oldVoteStatus = userVoteStatus;\\n  try {\\n    userVoteStatus = voteType;\\n    if (voteType === \\"none\\") {\\n      const result = await fetchWithAuth(\\n        \`/nodes/word/\${data.word}/vote/remove\`,\\n        { method: \\"POST\\" }\\n      );\\n      data.positiveVotes = getNeo4jNumber(result.positiveVotes);\\n      data.negativeVotes = getNeo4jNumber(result.negativeVotes);\\n    } else {\\n      const result = await fetchWithAuth(\\n        \`/nodes/word/\${data.word}/vote\`,\\n        {\\n          method: \\"POST\\",\\n          body: JSON.stringify({\\n            isPositive: voteType === \\"agree\\"\\n          })\\n        }\\n      );\\n      data.positiveVotes = getNeo4jNumber(result.positiveVotes);\\n      data.negativeVotes = getNeo4jNumber(result.negativeVotes);\\n    }\\n  } catch (error) {\\n    console.error(\\"Error voting:\\", error);\\n    userVoteStatus = oldVoteStatus;\\n    await initializeVoteStatus();\\n  } finally {\\n    isVoting = false;\\n  }\\n}\\nonMount(async () => {\\n  if (data.createdBy && data.createdBy !== \\"FreeDictionaryAPI\\") {\\n    wordCreatorDetails = await getUserDetails(data.createdBy);\\n  }\\n  data.positiveVotes = getNeo4jNumber(data.positiveVotes);\\n  data.negativeVotes = getNeo4jNumber(data.negativeVotes);\\n  await initializeVoteStatus();\\n});\\n$: userName = $userStore?.preferred_username || $userStore?.name || \\"Anonymous\\";\\n$: netVotes = getNeo4jNumber(data.positiveVotes) - getNeo4jNumber(data.negativeVotes);\\n$: wordStatus = netVotes > 0 ? \\"agreed\\" : netVotes < 0 ? \\"disagreed\\" : \\"undecided\\";\\n<\/script>\\n\\n<BaseDetailNode {style}>\\n    <svelte:fragment slot=\\"default\\" let:radius>\\n        <!-- Title -->\\n        <text\\n            y={-radius + 40}\\n            class=\\"title\\"\\n            style:font-family={NODE_CONSTANTS.FONTS.title.family}\\n            style:font-size={NODE_CONSTANTS.FONTS.title.size}\\n            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}\\n        >\\n            Word\\n        </text>\\n \\n        <!-- Main Word Display -->\\n        <g class=\\"word-display\\" transform=\\"translate(0, {-radius/2})\\">\\n            <text\\n                class=\\"word main-word\\"\\n                style:font-family={NODE_CONSTANTS.FONTS.word.family}\\n                style:font-weight={NODE_CONSTANTS.FONTS.word.weight}\\n            >\\n                {data.word}\\n            </text>\\n        </g>\\n \\n        <!-- User Context -->\\n        <g transform=\\"translate(0, -100)\\">\\n            <text \\n                x={METRICS_SPACING.labelX} \\n                class=\\"context-text left-align\\"\\n            >\\n                Please vote on whether to include this keyword in \\n            </text>\\n            <text \\n                x={METRICS_SPACING.labelX} \\n                y=\\"25\\" \\n                class=\\"context-text left-align\\"\\n            >\\n                ProjectZer0 or not.\\n            </text>\\n            <text \\n                x={METRICS_SPACING.labelX} \\n                y=\\"60\\" \\n                class=\\"context-text left-align\\"\\n            >\\n                You can always change your vote using the buttons below.\\n            </text>\\n        </g>\\n \\n        <!-- Vote Buttons -->\\n        <g transform=\\"translate(0, -10)\\">\\n            <foreignObject x={-160} width=\\"100\\" height=\\"45\\">\\n                <div class=\\"button-wrapper\\">\\n                    <button \\n                        class=\\"vote-button agree\\"\\n                        class:active={userVoteStatus === 'agree'}\\n                        on:click={() => handleVote('agree')}\\n                        disabled={isVoting}\\n                    >\\n                        Agree\\n                    </button>\\n                </div>\\n            </foreignObject>\\n \\n            <foreignObject x={-50} width=\\"100\\" height=\\"45\\">\\n                <div class=\\"button-wrapper\\">\\n                    <button \\n                        class=\\"vote-button no-vote\\"\\n                        class:active={userVoteStatus === 'none'}\\n                        on:click={() => handleVote('none')}\\n                        disabled={isVoting}\\n                    >\\n                        No Vote\\n                    </button>\\n                </div>\\n            </foreignObject>\\n \\n            <foreignObject x={60} width=\\"100\\" height=\\"45\\">\\n                <div class=\\"button-wrapper\\">\\n                    <button \\n                        class=\\"vote-button disagree\\"\\n                        class:active={userVoteStatus === 'disagree'}\\n                        on:click={() => handleVote('disagree')}\\n                        disabled={isVoting}\\n                    >\\n                        Disagree\\n                    </button>\\n                </div>\\n            </foreignObject>\\n        </g>\\n \\n        <!-- Vote Stats -->\\n        <g transform=\\"translate(0, 60)\\">\\n            <text x={METRICS_SPACING.labelX} class=\\"stats-label left-align\\">\\n                Vote Data:\\n            </text>\\n            \\n            <!-- User's current vote -->\\n            <g transform=\\"translate(0, 30)\\">\\n                <text x={METRICS_SPACING.labelX} class=\\"stats-text left-align\\">\\n                    {userName}\\n                </text>\\n                <text x={METRICS_SPACING.equalsX} class=\\"stats-text\\">\\n                    =\\n                </text>\\n                <text x={METRICS_SPACING.valueX} class=\\"stats-value left-align\\">\\n                    {userVoteStatus}\\n                </text>\\n            </g>\\n \\n            <!-- Total agree votes -->\\n            <g transform=\\"translate(0, 55)\\">\\n                <text x={METRICS_SPACING.labelX} class=\\"stats-text left-align\\">\\n                    Total Agree\\n                </text>\\n                <text x={METRICS_SPACING.equalsX} class=\\"stats-text\\">\\n                    =\\n                </text>\\n                <text x={METRICS_SPACING.valueX} class=\\"stats-value left-align\\">\\n                    {data.positiveVotes}\\n                </text>\\n            </g>\\n \\n            <!-- Total disagree votes -->\\n            <g transform=\\"translate(0, 80)\\">\\n                <text x={METRICS_SPACING.labelX} class=\\"stats-text left-align\\">\\n                    Total Disagree\\n                </text>\\n                <text x={METRICS_SPACING.equalsX} class=\\"stats-text\\">\\n                    =\\n                </text>\\n                <text x={METRICS_SPACING.valueX} class=\\"stats-value left-align\\">\\n                    {data.negativeVotes}\\n                </text>\\n            </g>\\n \\n            <!-- Net votes -->\\n            <g transform=\\"translate(0, 105)\\">\\n                <text x={METRICS_SPACING.labelX} class=\\"stats-text left-align\\">\\n                    Net \\n                </text>\\n                <text x={METRICS_SPACING.equalsX} class=\\"stats-text\\">\\n                    =\\n                </text>\\n                <text x={METRICS_SPACING.valueX} class=\\"stats-value left-align\\">\\n                    {netVotes}\\n                </text>\\n            </g>\\n \\n            <!-- Word status -->\\n            <g transform=\\"translate(0, 130)\\">\\n                <text x={METRICS_SPACING.labelX} class=\\"stats-text left-align\\">\\n                    Word Status\\n                </text>\\n                <text x={METRICS_SPACING.equalsX} class=\\"stats-text\\">\\n                    =\\n                </text>\\n                <text x={METRICS_SPACING.valueX} class=\\"stats-value left-align\\">\\n                    {wordStatus}\\n                </text>\\n            </g>\\n        </g>\\n        \\n        <!-- Creator credits -->\\n        <g transform=\\"translate(0, {radius - 55})\\">\\n            <text class=\\"creator-label\\">\\n                created by: {getDisplayName(data.createdBy, wordCreatorDetails, !data.publicCredit)}\\n            </text>\\n        </g>\\n \\n        <!-- Contract button -->\\n        <ExpandCollapseButton \\n            mode=\\"collapse\\"\\n            y={radius}\\n            on:click={handleCollapse}\\n        />\\n    </svelte:fragment>\\n </BaseDetailNode>\\n \\n <style>\\n    text {\\n        text-anchor: middle;\\n        font-family: 'Orbitron', sans-serif;\\n    }\\n \\n    .title {\\n        fill: rgba(255, 255, 255, 0.7);\\n    }\\n \\n    .main-word {\\n        font-size: 30px;\\n        fill: white;\\n        filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));\\n    }\\n \\n    .context-text {\\n        font-size: 14px;\\n        fill: rgba(255, 255, 255, 0.9);\\n    }\\n \\n    .stats-label {\\n        font-size: 14px;\\n        fill: white;\\n    }\\n \\n    .stats-text {\\n        font-size: 14px;\\n        fill: rgba(255, 255, 255, 0.7);\\n    }\\n \\n    .stats-value {\\n        font-size: 14px;\\n        fill: white;\\n    }\\n \\n    .creator-label {\\n        font-size: 10px;\\n        fill: rgba(255, 255, 255, 0.5);\\n    }\\n \\n    .left-align {\\n        text-anchor: start;\\n    }\\n \\n    :global(.button-wrapper) {\\n        padding-top: 4px;\\n        height: 100%;\\n    }\\n \\n    :global(.vote-button) {\\n        width: 100%;\\n        padding: 8px 12px;\\n        border-radius: 4px;\\n        font-family: 'Orbitron', sans-serif;\\n        font-size: 0.9rem;\\n        cursor: pointer;\\n        transition: all 0.2s ease;\\n        display: flex;\\n        align-items: center;\\n        justify-content: center;\\n        min-width: 100px;\\n        box-sizing: border-box;\\n        margin: 0;\\n        color: white;\\n        background: rgba(255, 255, 255, 0.05);\\n        border: 1px solid rgba(255, 255, 255, 0.1);\\n        white-space: nowrap;\\n    }\\n \\n    :global(.vote-button.agree) {\\n        background: rgba(46, 204, 113, 0.1);\\n        border: 1px solid rgba(46, 204, 113, 0.2);\\n    }\\n \\n    :global(.vote-button.disagree) {\\n        background: rgba(231, 76, 60, 0.1);\\n        border: 1px solid rgba(231, 76, 60, 0.2);\\n    }\\n \\n    :global(.vote-button.no-vote) {\\n        background: rgba(255, 255, 255, 0.05);\\n        border: 1px solid rgba(255, 255, 255, 0.1);\\n    }\\n \\n    :global(.vote-button:hover:not(:disabled)) {\\n        transform: translateY(-1px);\\n    }\\n \\n    :global(.vote-button.agree:hover:not(:disabled)) {\\n        background: rgba(46, 204, 113, 0.2);\\n        border: 1px solid rgba(46, 204, 113, 0.3);\\n    }\\n \\n    :global(.vote-button.disagree:hover:not(:disabled)) {\\n        background: rgba(231, 76, 60, 0.2);\\n        border: 1px solid rgba(231, 76, 60, 0.3);\\n    }\\n \\n    :global(.vote-button.no-vote:hover:not(:disabled)) {\\n        background: rgba(255, 255, 255, 0.1);\\n        border: 1px solid rgba(255, 255, 255, 0.2);\\n    }\\n \\n    :global(.vote-button:active:not(:disabled)) {\\n        transform: translateY(0);\\n    }\\n \\n    :global(.vote-button.agree.active) {\\n        background: rgba(46, 204, 113, 0.3);\\n        border-color: rgba(46, 204, 113, 0.4);\\n    }\\n \\n    :global(.vote-button.disagree.active) {\\n        background: rgba(231, 76, 60, 0.3);\\n        border-color: rgba(231, 76, 60, 0.4);\\n    }\\n \\n    :global(.vote-button.no-vote.active) {\\n        background: rgba(255, 255, 255, 0.15);\\n        border-color: rgba(255, 255, 255, 0.3);\\n    }\\n \\n    :global(.vote-button:disabled) {\\n        opacity: 0.5;\\n        cursor: not-allowed;\\n    }\\n </style>"],"names":[],"mappings":"AAsRI,kBAAK,CACD,WAAW,CAAE,MAAM,CACnB,WAAW,CAAE,UAAU,CAAC,CAAC,UAC7B,CAEA,oBAAO,CACH,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC,CAEA,wBAAW,CACP,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KAAK,CACX,MAAM,CAAE,YAAY,CAAC,CAAC,CAAC,CAAC,IAAI,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACzD,CAEA,2BAAc,CACV,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC,CAEA,0BAAa,CACT,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KACV,CAEA,yBAAY,CACR,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC,CAEA,0BAAa,CACT,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KACV,CAEA,4BAAe,CACX,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC,CAEA,yBAAY,CACR,WAAW,CAAE,KACjB,CAEQ,eAAiB,CACrB,WAAW,CAAE,GAAG,CAChB,MAAM,CAAE,IACZ,CAEQ,YAAc,CAClB,KAAK,CAAE,IAAI,CACX,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,aAAa,CAAE,GAAG,CAClB,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,SAAS,CAAE,MAAM,CACjB,MAAM,CAAE,OAAO,CACf,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,IAAI,CACzB,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,eAAe,CAAE,MAAM,CACvB,SAAS,CAAE,KAAK,CAChB,UAAU,CAAE,UAAU,CACtB,MAAM,CAAE,CAAC,CACT,KAAK,CAAE,KAAK,CACZ,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,IAAI,CAAC,CACrC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,WAAW,CAAE,MACjB,CAEQ,kBAAoB,CACxB,UAAU,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACnC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC5C,CAEQ,qBAAuB,CAC3B,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CAAC,CAClC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CAC3C,CAEQ,oBAAsB,CAC1B,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,IAAI,CAAC,CACrC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC7C,CAEQ,iCAAmC,CACvC,SAAS,CAAE,WAAW,IAAI,CAC9B,CAEQ,uCAAyC,CAC7C,UAAU,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACnC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC5C,CAEQ,0CAA4C,CAChD,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CAAC,CAClC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CAC3C,CAEQ,yCAA2C,CAC/C,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACpC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC7C,CAEQ,kCAAoC,CACxC,SAAS,CAAE,WAAW,CAAC,CAC3B,CAEQ,yBAA2B,CAC/B,UAAU,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACnC,YAAY,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACxC,CAEQ,4BAA8B,CAClC,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CAAC,CAClC,YAAY,CAAE,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CACvC,CAEQ,2BAA6B,CACjC,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,IAAI,CAAC,CACrC,YAAY,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACzC,CAEQ,qBAAuB,CAC3B,OAAO,CAAE,GAAG,CACZ,MAAM,CAAE,WACZ"}`
};
function getNeo4jNumber(value) {
  if (value && typeof value === "object" && "low" in value) {
    return Number(value.low);
  }
  return Number(value || 0);
}
const WordDetail = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $userStore, $$unsubscribe_userStore;
  $$unsubscribe_userStore = subscribe(userStore, (value) => $userStore = value);
  let { data } = $$props;
  let { style } = $$props;
  createEventDispatcher();
  const METRICS_SPACING = { labelX: -200, equalsX: 0, valueX: 30 };
  let wordCreatorDetails = null;
  let userVoteStatus = "none";
  let userName;
  let netVotes;
  let wordStatus;
  if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
  if ($$props.style === void 0 && $$bindings.style && style !== void 0) $$bindings.style(style);
  $$result.css.add(css$4);
  userName = $userStore?.preferred_username || $userStore?.name || "Anonymous";
  netVotes = getNeo4jNumber(data.positiveVotes) - getNeo4jNumber(data.negativeVotes);
  wordStatus = netVotes > 0 ? "agreed" : netVotes < 0 ? "disagreed" : "undecided";
  $$unsubscribe_userStore();
  return `${validate_component(BaseDetailNode, "BaseDetailNode").$$render($$result, { style }, {}, {
    default: ({ radius }) => {
      return ` <text${add_attribute("y", -radius + 40, 0)} class="title svelte-lowxag"${add_styles({
        "font-family": NODE_CONSTANTS.FONTS.title.family,
        "font-size": NODE_CONSTANTS.FONTS.title.size,
        "font-weight": NODE_CONSTANTS.FONTS.title.weight
      })}>Word</text>  <g class="word-display" transform="${"translate(0, " + escape(-radius / 2, true) + ")"}"><text class="word main-word svelte-lowxag"${add_styles({
        "font-family": NODE_CONSTANTS.FONTS.word.family,
        "font-weight": NODE_CONSTANTS.FONTS.word.weight
      })}>${escape(data.word)}</text></g>  <g transform="translate(0, -100)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="context-text left-align svelte-lowxag">Please vote on whether to include this keyword in 
            </text><text${add_attribute("x", METRICS_SPACING.labelX, 0)} y="25" class="context-text left-align svelte-lowxag">ProjectZer0 or not.
            </text><text${add_attribute("x", METRICS_SPACING.labelX, 0)} y="60" class="context-text left-align svelte-lowxag">You can always change your vote using the buttons below.</text></g>  <g transform="translate(0, -10)"><foreignObject${add_attribute("x", -160, 0)} width="100" height="45"><div class="button-wrapper"><button class="${["vote-button agree", ""].join(" ").trim()}" ${""}>Agree</button></div></foreignObject><foreignObject${add_attribute("x", -50, 0)} width="100" height="45"><div class="button-wrapper"><button class="${["vote-button no-vote", "active"].join(" ").trim()}" ${""}>No Vote</button></div></foreignObject><foreignObject${add_attribute("x", 60, 0)} width="100" height="45"><div class="button-wrapper"><button class="${["vote-button disagree", ""].join(" ").trim()}" ${""}>Disagree</button></div></foreignObject></g>  <g transform="translate(0, 60)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-label left-align svelte-lowxag">Vote Data:
            </text><g transform="translate(0, 30)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-text left-align svelte-lowxag">${escape(userName)}</text><text${add_attribute("x", METRICS_SPACING.equalsX, 0)} class="stats-text svelte-lowxag">=
                </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="stats-value left-align svelte-lowxag">${escape(userVoteStatus)}</text></g><g transform="translate(0, 55)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-text left-align svelte-lowxag">Total Agree
                </text><text${add_attribute("x", METRICS_SPACING.equalsX, 0)} class="stats-text svelte-lowxag">=
                </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="stats-value left-align svelte-lowxag">${escape(data.positiveVotes)}</text></g><g transform="translate(0, 80)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-text left-align svelte-lowxag">Total Disagree
                </text><text${add_attribute("x", METRICS_SPACING.equalsX, 0)} class="stats-text svelte-lowxag">=
                </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="stats-value left-align svelte-lowxag">${escape(data.negativeVotes)}</text></g><g transform="translate(0, 105)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-text left-align svelte-lowxag">Net 
                </text><text${add_attribute("x", METRICS_SPACING.equalsX, 0)} class="stats-text svelte-lowxag">=
                </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="stats-value left-align svelte-lowxag">${escape(netVotes)}</text></g><g transform="translate(0, 130)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-text left-align svelte-lowxag">Word Status
                </text><text${add_attribute("x", METRICS_SPACING.equalsX, 0)} class="stats-text svelte-lowxag">=
                </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="stats-value left-align svelte-lowxag">${escape(wordStatus)}</text></g></g>  <g transform="${"translate(0, " + escape(radius - 55, true) + ")"}"><text class="creator-label svelte-lowxag">created by: ${escape(getDisplayName(data.createdBy, wordCreatorDetails, !data.publicCredit))}</text></g>  ${validate_component(ExpandCollapseButton, "ExpandCollapseButton").$$render($$result, { mode: "collapse", y: radius }, {}, {})}`;
    }
  })}`;
});
const css$3 = {
  code: "text.svelte-1723qqz{dominant-baseline:middle;user-select:none}.centered.svelte-1723qqz{text-anchor:middle}.left-aligned.svelte-1723qqz{text-anchor:start}.title.svelte-1723qqz{fill:rgba(255, 255, 255, 0.7)}.content.svelte-1723qqz{fill:white}.score.svelte-1723qqz{fill:rgba(255, 255, 255, 0.7);text-anchor:middle}",
  map: '{"version":3,"file":"DefinitionPreview.svelte","sources":["DefinitionPreview.svelte"],"sourcesContent":["<!-- src/lib/components/graph/nodes/definition/DefinitionPreview.svelte -->\\n<script lang=\\"ts\\">import { onMount, createEventDispatcher } from \\"svelte\\";\\nimport { NODE_CONSTANTS } from \\"../base/BaseNodeConstants\\";\\nimport BasePreviewNode from \\"../base/BasePreviewNode.svelte\\";\\nimport ExpandCollapseButton from \\"../common/ExpandCollapseButton.svelte\\";\\nimport { userStore } from \\"$lib/stores/userStore\\";\\nimport { fetchWithAuth } from \\"$lib/services/api\\";\\nexport let definition;\\nexport let type;\\nexport let style;\\nexport let transform = \\"\\";\\nexport let word;\\nconst MAX_RETRIES = 3;\\nconst RETRY_DELAY = 1e3;\\nlet netVotes = 0;\\nlet scoreDisplay = \\"0\\";\\nconst dispatch = createEventDispatcher();\\nfunction handleHover(event) {\\n  dispatch(\\"hover\\", { data: definition, isHovered: event.detail.isHovered });\\n}\\nfunction handleExpandClick() {\\n  dispatch(\\"modeChange\\", { mode: \\"detail\\" });\\n}\\nfunction getNeo4jNumber(value) {\\n  if (value && typeof value === \\"object\\" && \\"low\\" in value) {\\n    return Number(value.low);\\n  }\\n  return Number(value || 0);\\n}\\nasync function initializeVoteStatus(retryCount = 0) {\\n  if (!$userStore) return;\\n  try {\\n    const response = await fetchWithAuth(`/definitions/${definition.id}/vote`);\\n    if (!response) {\\n      throw new Error(\\"No response from vote status endpoint\\");\\n    }\\n    console.log(\\"[DefinitionPreview] Vote status response:\\", response);\\n    const posVotes = getNeo4jNumber(response.positiveVotes);\\n    const negVotes = getNeo4jNumber(response.negativeVotes);\\n    console.log(\\"[DefinitionPreview] Parsed vote numbers:\\", { posVotes, negVotes });\\n    definition.positiveVotes = posVotes;\\n    definition.negativeVotes = negVotes;\\n    netVotes = posVotes - negVotes;\\n    console.log(\\"[DefinitionPreview] Updated state:\\", {\\n      positiveVotes: definition.positiveVotes,\\n      negativeVotes: definition.negativeVotes,\\n      netVotes,\\n      currentScoreDisplay: scoreDisplay\\n    });\\n  } catch (error) {\\n    console.error(\\"[DefinitionPreview] Error fetching vote status:\\", error);\\n    if (retryCount < MAX_RETRIES) {\\n      console.log(`[DefinitionPreview] Retrying vote status fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);\\n      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));\\n      await initializeVoteStatus(retryCount + 1);\\n    }\\n  }\\n}\\n$: textWidth = style.previewSize - style.padding.preview * 2 - 45;\\n$: maxCharsPerLine = Math.floor(textWidth / 8);\\n$: content = `${word}: ${definition.text}`;\\n$: lines = content.split(\\" \\").reduce((acc, word2) => {\\n  const currentLine = acc[acc.length - 1] || \\"\\";\\n  const testLine = currentLine + (currentLine ? \\" \\" : \\"\\") + word2;\\n  if (!currentLine || testLine.length <= maxCharsPerLine) {\\n    acc[acc.length - 1] = testLine;\\n  } else {\\n    acc.push(word2);\\n  }\\n  return acc;\\n}, [\\"\\"]);\\nonMount(async () => {\\n  console.warn(\\"\\\\u{1F3AF} [DefinitionPreview] MOUNT:\\", {\\n    id: definition.id,\\n    initialPositiveVotes: definition.positiveVotes,\\n    initialNegativeVotes: definition.negativeVotes\\n  });\\n  const initialPos = getNeo4jNumber(definition.positiveVotes);\\n  const initialNeg = getNeo4jNumber(definition.negativeVotes);\\n  netVotes = initialPos - initialNeg;\\n  console.warn(\\"\\\\u{1F3AF} [DefinitionPreview] INITIAL CALCS:\\", {\\n    initialPos,\\n    initialNeg,\\n    netVotes,\\n    scoreDisplay\\n  });\\n  await initializeVoteStatus();\\n});\\n$: {\\n  const oldScoreDisplay = scoreDisplay;\\n  scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();\\n  console.warn(\\"\\\\u{1F3AF} [DefinitionPreview] SCORE UPDATE:\\", {\\n    netVotes,\\n    oldScoreDisplay,\\n    newScoreDisplay: scoreDisplay\\n  });\\n}\\n<\/script>\\n\\n<BasePreviewNode \\n    {style}\\n    {transform}\\n>\\n    <svelte:fragment slot=\\"title\\">\\n        <text\\n            y={-style.previewSize/4 - 50}\\n            class=\\"title centered\\"\\n            style:font-family={NODE_CONSTANTS.FONTS.title.family}\\n            style:font-size=\\"12px\\"\\n            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}\\n        >\\n            {type === \'live\' ? \'Live Definition\' : \'Alternative Definition\'}\\n        </text>\\n    </svelte:fragment>\\n\\n    <svelte:fragment slot=\\"content\\">\\n        <text\\n            y={-style.previewSize/4 + 20}\\n            x={-style.previewSize/2 + 35}\\n            class=\\"content left-aligned\\"\\n            style:font-family={NODE_CONSTANTS.FONTS.word.family}\\n            style:font-size={NODE_CONSTANTS.FONTS.word.size}\\n            style:font-weight={NODE_CONSTANTS.FONTS.word.weight}\\n        >\\n            {#each lines as line, i}\\n                <tspan \\n                    x={-style.previewSize/2 + 40}\\n                    dy={i === 0 ? 0 : \\"1.2em\\"}\\n                >\\n                    {line}\\n                </tspan>\\n            {/each}\\n        </text>\\n    </svelte:fragment>\\n\\n    <svelte:fragment slot=\\"score\\">\\n        <text\\n            y={style.previewSize/4 + 10}\\n            class=\\"score\\"\\n            style:font-family={NODE_CONSTANTS.FONTS.word.family}\\n            style:font-size={NODE_CONSTANTS.FONTS.value.size}\\n            style:font-weight={NODE_CONSTANTS.FONTS.value.weight}\\n        >\\n            {scoreDisplay}\\n        </text>\\n    </svelte:fragment>\\n\\n    <svelte:fragment slot=\\"button\\" let:radius>\\n        <ExpandCollapseButton \\n            mode=\\"expand\\"\\n            y={radius}\\n            on:click={handleExpandClick}\\n        />\\n    </svelte:fragment>\\n</BasePreviewNode>\\n\\n<style>\\n    text {\\n        dominant-baseline: middle;\\n        user-select: none;\\n    }\\n\\n    .centered {\\n        text-anchor: middle;\\n    }\\n\\n    .left-aligned {\\n        text-anchor: start;\\n    }\\n\\n    .title {\\n        fill: rgba(255, 255, 255, 0.7);\\n    }\\n\\n    .content {\\n        fill: white;\\n    }\\n\\n    .score {\\n        fill: rgba(255, 255, 255, 0.7);\\n        text-anchor: middle;\\n    }\\n</style>"],"names":[],"mappings":"AA6JI,mBAAK,CACD,iBAAiB,CAAE,MAAM,CACzB,WAAW,CAAE,IACjB,CAEA,wBAAU,CACN,WAAW,CAAE,MACjB,CAEA,4BAAc,CACV,WAAW,CAAE,KACjB,CAEA,qBAAO,CACH,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC,CAEA,uBAAS,CACL,IAAI,CAAE,KACV,CAEA,qBAAO,CACH,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC9B,WAAW,CAAE,MACjB"}'
};
const DefinitionPreview = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let textWidth;
  let maxCharsPerLine;
  let content;
  let lines;
  let $$unsubscribe_userStore;
  $$unsubscribe_userStore = subscribe(userStore, (value) => value);
  let { definition } = $$props;
  let { type } = $$props;
  let { style } = $$props;
  let { transform = "" } = $$props;
  let { word } = $$props;
  let netVotes = 0;
  let scoreDisplay = "0";
  createEventDispatcher();
  if ($$props.definition === void 0 && $$bindings.definition && definition !== void 0) $$bindings.definition(definition);
  if ($$props.type === void 0 && $$bindings.type && type !== void 0) $$bindings.type(type);
  if ($$props.style === void 0 && $$bindings.style && style !== void 0) $$bindings.style(style);
  if ($$props.transform === void 0 && $$bindings.transform && transform !== void 0) $$bindings.transform(transform);
  if ($$props.word === void 0 && $$bindings.word && word !== void 0) $$bindings.word(word);
  $$result.css.add(css$3);
  textWidth = style.previewSize - style.padding.preview * 2 - 45;
  maxCharsPerLine = Math.floor(textWidth / 8);
  content = `${word}: ${definition.text}`;
  lines = content.split(" ").reduce(
    (acc, word2) => {
      const currentLine = acc[acc.length - 1] || "";
      const testLine = currentLine + (currentLine ? " " : "") + word2;
      if (!currentLine || testLine.length <= maxCharsPerLine) {
        acc[acc.length - 1] = testLine;
      } else {
        acc.push(word2);
      }
      return acc;
    },
    [""]
  );
  {
    {
      const oldScoreDisplay = scoreDisplay;
      scoreDisplay = netVotes.toString();
      console.warn("🎯 [DefinitionPreview] SCORE UPDATE:", {
        netVotes,
        oldScoreDisplay,
        newScoreDisplay: scoreDisplay
      });
    }
  }
  $$unsubscribe_userStore();
  return `  ${validate_component(BasePreviewNode, "BasePreviewNode").$$render($$result, { style, transform }, {}, {
    button: ({ radius }) => {
      return `${validate_component(ExpandCollapseButton, "ExpandCollapseButton").$$render($$result, { mode: "expand", y: radius }, {}, {})} `;
    },
    score: () => {
      return `<text${add_attribute("y", style.previewSize / 4 + 10, 0)} class="score svelte-1723qqz"${add_styles({
        "font-family": NODE_CONSTANTS.FONTS.word.family,
        "font-size": NODE_CONSTANTS.FONTS.value.size,
        "font-weight": NODE_CONSTANTS.FONTS.value.weight
      })}>${escape(scoreDisplay)}</text> `;
    },
    content: () => {
      return `<text${add_attribute("y", -style.previewSize / 4 + 20, 0)}${add_attribute("x", -style.previewSize / 2 + 35, 0)} class="content left-aligned svelte-1723qqz"${add_styles({
        "font-family": NODE_CONSTANTS.FONTS.word.family,
        "font-size": NODE_CONSTANTS.FONTS.word.size,
        "font-weight": NODE_CONSTANTS.FONTS.word.weight
      })}>${each(lines, (line, i) => {
        return `<tspan${add_attribute("x", -style.previewSize / 2 + 40, 0)}${add_attribute("dy", i === 0 ? 0 : "1.2em", 0)}>${escape(line)}</tspan>`;
      })}</text> `;
    },
    title: () => {
      return `<text${add_attribute("y", -style.previewSize / 4 - 50, 0)} class="title centered svelte-1723qqz"${add_styles({
        "font-family": NODE_CONSTANTS.FONTS.title.family,
        "font-size": `12px`,
        "font-weight": NODE_CONSTANTS.FONTS.title.weight
      })}>${escape(type === "live" ? "Live Definition" : "Alternative Definition")}</text>`;
    }
  })}`;
});
const NavigationOptionId = {
  DASHBOARD: "dashboard",
  CREATE_NODE: "create-node",
  EDIT_PROFILE: "edit-profile",
  EXPLORE: "explore",
  NETWORK: "network",
  INTERACTIONS: "interactions",
  CREATIONS: "creations",
  LOGOUT: "logout",
  ALTERNATIVE_DEFINITIONS: "alternative-definitions",
  CREATE_ALTERNATIVE: "create-alternative",
  DISCUSS: "discuss"
};
const NavigationContext = {
  DASHBOARD: "dashboard",
  CREATE_NODE: "create-node",
  EXPLORE: "explore",
  WORD: "word",
  EDIT_PROFILE: "edit-profile"
};
const navigationIcons = {
  [NavigationOptionId.EXPLORE]: "Language",
  [NavigationOptionId.CREATE_NODE]: "add_circle",
  [NavigationOptionId.NETWORK]: "network_node",
  [NavigationOptionId.LOGOUT]: "logout",
  [NavigationOptionId.EDIT_PROFILE]: "settings",
  [NavigationOptionId.INTERACTIONS]: "compare_arrows",
  [NavigationOptionId.CREATIONS]: "stars",
  [NavigationOptionId.DASHBOARD]: "home",
  [NavigationOptionId.ALTERNATIVE_DEFINITIONS]: "format_list_bulleted",
  [NavigationOptionId.CREATE_ALTERNATIVE]: "playlist_add_circle",
  [NavigationOptionId.DISCUSS]: "forum"
};
const navigationConfigs = {
  [NavigationContext.DASHBOARD]: [
    NavigationOptionId.EXPLORE,
    NavigationOptionId.CREATE_NODE,
    NavigationOptionId.NETWORK,
    NavigationOptionId.LOGOUT,
    NavigationOptionId.EDIT_PROFILE,
    NavigationOptionId.INTERACTIONS,
    NavigationOptionId.CREATIONS
  ],
  [NavigationContext.EDIT_PROFILE]: [
    NavigationOptionId.EXPLORE,
    NavigationOptionId.CREATE_NODE,
    NavigationOptionId.NETWORK,
    NavigationOptionId.LOGOUT,
    NavigationOptionId.DASHBOARD,
    NavigationOptionId.INTERACTIONS,
    NavigationOptionId.CREATIONS
  ],
  [NavigationContext.CREATE_NODE]: [
    NavigationOptionId.EXPLORE,
    NavigationOptionId.DASHBOARD,
    NavigationOptionId.NETWORK,
    NavigationOptionId.LOGOUT,
    NavigationOptionId.EDIT_PROFILE,
    NavigationOptionId.INTERACTIONS,
    NavigationOptionId.CREATIONS
  ],
  [NavigationContext.EXPLORE]: [],
  [NavigationContext.WORD]: [
    NavigationOptionId.EXPLORE,
    NavigationOptionId.DASHBOARD,
    NavigationOptionId.LOGOUT,
    NavigationOptionId.CREATE_NODE,
    NavigationOptionId.ALTERNATIVE_DEFINITIONS,
    NavigationOptionId.CREATE_ALTERNATIVE,
    NavigationOptionId.DISCUSS
  ]
};
function getNavigationOptions(context) {
  const config = navigationConfigs[context];
  if (!config) {
    console.warn(`No navigation configuration found for context: ${context}`);
    return [];
  }
  return config.map((optionId) => ({
    id: optionId,
    label: optionId.replace("-", " "),
    icon: navigationIcons[optionId]
  }));
}
const css$2 = {
  code: "text.svelte-iygazu{text-anchor:middle;font-family:'Orbitron', sans-serif}.title.svelte-iygazu{fill:rgba(255, 255, 255, 0.7)}.definition-text.svelte-iygazu{fill:white}.context-text.svelte-iygazu{font-size:14px;fill:rgba(255, 255, 255, 0.9)}.stats-label.svelte-iygazu{font-size:14px;fill:white}.stats-text.svelte-iygazu{font-size:14px;fill:rgba(255, 255, 255, 0.7)}.stats-value.svelte-iygazu{font-size:14px;fill:white}.creator-label.svelte-iygazu{font-size:10px;fill:rgba(255, 255, 255, 0.5)}.left-align.svelte-iygazu{text-anchor:start}.button-wrapper{padding-top:4px;height:100%}.vote-button{width:100%;padding:8px 12px;border-radius:4px;font-family:'Orbitron', sans-serif;font-size:0.9rem;cursor:pointer;transition:all 0.2s ease;display:flex;align-items:center;justify-content:center;min-width:100px;box-sizing:border-box;margin:0;color:white;background:rgba(255, 255, 255, 0.05);border:1px solid rgba(255, 255, 255, 0.1);white-space:nowrap}.vote-button.agree{background:rgba(46, 204, 113, 0.1);border:1px solid rgba(46, 204, 113, 0.2)}.vote-button.disagree{background:rgba(231, 76, 60, 0.1);border:1px solid rgba(231, 76, 60, 0.2)}.vote-button.no-vote{background:rgba(255, 255, 255, 0.05);border:1px solid rgba(255, 255, 255, 0.1)}.vote-button:hover:not(:disabled){transform:translateY(-1px)}.vote-button.agree:hover:not(:disabled){background:rgba(46, 204, 113, 0.2);border:1px solid rgba(46, 204, 113, 0.3)}.vote-button.disagree:hover:not(:disabled){background:rgba(231, 76, 60, 0.2);border:1px solid rgba(231, 76, 60, 0.3)}.vote-button.no-vote:hover:not(:disabled){background:rgba(255, 255, 255, 0.1);border:1px solid rgba(255, 255, 255, 0.2)}.vote-button:active:not(:disabled){transform:translateY(0)}.vote-button.active{background:rgba(255, 255, 255, 0.15);border-color:rgba(255, 255, 255, 0.3)}.vote-button.agree.active{background:rgba(46, 204, 113, 0.3);border-color:rgba(46, 204, 113, 0.4)}.vote-button.disagree.active{background:rgba(231, 76, 60, 0.3);border-color:rgba(231, 76, 60, 0.4)}.vote-button:disabled{opacity:0.5;cursor:not-allowed}.definition-line{color:white;font-family:'Orbitron', sans-serif;font-size:14px;line-height:1.4;text-align:left;padding-right:20px}.word-text{font-weight:500;margin-right:8px}.definition-text{opacity:0.9}",
  map: `{"version":3,"file":"DefinitionDetail.svelte","sources":["DefinitionDetail.svelte"],"sourcesContent":["<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/definition/DefinitionDetail.svelte -->\\n<script lang=\\"ts\\">import { onMount, createEventDispatcher } from \\"svelte\\";\\nimport { NODE_CONSTANTS } from \\"../base/BaseNodeConstants\\";\\nimport BaseDetailNode from \\"../base/BaseDetailNode.svelte\\";\\nimport ExpandCollapseButton from \\"../common/ExpandCollapseButton.svelte\\";\\nimport { getDisplayName } from \\"../utils/nodeUtils\\";\\nimport { userStore } from \\"$lib/stores/userStore\\";\\nimport { fetchWithAuth } from \\"$lib/services/api\\";\\nexport let data;\\nexport let word;\\nexport let type;\\nexport let style;\\nconst METRICS_SPACING = {\\n  labelX: -200,\\n  equalsX: 0,\\n  valueX: 30\\n};\\nconst MAX_RETRIES = 3;\\nconst RETRY_DELAY = 1e3;\\nlet userVoteStatus = \\"none\\";\\nlet isVoting = false;\\nlet userName;\\nlet netVotes;\\nlet definitionStatus;\\nconst dispatch = createEventDispatcher();\\nfunction handleCollapse() {\\n  dispatch(\\"modeChange\\", { mode: \\"preview\\" });\\n}\\nfunction getNeo4jNumber(value) {\\n  if (value && typeof value === \\"object\\" && \\"low\\" in value) {\\n    return Number(value.low);\\n  }\\n  return Number(value || 0);\\n}\\nasync function initializeVoteStatus(retryCount = 0) {\\n  if (!$userStore) return;\\n  try {\\n    console.log(\\"[DefinitionDetail] Fetching vote status for definition:\\", data.id);\\n    const response = await fetchWithAuth(\`/definitions/\${data.id}/vote\`);\\n    if (!response) {\\n      throw new Error(\\"No response from vote status endpoint\\");\\n    }\\n    console.log(\\"[DefinitionDetail] Vote status response:\\", response);\\n    userVoteStatus = response.status || \\"none\\";\\n    data.positiveVotes = getNeo4jNumber(response.positiveVotes);\\n    data.negativeVotes = getNeo4jNumber(response.negativeVotes);\\n    console.log(\\"[DefinitionDetail] Updated vote status:\\", {\\n      userVoteStatus,\\n      positiveVotes: data.positiveVotes,\\n      negativeVotes: data.negativeVotes\\n    });\\n  } catch (error) {\\n    console.error(\\"[DefinitionDetail] Error fetching vote status:\\", error);\\n    if (retryCount < MAX_RETRIES) {\\n      console.log(\`[DefinitionDetail] Retrying vote status fetch (attempt \${retryCount + 1}/\${MAX_RETRIES})\`);\\n      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));\\n      await initializeVoteStatus(retryCount + 1);\\n    }\\n  }\\n}\\nasync function handleVote(voteType) {\\n  if (!$userStore || isVoting) return;\\n  isVoting = true;\\n  const oldVoteStatus = userVoteStatus;\\n  try {\\n    console.log(\\"[DefinitionDetail] Processing vote:\\", {\\n      definitionId: data.id,\\n      voteType,\\n      currentStatus: userVoteStatus\\n    });\\n    userVoteStatus = voteType;\\n    if (voteType === \\"none\\") {\\n      const result = await fetchWithAuth(\\n        \`/definitions/\${data.id}/vote/remove\`,\\n        { method: \\"POST\\" }\\n      );\\n      data.positiveVotes = getNeo4jNumber(result.positiveVotes);\\n      data.negativeVotes = getNeo4jNumber(result.negativeVotes);\\n      console.log(\\"[DefinitionDetail] Vote removed:\\", result);\\n    } else {\\n      const result = await fetchWithAuth(\\n        \`/definitions/\${data.id}/vote\`,\\n        {\\n          method: \\"POST\\",\\n          body: JSON.stringify({\\n            isPositive: voteType === \\"agree\\"\\n          })\\n        }\\n      );\\n      data.positiveVotes = getNeo4jNumber(result.positiveVotes);\\n      data.negativeVotes = getNeo4jNumber(result.negativeVotes);\\n      console.log(\\"[DefinitionDetail] Vote recorded:\\", result);\\n    }\\n  } catch (error) {\\n    console.error(\\"[DefinitionDetail] Error processing vote:\\", error);\\n    userVoteStatus = oldVoteStatus;\\n    await initializeVoteStatus();\\n  } finally {\\n    isVoting = false;\\n  }\\n}\\nonMount(async () => {\\n  console.log(\\"[DefinitionDetail] Mounting with definition:\\", data);\\n  data.positiveVotes = getNeo4jNumber(data.positiveVotes);\\n  data.negativeVotes = getNeo4jNumber(data.negativeVotes);\\n  await initializeVoteStatus();\\n});\\n$: userName = $userStore?.preferred_username || $userStore?.name || \\"Anonymous\\";\\n$: netVotes = (data.positiveVotes || 0) - (data.negativeVotes || 0);\\n$: definitionStatus = netVotes > 0 ? \\"agreed\\" : netVotes < 0 ? \\"disagreed\\" : \\"undecided\\";\\n$: {\\n  console.log(\\"[DefinitionDetail] Vote state updated:\\", {\\n    userVoteStatus,\\n    netVotes,\\n    definitionStatus,\\n    positiveVotes: data.positiveVotes,\\n    negativeVotes: data.negativeVotes\\n  });\\n}\\n<\/script>\\n\\n<BaseDetailNode {style}>\\n    <svelte:fragment slot=\\"default\\" let:radius>\\n        <!-- Title -->\\n        <text\\n            y={-radius + 40}\\n            class=\\"title\\"\\n            style:font-family={NODE_CONSTANTS.FONTS.title.family}\\n            style:font-size={NODE_CONSTANTS.FONTS.title.size}\\n            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}\\n        >\\n            {type === 'live' ? 'Live Definition' : 'Alternative Definition'}\\n        </text>\\n\\n        <!-- Definition Display -->\\n        <g class=\\"definition-display\\" transform=\\"translate(0, {-radius/2 - 40})\\">\\n            <foreignObject \\n                x={METRICS_SPACING.labelX}\\n                width={Math.abs(METRICS_SPACING.labelX) * 2}\\n                height=\\"100\\"\\n            >\\n                <div class=\\"definition-line\\">\\n                    <span class=\\"word-text\\">{word}:</span>\\n                    <span class=\\"definition-text\\">{data.text}</span>\\n                </div>\\n            </foreignObject>\\n        </g>\\n\\n        <!-- User Context -->\\n        <g transform=\\"translate(0, -100)\\">\\n            <text \\n                x={METRICS_SPACING.labelX} \\n                class=\\"context-text left-align\\"\\n            >\\n                Please vote on whether you agree with this definition \\n            </text>\\n            <text \\n                x={METRICS_SPACING.labelX} \\n                y=\\"25\\" \\n                class=\\"context-text left-align\\"\\n            >\\n                for this word within the context of ProjectZer0.\\n            </text>\\n            <text \\n                x={METRICS_SPACING.labelX} \\n                y=\\"60\\" \\n                class=\\"context-text left-align\\"\\n            >\\n                You can always change your vote using the buttons below.\\n            </text>\\n        </g>\\n\\n        <!-- Vote Buttons -->\\n        <g transform=\\"translate(0, -10)\\">\\n            <foreignObject x={-160} width=\\"100\\" height=\\"45\\">\\n                <div class=\\"button-wrapper\\">\\n                    <button \\n                        class=\\"vote-button agree\\"\\n                        class:active={userVoteStatus === 'agree'}\\n                        on:click={() => handleVote('agree')}\\n                        disabled={isVoting}\\n                    >\\n                        Agree\\n                    </button>\\n                </div>\\n            </foreignObject>\\n\\n            <foreignObject x={-50} width=\\"100\\" height=\\"45\\">\\n                <div class=\\"button-wrapper\\">\\n                    <button \\n                        class=\\"vote-button no-vote\\"\\n                        class:active={userVoteStatus === 'none'}\\n                        on:click={() => handleVote('none')}\\n                        disabled={isVoting}\\n                    >\\n                        No Vote\\n                    </button>\\n                </div>\\n            </foreignObject>\\n\\n            <foreignObject x={60} width=\\"100\\" height=\\"45\\">\\n                <div class=\\"button-wrapper\\">\\n                    <button \\n                        class=\\"vote-button disagree\\"\\n                        class:active={userVoteStatus === 'disagree'}\\n                        on:click={() => handleVote('disagree')}\\n                        disabled={isVoting}\\n                    >\\n                        Disagree\\n                    </button>\\n                </div>\\n            </foreignObject>\\n        </g>\\n\\n        <!-- Vote Stats -->\\n<g transform=\\"translate(0, 60)\\">\\n    <text x={METRICS_SPACING.labelX} class=\\"stats-label left-align\\">\\n        Vote Data:\\n    </text>\\n    \\n    <!-- User's current vote -->\\n    <g transform=\\"translate(0, 30)\\">\\n        <text x={METRICS_SPACING.labelX} class=\\"stats-text left-align\\">\\n            {userName}\\n        </text>\\n        <text x={METRICS_SPACING.equalsX} class=\\"stats-text\\">\\n            =\\n        </text>\\n        <text x={METRICS_SPACING.valueX} class=\\"stats-value left-align\\">\\n            {userVoteStatus}\\n        </text>\\n    </g>\\n\\n    <!-- Total agree votes -->\\n    <g transform=\\"translate(0, 55)\\">\\n        <text x={METRICS_SPACING.labelX} class=\\"stats-text left-align\\">\\n            Total Agree\\n        </text>\\n        <text x={METRICS_SPACING.equalsX} class=\\"stats-text\\">\\n            =\\n        </text>\\n        <text x={METRICS_SPACING.valueX} class=\\"stats-value left-align\\">\\n            {data.positiveVotes || 0}\\n        </text>\\n    </g>\\n\\n    <!-- Total disagree votes -->\\n    <g transform=\\"translate(0, 80)\\">\\n        <text x={METRICS_SPACING.labelX} class=\\"stats-text left-align\\">\\n            Total Disagree\\n        </text>\\n        <text x={METRICS_SPACING.equalsX} class=\\"stats-text\\">\\n            =\\n        </text>\\n        <text x={METRICS_SPACING.valueX} class=\\"stats-value left-align\\">\\n            {data.negativeVotes || 0}\\n        </text>\\n    </g>\\n\\n    <!-- Net votes -->\\n    <g transform=\\"translate(0, 105)\\">\\n        <text x={METRICS_SPACING.labelX} class=\\"stats-text left-align\\">\\n            Net \\n        </text>\\n        <text x={METRICS_SPACING.equalsX} class=\\"stats-text\\">\\n            =\\n        </text>\\n        <text x={METRICS_SPACING.valueX} class=\\"stats-value left-align\\">\\n            {netVotes}\\n        </text>\\n    </g>\\n\\n    <!-- Definition status -->\\n    <g transform=\\"translate(0, 130)\\">\\n        <text x={METRICS_SPACING.labelX} class=\\"stats-text left-align\\">\\n            Definition Status\\n        </text>\\n        <text x={METRICS_SPACING.equalsX} class=\\"stats-text\\">\\n            =\\n        </text>\\n        <text x={METRICS_SPACING.valueX} class=\\"stats-value left-align\\">\\n            {definitionStatus}\\n        </text>\\n    </g>\\n</g>\\n        \\n        <!-- Creator credits -->\\n        <g transform=\\"translate(0, {radius - 55})\\">\\n            <text class=\\"creator-label\\">\\n                defined by: {getDisplayName(data.createdBy, null, false)}\\n            </text>\\n        </g>\\n\\n        <!-- Collapse button -->\\n        <ExpandCollapseButton \\n            mode=\\"collapse\\"\\n            y={radius}\\n            on:click={handleCollapse}\\n        />\\n    </svelte:fragment>\\n</BaseDetailNode>\\n\\n<style>\\n    text {\\n        text-anchor: middle;\\n        font-family: 'Orbitron', sans-serif;\\n    }\\n\\n    .title {\\n        fill: rgba(255, 255, 255, 0.7);\\n    }\\n\\n    .definition-text {\\n        fill: white;\\n    }\\n\\n    .context-text {\\n        font-size: 14px;\\n        fill: rgba(255, 255, 255, 0.9);\\n    }\\n\\n    .stats-label {\\n        font-size: 14px;\\n        fill: white;\\n    }\\n\\n    .stats-text {\\n        font-size: 14px;\\n        fill: rgba(255, 255, 255, 0.7);\\n    }\\n\\n    .stats-value {\\n        font-size: 14px;\\n        fill: white;\\n    }\\n\\n    .creator-label {\\n        font-size: 10px;\\n        fill: rgba(255, 255, 255, 0.5);\\n    }\\n\\n    .left-align {\\n        text-anchor: start;\\n    }\\n\\n    :global(.button-wrapper) {\\n        padding-top: 4px;\\n        height: 100%;\\n    }\\n\\n    :global(.vote-button) {\\n        width: 100%;\\n        padding: 8px 12px;\\n        border-radius: 4px;\\n        font-family: 'Orbitron', sans-serif;\\n        font-size: 0.9rem;\\n        cursor: pointer;\\n        transition: all 0.2s ease;\\n        display: flex;\\n        align-items: center;\\n        justify-content: center;\\n        min-width: 100px;\\n        box-sizing: border-box;\\n        margin: 0;\\n        color: white;\\n        background: rgba(255, 255, 255, 0.05);\\n        border: 1px solid rgba(255, 255, 255, 0.1);\\n        white-space: nowrap;\\n    }\\n\\n    :global(.vote-button.agree) {\\n        background: rgba(46, 204, 113, 0.1);\\n        border: 1px solid rgba(46, 204, 113, 0.2);\\n    }\\n\\n    :global(.vote-button.disagree) {\\n        background: rgba(231, 76, 60, 0.1);\\n        border: 1px solid rgba(231, 76, 60, 0.2);\\n    }\\n\\n    :global(.vote-button.no-vote) {\\n        background: rgba(255, 255, 255, 0.05);\\n        border: 1px solid rgba(255, 255, 255, 0.1);\\n    }\\n\\n    :global(.vote-button:hover:not(:disabled)) {\\n        transform: translateY(-1px);\\n    }\\n\\n    :global(.vote-button.agree:hover:not(:disabled)) {\\n        background: rgba(46, 204, 113, 0.2);\\n        border: 1px solid rgba(46, 204, 113, 0.3);\\n    }\\n\\n    :global(.vote-button.disagree:hover:not(:disabled)) {\\n        background: rgba(231, 76, 60, 0.2);\\n        border: 1px solid rgba(231, 76, 60, 0.3);\\n    }\\n\\n    :global(.vote-button.no-vote:hover:not(:disabled)) {\\n        background: rgba(255, 255, 255, 0.1);\\n        border: 1px solid rgba(255, 255, 255, 0.2);\\n    }\\n\\n    :global(.vote-button:active:not(:disabled)) {\\n        transform: translateY(0);\\n    }\\n\\n    :global(.vote-button.active) {\\n        background: rgba(255, 255, 255, 0.15);\\n        border-color: rgba(255, 255, 255, 0.3);\\n    }\\n\\n    :global(.vote-button.agree.active) {\\n        background: rgba(46, 204, 113, 0.3);\\n        border-color: rgba(46, 204, 113, 0.4);\\n    }\\n\\n    :global(.vote-button.disagree.active) {\\n        background: rgba(231, 76, 60, 0.3);\\n        border-color: rgba(231, 76, 60, 0.4);\\n    }\\n\\n    :global(.vote-button:disabled) {\\n        opacity: 0.5;\\n        cursor: not-allowed;\\n    }\\n\\n    :global(.definition-line) {\\n        color: white;\\n        font-family: 'Orbitron', sans-serif;\\n        font-size: 14px;\\n        line-height: 1.4;\\n        text-align: left;\\n        padding-right: 20px;\\n    }\\n\\n    :global(.word-text) {\\n        font-weight: 500;\\n        margin-right: 8px;\\n    }\\n\\n    :global(.definition-text) {\\n        opacity: 0.9;\\n    }\\n</style>"],"names":[],"mappings":"AA+SI,kBAAK,CACD,WAAW,CAAE,MAAM,CACnB,WAAW,CAAE,UAAU,CAAC,CAAC,UAC7B,CAEA,oBAAO,CACH,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC,CAEA,8BAAiB,CACb,IAAI,CAAE,KACV,CAEA,2BAAc,CACV,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC,CAEA,0BAAa,CACT,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KACV,CAEA,yBAAY,CACR,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC,CAEA,0BAAa,CACT,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KACV,CAEA,4BAAe,CACX,SAAS,CAAE,IAAI,CACf,IAAI,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACjC,CAEA,yBAAY,CACR,WAAW,CAAE,KACjB,CAEQ,eAAiB,CACrB,WAAW,CAAE,GAAG,CAChB,MAAM,CAAE,IACZ,CAEQ,YAAc,CAClB,KAAK,CAAE,IAAI,CACX,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,aAAa,CAAE,GAAG,CAClB,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,SAAS,CAAE,MAAM,CACjB,MAAM,CAAE,OAAO,CACf,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,IAAI,CACzB,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,eAAe,CAAE,MAAM,CACvB,SAAS,CAAE,KAAK,CAChB,UAAU,CAAE,UAAU,CACtB,MAAM,CAAE,CAAC,CACT,KAAK,CAAE,KAAK,CACZ,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,IAAI,CAAC,CACrC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,WAAW,CAAE,MACjB,CAEQ,kBAAoB,CACxB,UAAU,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACnC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC5C,CAEQ,qBAAuB,CAC3B,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CAAC,CAClC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CAC3C,CAEQ,oBAAsB,CAC1B,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,IAAI,CAAC,CACrC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC7C,CAEQ,iCAAmC,CACvC,SAAS,CAAE,WAAW,IAAI,CAC9B,CAEQ,uCAAyC,CAC7C,UAAU,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACnC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC5C,CAEQ,0CAA4C,CAChD,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CAAC,CAClC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CAC3C,CAEQ,yCAA2C,CAC/C,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACpC,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAC7C,CAEQ,kCAAoC,CACxC,SAAS,CAAE,WAAW,CAAC,CAC3B,CAEQ,mBAAqB,CACzB,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,IAAI,CAAC,CACrC,YAAY,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACzC,CAEQ,yBAA2B,CAC/B,UAAU,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACnC,YAAY,CAAE,KAAK,EAAE,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CACxC,CAEQ,4BAA8B,CAClC,UAAU,CAAE,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CAAC,CAClC,YAAY,CAAE,KAAK,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,GAAG,CACvC,CAEQ,qBAAuB,CAC3B,OAAO,CAAE,GAAG,CACZ,MAAM,CAAE,WACZ,CAEQ,gBAAkB,CACtB,KAAK,CAAE,KAAK,CACZ,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,GAAG,CAChB,UAAU,CAAE,IAAI,CAChB,aAAa,CAAE,IACnB,CAEQ,UAAY,CAChB,WAAW,CAAE,GAAG,CAChB,YAAY,CAAE,GAClB,CAEQ,gBAAkB,CACtB,OAAO,CAAE,GACb"}`
};
const DefinitionDetail = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $userStore, $$unsubscribe_userStore;
  $$unsubscribe_userStore = subscribe(userStore, (value) => $userStore = value);
  let { data } = $$props;
  let { word } = $$props;
  let { type } = $$props;
  let { style } = $$props;
  const METRICS_SPACING = { labelX: -200, equalsX: 0, valueX: 30 };
  let userVoteStatus = "none";
  let userName;
  let netVotes;
  let definitionStatus;
  createEventDispatcher();
  if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
  if ($$props.word === void 0 && $$bindings.word && word !== void 0) $$bindings.word(word);
  if ($$props.type === void 0 && $$bindings.type && type !== void 0) $$bindings.type(type);
  if ($$props.style === void 0 && $$bindings.style && style !== void 0) $$bindings.style(style);
  $$result.css.add(css$2);
  userName = $userStore?.preferred_username || $userStore?.name || "Anonymous";
  netVotes = (data.positiveVotes || 0) - (data.negativeVotes || 0);
  definitionStatus = netVotes > 0 ? "agreed" : netVotes < 0 ? "disagreed" : "undecided";
  {
    {
      console.log("[DefinitionDetail] Vote state updated:", {
        userVoteStatus,
        netVotes,
        definitionStatus,
        positiveVotes: data.positiveVotes,
        negativeVotes: data.negativeVotes
      });
    }
  }
  $$unsubscribe_userStore();
  return `  ${validate_component(BaseDetailNode, "BaseDetailNode").$$render($$result, { style }, {}, {
    default: ({ radius }) => {
      return ` <text${add_attribute("y", -radius + 40, 0)} class="title svelte-iygazu"${add_styles({
        "font-family": NODE_CONSTANTS.FONTS.title.family,
        "font-size": NODE_CONSTANTS.FONTS.title.size,
        "font-weight": NODE_CONSTANTS.FONTS.title.weight
      })}>${escape(type === "live" ? "Live Definition" : "Alternative Definition")}</text>  <g class="definition-display" transform="${"translate(0, " + escape(-radius / 2 - 40, true) + ")"}"><foreignObject${add_attribute("x", METRICS_SPACING.labelX, 0)}${add_attribute("width", Math.abs(METRICS_SPACING.labelX) * 2, 0)} height="100"><div class="definition-line"><span class="word-text">${escape(word)}:</span> <span class="definition-text svelte-iygazu">${escape(data.text)}</span></div></foreignObject></g>  <g transform="translate(0, -100)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="context-text left-align svelte-iygazu">Please vote on whether you agree with this definition 
            </text><text${add_attribute("x", METRICS_SPACING.labelX, 0)} y="25" class="context-text left-align svelte-iygazu">for this word within the context of ProjectZer0.
            </text><text${add_attribute("x", METRICS_SPACING.labelX, 0)} y="60" class="context-text left-align svelte-iygazu">You can always change your vote using the buttons below.</text></g>  <g transform="translate(0, -10)"><foreignObject${add_attribute("x", -160, 0)} width="100" height="45"><div class="button-wrapper"><button class="${["vote-button agree", ""].join(" ").trim()}" ${""}>Agree</button></div></foreignObject><foreignObject${add_attribute("x", -50, 0)} width="100" height="45"><div class="button-wrapper"><button class="${["vote-button no-vote", "active"].join(" ").trim()}" ${""}>No Vote</button></div></foreignObject><foreignObject${add_attribute("x", 60, 0)} width="100" height="45"><div class="button-wrapper"><button class="${["vote-button disagree", ""].join(" ").trim()}" ${""}>Disagree</button></div></foreignObject></g>  <g transform="translate(0, 60)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-label left-align svelte-iygazu">Vote Data:
    </text><g transform="translate(0, 30)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-text left-align svelte-iygazu">${escape(userName)}</text><text${add_attribute("x", METRICS_SPACING.equalsX, 0)} class="stats-text svelte-iygazu">=
        </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="stats-value left-align svelte-iygazu">${escape(userVoteStatus)}</text></g><g transform="translate(0, 55)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-text left-align svelte-iygazu">Total Agree
        </text><text${add_attribute("x", METRICS_SPACING.equalsX, 0)} class="stats-text svelte-iygazu">=
        </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="stats-value left-align svelte-iygazu">${escape(data.positiveVotes || 0)}</text></g><g transform="translate(0, 80)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-text left-align svelte-iygazu">Total Disagree
        </text><text${add_attribute("x", METRICS_SPACING.equalsX, 0)} class="stats-text svelte-iygazu">=
        </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="stats-value left-align svelte-iygazu">${escape(data.negativeVotes || 0)}</text></g><g transform="translate(0, 105)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-text left-align svelte-iygazu">Net 
        </text><text${add_attribute("x", METRICS_SPACING.equalsX, 0)} class="stats-text svelte-iygazu">=
        </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="stats-value left-align svelte-iygazu">${escape(netVotes)}</text></g><g transform="translate(0, 130)"><text${add_attribute("x", METRICS_SPACING.labelX, 0)} class="stats-text left-align svelte-iygazu">Definition Status
        </text><text${add_attribute("x", METRICS_SPACING.equalsX, 0)} class="stats-text svelte-iygazu">=
        </text><text${add_attribute("x", METRICS_SPACING.valueX, 0)} class="stats-value left-align svelte-iygazu">${escape(definitionStatus)}</text></g></g>  <g transform="${"translate(0, " + escape(radius - 55, true) + ")"}"><text class="creator-label svelte-iygazu">defined by: ${escape(getDisplayName(data.createdBy, null, false))}</text></g>  ${validate_component(ExpandCollapseButton, "ExpandCollapseButton").$$render($$result, { mode: "collapse", y: radius }, {}, {})}`;
    }
  })}`;
});
const navigationColors = {
  explore: COLORS.PRIMARY.BLUE,
  "create-node": COLORS.PRIMARY.YELLOW,
  network: COLORS.PRIMARY.PURPLE,
  creations: COLORS.PRIMARY.GREEN,
  interactions: COLORS.PRIMARY.TURQUOISE,
  "edit-profile": COLORS.PRIMARY.ORANGE,
  logout: COLORS.PRIMARY.RED,
  dashboard: COLORS.PRIMARY.BLUE,
  // Matching explore blue
  "alternative-definitions": COLORS.PRIMARY.PURPLE,
  // Changed from FOREST to PURPLE
  "create-alternative": COLORS.PRIMARY.PURPLE,
  // Same as alternative-definitions
  "discuss": COLORS.PRIMARY.TURQUOISE
  // Using TURQUOISE for discussion
};
function getNavigationColor(nodeId) {
  return navigationColors[nodeId] || navigationColors.explore;
}
const css$1 = {
  code: ".navigation-node.svelte-xtjlke.svelte-xtjlke{cursor:pointer}.icon-container.svelte-xtjlke.svelte-xtjlke{overflow:visible;transition:transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)}.navigation-node.svelte-xtjlke:hover .icon-container.svelte-xtjlke{transform:scale(1.1)}.icon-wrapper.svelte-xtjlke.svelte-xtjlke{width:100%;height:100%;display:flex;align-items:center;justify-content:center}.navigation-node .material-symbols-outlined{font-size:24px;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1)}.navigation-node.svelte-xtjlke:hover .material-symbols-outlined{font-size:32px}.label.svelte-xtjlke.svelte-xtjlke{font-family:'Orbitron', sans-serif;font-size:14px;text-anchor:middle;dominant-baseline:middle;pointer-events:none;opacity:0;animation:svelte-xtjlke-fadeIn 0.2s ease-out forwards}.connection-line.svelte-xtjlke.svelte-xtjlke{pointer-events:none;vector-effect:non-scaling-stroke;opacity:0;animation:svelte-xtjlke-fadeIn 0.2s ease-out forwards;stroke-dasharray:2;animation:svelte-xtjlke-fadeIn 0.2s ease-out forwards, svelte-xtjlke-dash 20s linear infinite}.glow.svelte-xtjlke.svelte-xtjlke{pointer-events:none;opacity:0;animation:svelte-xtjlke-fadeIn 0.2s ease-out forwards, svelte-xtjlke-pulse 2s ease-in-out infinite}@keyframes svelte-xtjlke-fadeIn{from{opacity:0}to{opacity:1}}@keyframes svelte-xtjlke-pulse{0%{transform:scale(1);opacity:0.8}50%{transform:scale(1.1);opacity:0.6}100%{transform:scale(1);opacity:0.8}}@keyframes svelte-xtjlke-dash{to{stroke-dashoffset:-1000}}.navigation-node *{vector-effect:non-scaling-stroke}",
  map: '{"version":3,"file":"NavigationNode.svelte","sources":["NavigationNode.svelte"],"sourcesContent":["<!-- src/lib/components/graph/nodes/navigation/NavigationNode.svelte -->\\n<!-- svelte-ignore a11y-click-events-have-key-events -->\\n<!-- svelte-ignore a11y-no-static-element-interactions -->\\n<script lang=\\"ts\\">import { createEventDispatcher } from \\"svelte\\";\\nimport { handleNavigation } from \\"$lib/services/navigation\\";\\nimport { getNavigationColor } from \\"./navigationColors\\";\\nconst dispatch = createEventDispatcher();\\nexport let option;\\nexport let transform;\\nexport let isHovered = false;\\nconst color = getNavigationColor(option.id);\\nconst filterId = `nav-glow-${Math.random().toString(36).slice(2)}`;\\nlet transformValues = [];\\nlet translateX = 0;\\nlet translateY = 0;\\n$: {\\n  const matches = transform.match(/translate\\\\(([-\\\\d.e+-]+),\\\\s*([-\\\\d.e+-]+)\\\\)/);\\n  if (matches) {\\n    transformValues = [parseFloat(matches[1]), parseFloat(matches[2])];\\n    [translateX, translateY] = transformValues;\\n  } else {\\n    transformValues = [0, 0];\\n    [translateX, translateY] = transformValues;\\n  }\\n}\\nfunction handleClick() {\\n  handleNavigation(option.id);\\n}\\nfunction handleMouseEnter() {\\n  dispatch(\\"hover\\", { isHovered: true });\\n  isHovered = true;\\n}\\nfunction handleMouseLeave() {\\n  dispatch(\\"hover\\", { isHovered: false });\\n  isHovered = false;\\n}\\n<\/script>\\n\\n<g \\n    class=\\"navigation-node\\"\\n    {transform}\\n    on:mouseenter={handleMouseEnter}\\n    on:mouseleave={handleMouseLeave}\\n    on:click={handleClick}\\n>\\n    <defs>\\n        <filter id={filterId} x=\\"-100%\\" y=\\"-100%\\" width=\\"300%\\" height=\\"300%\\">\\n            <!-- Strong outer glow -->\\n            <feGaussianBlur in=\\"SourceAlpha\\" stdDeviation=\\"18\\" result=\\"blur1\\"/>\\n            <feFlood flood-color={color} flood-opacity=\\"0.6\\" result=\\"color1\\"/>\\n            <feComposite in=\\"color1\\" in2=\\"blur1\\" operator=\\"in\\" result=\\"shadow1\\"/>\\n \\n            <!-- Medium glow -->\\n            <feGaussianBlur in=\\"SourceAlpha\\" stdDeviation=\\"10\\" result=\\"blur2\\"/>\\n            <feFlood flood-color={color} flood-opacity=\\"0.8\\" result=\\"color2\\"/>\\n            <feComposite in=\\"color2\\" in2=\\"blur2\\" operator=\\"in\\" result=\\"shadow2\\"/>\\n \\n            <!-- Sharp inner glow -->\\n            <feGaussianBlur in=\\"SourceAlpha\\" stdDeviation=\\"6\\" result=\\"blur3\\"/>\\n            <feFlood flood-color={color} flood-opacity=\\"1\\" result=\\"color3\\"/>\\n            <feComposite in=\\"color3\\" in2=\\"blur3\\" operator=\\"in\\" result=\\"shadow3\\"/>\\n \\n            <feMerge>\\n                <feMergeNode in=\\"shadow1\\"/>\\n                <feMergeNode in=\\"shadow2\\"/>\\n                <feMergeNode in=\\"shadow3\\"/>\\n                <feMergeNode in=\\"SourceGraphic\\"/>\\n            </feMerge>\\n        </filter>\\n    </defs>\\n\\n    {#if isHovered}\\n        <!-- Connection line to center -->\\n        <line \\n            class=\\"connection-line\\"\\n            x1=\\"0\\"\\n            y1=\\"0\\"\\n            x2={-translateX * 0.55}\\n            y2={-translateY * 0.55}\\n            stroke={`${color}50`}\\n            stroke-width=\\"1.5\\"\\n        />\\n    {/if}\\n\\n    <!-- Icon Container -->\\n    <foreignObject \\n        x=\\"-16\\" \\n        y=\\"-16\\" \\n        width=\\"32\\" \\n        height=\\"32\\" \\n        class=\\"icon-container\\"\\n        style:filter={isHovered ? `url(#${filterId})` : \'none\'}\\n    >\\n        <div \\n            class=\\"icon-wrapper\\"\\n            {...{\\"xmlns\\": \\"http://www.w3.org/1999/xhtml\\"}}\\n        >\\n            <span \\n                class=\\"material-symbols-outlined\\"\\n                style:color={isHovered ? color : \'white\'}\\n            >\\n                {option.icon}\\n            </span>\\n        </div>\\n    </foreignObject>\\n\\n    <!-- Label -->\\n    {#if isHovered}\\n        <text\\n            class=\\"label\\"\\n            dy=\\"30\\"\\n            style:fill={color}\\n        >\\n            {option.label}\\n        </text>\\n    {/if}\\n</g>\\n\\n<style>\\n    .navigation-node {\\n        cursor: pointer;\\n    }\\n\\n    .icon-container {\\n        overflow: visible;\\n        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);\\n    }\\n\\n    .navigation-node:hover .icon-container {\\n        transform: scale(1.1);\\n    }\\n\\n    .icon-wrapper {\\n        width: 100%;\\n        height: 100%;\\n        display: flex;\\n        align-items: center;\\n        justify-content: center;\\n    }\\n\\n    :global(.navigation-node .material-symbols-outlined) {\\n        font-size: 24px;\\n        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\\n    }\\n\\n    .navigation-node:hover :global(.material-symbols-outlined) {\\n        font-size: 32px;\\n    }\\n\\n    .label {\\n        font-family: \'Orbitron\', sans-serif;\\n        font-size: 14px;\\n        text-anchor: middle;\\n        dominant-baseline: middle;\\n        pointer-events: none;\\n        opacity: 0;\\n        animation: fadeIn 0.2s ease-out forwards;\\n    }\\n\\n    .connection-line {\\n        pointer-events: none;\\n        vector-effect: non-scaling-stroke;\\n        opacity: 0;\\n        animation: fadeIn 0.2s ease-out forwards;\\n        stroke-dasharray: 2;\\n        animation: fadeIn 0.2s ease-out forwards, dash 20s linear infinite;\\n    }\\n\\n    .glow {\\n        pointer-events: none;\\n        opacity: 0;\\n        animation: fadeIn 0.2s ease-out forwards, pulse 2s ease-in-out infinite;\\n    }\\n\\n    @keyframes fadeIn {\\n        from {\\n            opacity: 0;\\n        }\\n        to {\\n            opacity: 1;\\n        }\\n    }\\n\\n    @keyframes pulse {\\n        0% {\\n            transform: scale(1);\\n            opacity: 0.8;\\n        }\\n        50% {\\n            transform: scale(1.1);\\n            opacity: 0.6;\\n        }\\n        100% {\\n            transform: scale(1);\\n            opacity: 0.8;\\n        }\\n    }\\n\\n    @keyframes dash {\\n        to {\\n            stroke-dashoffset: -1000;\\n        }\\n    }\\n\\n    :global(.navigation-node *) {\\n        vector-effect: non-scaling-stroke;\\n    }\\n</style>"],"names":[],"mappings":"AAuHI,4CAAiB,CACb,MAAM,CAAE,OACZ,CAEA,2CAAgB,CACZ,QAAQ,CAAE,OAAO,CACjB,UAAU,CAAE,SAAS,CAAC,IAAI,CAAC,aAAa,GAAG,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAAC,CAAC,CAC1D,CAEA,8BAAgB,MAAM,CAAC,6BAAgB,CACnC,SAAS,CAAE,MAAM,GAAG,CACxB,CAEA,yCAAc,CACV,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,eAAe,CAAE,MACrB,CAEQ,2CAA6C,CACjD,SAAS,CAAE,IAAI,CACf,UAAU,CAAE,GAAG,CAAC,IAAI,CAAC,aAAa,GAAG,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAAC,CAAC,CACpD,CAEA,8BAAgB,MAAM,CAAS,0BAA4B,CACvD,SAAS,CAAE,IACf,CAEA,kCAAO,CACH,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,MAAM,CACnB,iBAAiB,CAAE,MAAM,CACzB,cAAc,CAAE,IAAI,CACpB,OAAO,CAAE,CAAC,CACV,SAAS,CAAE,oBAAM,CAAC,IAAI,CAAC,QAAQ,CAAC,QACpC,CAEA,4CAAiB,CACb,cAAc,CAAE,IAAI,CACpB,aAAa,CAAE,kBAAkB,CACjC,OAAO,CAAE,CAAC,CACV,SAAS,CAAE,oBAAM,CAAC,IAAI,CAAC,QAAQ,CAAC,QAAQ,CACxC,gBAAgB,CAAE,CAAC,CACnB,SAAS,CAAE,oBAAM,CAAC,IAAI,CAAC,QAAQ,CAAC,QAAQ,CAAC,CAAC,kBAAI,CAAC,GAAG,CAAC,MAAM,CAAC,QAC9D,CAEA,iCAAM,CACF,cAAc,CAAE,IAAI,CACpB,OAAO,CAAE,CAAC,CACV,SAAS,CAAE,oBAAM,CAAC,IAAI,CAAC,QAAQ,CAAC,QAAQ,CAAC,CAAC,mBAAK,CAAC,EAAE,CAAC,WAAW,CAAC,QACnE,CAEA,WAAW,oBAAO,CACd,IAAK,CACD,OAAO,CAAE,CACb,CACA,EAAG,CACC,OAAO,CAAE,CACb,CACJ,CAEA,WAAW,mBAAM,CACb,EAAG,CACC,SAAS,CAAE,MAAM,CAAC,CAAC,CACnB,OAAO,CAAE,GACb,CACA,GAAI,CACA,SAAS,CAAE,MAAM,GAAG,CAAC,CACrB,OAAO,CAAE,GACb,CACA,IAAK,CACD,SAAS,CAAE,MAAM,CAAC,CAAC,CACnB,OAAO,CAAE,GACb,CACJ,CAEA,WAAW,kBAAK,CACZ,EAAG,CACC,iBAAiB,CAAE,KACvB,CACJ,CAEQ,kBAAoB,CACxB,aAAa,CAAE,kBACnB"}'
};
const NavigationNode = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  createEventDispatcher();
  let { option } = $$props;
  let { transform } = $$props;
  let { isHovered = false } = $$props;
  const color = getNavigationColor(option.id);
  const filterId = `nav-glow-${Math.random().toString(36).slice(2)}`;
  let transformValues = [];
  let translateX = 0;
  let translateY = 0;
  if ($$props.option === void 0 && $$bindings.option && option !== void 0) $$bindings.option(option);
  if ($$props.transform === void 0 && $$bindings.transform && transform !== void 0) $$bindings.transform(transform);
  if ($$props.isHovered === void 0 && $$bindings.isHovered && isHovered !== void 0) $$bindings.isHovered(isHovered);
  $$result.css.add(css$1);
  {
    {
      const matches = transform.match(/translate\(([-\d.e+-]+),\s*([-\d.e+-]+)\)/);
      if (matches) {
        transformValues = [parseFloat(matches[1]), parseFloat(matches[2])];
        [translateX, translateY] = transformValues;
      } else {
        transformValues = [0, 0];
        [translateX, translateY] = transformValues;
      }
    }
  }
  return `    <g class="navigation-node svelte-xtjlke"${add_attribute("transform", transform, 0)}><defs><filter${add_attribute("id", filterId, 0)} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur in="SourceAlpha" stdDeviation="18" result="blur1"></feGaussianBlur><feFlood${add_attribute("flood-color", color, 0)} flood-opacity="0.6" result="color1"></feFlood><feComposite in="color1" in2="blur1" operator="in" result="shadow1"></feComposite><feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur2"></feGaussianBlur><feFlood${add_attribute("flood-color", color, 0)} flood-opacity="0.8" result="color2"></feFlood><feComposite in="color2" in2="blur2" operator="in" result="shadow2"></feComposite><feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur3"></feGaussianBlur><feFlood${add_attribute("flood-color", color, 0)} flood-opacity="1" result="color3"></feFlood><feComposite in="color3" in2="blur3" operator="in" result="shadow3"></feComposite><feMerge><feMergeNode in="shadow1"></feMergeNode><feMergeNode in="shadow2"></feMergeNode><feMergeNode in="shadow3"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs>${isHovered ? ` <line class="connection-line svelte-xtjlke" x1="0" y1="0"${add_attribute("x2", -translateX * 0.55, 0)}${add_attribute("y2", -translateY * 0.55, 0)}${add_attribute("stroke", `${color}50`, 0)} stroke-width="1.5"></line>` : ``}<foreignObject x="-16" y="-16" width="32" height="32" class="icon-container svelte-xtjlke"${add_styles({
    "filter": isHovered ? `url(#${filterId})` : "none"
  })}><div${spread(
    [
      { class: "icon-wrapper" },
      escape_object({ "xmlns": "http://www.w3.org/1999/xhtml" })
    ],
    { classes: "svelte-xtjlke" }
  )}><span class="material-symbols-outlined"${add_styles({ "color": isHovered ? color : "white" })}>${escape(option.icon)}</span></div></foreignObject>${isHovered ? `<text class="label svelte-xtjlke" dy="30"${add_styles({ "fill": color })}>${escape(option.label)}</text>` : ``}</g>`;
});
const isDashboardNode = (node) => node.type === "dashboard";
const isEditProfileNode = (node) => node.type === "edit-profile";
const isCreateNodeNode = (node) => node.type === "create-node";
const isNavigationNode = (node) => node.type === "navigation";
const isWordNode = (node) => node.type === "word";
const isDefinitionNode = (node) => node.type === "definition";
const css = {
  code: "html, body{height:100%;margin:0;padding:0;overflow:hidden;background:black}.loading-container.svelte-1nfodeq{position:fixed;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:black;color:rgba(255, 255, 255, 0.8);gap:1rem}.loading-spinner.svelte-1nfodeq{width:580px;height:580px;border:3px solid rgba(255, 255, 255, 0.1);border-top-color:rgba(255, 255, 255, 0.8);border-radius:50%;animation:svelte-1nfodeq-spin 1s linear infinite}.loading-text.svelte-1nfodeq{font-family:'Orbitron', sans-serif;font-size:1.2rem}@keyframes svelte-1nfodeq-spin{to{transform:rotate(360deg)}}",
  map: `{"version":3,"file":"+page.svelte","sources":["+page.svelte"],"sourcesContent":["<!-- src/routes/graph/[view]/+page.svelte -->\\n<script lang=\\"ts\\">import { onMount } from \\"svelte\\";\\nimport { page } from \\"$app/stores\\";\\nimport * as auth0 from \\"$lib/services/auth0\\";\\nimport { getUserActivity } from \\"$lib/services/userActivity\\";\\nimport { getWordData } from \\"$lib/services/word\\";\\nimport { NODE_CONSTANTS } from \\"$lib/components/graph/nodes/base/BaseNodeConstants\\";\\nimport Graph from \\"$lib/components/graph/Graph.svelte\\";\\nimport DashboardNode from \\"$lib/components/graph/nodes/dashboard/DashboardNode.svelte\\";\\nimport EditProfileNode from \\"$lib/components/graph/nodes/editProfile/EditProfileNode.svelte\\";\\nimport CreateNodeNode from \\"$lib/components/graph/nodes/createNode/CreateNodeNode.svelte\\";\\nimport WordPreview from \\"$lib/components/graph/nodes/word/WordPreview.svelte\\";\\nimport WordDetail from \\"$lib/components/graph/nodes/word/WordDetail.svelte\\";\\nimport DefinitionPreview from \\"$lib/components/graph/nodes/definition/DefinitionPreview.svelte\\";\\nimport { getNavigationOptions } from \\"$lib/services/navigation\\";\\nimport { NavigationContext } from \\"$lib/services/navigation\\";\\nimport { userStore } from \\"$lib/stores/userStore\\";\\nimport { wordStore } from \\"$lib/stores/wordStore\\";\\nimport { COLORS } from \\"$lib/constants/colors\\";\\nimport { getNetVotes } from \\"$lib/components/graph/nodes/utils/nodeUtils\\";\\nimport DefinitionDetail from \\"$lib/components/graph/nodes/definition/DefinitionDetail.svelte\\";\\nimport NavigationNode from \\"$lib/components/graph/nodes/navigation/NavigationNode.svelte\\";\\nimport {\\n  isDashboardNode,\\n  isEditProfileNode,\\n  isCreateNodeNode,\\n  isWordNode,\\n  isDefinitionNode,\\n  isNavigationNode\\n} from \\"$lib/types/graph/core\\";\\nexport let data;\\nlet authInitialized = false;\\nlet dataInitialized = false;\\nlet userActivity;\\nlet graphLayout;\\nlet definitionNodeModes = /* @__PURE__ */ new Map();\\n$: viewType = view;\\n$: console.log(\\"Auth State:\\", {\\n  authInitialized,\\n  dataInitialized,\\n  hasUser: !!$userStore,\\n  view,\\n  data\\n});\\n$: wordNodeMode = $page ? $page.params.view === \\"word\\" ? \\"detail\\" : \\"preview\\" : \\"preview\\";\\nconst wordStyle = {\\n  previewSize: NODE_CONSTANTS.SIZES.WORD.preview,\\n  detailSize: NODE_CONSTANTS.SIZES.WORD.detail,\\n  colors: NODE_CONSTANTS.COLORS.WORD,\\n  padding: NODE_CONSTANTS.PADDING,\\n  lineHeight: NODE_CONSTANTS.LINE_HEIGHT,\\n  stroke: NODE_CONSTANTS.STROKE,\\n  highlightColor: COLORS.PRIMARY.BLUE\\n};\\nconst liveDefinitionStyle = {\\n  previewSize: NODE_CONSTANTS.SIZES.DEFINITION.live.preview,\\n  detailSize: NODE_CONSTANTS.SIZES.DEFINITION.live.detail,\\n  colors: NODE_CONSTANTS.COLORS.DEFINITION.live,\\n  padding: NODE_CONSTANTS.PADDING,\\n  lineHeight: NODE_CONSTANTS.LINE_HEIGHT,\\n  stroke: NODE_CONSTANTS.STROKE,\\n  highlightColor: COLORS.PRIMARY.BLUE\\n};\\nconst alternativeDefinitionStyle = {\\n  previewSize: NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview,\\n  detailSize: NODE_CONSTANTS.SIZES.DEFINITION.alternative.detail,\\n  colors: NODE_CONSTANTS.COLORS.DEFINITION.alternative,\\n  padding: NODE_CONSTANTS.PADDING,\\n  lineHeight: NODE_CONSTANTS.LINE_HEIGHT,\\n  stroke: NODE_CONSTANTS.STROKE,\\n  highlightColor: COLORS.PRIMARY.PURPLE\\n};\\n$: isPreviewMode = view === \\"alternative-definitions\\" ? wordNodeMode === \\"preview\\" : view === \\"word\\" ? wordNodeMode === \\"preview\\" : false;\\nasync function initializeData() {\\n  console.log(\\"Starting initializeData\\");\\n  try {\\n    await auth0.handleAuthCallback();\\n    const fetchedUser = await auth0.getAuth0User();\\n    console.log(\\"Auth check complete:\\", { hasUser: !!fetchedUser });\\n    if (!fetchedUser) {\\n      console.log(\\"No user found, redirecting to login\\");\\n      auth0.login();\\n      return;\\n    }\\n    authInitialized = true;\\n    userStore.set(fetchedUser);\\n    userActivity = await getUserActivity();\\n    if (view === \\"word\\") {\\n      const wordParam = new URL(window.location.href).searchParams.get(\\"word\\");\\n      if (wordParam) {\\n        const loadedWord = await getWordData(wordParam);\\n        if (loadedWord) {\\n          wordStore.set(loadedWord);\\n        }\\n      }\\n    }\\n    dataInitialized = true;\\n    console.log(\\"Data initialization complete\\", {\\n      hasUser: !!fetchedUser,\\n      hasActivity: !!userActivity,\\n      view\\n    });\\n  } catch (error) {\\n    console.error(\\"Error in initializeData:\\", error);\\n    auth0.login();\\n  }\\n}\\nonMount(initializeData);\\n$: view = $page.params.view;\\n$: isWordView = view === \\"word\\" || view === \\"alternative-definitions\\";\\n$: wordData = isWordView ? $wordStore : null;\\n$: isReady = authInitialized && dataInitialized;\\nfunction handleWordNodeModeChange(event) {\\n  console.log(\\"Word node mode change:\\", event.detail);\\n  wordNodeMode = event.detail.mode;\\n}\\nfunction handleDefinitionModeChange(event, nodeId) {\\n  console.log(\\"Definition mode change:\\", { nodeId, newMode: event.detail.mode });\\n  definitionNodeModes.set(nodeId, event.detail.mode);\\n  definitionNodeModes = new Map(definitionNodeModes);\\n}\\n$: centralNode = isReady && $userStore && (isWordView && wordData ? {\\n  id: wordData.id,\\n  type: \\"word\\",\\n  data: wordData,\\n  group: \\"central\\"\\n} : {\\n  id: $userStore.sub,\\n  type: view,\\n  data: $userStore,\\n  group: \\"central\\"\\n});\\n$: context = view === \\"dashboard\\" ? NavigationContext.DASHBOARD : view === \\"create-node\\" ? NavigationContext.CREATE_NODE : isWordView ? NavigationContext.WORD : NavigationContext.EDIT_PROFILE;\\n$: navigationNodes = getNavigationOptions(context).map((option) => ({\\n  id: option.id,\\n  type: \\"navigation\\",\\n  data: option,\\n  group: \\"navigation\\"\\n}));\\n$: graphData = centralNode ? (() => {\\n  const baseNodes = [centralNode, ...navigationNodes];\\n  if (wordData && wordData.definitions.length > 0) {\\n    const sortedDefinitions = [...wordData.definitions].sort(\\n      (a, b) => getNetVotes(b) - getNetVotes(a)\\n    );\\n    if (view === \\"word\\") {\\n      const definitionNodes = sortedDefinitions.map((definition, index) => ({\\n        id: definition.id,\\n        type: \\"definition\\",\\n        data: definition,\\n        group: index === 0 ? \\"live-definition\\" : \\"alternative-definition\\"\\n      }));\\n      const definitionLinks = sortedDefinitions.map((definition, index) => ({\\n        source: centralNode.id,\\n        target: definition.id,\\n        type: index === 0 ? \\"live\\" : \\"alternative\\",\\n        value: 1 + Math.abs(getNetVotes(definition))\\n      }));\\n      return {\\n        nodes: [...baseNodes, ...definitionNodes],\\n        links: definitionLinks\\n      };\\n    }\\n  }\\n  return { nodes: baseNodes, links: [] };\\n})() : { nodes: [], links: [] };\\n$: nodes = graphData.nodes;\\n$: links = graphData.links;\\n<\/script>\\n\\n{#if !isReady}\\n    <div class=\\"loading-container\\">\\n        <div class=\\"loading-spinner\\" />\\n        <span class=\\"loading-text\\">Initializing...</span>\\n    </div>\\n{:else if !$userStore}\\n    <div class=\\"loading-container\\">\\n        <div class=\\"loading-text\\">Authentication required</div>\\n    </div>\\n{:else}\\n<Graph \\n    bind:this={graphLayout}\\n    data={graphData}\\n    {isPreviewMode}\\n    {viewType}\\n    on:modeChange\\n>\\n    <svelte:fragment let:node let:transform>\\n        {#if isDashboardNode(node)}\\n            <DashboardNode \\n                node={node.data} \\n                {userActivity}\\n            />\\n        {:else if isEditProfileNode(node)}\\n            <EditProfileNode \\n                node={node.data}\\n            />\\n        {:else if isCreateNodeNode(node)}\\n            <CreateNodeNode \\n                node={node.data}\\n            />\\n        {:else if isNavigationNode(node)}\\n            <NavigationNode \\n                option={node.data}\\n                transform={transform.toString()}\\n            />\\n        {:else if isWordNode(node)}\\n            {#if node.group === 'central'}\\n                {#if wordNodeMode === 'preview'}\\n                    <WordPreview\\n                        data={node.data}\\n                        style={wordStyle}\\n                        transform={transform.toString()}\\n                        on:modeChange={handleWordNodeModeChange}\\n                    />\\n                {:else}\\n                    <WordDetail\\n                        data={node.data}\\n                        style={wordStyle}\\n                        on:modeChange={handleWordNodeModeChange}\\n                    />\\n                {/if}\\n            {:else}\\n                <WordPreview\\n                    data={node.data}\\n                    style={wordStyle}\\n                    transform={transform.toString()}\\n                />\\n            {/if}\\n        {:else if isDefinitionNode(node) && wordData}\\n            {#if definitionNodeModes.get(node.id) === 'detail'}\\n                <DefinitionDetail\\n                    word={wordData.word}\\n                    data={node.data}\\n                    type={node.group === 'live-definition' ? 'live' : 'alternative'}\\n                    style={node.group === 'live-definition' ? liveDefinitionStyle : alternativeDefinitionStyle}\\n                    on:modeChange={(event) => handleDefinitionModeChange(event, node.id)}\\n                />\\n            {:else}\\n                <DefinitionPreview\\n                    word={wordData.word}\\n                    definition={node.data}\\n                    type={node.group === 'live-definition' ? 'live' : 'alternative'}\\n                    style={node.group === 'live-definition' ? liveDefinitionStyle : alternativeDefinitionStyle}\\n                    transform={transform.toString()}\\n                    on:modeChange={(event) => handleDefinitionModeChange(event, node.id)}\\n                />\\n            {/if}\\n        {/if}\\n    </svelte:fragment>\\n</Graph>\\n{/if}\\n\\n<style>\\n    :global(html, body) {\\n        height: 100%;\\n        margin: 0;\\n        padding: 0;\\n        overflow: hidden;\\n        background: black;\\n    }\\n\\n    .loading-container {\\n        position: fixed;\\n        top: 0;\\n        left: 0;\\n        width: 100%;\\n        height: 100%;\\n        display: flex;\\n        flex-direction: column;\\n        align-items: center;\\n        justify-content: center;\\n        background: black;\\n        color: rgba(255, 255, 255, 0.8);\\n        gap: 1rem;\\n    }\\n\\n    .loading-spinner {\\n        width: 580px;\\n        height: 580px;\\n        border: 3px solid rgba(255, 255, 255, 0.1);\\n        border-top-color: rgba(255, 255, 255, 0.8);\\n        border-radius: 50%;\\n        animation: spin 1s linear infinite;\\n    }\\n\\n    .loading-text {\\n        font-family: 'Orbitron', sans-serif;\\n        font-size: 1.2rem;\\n    }\\n\\n    @keyframes spin {\\n        to {\\n            transform: rotate(360deg);\\n        }\\n    }\\n</style>"],"names":[],"mappings":"AA8PY,UAAY,CAChB,MAAM,CAAE,IAAI,CACZ,MAAM,CAAE,CAAC,CACT,OAAO,CAAE,CAAC,CACV,QAAQ,CAAE,MAAM,CAChB,UAAU,CAAE,KAChB,CAEA,iCAAmB,CACf,QAAQ,CAAE,KAAK,CACf,GAAG,CAAE,CAAC,CACN,IAAI,CAAE,CAAC,CACP,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,WAAW,CAAE,MAAM,CACnB,eAAe,CAAE,MAAM,CACvB,UAAU,CAAE,KAAK,CACjB,KAAK,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC/B,GAAG,CAAE,IACT,CAEA,+BAAiB,CACb,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,gBAAgB,CAAE,KAAK,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAC1C,aAAa,CAAE,GAAG,CAClB,SAAS,CAAE,mBAAI,CAAC,EAAE,CAAC,MAAM,CAAC,QAC9B,CAEA,4BAAc,CACV,WAAW,CAAE,UAAU,CAAC,CAAC,UAAU,CACnC,SAAS,CAAE,MACf,CAEA,WAAW,mBAAK,CACZ,EAAG,CACC,SAAS,CAAE,OAAO,MAAM,CAC5B,CACJ"}`
};
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let viewType;
  let wordNodeMode;
  let isPreviewMode;
  let view;
  let isWordView;
  let wordData;
  let isReady;
  let centralNode;
  let context;
  let navigationNodes;
  let graphData;
  let $userStore, $$unsubscribe_userStore;
  let $wordStore, $$unsubscribe_wordStore;
  let $page, $$unsubscribe_page;
  $$unsubscribe_userStore = subscribe(userStore, (value) => $userStore = value);
  $$unsubscribe_wordStore = subscribe(wordStore, (value) => $wordStore = value);
  $$unsubscribe_page = subscribe(page, (value) => $page = value);
  let { data } = $$props;
  let authInitialized = false;
  let dataInitialized = false;
  let userActivity;
  let graphLayout;
  let definitionNodeModes = /* @__PURE__ */ new Map();
  const wordStyle = {
    previewSize: NODE_CONSTANTS.SIZES.WORD.preview,
    detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
    colors: NODE_CONSTANTS.COLORS.WORD,
    padding: NODE_CONSTANTS.PADDING,
    lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
    stroke: NODE_CONSTANTS.STROKE,
    highlightColor: COLORS.PRIMARY.BLUE
  };
  const liveDefinitionStyle = {
    previewSize: NODE_CONSTANTS.SIZES.DEFINITION.live.preview,
    detailSize: NODE_CONSTANTS.SIZES.DEFINITION.live.detail,
    colors: NODE_CONSTANTS.COLORS.DEFINITION.live,
    padding: NODE_CONSTANTS.PADDING,
    lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
    stroke: NODE_CONSTANTS.STROKE,
    highlightColor: COLORS.PRIMARY.BLUE
  };
  const alternativeDefinitionStyle = {
    previewSize: NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview,
    detailSize: NODE_CONSTANTS.SIZES.DEFINITION.alternative.detail,
    colors: NODE_CONSTANTS.COLORS.DEFINITION.alternative,
    padding: NODE_CONSTANTS.PADDING,
    lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
    stroke: NODE_CONSTANTS.STROKE,
    highlightColor: COLORS.PRIMARY.PURPLE
  };
  if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
  $$result.css.add(css);
  let $$settled;
  let $$rendered;
  let previous_head = $$result.head;
  do {
    $$settled = true;
    $$result.head = previous_head;
    view = $page.params.view;
    viewType = view;
    {
      console.log("Auth State:", {
        authInitialized,
        dataInitialized,
        hasUser: !!$userStore,
        view,
        data
      });
    }
    wordNodeMode = $page ? $page.params.view === "word" ? "detail" : "preview" : "preview";
    isPreviewMode = view === "alternative-definitions" ? wordNodeMode === "preview" : view === "word" ? wordNodeMode === "preview" : false;
    isWordView = view === "word" || view === "alternative-definitions";
    wordData = isWordView ? $wordStore : null;
    isReady = authInitialized;
    centralNode = isReady && $userStore && (isWordView && wordData ? {
      id: wordData.id,
      type: "word",
      data: wordData,
      group: "central"
    } : {
      id: $userStore.sub,
      type: view,
      data: $userStore,
      group: "central"
    });
    context = view === "dashboard" ? NavigationContext.DASHBOARD : view === "create-node" ? NavigationContext.CREATE_NODE : isWordView ? NavigationContext.WORD : NavigationContext.EDIT_PROFILE;
    navigationNodes = getNavigationOptions(context).map((option) => ({
      id: option.id,
      type: "navigation",
      data: option,
      group: "navigation"
    }));
    graphData = centralNode ? (() => {
      const baseNodes = [centralNode, ...navigationNodes];
      if (wordData && wordData.definitions.length > 0) {
        const sortedDefinitions = [...wordData.definitions].sort((a, b) => getNetVotes(b) - getNetVotes(a));
        if (view === "word") {
          const definitionNodes = sortedDefinitions.map((definition, index) => ({
            id: definition.id,
            type: "definition",
            data: definition,
            group: index === 0 ? "live-definition" : "alternative-definition"
          }));
          const definitionLinks = sortedDefinitions.map((definition, index) => ({
            source: centralNode.id,
            target: definition.id,
            type: index === 0 ? "live" : "alternative",
            value: 1 + Math.abs(getNetVotes(definition))
          }));
          return {
            nodes: [...baseNodes, ...definitionNodes],
            links: definitionLinks
          };
        }
      }
      return { nodes: baseNodes, links: [] };
    })() : { nodes: [], links: [] };
    graphData.nodes;
    graphData.links;
    $$rendered = `  ${!isReady ? `<div class="loading-container svelte-1nfodeq" data-svelte-h="svelte-9xy0vl"><div class="loading-spinner svelte-1nfodeq"></div> <span class="loading-text svelte-1nfodeq">Initializing...</span></div>` : `${!$userStore ? `<div class="loading-container svelte-1nfodeq" data-svelte-h="svelte-1ixvscs"><div class="loading-text svelte-1nfodeq">Authentication required</div></div>` : `${validate_component(Graph, "Graph").$$render(
      $$result,
      {
        data: graphData,
        isPreviewMode,
        viewType,
        this: graphLayout
      },
      {
        this: ($$value) => {
          graphLayout = $$value;
          $$settled = false;
        }
      },
      {
        default: ({ node, transform }) => {
          return `${isDashboardNode(node) ? `${validate_component(DashboardNode, "DashboardNode").$$render($$result, { node: node.data, userActivity }, {}, {})}` : `${isEditProfileNode(node) ? `${validate_component(EditProfileNode, "EditProfileNode").$$render($$result, { node: node.data }, {}, {})}` : `${isCreateNodeNode(node) ? `${validate_component(CreateNodeNode, "CreateNodeNode").$$render($$result, { node: node.data }, {}, {})}` : `${isNavigationNode(node) ? `${validate_component(NavigationNode, "NavigationNode").$$render(
            $$result,
            {
              option: node.data,
              transform: transform.toString()
            },
            {},
            {}
          )}` : `${isWordNode(node) ? `${node.group === "central" ? `${wordNodeMode === "preview" ? `${validate_component(WordPreview, "WordPreview").$$render(
            $$result,
            {
              data: node.data,
              style: wordStyle,
              transform: transform.toString()
            },
            {},
            {}
          )}` : `${validate_component(WordDetail, "WordDetail").$$render($$result, { data: node.data, style: wordStyle }, {}, {})}`}` : `${validate_component(WordPreview, "WordPreview").$$render(
            $$result,
            {
              data: node.data,
              style: wordStyle,
              transform: transform.toString()
            },
            {},
            {}
          )}`}` : `${isDefinitionNode(node) && wordData ? `${definitionNodeModes.get(node.id) === "detail" ? `${validate_component(DefinitionDetail, "DefinitionDetail").$$render(
            $$result,
            {
              word: wordData.word,
              data: node.data,
              type: node.group === "live-definition" ? "live" : "alternative",
              style: node.group === "live-definition" ? liveDefinitionStyle : alternativeDefinitionStyle
            },
            {},
            {}
          )}` : `${validate_component(DefinitionPreview, "DefinitionPreview").$$render(
            $$result,
            {
              word: wordData.word,
              definition: node.data,
              type: node.group === "live-definition" ? "live" : "alternative",
              style: node.group === "live-definition" ? liveDefinitionStyle : alternativeDefinitionStyle,
              transform: transform.toString()
            },
            {},
            {}
          )}`}` : ``}`}`}`}`}`}`;
        }
      }
    )}`}`}`;
  } while (!$$settled);
  $$unsubscribe_userStore();
  $$unsubscribe_wordStore();
  $$unsubscribe_page();
  return $$rendered;
});
export {
  Page as default
};
