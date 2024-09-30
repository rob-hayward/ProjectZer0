

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/dashboard/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/3.C31EjxkK.js","_app/immutable/chunks/scheduler.DUa3pFyD.js","_app/immutable/chunks/index.BtLLPK58.js","_app/immutable/chunks/entry.KsajuBdT.js","_app/immutable/chunks/index.DspQOGsj.js","_app/immutable/chunks/auth0.CGa5ZhUM.js"];
export const stylesheets = ["_app/immutable/assets/3.C32cd-jR.css"];
export const fonts = [];
