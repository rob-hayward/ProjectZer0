import { writable } from 'svelte/store';
import type { WordNode } from '$lib/types/nodes';

export const wordStore = writable<WordNode | null>(null);