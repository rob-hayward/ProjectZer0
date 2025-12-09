<!-- src/lib/components/graph/nodes/ui/ContentBox.svelte -->
<!-- SEMANTIC STRUCTURE: contentText / inclusionVoting / contentVoting -->
<!--
COORDINATE SYSTEM - SINGLE SOURCE OF TRUTH FOR POSITIONING

After parent transform translate({width/2}, 0):
  • Origin (0,0) = horizontal center, top of content section
  • X axis: 0 = center, positive = right, negative = left  
  • Y axis: 0 = top, positive values go DOWN

POSITIONING VALUES in POSITIONING_CONFIGS are FRACTIONS (0-1):
  • 0.0 = top of section, 0.5 = middle, 1.0 = bottom
  • Child components calculate: y = height * positioning.elementName

TO ADJUST POSITIONING:
  1. Find node type in POSITIONING_CONFIGS below
  2. Adjust fractional values (0-1)
  3. NEVER add positioning logic to child components
-->
<script lang="ts">
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import type { NodeType } from '$lib/types/graph/enhanced';
    
    export let nodeType: NodeType;
    export let mode: 'preview' | 'detail' = 'detail';
    export let showBorder: boolean = false;
    
    // Layout configuration per node type
    const LAYOUT_CONFIGS: Record<string, {
        horizontalPadding: number;
        verticalPadding: number;
        sectionSpacing: number;
        contentTextYOffset: number;
        inclusionVotingYOffset: number;
        contentVotingYOffset: number;
        titleYOffset: number;
        mainTextYOffset: number;
    }> = {
        word: {
            horizontalPadding: 0,
            verticalPadding: 0,
            sectionSpacing: 0,
            contentTextYOffset: 0,
            inclusionVotingYOffset: 0,
            contentVotingYOffset: 0,
            titleYOffset: 0,
            mainTextYOffset: 0
        },
        definition: {
            horizontalPadding: 0,
            verticalPadding: 0,
            sectionSpacing: 0,
            contentTextYOffset: 0,
            inclusionVotingYOffset: 0,
            contentVotingYOffset: 0,
            titleYOffset: 0,
            mainTextYOffset: 0
        },
        statement: {
            horizontalPadding: 0,
            verticalPadding: 0,
            sectionSpacing: 0,
            contentTextYOffset: 0,
            inclusionVotingYOffset: 0,
            contentVotingYOffset: 0,
            titleYOffset: 0,
            mainTextYOffset: 0
        },
        openquestion: {
            horizontalPadding: 0,
            verticalPadding: 0,
            sectionSpacing: 0,
            contentTextYOffset: 0,
            inclusionVotingYOffset: 0,
            contentVotingYOffset: 0,
            titleYOffset: 0,
            mainTextYOffset: 0
        },
        quantity: {
            horizontalPadding: 10,
            verticalPadding: 15,
            sectionSpacing: 8,
            contentTextYOffset: 0,
            inclusionVotingYOffset: -5,
            contentVotingYOffset: -5,
            titleYOffset: 30,
            mainTextYOffset: 60
        },
        comment: {
            horizontalPadding: 10,
            verticalPadding: 10,
            sectionSpacing: 5,
            contentTextYOffset: 0,
            inclusionVotingYOffset: -5,
            contentVotingYOffset: -5,
            titleYOffset: 20,
            mainTextYOffset: 40
        },
        control: {
            horizontalPadding: 15,
            verticalPadding: 10,
            sectionSpacing: 5,
            contentTextYOffset: 0,
            inclusionVotingYOffset: 0,
            contentVotingYOffset: 0,
            titleYOffset: 20,
            mainTextYOffset: 40
        },
        dashboard: {
            horizontalPadding: 10,
            verticalPadding: 20,
            sectionSpacing: 10,
            contentTextYOffset: 0,
            inclusionVotingYOffset: 0,
            contentVotingYOffset: 0,
            titleYOffset: 45,
            mainTextYOffset: 75
        },
        'edit-profile': {
            horizontalPadding: 10,
            verticalPadding: 20,
            sectionSpacing: 10,
            contentTextYOffset: 0,
            inclusionVotingYOffset: 0,
            contentVotingYOffset: 0,
            titleYOffset: 45,
            mainTextYOffset: 75
        },
        'create-node': {
            horizontalPadding: 10,
            verticalPadding: 20,
            sectionSpacing: 10,
            contentTextYOffset: 0,
            inclusionVotingYOffset: 0,
            contentVotingYOffset: 0,
            titleYOffset: 45,
            mainTextYOffset: 75
        },
        'comment-form': {
            horizontalPadding: 10,
            verticalPadding: 20,
            sectionSpacing: 10,
            contentTextYOffset: 0,
            inclusionVotingYOffset: 0,
            contentVotingYOffset: 0,
            titleYOffset: 45,
            mainTextYOffset: 75
        },
        default: {
            horizontalPadding: 10,
            verticalPadding: 20,
            sectionSpacing: 10,
            contentTextYOffset: 0,
            inclusionVotingYOffset: 0,
            contentVotingYOffset: 0,
            titleYOffset: 45,
            mainTextYOffset: 75
        }
    };
    
    // Layout ratios - how much space each section gets (contentText / inclusionVoting / contentVoting)
    const LAYOUT_RATIOS: Record<string, {
        detail: { contentText: number; inclusionVoting: number; contentVoting: number };
        preview: { contentText: number; inclusionVoting: number; contentVoting: number };
    }> = {
        answer: {
            detail: { contentText: 0.40, inclusionVoting: 0.30, contentVoting: 0.30 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        word: {
            detail: { contentText: 0.60, inclusionVoting: 0.40, contentVoting: 0 },
            preview: { contentText: 0.50, inclusionVoting: 0.50, contentVoting: 0 }
        },
        definition: {
            detail: { contentText: 0.40, inclusionVoting: 0.30, contentVoting: 0.30 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        statement: {
            detail: { 
                contentText: 0.40,      // 40% = 170px for statement text
                inclusionVoting: 0.30,  // 30% = 127px for Include/Exclude voting
                contentVoting: 0.30     // 30% = 127px for Agree/Disagree voting
            },
            preview: { 
                contentText: 0.65,
                inclusionVoting: 0.35,
                contentVoting: 0
            }
        },
        openquestion: {
            detail: { contentText: 0.60, inclusionVoting: 0.40, contentVoting: 0 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        quantity: {
            detail: { contentText: 0.15, inclusionVoting: 0.15, contentVoting: 0.70 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        evidence: {
            detail: { contentText: 0.30, inclusionVoting: 0.30, contentVoting: 0.40 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        comment: {
            detail: { contentText: 0.50, inclusionVoting: 0, contentVoting: 0.50 },
            preview: { contentText: 0.60, inclusionVoting: 0, contentVoting: 0.40 }
        },
        category: {
            detail: { contentText: 0.60, inclusionVoting: 0.40, contentVoting: 0 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        control: {
            detail: { contentText: 1.0, inclusionVoting: 0, contentVoting: 0 },
            preview: { contentText: 1.0, inclusionVoting: 0, contentVoting: 0 }
        },
        dashboard: {
            detail: { contentText: 1.0, inclusionVoting: 0, contentVoting: 0 },
            preview: { contentText: 1.0, inclusionVoting: 0, contentVoting: 0 }
        },
        'create-node': {
            detail: { contentText: 1.0, inclusionVoting: 0, contentVoting: 0 },
            preview: { contentText: 1.0, inclusionVoting: 0, contentVoting: 0 }
        },
        default: {
            detail: { contentText: 0.40, inclusionVoting: 0.30, contentVoting: 0.30 },
            preview: { contentText: 0.70, inclusionVoting: 0.30, contentVoting: 0 }
        }
    };
    
    // Positioning configs - element positions within sections (0-1 fractions)
    // Values represent position from top of section: 0.0 = top, 0.5 = middle, 1.0 = bottom
    const POSITIONING_CONFIGS: Record<string, {
        detail: {
            contentText?: Record<string, number>;
            inclusionVoting?: Record<string, number>;
            contentVoting?: Record<string, number>;
        };
        preview: {
            contentText?: Record<string, number>;
            inclusionVoting?: Record<string, number>;
            contentVoting?: Record<string, number>;
        };
    }> = {
        statement: {
            detail: {
                contentText: {
                    text: 0.2,
                    textHeight: 1.0
                },
                inclusionVoting: {
                    prompt: 0.0,
                    buttons: 0.40,
                    stats: 0.50
                },
                contentVoting: {
                    prompt: 0.0,
                    buttons: 0.40,
                    stats: 0.50
                }
            },
            preview: {
                contentText: {
                    text: 0.2,
                    textHeight: 1.0
                },
                inclusionVoting: {
                    buttons: 0.5
                },
                contentVoting: {}
            }
        },

        openquestion: {
            detail: {
                contentText: {
                    text: 0.2,
                    textHeight: 0.80,
                    answerCount: 0.85
                },
                inclusionVoting: {
                    prompt: 0.0,
                    buttons: 0.40,
                    stats: 0.50
                },
                contentVoting: {}
            },
            preview: {
                contentText: {
                    text: 0.2,
                    textHeight: 1.0
                },
                inclusionVoting: {
                    buttons: 0.5
                },
                contentVoting: {}
            }
        },
        
        answer: {
            detail: {
                contentText: {
                    text: 0.2,
                    textHeight: 1
                },
                inclusionVoting: {
                    prompt: 0.0,
                    buttons: 0.40,
                    stats: 0.50
                },
                contentVoting: {
                    prompt: 0.0,
                    buttons: 0.40,
                    stats: 0.50
                }
            },
            preview: {
                contentText: {
                    text: 0.2,
                    textHeight: 1.0
                },
                inclusionVoting: {
                    buttons: 0.5
                },
                contentVoting: {}
            }
        },

        quantity: {
            detail: {
                contentText: {
                    text: 0.0,
                    textHeight: 0.70,
                    unitCategory: 0.75
                },
                inclusionVoting: {
                    prompt: 0.0,
                    buttons: 0.40,
                    stats: 0.50,
                    statsXOffset: 0.15,
                    statsWidth: 0.7
                },
                contentVoting: {
                    responsesHeader: 0.0,
                    visualization: 0.08,
                    visualizationHeight: 0.35,
                    userResponseHeader: 0.45,
                    currentResponse: 0.52,
                    deleteButton: 0.56,
                    inputForm: 0.62,
                    unitSelector: 0.80
                }
            },
            preview: {
                contentText: {
                    text: 0.2,
                    textHeight: 1.0
                },
                inclusionVoting: {
                    buttons: 0.5
                },
                contentVoting: {}
            }
        },

        evidence: {
            detail: {
                contentText: {
                    title: 0.20,
                    titleHeight: 0.20,
                    typeBadge: 0.42,
                    authors: 0.55,
                    pubDate: 0.62,
                    url: 0.70,
                    description: 0.78,
                    descriptionHeight: 0.25,
                    parentLabel: 0.85,
                    parentTitle: 0.92
                },
                inclusionVoting: {
                    prompt: 0.0,
                    buttons: 0.35,
                    stats: 0.50,
                    statsXOffset: 0.0,
                    statsWidth: 0.7
                },
                contentVoting: {
                    header: 0.0,
                    communityLabel: 0.08,
                    communityScores: 0.13,
                    noReviews: 0.10,
                    userLabel: 0.42,
                    userScores: 0.48,
                    userButtons: 0.75,
                    inputStars: 0.48,
                    submitButton: 0.65,
                    errorMessage: 0.75
                }
            },
            preview: {
                contentText: {
                    text: 0.0,
                    textHeight: 0.20,
                    typeBadge: 0.75
                },
                inclusionVoting: {
                    buttons: 0.5
                },
                contentVoting: {}
            }
        },

        word: {
            detail: {
                contentText: {
                    word: 0.5
                },
                inclusionVoting: {
                    prompt: 0.0,
                    buttons: 0.40,
                    stats: 0.50
                },
                contentVoting: {}
            },
            preview: {
                contentText: {
                    word: 0.5
                },
                inclusionVoting: {
                    buttons: 0.5
                },
                contentVoting: {}
            }
        },

        definition: {
            detail: {
                contentText: {
                    text: 0.2,
                    textHeight: 0.70,
                    instruction: 0.75
                },
                inclusionVoting: {
                    prompt: 0.0,
                    buttons: 0.40,
                    stats: 0.50
                },
                contentVoting: {
                    prompt: 0.0,
                    buttons: 0.40,
                    stats: 0.50
                }
            },
            preview: {
                contentText: {
                    text: 0.0,
                    textHeight: 1.0
                },
                inclusionVoting: {
                    buttons: 0.5
                },
                contentVoting: {}
            }
        },

        category: {
            detail: {
                contentText: {
                    categoryName: 0.35,
                    stats: 0.55,
                    parentCategory: 0.75,
                    childCategories: 0.85
                },
                inclusionVoting: {
                    prompt: 0.0,
                    buttons: 0.40,
                    stats: 0.50
                },
                contentVoting: {}
            },
            preview: {
                contentText: {
                    categoryName: 0.4,
                    statsPreview: 0.65
                },
                inclusionVoting: {
                    buttons: 0.5
                },
                contentVoting: {}
            }
        },

        dashboard: {
            detail: {
                contentText: {
                    nameLabel: 0.2,
                    missionLabel: 0.35,
                    missionHeight: 0.40,
                    statsLabel: 0.70
                },
                inclusionVoting: {},
                contentVoting: {}
            },
            preview: {
                contentText: {
                    nameLabel: 0.0,
                    missionLabel: 0.25,
                    missionHeight: 0.70
                },
                inclusionVoting: {},
                contentVoting: {}
            }
        },

        control: {
            detail: {
                contentText: {},
                inclusionVoting: {},
                contentVoting: {}
            },
            preview: {
                contentText: {},
                inclusionVoting: {},
                contentVoting: {}
            }
        },

        'create-node': {
            detail: {
                contentText: {
                    label: 0.10,            // Label positioned above the input
                    dropdown: 0.20,         // Dropdown position (for steps 1-2)
                    dropdownHeight: 0.20,   // Dropdown height allocation
                    textarea: 0.20,         // Textarea position (same as dropdown)
                    textareaHeight: 0.30,   // Textarea height allocation
                    infoText: 0.80,         // Helper text
                    button: 0.72,            // Action button
                    reviewContainer: 0.05,  // Start at 5% from top
                    reviewContainerHeight: 0.85 // Allocate 65% height
                },
                inclusionVoting: {},
                contentVoting: {}
            },
            preview: {
                contentText: {},
                inclusionVoting: {},
                contentVoting: {}
            }
        },
        
        default: {
            detail: {
                contentText: {},
                inclusionVoting: {},
                contentVoting: {}
            },
            preview: {
                contentText: {},
                inclusionVoting: {},
                contentVoting: {}
            }
        }
    };
    
    // Get layout config for current node type
    $: layoutConfig = LAYOUT_CONFIGS[nodeType] || LAYOUT_CONFIGS.default;
    
    // Get ratios for current node type and mode
    $: currentRatios = (LAYOUT_RATIOS[nodeType] || LAYOUT_RATIOS.default)[mode];
    
    // Get positioning config for current node type and mode
    $: currentPositioning = (POSITIONING_CONFIGS[nodeType] || POSITIONING_CONFIGS.default)[mode];
    
    // Allow overrides via props
    export let horizontalPadding: number | undefined = undefined;
    export let verticalPadding: number | undefined = undefined;
    export let sectionSpacing: number | undefined = undefined;
    export let contentTextYOffset: number | undefined = undefined;
    export let inclusionVotingYOffset: number | undefined = undefined;
    export let contentVotingYOffset: number | undefined = undefined;
    
    // Use prop overrides if provided, otherwise use config defaults
    $: finalHorizontalPadding = horizontalPadding ?? layoutConfig.horizontalPadding;
    $: finalVerticalPadding = verticalPadding ?? layoutConfig.verticalPadding;
    $: finalSectionSpacing = sectionSpacing ?? layoutConfig.sectionSpacing;
    $: finalContentTextYOffset = contentTextYOffset ?? layoutConfig.contentTextYOffset;
    $: finalInclusionVotingYOffset = inclusionVotingYOffset ?? layoutConfig.inclusionVotingYOffset;
    $: finalContentVotingYOffset = contentVotingYOffset ?? layoutConfig.contentVotingYOffset;
    
    // Get appropriate content box size
    $: boxSize = getContentBoxSize(nodeType, mode);
    $: halfBox = boxSize / 2;
    
    function getContentBoxSize(type: NodeType, currentMode: 'preview' | 'detail'): number {
        const sizeMap = COORDINATE_SPACE.CONTENT_BOXES;
        
        switch(type) {
            case 'word': return currentMode === 'detail' ? sizeMap.WORD.DETAIL : sizeMap.WORD.PREVIEW;
            case 'definition': return currentMode === 'detail' ? sizeMap.DEFINITION.DETAIL : sizeMap.DEFINITION.PREVIEW;
            case 'statement': return currentMode === 'detail' ? sizeMap.STATEMENT.DETAIL : sizeMap.STATEMENT.PREVIEW;
            case 'openquestion': return currentMode === 'detail' ? sizeMap.OPENQUESTION.DETAIL : sizeMap.OPENQUESTION.PREVIEW;
            case 'quantity': return currentMode === 'detail' ? sizeMap.QUANTITY.DETAIL : sizeMap.QUANTITY.PREVIEW;
            case 'comment': return currentMode === 'detail' ? sizeMap.COMMENT.DETAIL : sizeMap.COMMENT.PREVIEW;
            case 'control': return currentMode === 'detail' ? sizeMap.CONTROL.DETAIL : sizeMap.CONTROL.PREVIEW;
            case 'dashboard': return currentMode === 'detail' ? sizeMap.DASHBOARD.DETAIL : sizeMap.DASHBOARD.PREVIEW;
            default: return currentMode === 'detail' ? sizeMap.STANDARD.DETAIL : sizeMap.STANDARD.PREVIEW;
        }
    }
    
    // Layout sections within the box using mode-specific ratios
    $: contentTextHeight = Math.floor(boxSize * currentRatios.contentText);
    $: inclusionVotingHeight = Math.floor(boxSize * currentRatios.inclusionVoting);
    $: contentVotingHeight = Math.floor(boxSize * currentRatios.contentVoting);
    
    // Y positioning - single source of truth
    $: contentTextBaseY = -halfBox;
    $: inclusionVotingBaseY = contentTextBaseY + contentTextHeight + finalSectionSpacing;
    $: contentVotingBaseY = inclusionVotingBaseY + inclusionVotingHeight + finalSectionSpacing;
    
    // Final positions with offsets
    $: contentTextY = contentTextBaseY + finalContentTextYOffset;
    $: inclusionVotingY = inclusionVotingBaseY + finalInclusionVotingYOffset;
    $: contentVotingY = contentVotingBaseY + finalContentVotingYOffset;
    
    // X positioning
    $: sectionX = -halfBox + finalHorizontalPadding;
    $: sectionWidth = boxSize - (finalHorizontalPadding * 2);
    
    interface $$Slots {
        contentText: {
            x: number;
            y: number;
            width: number;
            height: number;
            layoutConfig: typeof layoutConfig;
            positioning: Record<string, number>;
        };
        inclusionVoting: {
            x: number;
            y: number;
            width: number;
            height: number;
            layoutConfig: typeof layoutConfig;
            positioning: Record<string, number>;
        };
        contentVoting: {
            x: number; 
            y: number;
            width: number;
            height: number;
            layoutConfig: typeof layoutConfig;
            positioning: Record<string, number>;
        };
    }
</script>

<g class="content-box" data-box-size={boxSize}>
    {#if showBorder}
        <!-- Main content box border -->
        <rect
            x={-halfBox}
            y={-halfBox}
            width={boxSize}
            height={boxSize}
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            stroke-width="2"
            stroke-dasharray="8,4"
        />
        
        <!-- Section borders -->
        <rect
            x={-halfBox}
            y={contentTextY}
            width={boxSize}
            height={contentTextHeight}
            fill="none"
            stroke="rgba(52, 152, 219, 0.6)"
            stroke-width="1"
        />
        
        {#if inclusionVotingHeight > 0}
            <rect
                x={-halfBox}
                y={inclusionVotingY}
                width={boxSize}
                height={inclusionVotingHeight}
                fill="none"
                stroke="rgba(46, 204, 113, 0.6)"
                stroke-width="1"
            />
        {/if}
        
        {#if contentVotingHeight > 0}
            <rect
                x={-halfBox}
                y={contentVotingY}
                width={boxSize}
                height={contentVotingHeight}
                fill="none"
                stroke="rgba(241, 196, 15, 0.6)"
                stroke-width="1"
            />
        {/if}
        
        <!-- Section labels -->
        <text
            x={-halfBox + 5}
            y={contentTextY + 12}
            style:font-family="Inter"
            style:font-size="10px"
            style:fill="rgba(52, 152, 219, 0.8)"
            style:font-weight="500"
        >
            CONTENT TEXT ({Math.round(currentRatios.contentText * 100)}% = {contentTextHeight}px)
        </text>
        
        {#if inclusionVotingHeight > 0}
            <text
                x={-halfBox + 5}
                y={inclusionVotingY + 12}
                style:font-family="Inter"
                style:font-size="10px"
                style:fill="rgba(46, 204, 113, 0.8)"
                style:font-weight="500"
            >
                INCLUSION VOTING ({Math.round(currentRatios.inclusionVoting * 100)}% = {inclusionVotingHeight}px)
            </text>
        {/if}
        
        {#if contentVotingHeight > 0}
            <text
                x={-halfBox + 5}
                y={contentVotingY + 12}
                style:font-family="Inter"
                style:font-size="10px"
                style:fill="rgba(241, 196, 15, 0.8)"
                style:font-weight="500"
            >
                CONTENT VOTING ({Math.round(currentRatios.contentVoting * 100)}% = {contentVotingHeight}px)
            </text>
        {/if}
        
        <!-- Dimensions -->
        <text
            x="0"
            y={-halfBox - 5}
            style:font-family="Inter"
            style:font-size="8px"
            style:fill="rgba(255, 255, 255, 0.6)"
            style:text-anchor="middle"
            style:font-weight="400"
        >
            {boxSize}×{boxSize} ({nodeType} {mode})
        </text>
    {/if}
    
    <g class="content-text-section">
        <slot 
            name="contentText"
            x={sectionX}
            y={contentTextY}
            width={sectionWidth}
            height={contentTextHeight}
            {layoutConfig}
            positioning={currentPositioning.contentText || {}}
        />
    </g>
    
    {#if inclusionVotingHeight > 0}
        <g class="inclusion-voting-section">
            <slot
                name="inclusionVoting" 
                x={sectionX}
                y={inclusionVotingY}
                width={sectionWidth}
                height={inclusionVotingHeight}
                {layoutConfig}
                positioning={currentPositioning.inclusionVoting || {}}
            />
        </g>
    {/if}
    
    {#if contentVotingHeight > 0}
        <g class="content-voting-section">
            <slot
                name="contentVoting"
                x={sectionX}
                y={contentVotingY}
                width={sectionWidth}
                height={contentVotingHeight}
                {layoutConfig}
                positioning={currentPositioning.contentVoting || {}}
            />
        </g>
    {/if}
</g>

<style>
    .content-box {
        transform-origin: center;
    }
</style>