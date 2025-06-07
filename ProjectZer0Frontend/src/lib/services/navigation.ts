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
    EXPLORE: 'explore',
    NETWORK: 'network',
    INTERACTIONS: 'interactions',
    CREATIONS: 'creations',
    LOGOUT: 'logout',
    ALTERNATIVE_DEFINITIONS: 'alternative-definitions',
    CREATE_DEFINITION: 'create-definition', 
    DISCUSS: 'discuss',
    QUESTIONS: 'questions'  // NEW: For browsing all questions
} as const;

export type NavigationOptionId = typeof NavigationOptionId[keyof typeof NavigationOptionId];

// Helper function for word-related navigation
function navigateWithWord(path: string) {
    const currentWord = get(wordStore);
    if (currentWord) {
        const url = `${path}?word=${encodeURIComponent(currentWord.word)}`;
        // Use direct location change
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
    [NavigationOptionId.QUESTIONS]: 'openquestion',  // NEW: Map questions to openquestion view type
};

// Helper to update graph store without TypeScript errors
function updateGraphStore(viewType: ViewType): void {
    // Only check if graphStore exists, not its methods
    if (!graphStore) {
        console.warn('[Navigation] Graph store not available');
        return;
    }
    
    console.log(`[Navigation] Updating graph store to: ${viewType}`);
    graphStore.setViewType(viewType);
    
    // Call forceTick directly
    try {
        graphStore.forceTick();
    } catch (e) {
        console.warn('[Navigation] Error calling forceTick:', e);
    }
}

/**
 * Determines the appropriate API endpoint for node discussions based on node type
 * 
 * @param nodeType The type of node (statement, word, definition, quantity, openquestion)
 * @param nodeId The ID of the node
 * @param nodeText Optional text representation (for word nodes)
 * @returns The appropriate API endpoint
 */
export function getNodeDiscussionEndpoint(
    nodeType: string, 
    nodeId: string, 
    nodeText?: string,
    nodeObject?: any
  ): string {
    switch (nodeType) {
      case 'statement':
      case 'quantity':
      case 'openquestion':  // NEW: OpenQuestion support
        // These node types use ID-based endpoints with a standard pattern
        return `/nodes/${nodeType}/${nodeId}/discussion`;
      case 'word':
        // For word nodes, we need the actual word text, not ID
        if (nodeObject && nodeObject.word) {
          return `/nodes/word/${nodeObject.word}/discussion`;
        } else if (nodeText) {
          return `/nodes/word/${nodeText}/discussion`;
        } else {
          console.warn('Word node requires word text for discussion endpoint');
          return '';
        }
      case 'definition':
        // Definition nodes use a different base path
        return `/definitions/${nodeId}/discussion`;
      default:
        console.warn(`Unknown node type: ${nodeType}`);
        return '';
    }
  }

/**
 * Determines the appropriate API endpoint for node comments based on node type
 * 
 * @param nodeType The type of node (statement, word, definition, quantity, openquestion)
 * @param nodeId The ID of the node
 * @param nodeText Optional text representation (for word nodes)
 * @returns The appropriate API endpoint
 */
export function getNodeCommentsEndpoint(
    nodeType: string, 
    nodeId: string, 
    nodeText?: string,
    nodeObject?: any
  ): string {
    switch (nodeType) {
      case 'statement':
      case 'quantity':
      case 'openquestion':  // NEW: OpenQuestion support
        // These node types use ID-based endpoints with a standard pattern
        return `/nodes/${nodeType}/${nodeId}/comments`;
      case 'word':
        // For word nodes, we need the actual word text, not ID
        if (nodeObject && nodeObject.word) {
          return `/nodes/word/${nodeObject.word}/comments`;
        } else if (nodeText) {
          return `/nodes/word/${nodeText}/comments`;
        } else {
          console.warn('Word node requires word text for comments endpoint');
          return '';
        }
      case 'definition':
        // Definition nodes use a different base path
        return `/definitions/${nodeId}/comments`;
      default:
        console.warn(`Unknown node type: ${nodeType}`);
        return '';
    }
  }

/**
 * Determines the appropriate API endpoint for fetching node data based on node type
 * 
 * @param nodeType The type of node (statement, word, definition, quantity, openquestion)
 * @param nodeId The ID of the node
 * @param nodeText Optional text representation (for word nodes)
 * @returns The appropriate API endpoint
 */
export function getNodeDataEndpoint(
    nodeType: string, 
    nodeId: string, 
    nodeText?: string
  ): string {
    switch (nodeType) {
      case 'statement':
      case 'quantity':
      case 'openquestion':  // NEW: OpenQuestion support
        // These node types use ID-based endpoints
        return `/nodes/${nodeType}/${nodeId}`;
      case 'word':
        // For word nodes, try to find the word by ID first, and if that fails, 
        // we'll need to implement a lookup by ID
        return `/nodes/word/id/${nodeId}`;
      case 'definition':
        // Definition nodes use a different base path
        return `/definitions/${nodeId}`;
      default:
        console.warn(`Unknown node type: ${nodeType}`);
        return '';
    }
  }

// New function for node-specific navigation to discussion
export function navigateToNodeDiscussion(nodeType: string, nodeId: string, nodeText?: string): void {
    console.log(`[Navigation] Navigating to discussion for ${nodeType} node: ${nodeId}`);
    
    // First update the graph store to discussion view
    updateGraphStore('discussion');
    
    // For word nodes, use the text instead of ID in the URL if available
    const useId = nodeType === 'word' && nodeText ? nodeText : nodeId;
    
    // Then navigate to the discussion view for this node
    window.location.href = `/graph/discussion/${nodeType}/${useId}`;
}

// Navigation action handlers
const navigationHandlers: Record<NavigationOptionId, () => void> = {
    // Updated to navigate to the direct routes
    [NavigationOptionId.DASHBOARD]: () => {
        updateGraphStore('dashboard');
        window.location.href = '/graph/dashboard';
    },
    
    [NavigationOptionId.EDIT_PROFILE]: () => {
        updateGraphStore('edit-profile');
        window.location.href = '/graph/edit-profile';
    },
    
    [NavigationOptionId.CREATE_NODE]: () => {
        updateGraphStore('create-node');
        window.location.href = '/graph/create-node';
    },
    [NavigationOptionId.EXPLORE]: () => {
        // Updated to navigate to statement-network view
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
    // Updated handler for CREATE_DEFINITION
    [NavigationOptionId.CREATE_DEFINITION]: () => {
        const currentWord = get(wordStore);
        console.log(`[Navigation] CREATE_DEFINITION handler called, currentWord:`, currentWord);
        
        if (currentWord) {
            // First update graph state
            updateGraphStore('create-definition');
            
            // Then navigate with current word
            console.log(`[Navigation] Navigating to create definition for word: ${currentWord.word}`);
            window.location.href = `/graph/create-definition?word=${encodeURIComponent(currentWord.word)}`;
        } else {
            // Try to get word from URL if we're already in a word view
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
            // Use the new navigation function for consistency
            navigateToNodeDiscussion('word', currentWord.id, currentWord.word);
        } else if (currentQuestion) {
            // NEW: Support for discussing questions
            navigateToNodeDiscussion('openquestion', currentQuestion.id);
        } else {
            // Try to get from URL parameters
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
    // NEW: Questions navigation handler
    [NavigationOptionId.QUESTIONS]: () => {
        updateGraphStore('openquestion');
        // Future: Navigate to questions network view
        // For now, redirect to dashboard
        window.location.href = '/graph/dashboard';
    }
};

export const NavigationContext = {
    DASHBOARD: 'dashboard',
    CREATE_NODE: 'create-node',
    EXPLORE: 'explore',
    WORD: 'word',
    OPENQUESTION: 'openquestion',  // NEW: OpenQuestion context
    EDIT_PROFILE: 'edit-profile',
    DISCUSSION: 'discussion'
} as const;

export type NavigationContext = typeof NavigationContext[keyof typeof NavigationContext];

// Icons mapping - preserved exactly as in the original
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
    [NavigationOptionId.QUESTIONS]: 'help'  // NEW: Questions icon
};

// Navigation option configurations per context - preserved exactly as in the original
const navigationConfigs: Record<NavigationContext, readonly NavigationOptionId[]> = {
    [NavigationContext.DASHBOARD]: [
        NavigationOptionId.EXPLORE,
        NavigationOptionId.CREATE_NODE,
        NavigationOptionId.NETWORK,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.EDIT_PROFILE,
        NavigationOptionId.INTERACTIONS,
        NavigationOptionId.CREATIONS
    ],
    [NavigationContext.EDIT_PROFILE]: [
        NavigationOptionId.EXPLORE,
        NavigationOptionId.CREATE_NODE,
        NavigationOptionId.NETWORK,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.DASHBOARD,  
        NavigationOptionId.INTERACTIONS,
        NavigationOptionId.CREATIONS
    ],
    [NavigationContext.CREATE_NODE]: [
        NavigationOptionId.EXPLORE,
        NavigationOptionId.DASHBOARD,
        NavigationOptionId.NETWORK,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.EDIT_PROFILE,
        NavigationOptionId.INTERACTIONS,
        NavigationOptionId.CREATIONS
    ],
    [NavigationContext.EXPLORE]: [],
    [NavigationContext.WORD]: [
        NavigationOptionId.EXPLORE,
        NavigationOptionId.CREATE_NODE,
        NavigationOptionId.ALTERNATIVE_DEFINITIONS,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.CREATE_DEFINITION,
        NavigationOptionId.DISCUSS,
        NavigationOptionId.DASHBOARD
    ],
    // NEW: OpenQuestion navigation context
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
        NavigationOptionId.LOGOUT,
        NavigationOptionId.EDIT_PROFILE
    ]
} as const;

export function handleNavigation(optionId: NavigationOptionId): void {
    console.log(`[Navigation] Handling navigation for option ID: ${optionId}`);
    
    // Get the corresponding view type for graph updates if available
    const viewType = navigationViewTypeMap[optionId] as ViewType | undefined;
    
    // Pre-update graph store if this is a graph-related navigation
    if (viewType) {
        updateGraphStore(viewType);
    }
    
    // Execute the navigation handler
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