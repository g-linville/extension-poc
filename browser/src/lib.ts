export interface OpenResponse {
  tabId: string,
  content: string,
  ok: boolean,
  error?: string,
}

export async function open(url: string): Promise<OpenResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'open',
      'url': url,
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to open"}
}

export interface BrowseResponse {
  content: string,
  ok: boolean,
  error?: string,
}

export async function browse(tabId: string, url?: string): Promise<BrowseResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'browse',
      'tabId': tabId,
      'url': url,
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to browse"}
}

export interface ScreenshotResponse {
  screenshot: string,
  ok: boolean,
  error?: string,
}

export async function screenshot(tabId: string, fullPage: boolean): Promise<ScreenshotResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'screenshot',
      'tabId': tabId,
      'fullPage': fullPage,
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to take screenshot"}
}

export interface TabStatusResponse {
  url: string,
  ok: boolean,
  error?: string,
}

export async function tabStatus(tabId: string): Promise<TabStatusResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'tabStatus',
      'tabId': tabId,
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to get tab status"}
}

export interface GenericResponse {
  ok: boolean
  error?: string
}

export async function makeActive(tabId: string): Promise<GenericResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'makeActive',
      'tabId': tabId,
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to make tab active"}
}

export async function fill(tabId: string, contents: string, selector: string) : Promise<GenericResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'fill',
      'tabId': tabId,
      'contents': contents,
      'selector': selector
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to fill"}
}

export async function enter(tabId: string): Promise<GenericResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'enter',
      'tabId': tabId,
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to press enter"}
}

export async function back(tabId: string): Promise<GenericResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'back',
      'tabId': tabId,
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to go back"}
}

export async function forward(tabId: string): Promise<GenericResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'forward',
      'tabId': tabId,
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to go forward"}
}

export async function click(tabId: string, selector: string): Promise<GenericResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'click',
      'tabId': tabId,
      'selector': selector
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to click"}
}

export async function scroll(tabId: string): Promise<GenericResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'scroll',
      'tabId': tabId,
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to scroll"}
}

export async function close(tabId: string): Promise<GenericResponse> {
  const resp = await fetch('http://localhost:8080/send', {
    method: 'POST',
    body: JSON.stringify({
      'command': 'close',
      'tabId': tabId,
    })
  })
  return await resp.json() ?? {"ok": false, "error": "Failed to close tab"}
}
