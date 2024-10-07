(function() {
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    sleep(2000).then(() => {
        const socket = window.wsInstance;
        setupWebSocketInterceptor(socket);
    })

    function setupWebSocketInterceptor(wsInstance) {
        // Override the WebSocket's send method
        const originalSend = wsInstance.send;
        wsInstance.send = function(data) {
            // Log and send the outgoing message to the content script via `postMessage`
            console.log(`Sent: ${data}`);
            window.postMessage({
                type: 'wsData',
                direction: 'sent',
                data: data
            }, '*');
            return originalSend.apply(wsInstance, arguments);
        };

        // Listen for incoming messages on the WebSocket
        wsInstance.addEventListener('message', (event) => {
            console.log(`Received: ${event.data}`);
            window.postMessage({
                type: 'wsData',
                direction: 'received',
                data: event.data
            }, '*');
        });
    }
})();
