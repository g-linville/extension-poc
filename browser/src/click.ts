import * as lib from './lib.ts'
import { inspect } from './browse.ts'

export async function click (tabId: string, model: string, userInput: string, keywords: string[], matchTextOnly: boolean): Promise<string> {
  const browseResp = await lib.browse(tabId)
  if (!browseResp.ok) {
    throw new Error(`Failed to browse: ${browseResp.error}`)
  }

  const locator = await inspect(browseResp.content, model, userInput, 'click', matchTextOnly, keywords)
  const clickResp = await lib.click(tabId, locator.selector)
  if (clickResp.error && clickResp.error !== '') {
    return clickResp.error
  }

  return 'success'
}
