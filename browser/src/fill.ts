import { inspect } from './browse.ts'
import * as lib from './lib.ts'

export async function fill (tabId: string, model: string, userInput: string, content: string, keywords: string[], matchTextOnly: boolean): Promise<string> {
  const browseResp = await lib.browse(tabId)
  if (browseResp.error) {
    throw new Error(`Failed to browse: ${browseResp.error}`)
  }

  const locator = await inspect(browseResp.content, model, userInput, 'fill', matchTextOnly, keywords)
  const fillResp = await lib.fill(tabId, content, locator.selector)
  if (fillResp.error) {
    return fillResp.error
  }

  return 'success'
}
