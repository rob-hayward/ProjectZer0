import { r as redirect } from "../../../chunks/index.js";
import { f as fetchWithAuth } from "../../../chunks/api.js";
async function getWordData(word) {
  try {
    if (!word) {
      console.warn("getWordData called with empty word");
      return null;
    }
    console.log(`Fetching word data for: ${word}`);
    const encodedWord = encodeURIComponent(word.toLowerCase());
    const wordData = await fetchWithAuth(`/nodes/word/${encodedWord}`);
    console.log("Word data received:", wordData);
    return wordData;
  } catch (error) {
    console.error("Error fetching word data:", error);
    throw error;
  }
}
const ssr = false;
const load = async ({ params, url }) => {
  console.log("Page load starting:", {
    params,
    url: url.toString(),
    searchParams: Object.fromEntries(url.searchParams)
  });
  const validViews = ["dashboard", "word", "create-node", "edit-profile", "alternative-definitions"];
  const view = params.view;
  if (!view || !validViews.includes(view)) {
    console.log("Invalid view, redirecting to dashboard:", view);
    throw redirect(307, "/graph/dashboard");
  }
  let wordData = null;
  if (view === "word" || view === "alternative-definitions") {
    const wordParam = url.searchParams.get("word");
    console.log("Word param in load:", wordParam, "for view:", view);
    if (!wordParam) {
      console.warn("No word parameter found, redirecting to dashboard");
      throw redirect(307, "/graph/dashboard");
    }
    try {
      console.log("Loading word data for:", wordParam);
      wordData = await getWordData(wordParam);
      if (!wordData) {
        console.error("No word data found for:", wordParam);
        throw new Error("No word data found");
      }
      console.log("Word data loaded successfully:", wordData);
    } catch (error) {
      console.error("Error loading word data:", error);
      throw redirect(307, "/graph/dashboard");
    }
  }
  return {
    view,
    wordData
  };
};
export {
  load,
  ssr
};
