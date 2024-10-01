

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/dashboard/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/3.Btsk8P0T.js","_app/immutable/chunks/scheduler.DUa3pFyD.js","_app/immutable/chunks/index.BtLLPK58.js","_app/immutable/chunks/entry._RkA5kDJ.js","_app/immutable/chunks/index.DspQOGsj.js","_app/immutable/chunks/auth0.DsDXFQ5O.js"];
export const stylesheets = ["_app/immutable/assets/3.C32cd-jR.css"];
export const fonts = [];
