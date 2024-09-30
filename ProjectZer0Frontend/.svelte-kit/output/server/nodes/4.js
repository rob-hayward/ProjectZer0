

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/edit-profile/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/4.BkwTr_5m.js","_app/immutable/chunks/scheduler.DUa3pFyD.js","_app/immutable/chunks/index.BtLLPK58.js","_app/immutable/chunks/auth0.CGa5ZhUM.js","_app/immutable/chunks/index.DspQOGsj.js","_app/immutable/chunks/entry.KsajuBdT.js"];
export const stylesheets = ["_app/immutable/assets/4.BUqL5ta5.css"];
export const fonts = [];
