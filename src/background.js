chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'wsData') {
        const direction = message.direction === 'sent' ? 'Sent' : 'Received';
        console.log(`WebSocket ${direction}: ${message.data}`);

        if (direction === 'Sent' && message.data.startsWith('open ')) {
            const url = message.data.split(' ')[1];
            chrome.tabs.create({ url: url }, (tab) => {
                console.log("Opened tab with url", url);
            });
        }
    }
});
