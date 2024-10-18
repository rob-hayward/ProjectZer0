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
      { id: 'network', label: 'Network', position: { x: 0.85, y: 0.3 }, color: '#80ffff' },
      { id: 'creations', label: 'Creations', position: { x: 0.15, y: 0.3 }, color: '#ffff80' },
      { id: 'interactions', label: 'Interactions', position: { x: 0.85, y: 0.8 }, color: '#ff80ff' },
      { id: 'explore', label: 'Explore', position: { x: 0.15, y: 0.8 }, color: '#80ff80' },
      { id: 'create-node', label: 'Create Node', position: { x: 0.5, y: 0.15 }, color: '#ff8080' },
      { id: 'edit-profile', label: 'Edit Profile', position: { x: 0.1, y: 0.9 }, color: '#8080ff' },
      { id: 'logout', label: 'Logout', position: { x: 0.9, y: 0.9 }, color: '#ffa080' }
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
  
    onMount(() => {
      renderView();
    });
  
    function renderView() {
      const width = svg.clientWidth;
      const height = svg.clientHeight;
  
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
  
        const text = optionGroup.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.3em")
          .text(option.label)
          .attr("font-family", "Orbitron, sans-serif")
          .attr("font-size", "12px")
          .attr("fill", "black")
          .attr("font-weight", "bold");

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
  <LargeCentralNodeView title={`${node.preferred_username || node.nickname || 'User'}'s home`}>
    <div class="user-info">
      <div class="avatar-container">
        <img src={node.picture} alt="User avatar" class="user-avatar"/>
      </div>
      <p class="mission-statement">{node.mission_statement || "No mission statement set."}</p>
    </div>
  </LargeCentralNodeView>
  <svg bind:this={svg}></svg>
</div>
  
<style>
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');

  .own-user-node-view {
    width: 100%;
    height: 100%;
    position: relative;
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
    text-align: center;
    color: var(--text-color);
  }
  
  .avatar-container {
    width: 150px;
    height: 150px;
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
    margin-left: auto;
    margin-right: auto;
  }
</style>