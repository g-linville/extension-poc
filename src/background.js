const tabIdQueue = [];

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type !== 'wsData') {
        return;
    }

    const direction = message.direction === 'sent' ? 'Sent' : 'Received';
    if (direction === 'Sent') {
        return;
    }

    const msg = JSON.parse(message.data);

    let tab;
    let result;
    switch (msg['command']) {
        case 'open':
            chrome.tabs.create({ url: msg['url'] }, (tab) => {
                console.log("Opened tab with url", msg['url'], "and tab id", tab.id);

                // Wait for the tab to complete loading, then inject the content script
                chrome.tabs.onUpdated.addListener(function onTabUpdated(tabId, changeInfo) {
                    if (tabId === tab.id && changeInfo.status === 'complete') {
                        // Remove the listener once we are done
                        chrome.tabs.onUpdated.removeListener(onTabUpdated);

                        // Inject the content script into the newly opened tab
                        tabIdQueue.push(tab.id);
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: extractContent,
                        }).then(result => {
                            sendWebsocket({'ok': true, 'content': result[0].result, 'tabId': tab.id});
                        });
                    }
                });
            });
            break;
        case 'tabStatus':
            tab = await chrome.tabs.get(parseInt(msg['tabId']));
            if (tab) {
                sendWebsocket({'ok': true, 'url': tab.url});
            } else {
                sendWebsocket({'ok': false, 'error': 'Tab with id ' + msg['tabId'] + ' not found' });
            }
            break;
        case 'browse':
            tab = await chrome.tabs.get(parseInt(msg['tabId']));
            if (tab) {
                if (msg['url']) {
                    await chrome.tabs.update(parseInt(msg['tabId']), {url: msg['url']});
                }
                chrome.scripting.executeScript({
                    target: { tabId: parseInt(msg['tabId']) },
                    func: extractContent,
                }).then(result => {
                    sendWebsocket({'ok': true, 'content': result[0].result, 'tabId': msg['tabId']});
                });
            } else {
                sendWebsocket({'ok': false, 'error': 'Tab with id ' + msg['tabId'] + ' not found' });
            }
            break;
        case 'makeActive':
            await chrome.tabs.update(parseInt(msg['tabId']), { active: true });
            sendWebsocket({'ok': true});
            break;
        case 'fill':
            tab = await chrome.tabs.get(parseInt(msg['tabId']));
            if (tab) {
                result = await chrome.scripting.executeScript({
                    target: { tabId: parseInt(msg['tabId']) },
                    func: fill,
                    args: [msg['contents'], msg['selector']]
                });
                for (const r of result) {
                    sendWebsocket(r.result);
                }
            } else {
                sendWebsocket({'ok': false, 'error': 'Tab with id ' + msg['tabId'] + ' not found' });
            }
            break;
        case 'enter':
            tab = await chrome.tabs.get(parseInt(msg['tabId']));
            if (tab) {
                result = await chrome.scripting.executeScript({
                    target: { tabId: parseInt(msg['tabId']) },
                    func: enter,
                });
                for (const r of result) {
                    sendWebsocket(r.result);
                }
            } else {
                sendWebsocket({'ok': false, 'error': 'Tab with id ' + msg['tabId'] + ' not found' });
            }
            break;
        case 'back':
            tab = await chrome.tabs.get(parseInt(msg['tabId']));
            if (tab) {
                await chrome.scripting.executeScript({
                    target: { tabId: parseInt(msg['tabId']) },
                    func: () => {
                        window.history.back();
                    },
                }, () => {
                    sendWebsocket({'ok': true});
                });
            } else {
                sendWebsocket({'ok': false, 'error': 'Tab with id ' + msg['tabId'] + ' not found' });
            }
            break;
        case 'forward':
            tab = await chrome.tabs.get(parseInt(msg['tabId']));
            if (tab) {
                await chrome.scripting.executeScript({
                    target: { tabId: parseInt(msg['tabId']) },
                    func: () => {
                        window.history.forward();
                    },
                }, () => {
                    sendWebsocket({'ok': true});
                });
            } else {
                sendWebsocket({'ok': false, 'error': 'Tab with id ' + msg['tabId'] + ' not found' });
            }
            break;
        case 'click':
            tab = await chrome.tabs.get(parseInt(msg['tabId']));
            if (tab) {
                result = await chrome.scripting.executeScript({
                    target: { tabId: parseInt(msg['tabId']) },
                    func: click,
                    args: [msg['selector']]
                })
                for (const r of result) {
                    sendWebsocket(r.result);
                }
            } else {
                sendWebsocket({'ok': false, 'error': 'Tab with id ' + msg['tabId'] + ' not found' });
            }
            break;
        case 'scroll':
            tab = await chrome.tabs.get(parseInt(msg['tabId']));
            if (tab) {
                result = await chrome.scripting.executeScript({
                    target: { tabId: parseInt(msg['tabId']) },
                    func: scroll,
                });
                for (const r of result) {
                    sendWebsocket(r.result);
                }
            } else {
                sendWebsocket({'ok': false, 'error': 'Tab with id ' + msg['tabId'] + ' not found' });
            }
            break;
        case 'screenshot':
            await checkAndCaptureTab(parseInt(msg['tabId']), msg['fullPage']);
            break;
        case 'close':
            tab = await chrome.tabs.get(parseInt(msg['tabId']));
            if (tab) {
                await chrome.tabs.remove(parseInt(msg['tabId']));
                sendWebsocket({'ok': true});
            } else {
                sendWebsocket({'ok': false, 'error': 'Tab with id ' + msg['tabId'] + ' not found' });
            }
            break;
        default:
            sendWebsocket({'ok': false, 'error': 'Unknown command ' + msg['command']});
            break;
    }
});

