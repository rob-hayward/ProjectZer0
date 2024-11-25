import { goto } from '$app/navigation';
import * as auth0 from './auth0';
import type { NavigationOption } from '$lib/types/navigation';

export const NavigationOptionId = {
  DASHBOARD: 'dashboard',
  CREATE_NODE: 'create-node',
  EDIT_PROFILE: 'edit-profile',
  EXPLORE: 'explore',
  NETWORK: 'network',
  INTERACTIONS: 'interactions',
  CREATIONS: 'creations',
  LOGOUT: 'logout',
  ALTERNATIVE_DEFINITIONS: 'alternative-definitions'
} as const;

export type NavigationOptionId = typeof NavigationOptionId[keyof typeof NavigationOptionId];

// Navigation action handlers
const navigationHandlers: Record<NavigationOptionId, () => void> = {
  [NavigationOptionId.DASHBOARD]: () => goto('/dashboard'),
  [NavigationOptionId.CREATE_NODE]: () => goto('/create-node'),
  [NavigationOptionId.EDIT_PROFILE]: () => goto('/edit-profile'),
  [NavigationOptionId.EXPLORE]: () => goto('/explore'),
  [NavigationOptionId.NETWORK]: () => goto('/network'),
  [NavigationOptionId.INTERACTIONS]: () => goto('/interactions'),
  [NavigationOptionId.CREATIONS]: () => goto('/creations'),
  [NavigationOptionId.LOGOUT]: () => auth0.logout(),
  [NavigationOptionId.ALTERNATIVE_DEFINITIONS]: () => {
    console.log('View definitions functionality to be implemented');
  }
};

export const NavigationContext = {
  DASHBOARD: 'dashboard',
  CREATE_NODE: 'create-node',
  EXPLORE: 'explore',
  WORD: 'word',
  PROFILE: 'profile',
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
  [NavigationOptionId.ALTERNATIVE_DEFINITIONS]: '≣'
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
    NavigationOptionId.ALTERNATIVE_DEFINITIONS
  ],
  [NavigationContext.PROFILE]: [],
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