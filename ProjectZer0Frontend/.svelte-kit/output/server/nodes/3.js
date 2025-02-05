import * as universal from '../entries/pages/graph/_view_/_page.ts.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/graph/_view_/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/graph/[view]/+page.ts";
export const imports = ["_app/immutable/nodes/3.OMm_5S2C.js","_app/immutable/chunks/entry.DQxgZDBP.js","_app/immutable/chunks/scheduler.B-0CXS5p.js","_app/immutable/chunks/index.BLBD6f_K.js","_app/immutable/chunks/colors.rXsD7TVj.js","_app/immutable/chunks/index.Cd9iFXld.js","_app/immutable/chunks/stores.DOSMrAjX.js"];
export const stylesheets = ["_app/immutable/assets/3.5O5IY5Nb.css"];
export const fonts = [];
