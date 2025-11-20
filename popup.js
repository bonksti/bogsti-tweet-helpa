// popup.js

const refreshBtn = document.getElementById("getTweet");
const summarizeBtn = document.getElementById("summarizeTweet");
const output = document.getElementById("output");
const tweetMetaEl = document.getElementById("tweetMeta");
const summaryOutput = document.getElementById("summaryOutput");
const copySummaryBtn = document.getElementById("copySummary");
const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn = document.getElementById("saveKey");
const apiSection = document.getElementById("apiSection");
const statusEl = document.getElementById("status");

let summaryDetail = "standard";
let uiTheme = "dark";
let detailButtons = null;
let themeButtons = null;
let lastMeta = null;

const BOGSTI_SYSTEM_PROMPT = `
you are "bogsti tweet scout" – a crypto twitter native who reads tweets and explains them clearly.

your job:
• compress the tweet into a clean, accurate summary
• highlight the core claim, context, and any implied call to action
• write in natural, lowercase, ct-native language

rules:
• no hashtags, no @ mentions, no links
• no emojis unless the user explicitly asks for them
• 1–3 short sentences max, unless the user asks for a deep summary
• neutral, observant, and slightly analytical tone
`;

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function updateThemeButtons(theme) {
  if (!themeButtons) return;
  themeButtons.forEach((btn) => {
    const t = btn.getAttribute("data-theme");
    if (t === theme) btn.classList.add("active");
    else btn.classList.remove("active");
  });
  document.body.setAttribute("data-theme", theme);
}

function updateDetailButtons(level) {
  if (!detailButtons) return;
  detailButtons.forEach((btn) => {
    const d = btn.getAttribute("data-detail");
    if (d === level) btn.classList.add("active");
    else btn.classList.remove("active");
  });
}

function formatMeta(meta) {
  if (!meta) return "";
  const parts = [];
  if (meta.authorName) parts.push(meta.authorName);
  if (meta.handle) parts.push(meta.handle);
  if (meta.timeText) parts.push(meta.timeText);
  else if (meta.timeISO) parts.push(meta.timeISO);
  if (meta.likes) parts.push(meta.likes + " likes");
  return parts.join(" · ");
}

function fetchTweetText() {
  output.textContent = "Fetching tweet text...";
  tweetMetaEl.textContent = "";
  summaryOutput.textContent = "Summary will appear here once generated.";
  setStatus("");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      output.textContent = "No active tab found.";
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      { type: "GET_TWEET_TEXT" },
      (response) => {
        if (chrome.runtime.lastError) {
          output.textContent =
            "Error talking to page: " + chrome.runtime.lastError.message;
          return;
        }
        if (!response || !response.tweetText) {
          output.textContent =
            "No tweet text found.\n\nMake sure you are on a single tweet page (not the home timeline) and reopen bogsti tweet scout.";
          return;
        }

        output.textContent = response.tweetText;

        lastMeta = {
          authorName: response.authorName || "",
          handle: response.handle || "",
          timeText: response.timeText || "",
          timeISO: response.timeISO || "",
          likes: response.likes || ""
        };

        tweetMetaEl.textContent = formatMeta(lastMeta);
      }
    );
  });
}

function buildSummaryPrompt(tweetText, detail, meta) {
  let detailInstruction = "";
  if (detail === "short") {
    detailInstruction =
      "keep it ultra short: 1–2 tight sentences. focus only on the core idea.";
  } else if (detail === "deep") {
    detailInstruction =
      "you can use up to 4 short sentences. include the main idea, why it matters, and any implicit incentives or risks.";
  } else {
    detailInstruction =
      "aim for 2–3 short sentences that cover the main idea and why it matters.";
  }

  const authorLine =
    meta && (meta.authorName || meta.handle)
      ? `author: ${[meta.authorName, meta.handle].filter(Boolean).join(" ")}`
      : "";
  const timeLine =
    meta && (meta.timeText || meta.timeISO)
      ? `posted: ${meta.timeText || meta.timeISO}`
      : "";
  const likesLine = meta && meta.likes ? `approx likes: ${meta.likes}` : "";
  const contextLines = [authorLine, timeLine, likesLine]
    .filter(Boolean)
    .join("\n");

  return `
tweet content:
"${tweetText}"

${contextLines}

summary detail setting: ${detail}
${detailInstruction}

task:
summarize this tweet for a busy, crypto-native reader who hasn't seen it yet.

focus on:
• what the author is actually saying
• the main value or takeaway
• any implicit call to action, if present

constraints:
• lowercase
• no hashtags, no @ handles, no links
• no emojis
• do not speak as the author, speak as an observer

return only the final summary text, nothing else.
`;
}

