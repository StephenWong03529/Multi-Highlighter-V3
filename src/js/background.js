// Import jQuery if you are using it in the service worker.
// Note: Since this is not an ES module, we use importScripts.
// This must be at the very top of the script.
// try {
//   importScripts('js/jquery.js');
// } catch (e) {
//   console.error(e);
// }

const background = {};
const USER_ID_STORE = "userUUID";
const ACTIVE_STATUS_STORE = "isActive";
const KEYWORDS_STRING_STORE = "keywordsString";
const KEYWORDS_ARRAY_STORE = "keywordsArray";

// --- Asynchronous Storage Functions ---

// Helper function to get data from chrome.storage.local
const getStorageData = (key) => {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key]);
    });
  });
};

// Helper function to set data in chrome.storage.local
const setStorageData = (data) => {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => {
      resolve();
    });
  });
};

background.getUserId = async () => {
  let userId = await getStorageData(USER_ID_STORE);
  if (!userId) {
    // UUID generation function from your original code
    userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    await setStorageData({ [USER_ID_STORE]: userId });
  }
  return userId;
};

background.getActiveStatus = async () => {
  const isActive = await getStorageData(ACTIVE_STATUS_STORE);
  // Default to true if not set
  return isActive === false ? false : true;
};

background.setActiveStatus = async (isActive) => {
  await setStorageData({ [ACTIVE_STATUS_STORE]: isActive });
};

background.getKeywordsString = async () => {
  return await getStorageData(KEYWORDS_STRING_STORE) || "";
};

background.setKeywordsString = async (str) => {
  await setStorageData({ [KEYWORDS_STRING_STORE]: str });
  const keywords = (str || "").trim() ? str.trim().toLowerCase().split(/\s+/) : [];
  await setStorageData({ [KEYWORDS_ARRAY_STORE]: keywords });
};

background.getKeywords = async () => {
  return await getStorageData(KEYWORDS_ARRAY_STORE) || [];
};

// --- RPC Handler ---

// Listen for messages from other parts of the extension (popup, content scripts)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.opt === 'rpc' && background[request.func]) {
    // Use an async IIFE to handle the async function call
    (async () => {
      try {
        const result = await background[request.func](...request.args);
        sendResponse(result);
      } catch (error) {
        console.error("Error during RPC call:", error);
        sendResponse({ error: error.message });
      }
    })();
    // Return true to indicate that the response will be sent asynchronously
    return true;
  }
});

// --- Storage Change Listener ---
// This replaces your custom jQuery event system for storage changes.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    for (let [key, { newValue }] of Object.entries(changes)) {
      console.log(`Storage key "${key}" changed. New value:`, newValue);

      // Notify active tabs of the change
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            opt: "event",
            event: "storageChange",
            args: { key, value: newValue }
          });
        }
      });
    }
  }
});


// --- OnInstalled Logic (Updated for V3) ---
// This logic attempts to inject the content script into already open tabs when the extension is first installed.
// This is often not necessary as content scripts are automatically injected into new tabs that match the pattern.
const injectScriptsInExistingTabs = () => {
    const manifest = chrome.runtime.getManifest();
    const contentScript = manifest.content_scripts[0];
    const jsFiles = contentScript.js;
    const cssFiles = contentScript.css;

    chrome.windows.getAll({ populate: true }, (windows) => {
        windows.forEach((win) => {
            win.tabs.forEach((tab) => {
                // Check if the tab URL matches the content script's match patterns
                // and it's not a chrome:// or other restricted URL
                const urlIsAllowed = contentScript.matches.some(pattern => new RegExp(pattern.replace(/\*/g, '.*')).test(tab.url)) && tab.url.startsWith('http');

                if (urlIsAllowed) {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id, allFrames: contentScript.all_frames },
                        files: jsFiles
                    }).catch(err => console.log("Error injecting script:", err, "on tab:", tab.url));

                    chrome.scripting.insertCSS({
                        target: { tabId: tab.id, allFrames: contentScript.all_frames },
                        files: cssFiles
                    }).catch(err => console.log("Error injecting CSS:", err, "on tab:", tab.url));
                }
            });
        });
    });
};


chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        console.log("This is a first install!");
        injectScriptsInExistingTabs();
    }
});