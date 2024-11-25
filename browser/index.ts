import { browse, filterContent } from './src/browse.ts'
import { fill } from './src/fill.ts'
import { enter } from './src/enter.ts'
import { scrollToBottom } from './src/scrollToBottom.ts'
import { screenshot, ScreenshotInfo } from './src/screenshot.ts'
import * as lib from './src/lib.ts'
import { click } from './src/click.ts'

if (process.argv.length !== 3) {
  console.error('Usage: node index.ts <command>')
  process.exit(1)
}

const command = process.argv[2]

const model: string = process.env.MODEL ?? 'gpt-4o-mini'
const website: string = process.env.WEBSITE ?? ''
const userInput: string = process.env.USERINPUT ?? ''
const keywords: string[] = (process.env.KEYWORDS ?? '').split(',')
const filter: string = process.env.FILTER ?? ''
const followMode: boolean = process.env.FOLLOWMODE === 'false' ? false : Boolean(process.env.FOLLOWMODE)

try {
  const tabId = process.env.TABID ?? ''
  const printTabID = process.env.TABID === undefined
  let takeScreenshot = followMode

  if (tabId) {
    const resp = await lib.makeActive(tabId)
    if (!resp.ok || resp.error) {
      throw new Error(`Failed to make tab active: ${resp.error}`)
    }
  }

  let response: { result?: any, screenshotInfo?: ScreenshotInfo } = {}
  switch (command) {
    case 'browse':
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      response.result = await browse(website, 'browse', tabId, printTabID)
      break

    case 'getFilteredContent':
      response.result = await filterContent(tabId, printTabID, filter)
      break

    case 'getPageContents':
      response.result = await browse(website, 'getPageContents', tabId, printTabID)
      break

    case 'click':
      response.result = await click(tabId, model, userInput, keywords, Boolean(process.env.MATCHTEXTONLY ?? 'false'))
      break

    case 'fill':
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      response.result = await fill(tabId, model, userInput, process.env.CONTENT ?? '', keywords, Boolean(process.env.MATCHTEXTONLY ?? 'false'))
      break

    case 'enter':
      response.result = await enter(tabId)
      break

    case 'scrollToBottom':
      response.result = await scrollToBottom(tabId)
      break

    case 'screenshot':
      takeScreenshot = true
      break

    case 'back':
      const backResp = await lib.back(tabId)
      if (backResp.error) {
        response.result = backResp.error
      }
      break

    case 'forward':
      const forwardResp = await lib.forward(tabId)
      if (forwardResp.error) {
        response.result = forwardResp.error
      }
      break

    default:
      throw new Error(`Unknown command: ${command}`)
  }

  if (takeScreenshot) {
    const fullPage = Boolean(process.env.FULLPAGE ?? 'false')
    response.screenshotInfo = await screenshot(tabId, fullPage)
  }

  console.log(JSON.stringify(response))
} catch (e: any) {
  console.log(`"ok": false, "error": "${e.message}"`)
}
