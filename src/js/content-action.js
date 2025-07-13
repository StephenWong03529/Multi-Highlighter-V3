// content-action.js (V3 Compatible)
!function (a, b) {
    // Helper function for making async RPC calls to the service worker
    // This replaces the old jQuery Deferred wrapper.
    async function rpc(func, ...args) {
        return chrome.runtime.sendMessage({ opt: "rpc", func, args });
    }

    async function applyHighlight(targetNode, isFullReHighlight = false) {
        if (isActive) {
            highlighter.highlight(targetNode || document.body, keywords, isFullReHighlight);
        }
    }

    function clearHighlight(targetNode) {
        highlighter.clearHighlighted(targetNode || document.body);
    }

    // Initialize the script's state from the service worker
    async function initialize() {
        keywords = await rpc("getKeywords");
        isActive = await rpc("getActiveStatus");

        applyHighlight();
        setupListeners();
    }

    function setupListeners() {
        // This listens for the custom event triggered by the message listener below.
        // It handles state changes initiated from other parts of the extension (like the popup).
        b.on("storageChange", async (event, data) => {
            if (data.key === 'isActive') {
                isActive = await rpc('getActiveStatus');
                if (isActive) {
                    applyHighlight();
                } else {
                    clearHighlight();
                }
            }
            if (data.key === 'keywordsArray') {
                // Use a debounce timeout to avoid re-highlighting on every keystroke from the popup.
                clearTimeout(highlightTimeout);
                highlightTimeout = setTimeout(async () => {
                    keywords = await rpc('getKeywords');
                    applyHighlight(null, true); // Full re-highlight
                }, 200);
            }
        });

        // Use MutationObserver instead of the deprecated DOMSubtreeModified
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        // We only care about element nodes, not text nodes
                        if (node.nodeType === 1) {
                            applyHighlight(node);
                        }
                    });
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    let keywords = [];
    let isActive = true;
    let highlightTimeout;

    // This listener receives messages directly from the service worker.
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.opt === "event" && message.event === "storageChange") {
            // Trigger the custom jQuery event to be handled by our listeners.
            b.trigger(message.event, message.args);
        }
        // It's good practice to return true if you might send a response asynchronously,
        // though in this case, we are not.
        return false;
    });

    // Start the script
    initialize();

}(this, $(this));