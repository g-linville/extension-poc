import * as lib from './lib.ts'

// enter presses the enter key.
export async function enter (tabId: string): Promise<string> {
  const enterResp = await lib.enter(tabId)
  if (enterResp.error) {
    return enterResp.error
  }

  return 'success'
}
