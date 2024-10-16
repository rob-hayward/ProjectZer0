import { fetchWithAuth } from './api';
import type { WordNode } from '$lib/types/nodes';

export async function getWordData(word: string): Promise<WordNode> {
  return await fetchWithAuth(`/nodes/word/${encodeURIComponent(word.toLowerCase())}`);
}