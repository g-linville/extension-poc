if (window.location.href === 'CLIENT PAGE URL GOES HERE') {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();

    // Listen for messages from the injected script
    window.addEventListener('message', (event) => {
        // Only accept messages from the current window, and ensure they are our custom messages
        if (event.source === window && event.data && event.data.type === 'wsData') {
            // Forward the WebSocket data to the background script
            void chrome.runtime.sendMessage({
                type: 'wsData',
                direction: event.data.direction,
                data: event.data.data
            });
        }
    });
}
