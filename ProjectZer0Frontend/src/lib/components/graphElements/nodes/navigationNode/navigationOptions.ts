// components/graphElements/nodes/navigationNode/navigationOptions.ts
import type { NavigationOption } from '$lib/types/navigation';

export const dashboardNavigationOptions: NavigationOption[] = [
    { id: 'explore', label: 'explore', icon: '◯' },
    { id: 'create-node', label: 'create node', icon: '+' },
    { id: 'network', label: 'social network', icon: '◎' },
    { id: 'creations', label: 'my creations', icon: '✦' },
    { id: 'interactions', label: 'my interactions', icon: '⟷' },
    { id: 'edit-profile', label: 'edit profile', icon: '⚙' },
    { id: 'logout', label: 'logout', icon: '↪' }
  ];