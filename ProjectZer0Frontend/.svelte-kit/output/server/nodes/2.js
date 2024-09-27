

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/2.DAVd_Q0J.js","_app/immutable/chunks/scheduler.DUa3pFyD.js","_app/immutable/chunks/index.Dpsme9HD.js","_app/immutable/chunks/auth0.ByRKAWat.js"];
export const stylesheets = ["_app/immutable/assets/2.IpuuOhnd.css"];
export const fonts = [];
