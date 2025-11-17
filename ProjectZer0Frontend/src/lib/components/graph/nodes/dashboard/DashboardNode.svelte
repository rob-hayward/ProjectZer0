<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/dashboard/DashboardNode.svelte -->
<!-- REORGANIZED: Control node structure - contentText only (no voting sections) -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import type { UserActivity } from '$lib/services/userActivity';
    import { isUserProfileData } from '$lib/types/graph/enhanced';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import NodeHeader from '../ui/NodeHeader.svelte';
    import { wrapTextForWidth } from '../utils/textUtils';

    export let node: RenderableNode;
    export let userActivity: UserActivity | undefined;

    // Debug toggle - set to false in production
    const DEBUG_SHOW_BORDERS = false;

    // Type guard for user profile data
    if (!isUserProfileData(node.data)) {
        throw new Error('Invalid node data type for DashboardNode');
    }
    
    const userData = node.data;
    
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
    }>();

    // Function to handle mode changes
    function handleModeChange() {
        const newMode: NodeMode = isDetail ? 'preview' : 'detail';
        console.debug(`[DashboardNode] Mode change requested:`, { 
            currentMode: node.mode, 
            newMode
        });
        dispatch('modeChange', { mode: newMode });
    }

    // Reactive declarations
    $: isDetail = node.mode === 'detail';
    $: displayName = userData.preferred_username || userData.name || userData.nickname || 'User';
    $: missionStatement = userData.mission_statement || "no mission statement set.";
    
    onMount(() => {
        console.log(`[DashboardNode] Mounted with mode ${node.mode}, radius ${node.radius}`);
    });
</script>

