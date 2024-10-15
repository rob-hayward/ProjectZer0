

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/create-node/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/3.apxBF7wq.js","_app/immutable/chunks/scheduler.CHpejKh9.js","_app/immutable/chunks/index.DkR5ShKl.js","_app/immutable/chunks/entry.C6B3fOkw.js","_app/immutable/chunks/index.A4FuD42y.js","_app/immutable/chunks/auth0.Dq7QKDNG.js","_app/immutable/chunks/JWTStore.C8Ly8kZn.js","_app/immutable/chunks/api.D3fHdpjr.js"];
export const stylesheets = ["_app/immutable/assets/3.dInXHDkj.css"];
export const fonts = [];
