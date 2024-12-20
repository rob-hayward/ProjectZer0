<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/dashboard/DashboardNode.svelte -->
<script lang="ts">
    import BaseSvgDetailNode from '../base/BaseDetailNode.svelte';
    import type { UserProfile } from '$lib/types/user';
    import type { UserActivity } from '$lib/services/userActivity';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import { COLORS } from '$lib/constants/colors';

    export let node: UserProfile;
    export let userActivity: UserActivity | undefined;

    const highlightColor = COLORS.UI.TEXT.PRIMARY;
    const CONTENT_WIDTH = 350;
    const METRICS_SPACING = {
        labelX: -200,  // Moved further left
        equalsX: 0,
        valueX: 30
    };

    // Function to wrap text for SVG
    function getWrappedText(text: string, maxWidth: number, x: number) {
        const words = text.split(' ');
        const lines: { text: string; x: number; dy: number }[] = [];
        let currentLine = '';
        let lineCount = 0;

        const tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tempText.style.fontSize = '14px';
        tempText.style.fontFamily = 'Orbitron, sans-serif';
        document.body.appendChild(tempText);

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            tempText.textContent = testLine;
            const testWidth = tempText.getBoundingClientRect().width;

            if (testWidth > maxWidth && currentLine !== '') {
                lines.push({
                    text: currentLine,
                    x,
                    dy: lineCount * 20 // 20px line height
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

        document.body.removeChild(tempText);
        return lines;
    }

    $: missionStatementLines = getWrappedText(
        node.mission_statement || "no mission statement set.",
        200, // Maximum width for wrapped text
        METRICS_SPACING.labelX
    );

    const style = {
        previewSize: NODE_CONSTANTS.SIZES.WORD.detail,
        detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
        colors: {
            background: NODE_CONSTANTS.COLORS.WORD.background,
            border: NODE_CONSTANTS.COLORS.WORD.border,
            text: NODE_CONSTANTS.COLORS.WORD.text,
            hover: NODE_CONSTANTS.COLORS.WORD.hover,
            gradient: NODE_CONSTANTS.COLORS.WORD.gradient
        },
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: {
            preview: NODE_CONSTANTS.STROKE.preview,
            detail: NODE_CONSTANTS.STROKE.detail
        }
    };
</script>

<BaseSvgDetailNode {style}>
    <svelte:fragment let:radius let:isHovered>
        <!-- Title -->
        <text 
            dy={-radius + 120} 
            class="title"
        >
            ProjectZer0
        </text>

        <!-- Name -->
        <g transform="translate(0, {-radius + 180})">
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
        <g transform="translate(0, {-radius + 260})">
            <text 
                x={METRICS_SPACING.labelX}
                class="label left-align"
            >
                mission statement:
            </text>
            {#each missionStatementLines as line}
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
            <g transform="translate(0, {-radius + 340})">
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