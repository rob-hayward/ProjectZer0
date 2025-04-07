// ProjectZer0Frontend/src/lib/services/graph/GraphLayoutTransformer.ts
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
                createdAt: this.normalizeDate(wordNode.createdAt),
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
                createdAt: this.normalizeDate(def.createdAt),
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
            
            // Normalize the date to a consistent format
            const normalizedDate = this.normalizeDate(statement.createdAt);
            
            return {
                id: statement.id,
                type: 'statement',
                metadata: {
                    votes: voteData.netVotes,
                    positiveVotes: voteData.positiveVotes,
                    negativeVotes: voteData.negativeVotes,
                    createdAt: normalizedDate,
                    group: 'statement',
                    isHidden: isHidden,
                    hiddenReason: userPreference !== undefined ? 'user' : 'community'
                }
            };
        });

        // Create statement relationship links - MODIFIED to consolidate links
        // Create a map to track links between node pairs
        const linkMap = new Map<string, LayoutLink>();

        statements.forEach(statement => {
            if (statement.relatedStatements && statement.relatedStatements.length > 0) {
                statement.relatedStatements.forEach(related => {
                    // Only add link if target statement exists in our filtered statements
                    const targetExists = statements.some(s => s.id === related.nodeId);
                    if (targetExists) {
                        // Create consistent link key (always sort IDs for uniqueness)
                        const [sourceId, targetId] = [statement.id, related.nodeId].sort();
                        const linkKey = `${sourceId}-${targetId}`;
                        
                        if (linkMap.has(linkKey)) {
                            // Update existing link
                            const existingLink = linkMap.get(linkKey)!;
                            const metadata = (existingLink as any).metadata || { sharedWords: [] };
                            
                            // Add the shared word if not already included
                            if (!metadata.sharedWords.includes(related.sharedWord)) {
                                metadata.sharedWords.push(related.sharedWord);
                            }
                            
                            // Increment relationship count
                            metadata.relationCount = metadata.sharedWords.length;
                            
                            // Use the maximum strength for the consolidated link
                            existingLink.strength = Math.max(existingLink.strength || 0.5, related.strength || 0.5);
                            
                            // Update metadata
                            (existingLink as any).metadata = metadata;
                        } else {
                            // Create new link
                            const layoutLink: LayoutLink = {
                                source: statement.id,
                                target: related.nodeId,
                                type: 'related',
                                strength: related.strength || 0.5
                            };
                            
                            // Initialize metadata
                            (layoutLink as any).metadata = {
                                sharedWords: [related.sharedWord],
                                relationCount: 1
                            };
                            
                            linkMap.set(linkKey, layoutLink);
                        }
                    }
                });
            }
        });

        // Convert map to array for the final links
        const statementLinks: LayoutLink[] = Array.from(linkMap.values());

        return {
            nodes: [centralNode, ...navigationNodes, ...statementNodes],
            links: statementLinks
        };
    }

    /**
     * Helper function to normalize date format for consistent ISO strings
     */
    private static normalizeDate(dateInput: any): string | undefined {
        if (!dateInput) return undefined;
        
        try {
            // Handle Neo4j integer format
            if (typeof dateInput === 'object' && dateInput !== null && 'low' in dateInput) {
                const date = new Date(dateInput.low * 1000);
                return !isNaN(date.getTime()) ? date.toISOString() : undefined;
            }
            
            // Handle string date
            if (typeof dateInput === 'string') {
                const date = new Date(dateInput);
                return !isNaN(date.getTime()) ? date.toISOString() : undefined;
            }
            
            // Handle timestamp number
            if (typeof dateInput === 'number') {
                const date = new Date(dateInput);
                return !isNaN(date.getTime()) ? date.toISOString() : undefined;
            }
            
            return undefined;
        } catch (e) {
            console.warn(`[GraphLayoutTransformer] Invalid date format: ${dateInput}`, e);
            return undefined;
        }
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