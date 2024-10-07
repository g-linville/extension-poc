if (window.location.href === 'file:///Users/grant/pdevel/extension-poc/ws-stuff/client/index.html') {
    // Inject `injected.js` into the webpage
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();

    // Listen for messages from the `injected.js` script running in the page context
    window.addEventListener('message', (event) => {
        // Only accept messages from the current window, and ensure they are our custom messages
        if (event.source === window && event.data && event.data.type === 'wsData') {
            // Forward the WebSocket data to the background script using `chrome.runtime.sendMessage`
            void chrome.runtime.sendMessage({
                type: 'wsData',
                direction: event.data.direction,
                data: event.data.data
            });
        }
    });
}
