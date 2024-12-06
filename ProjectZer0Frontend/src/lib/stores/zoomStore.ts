// src/lib/stores/zoomStore.ts
import { writable } from 'svelte/store';

interface ZoomState {
    scale: number;
    x: number;
    y: number;
}

const initialZoomState: ZoomState = {
    scale: 100,  // 100%
    x: 0,
    y: 0
};

export const zoomStore = writable<ZoomState>(initialZoomState);