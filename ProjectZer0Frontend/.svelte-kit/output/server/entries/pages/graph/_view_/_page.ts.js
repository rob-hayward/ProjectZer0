import { r as redirect } from "../../../../chunks/index.js";
import { f as fetchWithAuth } from "../../../../chunks/api.js";
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
  console.log("=== PAGE LOAD START ===");
  console.log("Raw params:", params);
  console.log("Raw URL:", url.toString());
  console.log("URL params:", Object.fromEntries(url.searchParams));
  console.log("View param:", params.view);
  const validViews = ["dashboard", "word", "create-node", "edit-profile", "network", "statement"];
  const view = params.view;
  if (!view || !validViews.includes(view)) {
    console.log("View validation failed:", {
      view,
      isValid: validViews.includes(view),
      validViews
    });
    console.log("Redirecting to dashboard...");
    throw redirect(307, "/graph/dashboard");
  }
  console.log("View validation passed:", view);
  let wordData = null;
  if (view === "word") {
    const wordParam = url.searchParams.get("word");
    console.log("Processing word view:", { wordParam, view });
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
  const pageData = {
    view,
    viewType: view,
    wordData
  };
  console.log("=== PAGE LOAD COMPLETE ===");
  console.log("Returning page data:", pageData);
  return pageData;
};
export {
  load,
  ssr
};
