

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/dashboard/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/3.KCvwKecL.js","_app/immutable/chunks/scheduler.BvLojk_z.js","_app/immutable/chunks/index.8RwJHkSu.js","_app/immutable/chunks/auth0.BtEzjmD8.js","_app/immutable/chunks/entry.CX_G5xxV.js"];
export const stylesheets = [];
export const fonts = [];
