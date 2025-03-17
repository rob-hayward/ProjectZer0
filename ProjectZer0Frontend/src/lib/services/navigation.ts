// ProjectZer0Frontend/src/lib/services/navigation.ts
import { get } from 'svelte/store';
import * as auth0 from './auth0';
import type { NavigationOption } from '$lib/types/domain/navigation';
import { wordStore } from '$lib/stores/wordStore';
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
    CREATE_ALTERNATIVE: 'create-alternative',
    DISCUSS: 'discuss'
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

// Map navigation options to view types for graph state updates
const navigationViewTypeMap: Partial<Record<NavigationOptionId, ViewType>> = {
    [NavigationOptionId.DASHBOARD]: 'dashboard',
    [NavigationOptionId.CREATE_NODE]: 'create-node',
    [NavigationOptionId.EDIT_PROFILE]: 'edit-profile',
    [NavigationOptionId.NETWORK]: 'network',
    [NavigationOptionId.CREATE_ALTERNATIVE]: 'create-alternative',
    [NavigationOptionId.EXPLORE]: 'statement-network', // Added mapping for EXPLORE
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
    // Updated handler for CREATE_ALTERNATIVE
    [NavigationOptionId.CREATE_ALTERNATIVE]: () => {
        const currentWord = get(wordStore);
        if (currentWord) {
            // First update graph state
            updateGraphStore('create-alternative');
            
            // Then navigate with current word
            console.log(`[Navigation] Navigating to create alternative for word: ${currentWord.word}`);
            window.location.href = `/graph/create-alternative?word=${encodeURIComponent(currentWord.word)}`;
        } else {
            console.warn('[Navigation] Cannot create alternative: No word found in store');
            window.location.href = '/graph/dashboard';
        }
    },
    [NavigationOptionId.DISCUSS]: () => navigateWithWord('/graph/discuss')
};

export const NavigationContext = {
    DASHBOARD: 'dashboard',
    CREATE_NODE: 'create-node',
    EXPLORE: 'explore',
    WORD: 'word',
    EDIT_PROFILE: 'edit-profile',
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
    [NavigationOptionId.CREATE_ALTERNATIVE]: 'playlist_add_circle',
    [NavigationOptionId.DISCUSS]: 'forum'
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
        NavigationOptionId.CREATE_ALTERNATIVE,
        NavigationOptionId.DISCUSS,
        NavigationOptionId.DASHBOARD
    ],
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