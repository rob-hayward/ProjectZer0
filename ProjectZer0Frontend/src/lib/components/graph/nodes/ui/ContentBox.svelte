<!-- src/lib/components/graph/nodes/ui/ContentBox.svelte -->
<!-- REORGANIZED: Semantic 3-section structure - contentText / inclusionVoting / contentVoting -->
<script lang="ts">
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import type { NodeType } from '$lib/types/graph/enhanced';
    
    export let nodeType: NodeType;
    export let mode: 'preview' | 'detail' = 'detail';
    export let showBorder: boolean = false; // Set to true for layout refinement
    
    // Layout configuration per node type (SINGLE SOURCE OF TRUTH)
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
    
    // ============================================================================
    // LAYOUT RATIOS - Semantic 3-section structure per node type and mode
    // ============================================================================
    // REORGANIZED: contentText / inclusionVoting / contentVoting
    const LAYOUT_RATIOS: Record<string, {
        detail: { contentText: number; inclusionVoting: number; contentVoting: number };
        preview: { contentText: number; inclusionVoting: number; contentVoting: number };
    }> = {
        answer: {
            // Answer node: Text + both voting systems (similar to statement)
            detail: { contentText: 0.40, inclusionVoting: 0.30, contentVoting: 0.30 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        word: {
            // Word node: Simple structure - word display + inclusion voting only
            detail: { contentText: 0.60, inclusionVoting: 0.40, contentVoting: 0 },
            preview: { contentText: 0.50, inclusionVoting: 0.50, contentVoting: 0 }
        },
       definition: {
            // Definition node: Text + both voting systems
            detail: { contentText: 0.40, inclusionVoting: 0.30, contentVoting: 0.30 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        // UPDATED: Statement with new semantic structure (Option B - More Content Text)
        statement: {
            detail: { 
                contentText: 0.40,      // 40% = 170px for statement text (was 30%)
                inclusionVoting: 0.30,  // 30% = 127px for Include/Exclude voting (was 35%)
                contentVoting: 0.30     // 30% = 127px for Agree/Disagree voting (was 35%, still symmetric!)
            },
            preview: { 
                contentText: 0.65,      // Preview: mostly text
                inclusionVoting: 0.35,  // Just inclusion voting in preview
                contentVoting: 0        // No content voting in preview
            }
        },
        openquestion: {
            // Open question: Only inclusion voting (no content voting)
            // More space for content since we have fewer sections
            detail: { contentText: 0.60, inclusionVoting: 0.40, contentVoting: 0 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        quantity: {
            // Quantity node: Question + inclusion voting + visualization/response interface
            detail: { contentText: 0.15, inclusionVoting: 0.15, contentVoting: 0.70 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        evidence: {
            // Evidence node: Details + inclusion voting + peer review system
            detail: { contentText: 0.30, inclusionVoting: 0.30, contentVoting: 0.40 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        comment: {
            // Comment node: Text + content voting only (no inclusion voting)
            detail: { contentText: 0.50, inclusionVoting: 0, contentVoting: 0.50 },
            preview: { contentText: 0.60, inclusionVoting: 0, contentVoting: 0.40 }
        },
        category: {
            // Category node: Category display + stats + hierarchy + inclusion voting only
            detail: { contentText: 0.60, inclusionVoting: 0.40, contentVoting: 0 },
            preview: { contentText: 0.65, inclusionVoting: 0.35, contentVoting: 0 }
        },
        control: {
            // Control node: Content only, no voting
            detail: { contentText: 1.0, inclusionVoting: 0, contentVoting: 0 },
            preview: { contentText: 1.0, inclusionVoting: 0, contentVoting: 0 }
        },
        dashboard: {
            // Dashboard node: Content only, no voting
            detail: { contentText: 1.0, inclusionVoting: 0, contentVoting: 0 },
            preview: { contentText: 1.0, inclusionVoting: 0, contentVoting: 0 }
        },
        default: {
            detail: { contentText: 0.40, inclusionVoting: 0.30, contentVoting: 0.30 },
            preview: { contentText: 0.70, inclusionVoting: 0.30, contentVoting: 0 }
        }
    };
    
    // ============================================================================
    // POSITIONING CONFIGS - Element positions within sections (0-1 fractions)
    // ============================================================================
    // LOGICAL TOP-TO-BOTTOM ORDER: contentText → inclusionVoting → contentVoting
    // Each section contains its elements in vertical order (prompt → buttons → stats)
    //
    // 🔧 FINE-TUNING GUIDE:
    // - Values are fractions (0-1) of section height
    // - For statement detail: inclusionVoting section = 127px tall
    //   * 0.02 = ~2px from top
    //   * 0.25 = ~32px from top
    //   * 0.50 = ~64px from top
    // - Adjust these values in increments of 0.02-0.05 for fine-tuning
    // ============================================================================
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
        // ========================================================================
        // STATEMENT NODE - Primary reference implementation
        // ========================================================================
        statement: {
            detail: {
                // SECTION 1: Content Text (40% = 170px) - Statement display
                contentText: {
                    text: 0.2,              // Text starts at top of section
                    textHeight: 1.0       // Uses full section height
                },
                
                // SECTION 2: Inclusion Voting (30% = 127px) - "Should this exist in the graph?"
                // 🔧 ADJUST THESE VALUES FOR FINE-TUNING:
                inclusionVoting: {
                    prompt: 0.0,          // "Include/Exclude:" prompt (at top)
                    buttons: 0.40,        // [+] vote count [-] buttons (~44px from top)
                    stats: 0.50           // Vote data display (~83px from top)
                },
                
                // SECTION 3: Content Voting (30% = 127px) - "Is this statement accurate?"
                // SYMMETRIC MIRROR of inclusionVoting for visual consistency
                contentVoting: {
                    prompt: 0.0,          // "Agree/Disagree:" prompt (at top)
                    buttons: 0.40,        // [👍] vote count [👎] buttons (~44px from top)
                    stats: 0.50           // Vote data display (~83px from top)
                }
            },
            preview: {
                // SECTION 1: Content Text - Statement display only
                contentText: {
                    text: 0.2,
                    textHeight: 1.0
                },
                
                // SECTION 2: Inclusion Voting - Just buttons, centered
                inclusionVoting: {
                    buttons: 1          // Buttons centered in section
                },
                
                // SECTION 3: Content Voting - Not shown in preview
                contentVoting: {}
            }
        },

        // ========================================================================
        // OPENQUESTION NODE - Inclusion voting only, simpler structure
        // ========================================================================
        openquestion: {
            detail: {
                // SECTION 1: Content Text (60% = 255px) - Question text + answer count
                contentText: {
                    text: 0.2,              // Question text starts at top
                    textHeight: 0.80,       // Uses 80% of section for question text
                    answerCount: 0.85       // Answer count display at 85% down
                },
                
                // SECTION 2: Inclusion Voting (40% = 170px) - "Should this question exist?"
                inclusionVoting: {
                    prompt: 0.0,            // Prompt at top
                    buttons: 0.40,          // Buttons at 40% down (consistent with other nodes)
                    stats: 0.50             // Stats at 50% down (consistent with other nodes)
                },
                
                // SECTION 3: Content Voting - Not applicable for questions
                contentVoting: {}
            },
            preview: {
                // SECTION 1: Content Text - Question display only
                contentText: {
                    text: 0.2,              // Text starts at top
                    textHeight: 1.0         // Uses full section
                },
                
                // SECTION 2: Inclusion Voting - Just buttons, centered
                inclusionVoting: {
                    buttons: 0.5            // Buttons centered in section
                },
                
                // SECTION 3: Content Voting - Not applicable
                contentVoting: {}
            }
        },
        
        // ========================================================================
        // ANSWER NODE - Dual voting structure similar to Statement
        // ========================================================================
        answer: {
            detail: {
                // SECTION 1: Content Text (40% = 170px) - Answer text + instruction
                contentText: {
                    text: 0.2,              // Answer text starts at top
                    textHeight: 1,       // Uses 65% of section for answer text
                },
                
                // SECTION 2: Inclusion Voting (30% = 127px) - "Should this answer exist?"
                inclusionVoting: {
                    prompt: 0.0,            // Prompt at top
                    buttons: 0.40,          // Buttons at 40% down (symmetric with statement)
                    stats: 0.50             // Stats at 50% down (symmetric with statement)
                },
                
                // SECTION 3: Content Voting (30% = 127px) - "Is this answer accurate?"
                contentVoting: {
                    prompt: 0.0,            // Prompt at top
                    buttons: 0.40,          // Buttons at 40% down (symmetric with inclusion)
                    stats: 0.50             // Stats at 50% down (symmetric with inclusion)
                }
            },
            preview: {
                // SECTION 1: Content Text - Answer display only
                contentText: {
                    text: 0.0,              // Text starts at top
                    textHeight: 1.0         // Uses full section
                },
                
                // SECTION 2: Inclusion Voting - Just buttons, centered
                inclusionVoting: {
                    buttons: 0.5            // Buttons centered in section
                },
                
                // SECTION 3: Content Voting - Not shown in preview
                contentVoting: {}
            }
        },

        // ========================================================================
        // QUANTITY NODE - Repurposing contentVoting section for QuantityVisualization
        // ========================================================================
        quantity: {
            detail: {
                // SECTION 1: Content Text (25% = 106px) - Question + unit category
                contentText: {
                    text: 0.0,              // Question text at top
                    textHeight: 0.70,       // Uses 70% for question
                    unitCategory: 0.75      // Unit category label at 75%
                },
                
                // SECTION 2: Inclusion Voting (25% = 106px) - Standard inclusion voting
                inclusionVoting: {
                    prompt: 0.0,            // Prompt at top
                    buttons: 0.40,          // Buttons at 40%
                    stats: 0.50,            // Stats at 50%
                    // Stats width/centering config
                    statsXOffset: 0.15,     // Horizontal offset (15% from left)
                    statsWidth: 0.7         // Use 70% of section width (centered)
                },
                
                // SECTION 3: Content Voting REPURPOSED (50% = 212px) - Visualization + Response Interface
                contentVoting: {
                    responsesHeader: 0.0,           // "Community Responses" header
                    visualization: 0.08,            // Visualization component
                    visualizationHeight: 0.35,      // Height for visualization
                    userResponseHeader: 0.45,       // "Your Response" header
                    currentResponse: 0.52,          // Current response display (if exists)
                    deleteButton: 0.56,             // Delete button (if response exists)
                    inputForm: 0.62,                // Input form (or 0.52 if no existing response)
                    unitSelector: 0.80              // Unit selector dropdown
                }
            },
            preview: {
                // SECTION 1: Content Text - Question display only
                contentText: {
                    text: 0.0,
                    textHeight: 1.0
                },
                
                // SECTION 2: Inclusion Voting - Centered buttons
                inclusionVoting: {
                    buttons: 0.5
                },
                
                // SECTION 3: Content Voting - Not shown in preview
                contentVoting: {}
            }
        },

        // ========================================================================
        // EVIDENCE NODE - Repurposing contentVoting section for Peer Review System
        // ========================================================================
        evidence: {
            detail: {
                // SECTION 1: Content Text (35% = 149px) - Evidence details
                contentText: {
                    title: 0.20,                 // Title at top
                    titleHeight: 0.20,          // 20% for title
                    typeBadge: 0.42,            // Type badge below title
                    authors: 0.55,              // Authors metadata
                    pubDate: 0.62,              // Publication date
                    url: 0.70,                  // URL link
                    description: 0.78,          // Description text
                    descriptionHeight: 0.25,    // Height for description
                    parentLabel: 0.85,          // Parent node label
                    parentTitle: 0.92           // Parent node title
                },
                
                // SECTION 2: Inclusion Voting (25% = 106px) - Standard inclusion voting
                inclusionVoting: {
                    prompt: 0.0,                // Prompt at top
                    buttons: 0.35,              // Buttons at 40%
                    stats: 0.50,                // Stats at 50%
                    statsXOffset: 0.0,         // Center stats
                    statsWidth: 0.7             // 70% width for stats
                },
                
                // SECTION 3: Content Voting REPURPOSED (40% = 170px) - Peer Review System
                contentVoting: {
                    header: 0.0,                // "PEER REVIEW ASSESSMENT" header
                    communityLabel: 0.08,       // "Community Scores" label (if reviews exist)
                    communityScores: 0.13,      // Community scores display
                    noReviews: 0.10,            // "No reviews yet" message (if no reviews)
                    userLabel: 0.42,            // "Your Assessment:" label (with reviews) / 0.20 (no reviews)
                    userScores: 0.48,           // User's scores display (if has review) / 0.26 (no reviews)
                    userButtons: 0.75,          // Update/Clear buttons (with reviews) / 0.63 (no reviews)
                    inputStars: 0.48,           // Star input UI (no user review) / 0.26 (no reviews)
                    submitButton: 0.65,         // Submit button (no user review) / 0.53 (no reviews)
                    errorMessage: 0.75          // Error message (no user review) / 0.63 (no reviews)
                }
            },
            preview: {
                // SECTION 1: Content Text - Title and type badge
                contentText: {
                    text: 0.0,
                    textHeight: 0.70,
                    typeBadge: 0.75
                },
                
                // SECTION 2: Inclusion Voting - Centered buttons
                inclusionVoting: {
                    buttons: 0.5
                },
                
                // SECTION 3: Content Voting - Not shown in preview
                contentVoting: {}
            }
        },

        // ========================================================================
        // WORD NODE - Simplest structure, just word display + inclusion voting
        // ========================================================================
        word: {
            detail: {
                // SECTION 1: Content Text (60% = 255px) - Just the word, centered
                contentText: {
                    word: 0.5              // Word centered vertically in section
                },
                
                // SECTION 2: Inclusion Voting (40% = 170px) - Standard inclusion voting
                inclusionVoting: {
                    prompt: 0.0,           // Prompt at top
                    buttons: 0.40,         // Buttons at 40%
                    stats: 0.50            // Stats at 50%
                },
                
                // SECTION 3: Content Voting - Not applicable for words
                contentVoting: {}
            },
            preview: {
                // SECTION 1: Content Text - Word display, centered
                contentText: {
                    word: 0.5              // Word centered vertically
                },
                
                // SECTION 2: Inclusion Voting - Just buttons, centered
                inclusionVoting: {
                    buttons: 0.5           // Buttons centered in section
                },
                
                // SECTION 3: Content Voting - Not applicable
                contentVoting: {}
            }
        },

        // ========================================================================
        // DEFINITION NODE - Dual voting structure similar to Statement/Answer
        // ========================================================================
        definition: {
            detail: {
                // SECTION 1: Content Text (40% = 170px) - Word + definition + instruction
                contentText: {
                    text: 0.0,              // Word + definition at top
                    textHeight: 0.70,       // Uses 70% for definition text
                    instruction: 0.75       // Instruction text at 75%
                },
                
                // SECTION 2: Inclusion Voting (30% = 127px) - "Should this definition exist?"
                inclusionVoting: {
                    prompt: 0.0,            // Prompt at top
                    buttons: 0.40,          // Buttons at 40% (symmetric with statement)
                    stats: 0.50             // Stats at 50% (symmetric with statement)
                },
                
                // SECTION 3: Content Voting (30% = 127px) - "Is this definition accurate?"
                contentVoting: {
                    prompt: 0.0,            // Prompt at top
                    buttons: 0.40,          // Buttons at 40% (symmetric with inclusion)
                    stats: 0.50             // Stats at 50% (symmetric with inclusion)
                }
            },
            preview: {
                // SECTION 1: Content Text - Word + definition display
                contentText: {
                    text: 0.0,              // Text at top
                    textHeight: 1.0         // Uses full section
                },
                
                // SECTION 2: Inclusion Voting - Just buttons, centered
                inclusionVoting: {
                    buttons: 0.5            // Buttons centered in section
                },
                
                // SECTION 3: Content Voting - Not shown in preview
                contentVoting: {}
            }
        },
        // ========================================================================
        // CATEGORY NODE - Similar to word, but with additional stats and hierarchy
        // ========================================================================
        category: {
            detail: {
                // SECTION 1: Content Text (60% = 255px) - Category name + stats + hierarchy
                contentText: {
                    categoryName: 0.35,        // Category name, centered
                    stats: 0.55,               // Word/content/child counts
                    parentCategory: 0.75,      // Parent category link (if exists)
                    childCategories: 0.85      // Child category links (if exist)
                },
                
                // SECTION 2: Inclusion Voting (40% = 170px) - Standard inclusion voting
                inclusionVoting: {
                    prompt: 0.0,               // Prompt at top
                    buttons: 0.40,             // Buttons at 40%
                    stats: 0.50                // Stats at 50%
                },
                
                // SECTION 3: Content Voting - Not applicable for categories
                contentVoting: {}
            },
            preview: {
                // SECTION 1: Content Text - Category name + brief stats
                contentText: {
                    categoryName: 0.4,         // Category name
                    statsPreview: 0.65         // Brief stats summary
                },
                
                // SECTION 2: Inclusion Voting - Just buttons, centered
                inclusionVoting: {
                    buttons: 0.5               // Buttons centered in section
                },
                
                // SECTION 3: Content Voting - Not applicable
                contentVoting: {}
            }
        },

        // ========================================================================
        // DASHBOARD NODE - Control node, no voting sections
        // ========================================================================
        dashboard: {
            detail: {
                // SECTION 1: Content Text (100% = 425px) - All dashboard content
                contentText: {
                    nameLabel: 0.2,         // Name label at top
                    missionLabel: 0.35,     // Mission statement label at 15%
                    missionHeight: 0.40,    // Height allocated for mission text
                    statsLabel: 0.70        // Activity stats label at 50%
                },
                
                // SECTION 2: Inclusion Voting - Not applicable for dashboard
                inclusionVoting: {},
                
                // SECTION 3: Content Voting - Not applicable for dashboard
                contentVoting: {}
            },
            preview: {
                // SECTION 1: Content Text (100%) - Simplified dashboard preview
                contentText: {
                    nameLabel: 0.0,         // Name label at top
                    missionLabel: 0.25,     // Mission label at 25%
                    missionHeight: 0.70     // Remaining space for mission preview
                },
                
                // SECTION 2: Inclusion Voting - Not applicable
                inclusionVoting: {},
                
                // SECTION 3: Content Voting - Not applicable
                contentVoting: {}
            }
        },

        // ========================================================================
        // CONTROL NODE - Filter control node, no voting sections  
        // ========================================================================
        control: {
            detail: {
                // SECTION 1: Content Text (100%) - All filter UI controls
                // No positioning needed - uses foreignObject with full width/height
                contentText: {},
                
                // SECTION 2: Inclusion Voting - Not applicable for control node
                inclusionVoting: {},
                
                // SECTION 3: Content Voting - Not applicable for control node
                contentVoting: {}
            },
            preview: {
                // SECTION 1: Content Text (100%) - Icon display
                // No positioning needed - uses centered icon
                contentText: {},
                
                // SECTION 2: Inclusion Voting - Not applicable
                inclusionVoting: {},
                
                // SECTION 3: Content Voting - Not applicable
                contentVoting: {}
            }
        },
        
        // ========================================================================
        // DEFAULT - Fallback for unmigrated node types
        // ========================================================================
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
    
    // SINGLE SOURCE OF TRUTH for Y positioning
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
        <!-- Main content box border - white dashed -->
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
        
        <!-- Content Text section border - cyan -->
        <rect
            x={-halfBox}
            y={contentTextY}
            width={boxSize}
            height={contentTextHeight}
            fill="none"
            stroke="rgba(52, 152, 219, 0.6)"
            stroke-width="1"
        />
        
        <!-- Inclusion Voting section border - green -->
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
        
        <!-- Content Voting section border - yellow -->
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
        
        <!-- Dimensions text -->
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