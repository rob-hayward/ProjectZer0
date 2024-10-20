<!-- src/lib/components/nodeViews/OwnUserNodeView.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import * as d3 from 'd3';
  import { goto } from '$app/navigation';
  import * as auth0 from '$lib/services/auth0';
  import type { UserProfile } from '$lib/types/user';
  import LargeCentralNodeView from './LargeCentralNodeView.svelte';

  export let node: UserProfile;

  const dispatch = createEventDispatcher();

  const navigationOptions = [
    { id: 'network', label: 'social network', position: { x: 0.85, y: 0.3 }, color: '#80ffff' },
    { id: 'creations', label: 'my creations', position: { x: 0.15, y: 0.3 }, color: '#ffff80' },
    { id: 'interactions', label: 'my interactions', position: { x: 0.85, y: 0.6 }, color: '#ff80ff' },
    { id: 'explore', label: 'explore', position: { x: 0.15, y: 0.6 }, color: '#80ff80' },
    { id: 'create-node', label: 'create node', position: { x: 0.75, y: 0.15 }, color: '#ff8080' },
    { id: 'edit-profile', label: 'edit profile', position: { x: 0.1, y: 0.9 }, color: '#8080ff' },
    { id: 'logout', label: 'logout', position: { x: 0.9, y: 0.9 }, color: '#ffa080' }
  ];

  function handleNavigation(optionId: string) {
    switch(optionId) {
      case 'create-node':
        goto('/create-node');
        break;
      case 'edit-profile':
        goto('/edit-profile');
        break;
      case 'logout':
        auth0.logout();
        break;
      default:
        goto(`/${optionId}`);
    }
  }

  let svg: SVGElement;
  let centralNodeSize: number;

  onMount(() => {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === svg) {
          centralNodeSize = Math.min(entry.contentRect.width, entry.contentRect.height) * 0.8;
          renderView();
        }
      }
    });

    resizeObserver.observe(svg);

    return () => {
      resizeObserver.disconnect();
    };
  });

  function renderView() {
    if (!svg || !centralNodeSize) return;

    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const centerNodeRadius = centralNodeSize / 2;

    const svgElement = d3.select(svg);
    svgElement.selectAll("*").remove();  // Clear previous content

    // Add glow filter
    const defs = svgElement.append("defs");
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "10")
      .attr("result", "coloredBlur");
    
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode")
      .attr("in", "coloredBlur");
    feMerge.append("feMergeNode")
      .attr("in", "SourceGraphic");

    // Add edge glow filter
    const edgeFilter = defs.append("filter")
      .attr("id", "edge-glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    edgeFilter.append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "coloredBlur");
    
    const edgeFeMerge = edgeFilter.append("feMerge");
    edgeFeMerge.append("feMergeNode")
      .attr("in", "coloredBlur");
    edgeFeMerge.append("feMergeNode")
      .attr("in", "SourceGraphic");

    // Render edges
    navigationOptions.forEach((option, index) => {
      const x = option.position.x * width;
      const y = option.position.y * height;
      
      // Calculate start point on the edge of the center node
      const angle = Math.atan2(y - centerY, x - centerX);
      const startX = centerX + Math.cos(angle) * centerNodeRadius;
      const startY = centerY + Math.sin(angle) * centerNodeRadius;

      // Create gradient for each edge
      const gradientId = `edge-gradient-${index}`;
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", startX)
        .attr("y1", startY)
        .attr("x2", x)
        .attr("y2", y);

      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#00FFFF");  // Center node color

      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", option.color);

      svgElement.append("line")
        .attr("x1", startX)
        .attr("y1", startY)
        .attr("x2", x)
        .attr("y2", y)
        .attr("stroke", `url(#${gradientId})`)
        .attr("stroke-width", 2)
        .attr("filter", "url(#edge-glow)");
    });

    // Render navigation options
    navigationOptions.forEach((option) => {
      const x = option.position.x * width;
      const y = option.position.y * height;

      const optionGroup = svgElement.append("g")
        .attr("transform", `translate(${x}, ${y})`)
        .on("click", () => handleNavigation(option.id));

      // Sun-like glow effect
      const gradient = defs.append("radialGradient")
        .attr("id", `nav-gradient-${option.id}`)
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%");

      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 1);

      gradient.append("stop")
        .attr("offset", "70%")
        .attr("stop-color", option.color)
        .attr("stop-opacity", 1);

      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", option.color)
        .attr("stop-opacity", 0);

      optionGroup.append("circle")
        .attr("r", 50)
        .attr("fill", `url(#nav-gradient-${option.id})`)
        .attr("filter", "url(#glow)");

      optionGroup.append("circle")
        .attr("r", 40)
        .attr("fill", `url(#nav-gradient-${option.id})`);

      // Eclipse hover effect
      optionGroup.append("circle")
        .attr("r", 40)
        .attr("fill", "black")
        .attr("opacity", 0)
        .attr("class", "eclipse-hover");

      // Split the label into words
      const words = option.label.split(' ');
      
      // Create text element
      const text = optionGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("font-family", "Orbitron, sans-serif")
        .attr("font-size", "12px")
        .attr("fill", "black")
        .attr("font-weight", "bold")
        .attr("dominant-baseline", "middle");  // This helps with vertical centering

      // Calculate vertical positioning
      const lineHeight = 1.2;  // line height in ems
      const totalHeight = words.length * lineHeight;
      const startY = -(totalHeight - lineHeight) / 2;  // Start position to center text block

      // Add tspan elements for each word
      words.forEach((word, index) => {
        text.append("tspan")
          .attr("x", 0)
          .attr("dy", index === 0 ? startY + "em" : lineHeight + "em")
          .text(word);
      });

      // Hover effect
      optionGroup.on("mouseover", function() {
        d3.select(this).select(".eclipse-hover").transition().duration(200).attr("opacity", 1);
        text.transition().duration(200).attr("fill", "white");
      }).on("mouseout", function() {
        d3.select(this).select(".eclipse-hover").transition().duration(200).attr("opacity", 0);
        text.transition().duration(200).attr("fill", "black");
      });
    });
  }
