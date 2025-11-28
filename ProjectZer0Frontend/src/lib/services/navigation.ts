// ProjectZer0Frontend/src/lib/services/navigation.ts
import { get } from 'svelte/store';
import * as auth0 from './auth0';
import type { NavigationOption } from '$lib/types/domain/navigation';
import { wordStore } from '$lib/stores/wordStore';
import { openQuestionStore } from '$lib/stores/openQuestionStore';
import { graphStore } from '$lib/stores/graphStore';
import type { ViewType } from '$lib/types/graph/enhanced';

export const NavigationOptionId = {
    DASHBOARD: 'dashboard',
    CREATE_NODE: 'create-node',
    EDIT_PROFILE: 'edit-profile',
    GRAPH_CONTROLS: 'graph-controls',  // NEW: For universal graph controls
    DONATE: 'donate',  // NEW: Donation link
    EXPLORE: 'explore',
    NETWORK: 'network',
    INTERACTIONS: 'interactions',
    CREATIONS: 'creations',
    LOGOUT: 'logout',
    ALTERNATIVE_DEFINITIONS: 'alternative-definitions',
    CREATE_DEFINITION: 'create-definition', 
    DISCUSS: 'discuss',
    QUESTIONS: 'questions',
    UNIVERSAL_GRAPH: 'universal-graph'
} as const;

export type NavigationOptionId = typeof NavigationOptionId[keyof typeof NavigationOptionId];

// Helper function for word-related navigation
function navigateWithWord(path: string) {
    const currentWord = get(wordStore);
    if (currentWord) {
        const url = `${path}?word=${encodeURIComponent(currentWord.word)}`;
        window.location.href = url;
    }
}

// Helper function for question-related navigation
function navigateWithQuestion(path: string) {
    const currentQuestion = get(openQuestionStore);
    if (currentQuestion) {
        const url = `${path}?id=${encodeURIComponent(currentQuestion.id)}`;
        window.location.href = url;
    }
}

// Map navigation options to view types for graph state updates
const navigationViewTypeMap: Partial<Record<NavigationOptionId, ViewType>> = {
    [NavigationOptionId.DASHBOARD]: 'dashboard',
    [NavigationOptionId.CREATE_NODE]: 'create-node',
    [NavigationOptionId.EDIT_PROFILE]: 'edit-profile',
    [NavigationOptionId.NETWORK]: 'network',
    [NavigationOptionId.CREATE_DEFINITION]: 'create-definition',
    [NavigationOptionId.EXPLORE]: 'statement-network',
    [NavigationOptionId.DISCUSS]: 'discussion',
    [NavigationOptionId.QUESTIONS]: 'openquestion',
    [NavigationOptionId.UNIVERSAL_GRAPH]: 'universal',
};

// Helper to update graph store without TypeScript errors
function updateGraphStore(viewType: ViewType): void {
    if (!graphStore) {
        console.warn('[Navigation] Graph store not available');
        return;
    }
    
    console.log(`[Navigation] Updating graph store to: ${viewType}`);
    graphStore.setViewType(viewType);
    
    try {
        graphStore.forceTick();
    } catch (e) {
        console.warn('[Navigation] Error calling forceTick:', e);
    }
}

export function getNodeDiscussionEndpoint(
    nodeType: string, 
    nodeId: string, 
    nodeText?: string,
    nodeObject?: any
  ): string {
    switch (nodeType) {
      case 'statement':
      case 'quantity':
      case 'openquestion':
        return `/nodes/${nodeType}/${nodeId}/discussion`;
      case 'word':
        if (nodeObject && nodeObject.word) {
          return `/nodes/word/${nodeObject.word}/discussion`;
        } else if (nodeText) {
          return `/nodes/word/${nodeText}/discussion`;
        } else {
          console.warn('Word node requires word text for discussion endpoint');
          return '';
        }
      case 'definition':
        return `/definitions/${nodeId}/discussion`;
      default:
        console.warn(`Unknown node type: ${nodeType}`);
        return '';
    }
  }

