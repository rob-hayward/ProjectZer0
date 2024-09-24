

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.rsOvh-u1.js","_app/immutable/chunks/scheduler.DUa3pFyD.js","_app/immutable/chunks/index.Dpsme9HD.js"];
export const stylesheets = [];
export const fonts = [];
