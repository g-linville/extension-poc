import { GPTScript } from '@gptscript-ai/gptscript'
import { createHash } from 'node:crypto'
import * as lib from './lib.ts'

const client = new GPTScript()

export interface ScreenshotInfo {
  tabId: string
  tabPageUrl: string
  takenAt: number
  imageWorkspaceFile: string
  imageDownloadUrl: string | undefined
}

export async function screenshot (
  tabId: string,
  fullPage: boolean = false): Promise<ScreenshotInfo> {
  const statusResp = await lib.tabStatus(tabId)
  if (statusResp.error) {
    throw new Error(`Failed to get tab status: ${statusResp.error}`)
  }

  // Generate a unique workspace file name for the screenshot
  const timestamp = Date.now()
  const pageHash = createHash('sha256').update(statusResp.url).digest('hex').substring(0, 8)
  const screenshotName = `screenshot-${timestamp}_${pageHash}.png`

  try {
    // Take the screenshot
    const screenshotResp = await lib.screenshot(tabId, fullPage)
    if (screenshotResp.error) {
      throw new Error(`Failed to take screenshot: ${screenshotResp.error}`)
    }

    // If we are running in otto8, we need to save the screenshot in the files directory
    const workspaceId = process.env.GPTSCRIPT_WORKSPACE_ID
    const screenshotPath = workspaceId !== undefined ? `files/${screenshotName}` : screenshotName

    // Save the screenshot to the workspace
    await client.writeFileInWorkspace(screenshotPath, Buffer.from(screenshotResp.screenshot, 'base64'), workspaceId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to save screenshot to workspace: ${msg}`)
  }

  // Build the download URL used by the UI to display the image
  let downloadUrl: string | undefined
  const ottoServerUrl = process.env.OTTO8_SERVER_URL
  const threadId = process.env.OTTO8_THREAD_ID
  if (ottoServerUrl !== undefined && threadId !== undefined) {
    downloadUrl = `${ottoServerUrl}/api/threads/${threadId}/file/${screenshotName}`
  }

  return {
    tabId,
    tabPageUrl: statusResp.url,
    takenAt: timestamp,
    imageWorkspaceFile: screenshotName,
    imageDownloadUrl: downloadUrl
  }
}
