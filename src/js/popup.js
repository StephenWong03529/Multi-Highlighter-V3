// popup.js (V3 Compatible)
!function () {
    // Helper function to communicate with the service worker.
    async function rpc(func, ...args) {
        return chrome.runtime.sendMessage({ opt: "rpc", func, args });
    }

    // Main function to initialize the popup
    async function initializePopup() {
        // --- Get DOM Elements ---
        const highlightWordsDiv = document.getElementById('highlight-words');
        const switcher = document.getElementById('switcher');
        const textarea = document.createElement('textarea');
        textarea.setAttribute('spellcheck', 'false');

        // --- Fetch Initial State from Service Worker ---
        const initialKeywords = await rpc('getKeywordsString');
        const initialStatus = await rpc('getActiveStatus');

        // --- Populate the UI ---
        textarea.value = initialKeywords || "";
        const initialHeight = highlightWordsDiv.offsetHeight + 50;
        textarea.style.height = `${initialHeight > 530 ? 530 : initialHeight}px`;
        textarea.style.width = `${highlightWordsDiv.offsetWidth}px`;
        textarea.style.maxWidth = `${highlightWordsDiv.offsetWidth}px`;

        highlightWordsDiv.innerHTML = '';
        highlightWordsDiv.appendChild(textarea);
        
        switcher.setAttribute('data-on', initialStatus ? 'true' : 'false');

        // --- Set up Event Listeners ---
        let statusTimeout, keywordsTimeout;

        // Listener for the on/off switcher
        switcher.addEventListener('click', () => {
            const isOn = switcher.getAttribute('data-on') === 'true';
            switcher.setAttribute('data-on', !isOn ? 'true' : 'false');
            
            clearTimeout(statusTimeout);
            statusTimeout = setTimeout(() => {
                rpc('setActiveStatus', !isOn);
            }, 100);
        });

        // Listener for the textarea input
        textarea.addEventListener('keyup', (e) => {
            clearTimeout(keywordsTimeout);
            keywordsTimeout = setTimeout(() => {
                rpc('setKeywordsString', textarea.value);
            }, 150); // Debounce to prevent sending too many messages
        });
        
        // --- Final UI adjustments ---
        // Auto-focus and move cursor to the end
        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
            document.getElementById('footer').scrollIntoView();
        }, 100);
    }

    // Run the initialization function when the popup DOM is loaded.
    document.addEventListener('DOMContentLoaded', initializePopup);

}();