</script>

<div class="own-user-node-view">
  <div class="star-background"></div>
  <LargeCentralNodeView 
  title=""
  bind:size={centralNodeSize}
>
  <div class="user-info">
    <div class="avatar-container">
      <img src={node.picture} alt="User avatar" class="user-avatar"/>
    </div>
    <h2 class="user-name">{node.preferred_username || node.name || node.nickname || 'User'}</h2>
    <p class="mission-statement">{node.mission_statement || "No mission statement set."}</p>
  </div>
</LargeCentralNodeView>
  <svg bind:this={svg}></svg>
</div>

<style>
  .own-user-node-view {
    width: 100%;
    height: 100%;
    position: relative;
    background-color: #010B19;
    overflow: hidden;
  }

  .star-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      radial-gradient(2px 2px at 20px 30px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(2px 2px at 40px 70px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(2px 2px at 50px 160px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(2px 2px at 90px 40px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(2px 2px at 130px 80px, #ffffff, rgba(0,0,0,0));
    background-repeat: repeat;
    background-size: 200px 200px;
    opacity: 0.1;
    animation: twinkle 5s infinite;
  }

  @keyframes twinkle {
    0% { opacity: 0.1; }
    50% { opacity: 0.2; }
    100% { opacity: 0.1; }
  }

  svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  :global(svg g) {
    pointer-events: all;
    cursor: pointer;
  }

  .user-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  padding: 5% 5%; 
  box-sizing: border-box;
  font-family: 'Roboto', sans-serif;
  text-align: center;
}

.user-name {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.5em;
  margin: 10px 0;
  text-align: center;
  width: 100%;
}

  .avatar-container {
    width: 130px;
    height: 130px;
    margin: 0 auto 20px;
    position: relative;
  }

  .user-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--ring-color);
    box-shadow: 0 0 20px var(--ring-color);
  }

  .mission-statement {
  font-style: italic;
  margin: 20px 0;
  font-size: 1.1em;
  line-height: 1.4;
  max-width: 80%;
  text-align: center;
}
</style>