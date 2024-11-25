import * as lib from './lib.ts'

export async function scrollToBottom (tabId: string): Promise<string> {
  const scrollResp = await lib.scroll(tabId)
  if (scrollResp.error) {
    return scrollResp.error
  }

  return 'success'
}
