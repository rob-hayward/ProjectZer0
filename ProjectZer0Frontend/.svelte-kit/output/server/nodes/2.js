

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/2.dI13D_Nl.js","_app/immutable/chunks/scheduler.DUa3pFyD.js","_app/immutable/chunks/index.BtLLPK58.js","_app/immutable/chunks/auth0.CGa5ZhUM.js","_app/immutable/chunks/index.DspQOGsj.js"];
export const stylesheets = ["_app/immutable/assets/2.IpuuOhnd.css"];
export const fonts = [];
