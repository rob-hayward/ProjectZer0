

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.Blxf8U4G.js","_app/immutable/chunks/scheduler.CHpejKh9.js","_app/immutable/chunks/index.DkR5ShKl.js"];
export const stylesheets = [];
export const fonts = [];
