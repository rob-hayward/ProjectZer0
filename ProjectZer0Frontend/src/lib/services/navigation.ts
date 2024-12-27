// ProjectZer0Frontend/src/lib/services/navigation.ts
import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import * as auth0 from './auth0';
import type { NavigationOption } from '$lib/types/navigation';
import { wordStore } from '$lib/stores/wordStore';

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

// Navigation action handlers
const navigationHandlers: Record<NavigationOptionId, () => void> = {
    [NavigationOptionId.DASHBOARD]: () => goto('/graph/dashboard'),
    [NavigationOptionId.CREATE_NODE]: () => goto('/graph/create-node'),
    [NavigationOptionId.EDIT_PROFILE]: () => goto('/graph/edit-profile'),
    [NavigationOptionId.EXPLORE]: () => goto('/explore'),
    [NavigationOptionId.NETWORK]: () => goto('/network'),
    [NavigationOptionId.INTERACTIONS]: () => goto('/interactions'),
    [NavigationOptionId.CREATIONS]: () => goto('/creations'),
    [NavigationOptionId.LOGOUT]: () => auth0.logout(),
    [NavigationOptionId.ALTERNATIVE_DEFINITIONS]: () => {
        const currentWord = get(wordStore);
        if (currentWord) {
            goto(`/graph-test/${currentWord.word}`);
        }
    },
    [NavigationOptionId.CREATE_ALTERNATIVE]: () => {
        const currentWord = get(wordStore);
        if (currentWord) {
            goto(`/graph/create-alternative/${currentWord.word}`);
        }
    },
    [NavigationOptionId.DISCUSS]: () => {
        const currentWord = get(wordStore);
        if (currentWord) {
            goto(`/graph/discuss/${currentWord.word}`);
        }
    }
};

export const NavigationContext = {
    DASHBOARD: 'dashboard',
    CREATE_NODE: 'create-node',
    EXPLORE: 'explore',
    WORD: 'word',
    EDIT_PROFILE: 'edit-profile',
} as const;

export type NavigationContext = typeof NavigationContext[keyof typeof NavigationContext];

// Icons mapping
const navigationIcons: Record<NavigationOptionId, string> = {
    [NavigationOptionId.EXPLORE]: '◯',
    [NavigationOptionId.CREATE_NODE]: '+',
    [NavigationOptionId.NETWORK]: '◎',
    [NavigationOptionId.LOGOUT]: '↪',
    [NavigationOptionId.EDIT_PROFILE]: '⚙',
    [NavigationOptionId.INTERACTIONS]: '⟷',
    [NavigationOptionId.CREATIONS]: '✦',
    [NavigationOptionId.DASHBOARD]: '⌂',
    [NavigationOptionId.ALTERNATIVE_DEFINITIONS]: '≣',
    [NavigationOptionId.CREATE_ALTERNATIVE]: '+ ≣',
    [NavigationOptionId.DISCUSS]: '⚑'
};

// Navigation option configurations per context
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
        NavigationOptionId.DASHBOARD,
        NavigationOptionId.LOGOUT,
        NavigationOptionId.CREATE_NODE,
        NavigationOptionId.ALTERNATIVE_DEFINITIONS,
        NavigationOptionId.CREATE_ALTERNATIVE,
        NavigationOptionId.DISCUSS
    ],
} as const;

export function handleNavigation(optionId: NavigationOptionId): void {
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