export function getNodeCommentsEndpoint(
    nodeType: string, 
    nodeId: string, 
    nodeText?: string,
    nodeObject?: any
  ): string {
    switch (nodeType) {
      case 'statement':
      case 'quantity':
      case 'openquestion':
        return `/nodes/${nodeType}/${nodeId}/comments`;
      case 'word':
        if (nodeObject && nodeObject.word) {
          return `/nodes/word/${nodeObject.word}/comments`;
        } else if (nodeText) {
          return `/nodes/word/${nodeText}/comments`;
        } else {
          console.warn('Word node requires word text for comments endpoint');
          return '';
        }
      case 'definition':
        return `/definitions/${nodeId}/comments`;
      default:
        console.warn(`Unknown node type: ${nodeType}`);
        return '';
    }
  }

export function getNodeDataEndpoint(
    nodeType: string, 
    nodeId: string, 
    nodeText?: string
  ): string {
    switch (nodeType) {
      case 'statement':
      case 'quantity':
      case 'openquestion':
        return `/nodes/${nodeType}/${nodeId}`;
      case 'word':
        return `/nodes/word/id/${nodeId}`;
      case 'definition':
        return `/definitions/${nodeId}`;
      default:
        console.warn(`Unknown node type: ${nodeType}`);
        return '';
    }
  }

export function navigateToNodeDiscussion(nodeType: string, nodeId: string, nodeText?: string): void {
    console.log(`[Navigation] Navigating to discussion for ${nodeType} node: ${nodeId}`);
    
    updateGraphStore('discussion');
    
    const useId = nodeType === 'word' && nodeText ? nodeText : nodeId;
    
    window.location.href = `/graph/discussion/${nodeType}/${useId}`;
}

