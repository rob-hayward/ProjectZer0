

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/dashboard/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/4.CycDRbII.js","_app/immutable/chunks/scheduler.B8nqcW9H.js","_app/immutable/chunks/index.Bb0C942f.js","_app/immutable/chunks/entry.D89jaJfG.js","_app/immutable/chunks/index.VctODzhT.js","_app/immutable/chunks/auth0.Bs0tMaqG.js"];
export const stylesheets = ["_app/immutable/assets/4.CRbfiWHH.css"];
export const fonts = [];
