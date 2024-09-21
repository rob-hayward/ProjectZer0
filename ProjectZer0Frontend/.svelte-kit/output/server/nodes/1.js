

export const index = 1;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/error.svelte.js')).default;
export const imports = ["_app/immutable/nodes/1.CWf0Z355.js","_app/immutable/chunks/scheduler.BvLojk_z.js","_app/immutable/chunks/index.8RwJHkSu.js","_app/immutable/chunks/entry.CX_G5xxV.js"];
export const stylesheets = [];
export const fonts = [];