// UPDATED: Navigation action handlers - DASHBOARD, EDIT_PROFILE, CREATE_NODE, GRAPH_CONTROLS now dispatch events instead of navigating
const navigationHandlers: Record<NavigationOptionId, () => void> = {
    // UPDATED: Dispatch event for central node switching (no page navigation)
    [NavigationOptionId.DASHBOARD]: () => {
        console.log('[Navigation] Dashboard clicked - dispatching event');
        window.dispatchEvent(new CustomEvent('navigation-node-click', {
            detail: { optionId: NavigationOptionId.DASHBOARD }
        }));
    },
    
    // UPDATED: Dispatch event for central node switching (no page navigation)
    [NavigationOptionId.EDIT_PROFILE]: () => {
        console.log('[Navigation] Edit Profile clicked - dispatching event');
        window.dispatchEvent(new CustomEvent('navigation-node-click', {
            detail: { optionId: NavigationOptionId.EDIT_PROFILE }
        }));
    },
    
    // UPDATED: Dispatch event for central node switching (no page navigation)
    [NavigationOptionId.CREATE_NODE]: () => {
        console.log('[Navigation] Create Node clicked - dispatching event');
        window.dispatchEvent(new CustomEvent('navigation-node-click', {
            detail: { optionId: NavigationOptionId.CREATE_NODE }
        }));
    },
    
    // NEW: Dispatch event for returning to graph controls (control node)
    [NavigationOptionId.GRAPH_CONTROLS]: () => {
        console.log('[Navigation] Graph Controls clicked - dispatching event');
        window.dispatchEvent(new CustomEvent('navigation-node-click', {
            detail: { optionId: NavigationOptionId.GRAPH_CONTROLS }
        }));
    },
    
    // NEW: Donate handler (external link)
    [NavigationOptionId.DONATE]: () => {
        console.log('[Navigation] Donate clicked - opening external link');
        window.open('https://donate.projectzer0.co', '_blank');
    },
    
    [NavigationOptionId.EXPLORE]: () => {
        updateGraphStore('statement-network');
        window.location.href = '/graph/statement-network';
    },
    [NavigationOptionId.NETWORK]: () => {
        updateGraphStore('network');
        window.location.href = '/graph/network';
    },
    [NavigationOptionId.INTERACTIONS]: () => {
        window.location.href = '/interactions';
    },
    [NavigationOptionId.CREATIONS]: () => {
        window.location.href = '/creations';
    },
    [NavigationOptionId.LOGOUT]: () => auth0.logout(),
    [NavigationOptionId.ALTERNATIVE_DEFINITIONS]: () => navigateWithWord('/graph/alternative-definitions'),
    [NavigationOptionId.CREATE_DEFINITION]: () => {
        const currentWord = get(wordStore);
        console.log(`[Navigation] CREATE_DEFINITION handler called, currentWord:`, currentWord);
        
        if (currentWord) {
            updateGraphStore('create-definition');
            console.log(`[Navigation] Navigating to create definition for word: ${currentWord.word}`);
            window.location.href = `/graph/create-definition?word=${encodeURIComponent(currentWord.word)}`;
        } else {
            console.warn('[Navigation] No word in store, checking URL for word parameter');
            const url = new URL(window.location.href);
            const wordParam = url.searchParams.get('word');
            
            if (wordParam) {
                console.log(`[Navigation] Found word parameter in URL: ${wordParam}`);
                window.location.href = `/graph/create-definition?word=${encodeURIComponent(wordParam)}`;
            } else {
                console.warn('[Navigation] Cannot create definition: No word found in store or URL');
                window.location.href = '/graph/dashboard';
            }
        }
    },
    [NavigationOptionId.DISCUSS]: () => {
        const currentWord = get(wordStore);
        const currentQuestion = get(openQuestionStore);
        
        console.log(`[Navigation] DISCUSS handler called, currentWord:`, currentWord, 'currentQuestion:', currentQuestion);
        
        if (currentWord) {
            navigateToNodeDiscussion('word', currentWord.id, currentWord.word);
        } else if (currentQuestion) {
            navigateToNodeDiscussion('openquestion', currentQuestion.id);
        } else {
            console.warn('[Navigation] No node in store, checking URL parameters');
            const url = new URL(window.location.href);
            const wordParam = url.searchParams.get('word');
            const questionParam = url.searchParams.get('id');
            
            if (wordParam) {
                console.log(`[Navigation] Found word parameter in URL: ${wordParam}`);
                console.warn('[Navigation] Cannot discuss word without ID, redirecting to dashboard');
                window.location.href = '/graph/dashboard';
            } else if (questionParam) {
                console.log(`[Navigation] Found question parameter in URL: ${questionParam}`);
                navigateToNodeDiscussion('openquestion', questionParam);
            } else {
                console.warn('[Navigation] Cannot discuss: No node found in store or URL');
                window.location.href = '/graph/dashboard';
            }
        }
    },
    [NavigationOptionId.QUESTIONS]: () => {
        updateGraphStore('openquestion');
        window.location.href = '/graph/dashboard';
    },
    [NavigationOptionId.UNIVERSAL_GRAPH]: () => {
        updateGraphStore('universal');
        window.location.href = '/graph/universal';
    }
};

export const NavigationContext = {
    DASHBOARD: 'dashboard',
    CREATE_NODE: 'create-node',
    EXPLORE: 'explore',
    WORD: 'word',
    OPENQUESTION: 'openquestion',
    EDIT_PROFILE: 'edit-profile',
    DISCUSSION: 'discussion'
} as const;

export type NavigationContext = typeof NavigationContext[keyof typeof NavigationContext];

// UPDATED: Icons mapping with new icons for GRAPH_CONTROLS and DONATE
const navigationIcons: Record<NavigationOptionId, string> = {
    [NavigationOptionId.EXPLORE]: 'Language',
    [NavigationOptionId.CREATE_NODE]: 'add_circle',
    [NavigationOptionId.NETWORK]: 'network_node',
    [NavigationOptionId.LOGOUT]: 'logout',
    [NavigationOptionId.EDIT_PROFILE]: 'settings',
    [NavigationOptionId.INTERACTIONS]: 'compare_arrows',
    [NavigationOptionId.CREATIONS]: 'stars',
    [NavigationOptionId.DASHBOARD]: 'home',
    [NavigationOptionId.ALTERNATIVE_DEFINITIONS]: 'format_list_bulleted',
    [NavigationOptionId.CREATE_DEFINITION]: 'playlist_add_circle',
    [NavigationOptionId.DISCUSS]: 'forum',
    [NavigationOptionId.QUESTIONS]: 'help',
    [NavigationOptionId.UNIVERSAL_GRAPH]: 'hub',
    [NavigationOptionId.GRAPH_CONTROLS]: 'tune',  // NEW: Graph controls icon
    [NavigationOptionId.DONATE]: 'volunteer_activism'  // NEW: Donate icon
};

