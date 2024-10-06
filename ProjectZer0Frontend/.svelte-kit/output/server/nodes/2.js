

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/2.DqseiLjA.js","_app/immutable/chunks/scheduler.B8nqcW9H.js","_app/immutable/chunks/index.Bb0C942f.js","_app/immutable/chunks/auth0.Bs0tMaqG.js","_app/immutable/chunks/index.VctODzhT.js"];
export const stylesheets = ["_app/immutable/assets/2.IpuuOhnd.css"];
export const fonts = [];
