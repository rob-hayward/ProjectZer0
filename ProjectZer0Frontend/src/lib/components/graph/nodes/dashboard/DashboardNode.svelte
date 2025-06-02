<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/dashboard/DashboardNode.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import type { UserActivity } from '$lib/services/userActivity';
    import { isUserProfileData } from '$lib/types/graph/enhanced';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import { graphStore } from '$lib/stores/graphStore';
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    
    // Import the shared behaviors and UI components
    import {
        createVisibilityBehaviour,
        createModeBehaviour,
        createDataBehaviour
    } from '../behaviours';
    
    // Import the shared UI components
    import NodeHeader from '../ui/NodeHeader.svelte';
    import ContentBox from '../ui/ContentBox.svelte';
    import { wrapTextForWidth } from '../utils/textUtils';

    export let node: RenderableNode;
    export let userActivity: UserActivity | undefined;

    // Debug toggle - set to true to show ContentBox borders
    const DEBUG_SHOW_BORDERS = false;

    // Type guard for user profile data
    if (!isUserProfileData(node.data)) {
        throw new Error('Invalid node data type for DashboardNode');
    }
    
    const userData = node.data;
    
    // Behavior instances
    let visibilityBehaviour: any;
    let modeBehaviour: any;
    let dataBehaviour: any;
    let behavioursInitialized = false;
    
    // Initialize behaviors - match DefinitionNode pattern exactly
    $: if (node.id && !behavioursInitialized) {
        // Note: Dashboard nodes typically don't have voting behavior
        
        visibilityBehaviour = createVisibilityBehaviour(node.id, { graphStore });
        modeBehaviour = createModeBehaviour(node.mode || 'detail'); // Default to detail mode
        dataBehaviour = createDataBehaviour('dashboard', userData, {
            transformData: (rawData) => ({
                ...rawData,
                displayName: rawData.preferred_username || rawData.name || rawData.nickname || 'User',
                missionStatement: rawData.mission_statement || "no mission statement set."
            })
        });
        
        behavioursInitialized = true;
    }
    
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        visibilityChange: { isHidden: boolean };
    }>();

    function handleModeChange() {
        const newMode = modeBehaviour?.handleModeChange();
        if (newMode) {
            console.debug(`[DashboardNode] Mode change requested:`, { 
                currentMode: node.mode, 
                newMode
            });
            dispatch('modeChange', { mode: newMode });
        }
    }
    
    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        dispatch('visibilityChange', event.detail);
    }

    // Reactive declarations - match DefinitionNode pattern exactly
    $: isDetail = node.mode === 'detail';
    $: displayName = userData.preferred_username || userData.name || userData.nickname || 'User';
    $: missionStatement = userData.mission_statement || "no mission statement set.";
    
    onMount(async () => {
        // Wait for next tick like DefinitionNode does
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Initialize behaviors - match DefinitionNode pattern exactly
        const initPromises = [];
        if (dataBehaviour) initPromises.push(dataBehaviour.initialize());
        if (visibilityBehaviour) initPromises.push(visibilityBehaviour.initialize(0)); // No votes for dashboard
        if (initPromises.length > 0) await Promise.all(initPromises);
        
        console.log(`[DashboardNode] Mounted with mode ${node.mode}, radius ${node.radius}`);
    });

    onDestroy(() => {
        if (dataBehaviour?.destroy) dataBehaviour.destroy();
    });
</script>

{#if isDetail}
    <!-- DETAIL MODE - match DefinitionNode structure exactly -->
    <BaseDetailNode {node} on:modeChange={handleModeChange} on:visibilityChange={handleVisibilityChange}>
        <svelte:fragment slot="default" let:radius>
            <NodeHeader title="ProjectZer0" radius={radius} size="large" mode="detail" />
            
            <ContentBox nodeType="dashboard" mode="detail" showBorder={DEBUG_SHOW_BORDERS}>
                <svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
                    <!-- Name Section -->
                    <g transform="translate(0, {y + layoutConfig.titleYOffset})">
                        <text 
                            x={x}
                            class="label left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.7)"
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
                        >
                            {displayName}
                        </text>
                    </g>

                    <!-- Mission Statement Section -->
                    <g transform="translate(0, {y + layoutConfig.titleYOffset + 80})">
                        <text 
                            x={x}
                            class="label left-align"
                            style:font-family="Inter"
                            style:font-size="14px"
                            style:fill="rgba(255, 255, 255, 0.7)"
                        >
                            mission statement:
                        </text>
                        
                        <foreignObject 
                            x={x}
                            y="25"
                            width={width}
                            height="120"
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
                        <g transform="translate(0, {y + layoutConfig.titleYOffset + 240})">
                            <text 
                                x={x}
                                class="label left-align"
                                style:font-family="Inter"
                                style:font-size="14px"
                                style:fill="rgba(255, 255, 255, 0.7)"
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
                                >
                                    {userActivity.votesCast}
                                </text>
                            </g>
                        </g>
                    {/if}
                </svelte:fragment>
            </ContentBox>
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE - match DefinitionNode structure exactly -->
    <BasePreviewNode {node} on:modeChange={handleModeChange} showContentBoxBorder={DEBUG_SHOW_BORDERS}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="ProjectZer0" radius={radius} size="small" mode="preview" />
        </svelte:fragment>

        <svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
            <!-- Name -->
            <g transform="translate(0, {y + layoutConfig.titleYOffset - 10})">
                <text 
                    x={x}
                    class="preview-label left-align"
                    style:font-family="Inter"
                    style:font-size="11px"
                    style:fill="rgba(255, 255, 255, 0.6)"
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
                >
                    {displayName}
                </text>
            </g>

            <!-- Mission Statement (truncated for preview) -->
            <g transform="translate(0, {y + layoutConfig.titleYOffset + 45})">
                <text 
                    x={x}
                    class="preview-label left-align"
                    style:font-family="Inter"
                    style:font-size="11px"
                    style:fill="rgba(255, 255, 255, 0.6)"
                >
                    mission:
                </text>
                
                <foreignObject 
                    x={x}
                    y="18"
                    width={width}
                    height={height - layoutConfig.titleYOffset - 65}
                >
                    <div class="mission-preview">
                        {#each wrapTextForWidth(missionStatement, width, { fontSize: 11, fontFamily: 'Inter', maxLines: 3 }) as line}
                            <div class="mission-preview-line">{line}</div>
                        {/each}
                    </div>
                </foreignObject>
            </g>
        </svelte:fragment>
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