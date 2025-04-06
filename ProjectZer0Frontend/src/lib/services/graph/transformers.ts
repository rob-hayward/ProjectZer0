// ProjectZer0Frontend/src/lib/services/graph/transformers.ts
import type { WordNode, StatementNode } from '$lib/types/domain/nodes';
import type { UserProfile } from '$lib/types/domain/user';
import type { NavigationOption } from '$lib/types/domain/navigation';
import type { LayoutNode, LayoutLink } from '$lib/types/graph/enhanced';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import { statementNetworkStore } from '$lib/stores/statementNetworkStore';

export interface LayoutData {
    nodes: LayoutNode[];
    links: LayoutLink[];
}

// Extend the StatementNode type to include the netVotes property
interface EnhancedStatementNode extends StatementNode {
    netVotes?: number;
}

export class GraphLayoutTransformer {
    static transformDashboardView(
        user: UserProfile,
        navigationOptions: NavigationOption[]
    ): LayoutData {
        const centralNode: LayoutNode = {
            id: user.sub,
            type: 'central',
            metadata: {
                group: 'central',
                fixed: true
            }
        };

        const navigationNodes: LayoutNode[] = navigationOptions.map(option => ({
            id: option.id,
            type: 'navigation',
            metadata: {
                group: 'navigation'
            }
        }));

        return {
            nodes: [centralNode, ...navigationNodes],
            links: [] // Dashboard view doesn't need explicit links
        };
    }

    static transformWordView(
        wordNode: WordNode,
        navigationOptions: NavigationOption[],
        showAllDefinitions: boolean
    ): LayoutData {
        // Central word node
        const centralNode: LayoutNode = {
            id: wordNode.id,
            type: 'word',
            metadata: {
                votes: this.getNetVotes(wordNode),
                createdAt: wordNode.createdAt,
                group: 'central',
                fixed: true
            }
        };

        // Navigation nodes
        const navigationNodes: LayoutNode[] = navigationOptions.map(option => ({
            id: option.id,
            type: 'navigation',
            metadata: {
                group: 'navigation'
            }
        }));

        // Definition nodes
        const definitions = showAllDefinitions ? wordNode.definitions : 
            [wordNode.definitions[0]]; // Just live definition if not showing all

        const definitionNodes: LayoutNode[] = definitions.map((def, index) => ({
            id: def.id,
            type: 'definition',
            subtype: index === 0 ? 'live' : 'alternative',
            metadata: {
                votes: this.getNetVotes(def),
                createdAt: def.createdAt,
                group: 'definition'
            }
        }));

        // Create links from word to definitions
        const definitionLinks: LayoutLink[] = definitions.map((def, index) => ({
            source: wordNode.id,
            target: def.id,
            type: 'definition',
            strength: index === 0 ? 1 : 0.7 // Stronger connection to live definition
        }));

        return {
            nodes: [centralNode, ...navigationNodes, ...definitionNodes],
            links: definitionLinks
        };
    }

    static transformStatementNetworkView(
        rawStatements: StatementNode[],
        controlNode: any,
        navigationOptions: NavigationOption[],
        visibilityPreferences: Record<string, boolean> = {}
    ): LayoutData {
        // Cast statements to the enhanced type that includes netVotes
        const statements = rawStatements as EnhancedStatementNode[];
        
        console.log('[GraphLayoutTransformer] Starting statement network transformation with', statements.length, 'statements');

        // Central control node
        const centralNode: LayoutNode = {
            id: controlNode.id,
            type: 'dashboard',
            metadata: {
                group: 'central',
                fixed: true
            }
        };

        // Navigation nodes
        const navigationNodes: LayoutNode[] = navigationOptions.map(option => ({
            id: option.id,
            type: 'navigation',
            metadata: {
                group: 'navigation'
            }
        }));

        // Statement nodes - use statementNetworkStore as the single source of truth
        const statementNodes: LayoutNode[] = statements.map(statement => {
            // Get vote data from the statementNetworkStore - single source of truth
            const voteData = statementNetworkStore.getVoteData(statement.id);
            
            // Determine visibility
            const shouldBeHiddenByCommunity = voteData.shouldBeHidden;
            const userPreference = visibilityPreferences[statement.id];
            const isHidden = userPreference !== undefined ? 
                !userPreference : shouldBeHiddenByCommunity;
            
            return {
                id: statement.id,
                type: 'statement',
                metadata: {
                    votes: voteData.netVotes,
                    positiveVotes: voteData.positiveVotes,
                    negativeVotes: voteData.negativeVotes,
                    createdAt: statement.createdAt,
                    group: 'statement',
                    isHidden: isHidden,
                    hiddenReason: userPreference !== undefined ? 'user' : 'community'
                }
            };
        });

        // Log visibility summary
        const visibilitySummary = {
            total: statementNodes.length,
            hidden: statementNodes.filter(n => n.metadata.isHidden).length,
            visible: statementNodes.filter(n => !n.metadata.isHidden).length,
            negativeNetVotes: statementNodes.filter(n => (n.metadata.votes || 0) < 0).length,
            userOverrides: statementNodes.filter(n => n.metadata.hiddenReason === 'user').length
        };
        
        console.log('[GraphLayoutTransformer] Statement visibility summary:', visibilitySummary);

        // Create statement relationship links
        const statementLinks: LayoutLink[] = [];
        // For each statement that has related statements
        statements.forEach(statement => {
            if (statement.relatedStatements && statement.relatedStatements.length > 0) {
                // For each related statement
                statement.relatedStatements.forEach(related => {
                    // Only add link if target statement exists in our filtered statements
                    const targetExists = statements.some(s => s.id === related.nodeId);
                    if (targetExists) {
                        // Create a unique key for this link to avoid duplicates
                        const [sourceId, targetId] = [statement.id, related.nodeId].sort();
                        const linkKey = `${sourceId}-${targetId}`;
                        
                        // Only add if not already added (to avoid duplicates)
                        const linkExists = statementLinks.some(link => 
                            (link.source === sourceId && link.target === targetId) ||
                            (link.source === targetId && link.target === sourceId)
                        );
                        
                        if (!linkExists) {
                            // Create a LayoutLink with only the properties defined in the interface
                            const layoutLink: LayoutLink = {
                                source: statement.id,
                                target: related.nodeId,
                                type: 'related',
                                strength: related.strength || 0.5
                            };
                            
                            // Store the sharedWord in the metadata instead
                            // This avoids type errors while still preserving the relationship data
                            (layoutLink as any).metadata = {
                                sharedWord: related.sharedWord
                            };
                            
                            statementLinks.push(layoutLink);
                        }
                    }
                });
            }
        });

        return {
            nodes: [centralNode, ...navigationNodes, ...statementNodes],
            links: statementLinks
        };
    }

    // Calculate net votes - use for non-statement nodes only (word/definition)
    private static getNetVotes(node: WordNode | { positiveVotes?: any; negativeVotes?: any; }): number {
        // First try to directly get the netVotes property if it exists
        const netVotesValue = getNeo4jNumber((node as any).netVotes);
        if (netVotesValue !== 0) {
            return netVotesValue;
        }
        
        // If no netVotes or it's zero, calculate from positive/negative
        const posVotes = getNeo4jNumber(node.positiveVotes);
        const negVotes = getNeo4jNumber(node.negativeVotes);
        return posVotes - negVotes;
    }
}