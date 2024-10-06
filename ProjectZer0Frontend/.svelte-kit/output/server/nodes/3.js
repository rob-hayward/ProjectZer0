

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/create-node/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/3.DN_8rJ4R.js","_app/immutable/chunks/scheduler.B8nqcW9H.js","_app/immutable/chunks/index.Bb0C942f.js","_app/immutable/chunks/entry.D89jaJfG.js","_app/immutable/chunks/index.VctODzhT.js","_app/immutable/chunks/auth0.Bs0tMaqG.js","_app/immutable/chunks/api.Dyfb_DGk.js"];
export const stylesheets = ["_app/immutable/assets/3.CRRyJIDK.css"];
export const fonts = [];
