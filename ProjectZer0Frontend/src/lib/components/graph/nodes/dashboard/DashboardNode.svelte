<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/dashboard/DashboardNode.svelte -->
<script lang="ts">
    import BaseSvgDetailNode from '../base/BaseDetailNode.svelte';
    import type { UserProfile } from '$lib/types/user';
    import type { UserActivity } from '$lib/services/userActivity';
    import { NODE_CONSTANTS } from '../../../../constants/graph/node-styling';
    import { COORDINATE_SPACE } from '../../../../constants/graph';

    export let node: UserProfile;
    export let userActivity: UserActivity | undefined;

    const METRICS_SPACING = {
        labelX: -200,
        equalsX: 0,
        valueX: 30
    };

    function getWrappedText(text: string, maxWidth: number, x: number) {
        const words = text.split(' ');
        const lines: { text: string; x: number; dy: number }[] = [];
        let currentLine = '';
        let lineCount = 0;

        const tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tempText.setAttribute('font-family', 'Orbitron');
        tempText.setAttribute('font-size', '14px');
        tempText.setAttribute('x', '-1000');
        tempText.setAttribute('y', '-1000');
        
        const svg = document.querySelector('svg');
        if (!svg) return lines;
        svg.appendChild(tempText);

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            tempText.textContent = testLine;
            const testWidth = tempText.getComputedTextLength();

            if (testWidth > maxWidth && currentLine !== '') {
                lines.push({
                    text: currentLine,
                    x,
                    dy: lineCount * 20
                });
                currentLine = word;
                lineCount++;
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) {
            lines.push({
                text: currentLine,
                x,
                dy: lineCount * 20
            });
        }

        svg.removeChild(tempText);
        return lines;
    }

    $: missionStatementLines = getWrappedText(
        node.mission_statement || "no mission statement set.",
        420, 
        METRICS_SPACING.labelX
    );

    const style = {
        previewSize: COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL,
        detailSize: COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL,
        colors: NODE_CONSTANTS.COLORS.DASHBOARD,
        padding: {
            preview: COORDINATE_SPACE.NODES.PADDING.PREVIEW,
            detail: COORDINATE_SPACE.NODES.PADDING.DETAIL
        },
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE
    };
</script>

<BaseSvgDetailNode {style}>
    <svelte:fragment let:radius>
        <!-- Title -->
        <text 
            dy={-radius + 120} 
            class="title"
        >
            ProjectZer0
        </text>

        <!-- Name -->
        <g transform="translate(0, {-radius + 170})">
            <text 
                x={METRICS_SPACING.labelX}
                class="label left-align"
            >
                name:
            </text>
            <text 
                x={METRICS_SPACING.labelX}
                dy="25"
                class="value left-align"
            >
                {node.preferred_username || node.name || node.nickname || 'User'}
            </text>
        </g>

        <!-- Mission Statement -->
        <g transform="translate(0, {-radius + 230})">
            <text 
                x={METRICS_SPACING.labelX}
                class="label left-align"
            >
                mission statement:
            </text>
            {#each missionStatementLines as line, i}
                <text 
                    x={line.x}
                    dy={25 + line.dy}
                    class="value left-align"
                >
                    {line.text}
                </text>
            {/each}
        </g>

        <!-- Activity Stats -->
        {#if userActivity}
            <g transform="translate(0, {-radius + 390})">
                <text 
                    x={METRICS_SPACING.labelX}
                    class="label left-align"
                >
                    activity stats:
                </text>
                <g transform="translate(0, 30)">
                    <text 
                        x={METRICS_SPACING.labelX}
                        class="value left-align"
                    >
                        nodes created
                    </text>
                    <text 
                        class="value"
                    >
                        =
                    </text>
                    <text 
                        x={METRICS_SPACING.valueX}
                        class="value left-align"
                    >
                        {userActivity.nodesCreated}
                    </text>
                </g>
                <g transform="translate(0, 60)">
                    <text 
                        x={METRICS_SPACING.labelX}
                        class="value left-align"
                    >
                        votes cast
                    </text>
                    <text 
                        class="value"
                    >
                        =
                    </text>
                    <text 
                        x={METRICS_SPACING.valueX}
                        class="value left-align"
                    >
                        {userActivity.votesCast}
                    </text>
                </g>
            </g>
        {/if}
    </svelte:fragment>
</BaseSvgDetailNode>

<style>
    text {
        font-family: 'Orbitron', sans-serif;
        fill: white;
    }

    .title {
        font-size: 30px;
        text-anchor: middle;
    }

    .label {
        font-size: 14px;
        opacity: 0.7;
    }

    .value {
        font-size: 14px;
        text-anchor: middle;
    }

    .left-align {
        text-anchor: start;
    }
</style>