async function checkAndCaptureTab(tabId, fullPage) {
    let attempts = 0;
    while (attempts < 11) {
        attempts++;
        const hasPermission = await new Promise((resolve) => {
            chrome.permissions.contains({ permissions: ['debugger'] }, resolve);
        });

        let params = { format: 'png' };
        if (fullPage) {
            params = { format: 'png', captureBeyondViewport: true };
        }

        if (hasPermission) {
            // Attach the debugger to the tab and capture the screenshot
            try {
                chrome.debugger.attach({ tabId }, '1.3', () => {
                    chrome.debugger.sendCommand(
                        { tabId },
                        'Page.captureScreenshot',
                        params,
                        (result) => {
                            if (chrome.runtime.lastError) {
                                sendWebsocket({'ok': false, 'error': 'Error capturing screenshot: ' + chrome.runtime.lastError.message});
                            } else {
                                sendWebsocket({'ok': true, 'screenshot': result.data});
                            }
                            chrome.debugger.detach({ tabId });
                        }
                    );
                });
            } catch (error) {
                console.log('Error capturing tab:', error);
                void chrome.debugger.detach({ tabId });
            }

            return true;
        } else {
            console.log('debugger permission is not available, retrying...');
        }

        // Wait for a short period before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return false;
}

function sendWebsocket(response) {
    chrome.tabs.query({
        url: 'http://localhost:9090/'
    }, (tabs) => {
        if (tabs.length > 0) {
            void chrome.tabs.sendMessage(tabs[0].id, {
                type: 'wsOut',
                data: JSON.stringify(response),
            });
        } else {
            console.log("Error: tab not found");
        }
    })
}

function fill(contents, selector, text) {
    const e = document.querySelector(selector);
    if (e) {
        e.value = contents;
        return {'ok': true};
    } else {
        return {'ok': false, 'error': 'Element with selector ' + selector + ' not found' };
    }
}

function enter() {
    const enterKeyEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
    });

    const e = document.activeElement;
    if (e) {
        e.dispatchEvent(enterKeyEvent);
        return {'ok': true};
    } else {
        return {'ok': false, 'error': 'No active element found' };
    }
}

function click(selector, text) {
    const e = document.querySelector(selector);
    if (e) {
        e.click();
        return {'ok': true};
    }
    return {'ok': false, 'error': 'Element with selector ' + selector + ' not found'};
}

function scroll() {
    window.scrollBy(0, window.innerHeight);
    return {'ok': true};
}

function extractContent() {
    return document.documentElement.outerHTML;
}
