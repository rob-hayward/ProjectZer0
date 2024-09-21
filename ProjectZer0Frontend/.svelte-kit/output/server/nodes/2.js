

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/2.Z2dU44z5.js","_app/immutable/chunks/scheduler.BvLojk_z.js","_app/immutable/chunks/index.8RwJHkSu.js","_app/immutable/chunks/auth0.BtEzjmD8.js","_app/immutable/chunks/entry.CX_G5xxV.js"];
export const stylesheets = ["_app/immutable/assets/2.BbJ17Mls.css"];
export const fonts = [];
