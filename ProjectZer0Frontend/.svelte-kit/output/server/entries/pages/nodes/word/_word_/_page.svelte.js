import { c as create_ssr_component, e as each, v as validate_component } from "../../../../../chunks/ssr.js";
import "../../../../../chunks/client.js";
import { w as writable } from "../../../../../chunks/index.js";
import { e as escape } from "../../../../../chunks/escape.js";
function createJWTStore() {
  const { subscribe, set, update } = writable(null);
  return {
    subscribe,
    setToken: (token) => set(token),
    clearToken: () => set(null),
    getToken: () => {
      let token = null;
      subscribe((value) => {
        token = value;
      })();
      return token;
    }
  };
}
const jwtStore = createJWTStore();
const API_BASE_URL = "http://localhost:3000/api";
async function fetchWithAuth(url, options = {}) {
  const token = jwtStore.getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
      credentials: "include"
    });
    console.log("Fetch response:", response);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error response body:", errorBody);
      throw new Error(`API call failed: ${response.statusText}, body: ${errorBody}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}
const css$1 = {
  code: ".word-node.svelte-v9n0oe{max-width:800px;margin:0 auto;padding:20px}section.svelte-v9n0oe{margin-bottom:20px}.definition.svelte-v9n0oe,.comment.svelte-v9n0oe{background-color:#f0f0f0;padding:10px;border-radius:5px;margin-bottom:10px}",
  map: `{"version":3,"file":"WordNodeDisplay.svelte","sources":["WordNodeDisplay.svelte"],"sourcesContent":["<!-- src/routes/nodes/word/WordNodeDisplay.svelte -->\\n<script lang=\\"ts\\">export let word;\\nfunction formatDate(dateString) {\\n  return new Date(dateString).toLocaleString();\\n}\\n<\/script>\\n\\n<div class=\\"word-node\\">\\n  <h1>{word.word}</h1>\\n  \\n  <section class=\\"definitions\\">\\n    <h2>Definitions</h2>\\n    {#each word.definitions as definition}\\n      <div class=\\"definition\\">\\n        <h3>{definition.createdBy === 'FreeDictionaryAPI' ? 'Free Dictionary Definition' : 'User-Provided Definition'}</h3>\\n        <p>{definition.text}</p>\\n        <p>Votes: {definition.votes}</p>\\n      </div>\\n    {/each}\\n  </section>\\n\\n  {#if word.discussion}\\n    <section class=\\"discussion\\">\\n      <h2>Discussion</h2>\\n      {#each word.discussion.comments as comment}\\n        <div class=\\"comment\\">\\n          <p>{comment.commentText}</p>\\n          <p>By: {comment.createdBy}</p>\\n          <p>Posted: {formatDate(comment.createdAt)}</p>\\n        </div>\\n      {/each}\\n    </section>\\n  {/if}\\n\\n  <section class=\\"metadata\\">\\n    <p>Created by: {word.publicCredit ? word.createdBy : 'Anonymous'}</p>\\n    <p>Created at: {formatDate(word.createdAt)}</p>\\n    <p>Last updated: {formatDate(word.updatedAt)}</p>\\n  </section>\\n</div>\\n\\n<style>\\n.word-node {\\n  max-width: 800px;\\n  margin: 0 auto;\\n  padding: 20px;\\n}\\nsection {\\n  margin-bottom: 20px;\\n}\\n.definition, .comment {\\n  background-color: #f0f0f0;\\n  padding: 10px;\\n  border-radius: 5px;\\n  margin-bottom: 10px;\\n}\\n</style>"],"names":[],"mappings":"AA0CA,wBAAW,CACT,SAAS,CAAE,KAAK,CAChB,MAAM,CAAE,CAAC,CAAC,IAAI,CACd,OAAO,CAAE,IACX,CACA,qBAAQ,CACN,aAAa,CAAE,IACjB,CACA,yBAAW,CAAE,sBAAS,CACpB,gBAAgB,CAAE,OAAO,CACzB,OAAO,CAAE,IAAI,CACb,aAAa,CAAE,GAAG,CAClB,aAAa,CAAE,IACjB"}`
};
function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}
const WordNodeDisplay = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { word } = $$props;
  if ($$props.word === void 0 && $$bindings.word && word !== void 0) $$bindings.word(word);
  $$result.css.add(css$1);
  return `  <div class="word-node svelte-v9n0oe"><h1>${escape(word.word)}</h1> <section class="definitions svelte-v9n0oe"><h2 data-svelte-h="svelte-wrtpe4">Definitions</h2> ${each(word.definitions, (definition) => {
    return `<div class="definition svelte-v9n0oe"><h3>${escape(definition.createdBy === "FreeDictionaryAPI" ? "Free Dictionary Definition" : "User-Provided Definition")}</h3> <p>${escape(definition.text)}</p> <p>Votes: ${escape(definition.votes)}</p> </div>`;
  })}</section> ${word.discussion ? `<section class="discussion svelte-v9n0oe"><h2 data-svelte-h="svelte-78nape">Discussion</h2> ${each(word.discussion.comments, (comment) => {
    return `<div class="comment svelte-v9n0oe"><p>${escape(comment.commentText)}</p> <p>By: ${escape(comment.createdBy)}</p> <p>Posted: ${escape(formatDate(comment.createdAt))}</p> </div>`;
  })}</section>` : ``} <section class="metadata svelte-v9n0oe"><p>Created by: ${escape(word.publicCredit ? word.createdBy : "Anonymous")}</p> <p>Created at: ${escape(formatDate(word.createdAt))}</p> <p>Last updated: ${escape(formatDate(word.updatedAt))}</p></section> </div>`;
});
const css = {
  code: ".error.svelte-1fi3y4c{color:red}",
  map: '{"version":3,"file":"+page.svelte","sources":["+page.svelte"],"sourcesContent":["<!-- src/routes/nodes/word/[word]/+page.svelte -->\\n<script lang=\\"ts\\">import { page } from \\"$app/stores\\";\\nimport { onMount } from \\"svelte\\";\\nimport { fetchWithAuth } from \\"$lib/services/api\\";\\nimport WordNodeDisplay from \\"../WordNodeDisplay.svelte\\";\\nexport let data;\\nlet wordData = null;\\nlet error = null;\\nlet isLoading = true;\\nasync function fetchWordData() {\\n  isLoading = true;\\n  error = null;\\n  try {\\n    wordData = await fetchWithAuth(`/nodes/word/${encodeURIComponent(data.word.toLowerCase())}`);\\n    isLoading = false;\\n  } catch (e) {\\n    console.error(\\"Error fetching word data:\\", e);\\n    error = e instanceof Error ? e.message : \\"An error occurred while fetching word data\\";\\n    isLoading = false;\\n  }\\n}\\n$: if (data.word) {\\n  fetchWordData();\\n}\\n<\/script>\\n\\n{#if isLoading}\\n  <p>Loading word data...</p>\\n{:else if error}\\n  <p class=\\"error\\">{error}</p>\\n{:else if wordData}\\n  <WordNodeDisplay word={wordData} />\\n{:else}\\n  <p>No word data available</p>\\n{/if}\\n\\n<style>\\n  .error {\\n    color: red;\\n  }\\n</style>"],"names":[],"mappings":"AAqCE,qBAAO,CACL,KAAK,CAAE,GACT"}'
};
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { data } = $$props;
  let wordData = null;
  let error = null;
  let isLoading = true;
  async function fetchWordData() {
    isLoading = true;
    error = null;
    try {
      wordData = await fetchWithAuth(`/nodes/word/${encodeURIComponent(data.word.toLowerCase())}`);
      isLoading = false;
    } catch (e) {
      console.error("Error fetching word data:", e);
      error = e instanceof Error ? e.message : "An error occurred while fetching word data";
      isLoading = false;
    }
  }
  if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
  $$result.css.add(css);
  {
    if (data.word) {
      fetchWordData();
    }
  }
  return `  ${isLoading ? `<p data-svelte-h="svelte-1ygobei">Loading word data...</p>` : `${error ? `<p class="error svelte-1fi3y4c">${escape(error)}</p>` : `${wordData ? `${validate_component(WordNodeDisplay, "WordNodeDisplay").$$render($$result, { word: wordData }, {}, {})}` : `<p data-svelte-h="svelte-10fidlo">No word data available</p>`}`}`}`;
});
export {
  Page as default
};
