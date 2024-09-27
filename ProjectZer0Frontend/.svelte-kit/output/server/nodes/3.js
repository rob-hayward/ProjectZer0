

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/dashboard/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/3.B-wtXMzG.js","_app/immutable/chunks/scheduler.DUa3pFyD.js","_app/immutable/chunks/index.Dpsme9HD.js","_app/immutable/chunks/auth0.ByRKAWat.js"];
export const stylesheets = ["_app/immutable/assets/3.kdH594J4.css"];
export const fonts = [];
