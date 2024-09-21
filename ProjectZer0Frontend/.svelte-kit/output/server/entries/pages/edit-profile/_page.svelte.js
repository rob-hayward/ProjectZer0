import { c as create_ssr_component } from "../../../chunks/ssr.js";
import "../../../chunks/client.js";
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { testUser = null } = $$props;
  if ($$props.testUser === void 0 && $$bindings.testUser && testUser !== void 0) $$bindings.testUser(testUser);
  return `<h1 data-svelte-h="svelte-1o5ke4h">Edit Profile</h1> ${`<p data-svelte-h="svelte-qdsr2u">Loading...</p>`}`;
});
export {
  Page as default
};
