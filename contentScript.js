function getMainTweetElement() {
  let el = document.querySelector('article[data-testid="tweet"]');
  if (el) return el;
  el = document.querySelector('article');
  if (el) return el;
  el = document.querySelector('div[data-testid="tweet"]');
  return el || null;
}

function extractTweetText(el) {
  if (!el) return "";
  const spans = el.querySelectorAll('[data-testid="tweetText"] span');
  if (spans.length > 0) {
    return Array.from(spans)
      .map((s) => s.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const text = el.innerText || "";
  return text.replace(/\s+/g, " ").trim();
}

function extractTweetMetadata(el) {
  if (!el) {
    return {
      authorName: "",
      handle: "",
      timeText: "",
      timeISO: "",
      likes: ""
    };
  }
  let authorName = "";
  let handle = "";
  const nameSpans = el.querySelectorAll('[data-testid="User-Name"] span');
  if (nameSpans.length > 0) {
    authorName = nameSpans[0].textContent || "";
    authorName = authorName.trim();
    if (nameSpans.length > 1) {
      handle = nameSpans[nameSpans.length - 1].textContent || "";
      handle = handle.trim();
    }
  }
  let timeText = "";
  let timeISO = "";
  const timeEl = el.querySelector("time");
  if (timeEl) {
    timeText = (timeEl.textContent || "").trim();
    timeISO = timeEl.getAttribute("datetime") || "";
  }
  let likes = "";
  const likeSpan = el.querySelector('div[data-testid="like"] span');
  if (likeSpan) {
    likes = (likeSpan.textContent || "").trim();
  }
  return {
    authorName,
    handle,
    timeText,
    timeISO,
    likes
  };
}

function findReplyBox() {
  let el = document.querySelector('div[contenteditable="true"][data-testid="tweetTextarea_0"]');
  if (el) return el;
  el = document.querySelector('div[contenteditable="true"][role="textbox"]');
  return el || null;
}

function insertReplyText(text) {
  const box = findReplyBox();
  if (!box) return false;
  box.scrollIntoView({ block: "center", behavior: "smooth" });
  box.focus();
  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  let ok = false;
  try {
    ok = document.execCommand("insertText", false, text);
  } catch {
    ok = false;
  }
  if (!ok) {
    box.textContent = text;
    const inputEvent = new InputEvent("input", { bubbles: true, cancelable: true });
    box.dispatchEvent(inputEvent);
  }
  return true;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_TWEET_TEXT") {
    const el = getMainTweetElement();
    const tweetText = extractTweetText(el);
    const meta = extractTweetMetadata(el);
    sendResponse({
      tweetText,
      authorName: meta.authorName,
      handle: meta.handle,
      timeText: meta.timeText,
      timeISO: meta.timeISO,
      likes: meta.likes
    });
    return true;
  }
  if (msg.type === "INSERT_REPLY_ONLY") {
    const ok = insertReplyText(msg.replyText || "");
    sendResponse({ ok });
    return true;
  }
  return false;
});