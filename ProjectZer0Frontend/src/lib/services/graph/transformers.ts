// ProjectZer0Frontend/src/lib/services/graph/transformers.ts
import type { WordNode } from '$lib/types/domain/nodes';
import type { UserProfile } from '$lib/types/domain/user';
import type { NavigationOption } from '$lib/types/domain/navigation';
import type { LayoutNode, LayoutLink } from '$lib/types/legacy/layout';

export interface LayoutData {
    nodes: LayoutNode[];
    links: LayoutLink[];
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

    private static getNetVotes(node: WordNode | { positiveVotes?: number; negativeVotes?: number }): number {
        const posVotes = typeof node.positiveVotes === 'number' ? node.positiveVotes : 0;
        const negVotes = typeof node.negativeVotes === 'number' ? node.negativeVotes : 0;
        return posVotes - negVotes;
    }
}