// UPDATED: Navigation option configurations - DASHBOARD context now has 6 items
const navigationConfigs: Record<NavigationContext, readonly NavigationOptionId[]> = {
    // UPDATED: New universal graph dashboard navigation with 6 options
    [NavigationContext.DASHBOARD]: [
        NavigationOptionId.DASHBOARD,
        NavigationOptionId.EDIT_PROFILE,
        NavigationOptionId.CREATE_NODE,
        NavigationOptionId.DONATE,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.GRAPH_CONTROLS
    ],
    [NavigationContext.EDIT_PROFILE]: [
        NavigationOptionId.EXPLORE,
        NavigationOptionId.CREATE_NODE,
        NavigationOptionId.UNIVERSAL_GRAPH,
        NavigationOptionId.NETWORK,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.DASHBOARD,  
        NavigationOptionId.INTERACTIONS,
        NavigationOptionId.CREATIONS
    ],
    [NavigationContext.CREATE_NODE]: [
        NavigationOptionId.EXPLORE,
        NavigationOptionId.DASHBOARD,
        NavigationOptionId.UNIVERSAL_GRAPH,
        NavigationOptionId.NETWORK,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.EDIT_PROFILE,
        NavigationOptionId.INTERACTIONS,
        NavigationOptionId.CREATIONS
    ],
    [NavigationContext.EXPLORE]: [
        NavigationOptionId.DASHBOARD,
        NavigationOptionId.CREATE_NODE,
        NavigationOptionId.UNIVERSAL_GRAPH,
        NavigationOptionId.NETWORK,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.EDIT_PROFILE
    ],
    [NavigationContext.WORD]: [
        NavigationOptionId.EXPLORE,
        NavigationOptionId.CREATE_NODE,
        NavigationOptionId.ALTERNATIVE_DEFINITIONS,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.CREATE_DEFINITION,
        NavigationOptionId.DISCUSS,
        NavigationOptionId.DASHBOARD
    ],
    [NavigationContext.OPENQUESTION]: [
        NavigationOptionId.DASHBOARD,
        NavigationOptionId.CREATE_NODE,
        NavigationOptionId.EXPLORE,
        NavigationOptionId.QUESTIONS,
        NavigationOptionId.DISCUSS,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.EDIT_PROFILE
    ],
    [NavigationContext.DISCUSSION]: [
        NavigationOptionId.DASHBOARD,
        NavigationOptionId.EXPLORE,
        NavigationOptionId.CREATE_NODE,
        NavigationOptionId.UNIVERSAL_GRAPH,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.EDIT_PROFILE
    ]
} as const;

export function handleNavigation(optionId: NavigationOptionId): void {
    console.log(`[Navigation] Handling navigation for option ID: ${optionId}`);
    
    const viewType = navigationViewTypeMap[optionId] as ViewType | undefined;
    
    if (viewType) {
        updateGraphStore(viewType);
    }
    
    const handler = navigationHandlers[optionId];
    if (handler) {
        handler();
    } else {
        console.warn(`No handler defined for navigation option: ${optionId}`);
    }
}

export function getNavigationOptions(context: NavigationContext): NavigationOption[] {
    const config = navigationConfigs[context];
    if (!config) {
        console.warn(`No navigation configuration found for context: ${context}`);
        return [];
    }

    return config.map(optionId => ({
        id: optionId,
        label: optionId.replace('-', ' '),
        icon: navigationIcons[optionId],
    }));
}