async function generateSummary(apiKey, tweetText, detail, meta) {
  const userPrompt = buildSummaryPrompt(tweetText, detail, meta);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: BOGSTI_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.4
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("OpenAI error:", text);
    throw new Error("OpenAI API error");
  }

  const data = await res.json();
  return (data.choices[0].message.content || "").trim();
}

document.addEventListener("DOMContentLoaded", () => {
  detailButtons = document.querySelectorAll(".detail-btn[data-detail]");
  themeButtons = document.querySelectorAll(".theme-btn[data-theme]");

  chrome.storage.sync.get(["openaiKey", "uiTheme", "summaryDetail"], (res) => {
    if (res.openaiKey) {
      apiKeyInput.value = res.openaiKey;
      apiSection.classList.add("hidden");
    }

    uiTheme = typeof res.uiTheme === "string" ? res.uiTheme : "dark";
    summaryDetail =
      typeof res.summaryDetail === "string" ? res.summaryDetail : "standard";

    updateThemeButtons(uiTheme);
    updateDetailButtons(summaryDetail);
  });

  if (detailButtons) {
    detailButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const level = btn.getAttribute("data-detail") || "standard";
        summaryDetail = level;
        updateDetailButtons(summaryDetail);
        chrome.storage.sync.set({ summaryDetail });
      });
    });
  }

  if (themeButtons) {
    themeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.getAttribute("data-theme") || "dark";
        uiTheme = theme;
        updateThemeButtons(uiTheme);
        chrome.storage.sync.set({ uiTheme });
      });
    });
  }

  fetchTweetText();
});

refreshBtn.addEventListener("click", () => {
  fetchTweetText();
});

saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    setStatus("Paste an API key before saving.");
    return;
  }
  chrome.storage.sync.set({ openaiKey: key }, () => {
    setStatus("API key saved. You are set.");
    apiSection.classList.add("hidden");
  });
});

summarizeBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const tweetText = output.textContent.trim();

  summaryOutput.textContent = "";
  if (!apiKey) {
    setStatus("No API key found. Revealing API section.");
    apiSection.classList.remove("hidden");
    return;
  }
  if (
    !tweetText ||
    tweetText.startsWith("No tweet text") ||
    tweetText.startsWith("Error")
  ) {
    setStatus("No valid tweet text to summarize.");
    return;
  }

  summarizeBtn.disabled = true;
  setStatus("Summarizing tweet...");

  try {
    const summary = await generateSummary(
      apiKey,
      tweetText,
      summaryDetail,
      lastMeta
    );
    summaryOutput.textContent = summary || "No summary returned.";
    setStatus("Summary ready.");
  } catch (err) {
    console.error(err);
    summaryOutput.textContent = "Error generating summary.";
    setStatus("Error generating summary.");
  } finally {
    summarizeBtn.disabled = false;
  }
});

copySummaryBtn.addEventListener("click", () => {
  const text = summaryOutput.textContent.trim();
  if (!text) {
    setStatus("Nothing to copy yet.");
    return;
  }

  if (!navigator.clipboard) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setStatus("Summary copied.");
    } catch {
      setStatus("Copy failed.");
    }
    return;
  }

  navigator.clipboard
    .writeText(text)
    .then(() => setStatus("Summary copied."))
    .catch(() => setStatus("Copy failed."));
});