{#if isDetail}
    <!-- DETAIL MODE -->
    <BaseDetailNode {node} on:modeChange={handleModeChange} showContentBoxBorder={DEBUG_SHOW_BORDERS}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="ProjectZer0" {radius} size="large" mode="detail" />
        </svelte:fragment>
        
        <!-- REORGANIZED: Section 1 - Content Text (All dashboard content) -->
        <svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
            <!-- Name Section -->
            <g transform="translate(0, {y + Math.floor(height * (positioning.nameLabel || 0))})">
                <text 
                    x={x}
                    class="label left-align"
                    style:font-family="Inter"
                    style:font-size="14px"
                    style:fill="rgba(255, 255, 255, 0.7)"
                    style:dominant-baseline="middle"
                >
                    name:
                </text>
                <text 
                    x={x}
                    y="25"
                    class="value left-align"
                    style:font-family="Inter"
                    style:font-size="16px"
                    style:fill="white"
                    style:font-weight="500"
                    style:dominant-baseline="middle"
                >
                    {displayName}
                </text>
            </g>

            <!-- Mission Statement Section -->
            <g transform="translate(0, {y + Math.floor(height * (positioning.missionLabel || 0.15))})">
                <text 
                    x={x}
                    class="label left-align"
                    style:font-family="Inter"
                    style:font-size="14px"
                    style:fill="rgba(255, 255, 255, 0.7)"
                    style:dominant-baseline="middle"
                >
                    mission statement:
                </text>
                
                <foreignObject 
                    x={x}
                    y="25"
                    width={width}
                    height={Math.floor(height * (positioning.missionHeight || 0.20))}
                >
                    <div class="mission-statement">
                        {#each wrapTextForWidth(missionStatement, width, { fontSize: 14, fontFamily: 'Inter' }) as line}
                            <div class="mission-line">{line}</div>
                        {/each}
                    </div>
                </foreignObject>
            </g>

            <!-- Activity Stats Section -->
            {#if userActivity}
                <g transform="translate(0, {y + Math.floor(height * (positioning.statsLabel || 0.50))})">
                    <text 
                        x={x}
                        class="label left-align"
                        style:font-family="Inter"
                        style:font-size="14px"
                        style:fill="rgba(255, 255, 255, 0.7)"
                        style:dominant-baseline="middle"
                    >
                        activity stats:
                    </text>
                    
                    <!-- Nodes Created -->
                    <g transform="translate(0, 30)">
                        <text 
                            x={x}
                            class="stat-label left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.8)"
                            style:dominant-baseline="middle"
                        >
                            nodes created
                        </text>
                        <text 
                            x={x + width/2}
                            class="stat-equals"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.6)"
                            style:text-anchor="middle"
                            style:dominant-baseline="middle"
                        >
                            =
                        </text>
                        <text 
                            x={x + width - 20}
                            class="stat-value left-align"
                            style:font-family="Inter"
                            style:font-size="16px"
                            style:fill="white"
                            style:font-weight="600"
                            style:text-anchor="end"
                            style:dominant-baseline="middle"
                        >
                            {userActivity.nodesCreated}
                        </text>
                    </g>
                    
                    <!-- Votes Cast -->
                    <g transform="translate(0, 60)">
                        <text 
                            x={x}
                            class="stat-label left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.8)"
                            style:dominant-baseline="middle"
                        >
                            votes cast
                        </text>
                        <text 
                            x={x + width/2}
                            class="stat-equals"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.6)"
                            style:text-anchor="middle"
                            style:dominant-baseline="middle"
                        >
                            =
                        </text>
                        <text 
                            x={x + width - 20}
                            class="stat-value left-align"
                            style:font-family="Inter"
                            style:font-size="16px"
                            style:fill="white"
                            style:font-weight="600"
                            style:text-anchor="end"
                            style:dominant-baseline="middle"
                        >
                            {userActivity.votesCast}
                        </text>
                    </g>
                </g>
            {/if}
        </svelte:fragment>

        <!-- Section 2: No inclusion voting for dashboard -->
        <!-- Section 3: No content voting for dashboard -->
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} on:modeChange={handleModeChange} showContentBoxBorder={DEBUG_SHOW_BORDERS}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="ProjectZer0" {radius} size="small" mode="preview" />
        </svelte:fragment>

        <!-- REORGANIZED: Section 1 - Content Text (Simplified dashboard preview) -->
        <svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
            <!-- Name -->
            <g transform="translate(0, {y + Math.floor(height * (positioning.nameLabel || 0))})">
                <text 
                    x={x}
                    class="preview-label left-align"
                    style:font-family="Inter"
                    style:font-size="11px"
                    style:fill="rgba(255, 255, 255, 0.6)"
                    style:dominant-baseline="middle"
                >
                    name:
                </text>
                <text 
                    x={x}
                    y="18"
                    class="preview-value left-align"
                    style:font-family="Inter"
                    style:font-size="13px"
                    style:fill="white"
                    style:font-weight="500"
                    style:dominant-baseline="middle"
                >
                    {displayName}
                </text>
            </g>

            <!-- Mission Statement (truncated for preview) -->
            <g transform="translate(0, {y + Math.floor(height * (positioning.missionLabel || 0.25))})">
                <text 
                    x={x}
                    class="preview-label left-align"
                    style:font-family="Inter"
                    style:font-size="11px"
                    style:fill="rgba(255, 255, 255, 0.6)"
                    style:dominant-baseline="middle"
                >
                    mission:
                </text>
                
                <foreignObject 
                    x={x}
                    y="18"
                    width={width}
                    height={Math.floor(height * (positioning.missionHeight || 0.70))}
                >
                    <div class="mission-preview">
                        {#each wrapTextForWidth(missionStatement, width, { fontSize: 11, fontFamily: 'Inter', maxLines: 3 }) as line}
                            <div class="mission-preview-line">{line}</div>
                        {/each}
                    </div>
                </foreignObject>
            </g>
        </svelte:fragment>

        <!-- Section 2: No inclusion voting for dashboard -->
        <!-- Section 3: No content voting for dashboard -->
    </BasePreviewNode>
{/if}

<style>
    /* Base text styling with Inter font */
    .left-align {
        text-anchor: start;
    }

    .label {
        dominant-baseline: middle;
    }

    .value {
        dominant-baseline: middle;
    }

    .stat-label, .stat-equals, .stat-value {
        dominant-baseline: middle;
    }

    /* Mission statement styling */
    :global(.mission-statement) {
        color: white;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 400;
        line-height: 1.5;
        text-align: left;
    }
    
    :global(.mission-line) {
        margin-bottom: 4px;
    }

    /* Preview mode mission statement styling */
    :global(.mission-preview) {
        color: white;
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
        line-height: 1.4;
        text-align: left;
    }
    
    :global(.mission-preview-line) {
        margin-bottom: 2px;
    }

    .preview-label, .preview-value {
        dominant-baseline: middle;
    }
</style>