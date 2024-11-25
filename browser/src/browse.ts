import * as cheerio from 'cheerio'
import { GPTScript } from '@gptscript-ai/gptscript'
import { delay } from './delay.ts'
import { URL } from 'url'
import TurndownService from 'turndown'
import * as lib from './lib.ts'

export async function close (tabId: string): Promise<void> {
  const resp = await lib.close(tabId)
  if (!resp.ok || resp.error) {
    throw new Error(`Failed to close the tab: ${resp.error}`)
  }
}

// browse navigates to the website and returns the text content of the page (if print is true)
export async function browse (website: string, mode: string, tabId: string, printTabID: boolean): Promise<string> {
  let content: string
  if (tabId) {
    const status = await lib.tabStatus(tabId)
    if (!status.ok || status.error) {
      throw new Error(`Tab with ID ${tabId} is not open`)
    }

    if (website !== '' && status.url !== website) {
      const browseResp = await lib.browse(tabId, website)
      content = browseResp.content
    } else {
      const browseResp = await lib.browse(tabId)
      content = browseResp.content
    }
  } else {
    const openResp = await lib.open(website);
    if (!openResp.ok || openResp.error) {
      throw new Error(`Failed to open a new tab: ${openResp.error}`)
    }
    content = openResp.content
    tabId = openResp.tabId
  }

  await delay(3000)

  // TODO - handle iframes?

  let resp = ''
  if (mode === 'getPageContents') {
    const $ = cheerio.load(content)

    $('script').each(function () {
      const elem = $(this)
      elem.contents().filter(function () {
        return this.type === 'text'
      }).remove()
      const children = elem.contents()
      elem.before(children)
      elem.remove()
    })
    $('noscript').remove()
    $('style').remove()
    $('img').remove()
    $('[style]').removeAttr('style')
    $('[onclick]').removeAttr('onclick')
    $('[onload]').removeAttr('onload')
    $('[onerror]').removeAttr('onerror')

    // Remove empty divs and spans
    $('div').each(function () {
      if ($(this).text() === '' && $(this).children().length === 0) {
        $(this).remove()
      }
    })
    $('span').each(function () {
      if ($(this).text() === '' && $(this).children().length === 0) {
        $(this).remove()
      }
    })

    const turndownService = new TurndownService()
    $('body').each(function () {
      resp += turndownService.turndown($.html(this))
    })
  } else if (mode === 'getPageLinks') {
    const statusResp = await lib.tabStatus(tabId)
    if (statusResp.error) {
      throw new Error(`Failed to get tab status for tab ID ${tabId}: ${statusResp.error}`)
    }

    const $ = cheerio.load(content)
    $('a').each(function () {
      const link = new URL($(this).attr('href') ?? '', statusResp.url).toString()
      resp += `[${$(this).text().trim()}](${link.trim()})\n`
    })
  } else if (mode === 'getPageImages') {
    const $ = cheerio.load(content)
    $('img').each(function () {
      resp += `${Object.entries($(this).attr() ?? '').toString()}\n`
    })
  }

  if (printTabID) {
    resp = `Tab ID: ${tabId}\n` + resp
  }
  return resp.split('\n').filter(line => line.trim() !== '').join('\n')
}

export async function filterContent (tabId: string, printTabID: boolean, filter: string): Promise<string> {
  // Navigate and get the page contents
  const browseResp = await lib.browse(tabId)
  if (browseResp.error) {
    throw new Error(`Failed to get the HTML contents of the tab: ${browseResp.error}`)
  }

  const $ = cheerio.load(browseResp.content)
  let filteredContent = ''

  // Check if the filter is an ID, class, or tag selector
  if (filter.startsWith('#') || filter.startsWith('.') || /^[a-zA-Z]/.test(filter)) {
    // Use the filter to select elements matching the CSS selector
    $(filter).each((i, elem) => {
      filteredContent += $.html(elem)
    })
  } else {
    throw new Error(`Invalid filter format: ${filter}. Use a CSS ID, class, or tag selector.`)
  }

  // Clean up the filtered content
  const clean$ = cheerio.load(filteredContent)
  clean$('script').each(function () {
    const elem = $(this)
    // Remove text nodes inside the script tag
    elem.contents().filter(function () {
      return this.type === 'text'
    }).remove()
    // Extract the remaining content from the script tag
    const children = elem.contents()
    elem.before(children)
    elem.remove()
  })
  clean$('noscript, style, img').remove()
  clean$('[style]').removeAttr('style')
  clean$('[onclick], [onload], [onerror]').removeAttr('onclick onload onerror')

  // Remove empty divs and spans
  $('div').each(function () {
    if ($(this).text() === '' && $(this).children().length === 0) {
      $(this).remove()
    }
  })
  $('span').each(function () {
    if ($(this).text() === '' && $(this).children().length === 0) {
      $(this).remove()
    }
  })

  // Remove HTML comment nodes
  clean$('*').contents().filter(function () {
    return this.type === 'comment'
  }).remove()

  let resp = clean$.html().trim()
  if (printTabID) {
    resp = `Tab ID: ${tabId}\n` + clean$.html().trim()
  }

  return resp.split('\n').filter(line => line.trim() !== '').join('\n')
}

export type Locator = {
  selector: string
}

// inspect inspects a webpage and returns a locator for a specific element based on the user's input and action.
export async function inspect (html: string, model: string, userInput: string, action: string, matchTextOnly: boolean, keywords?: string[]): Promise<Locator> {
  if (userInput === '') {
    // This shouldn't happen, since the LLM is told that it must fill in the user input,
    // but in case it doesn't, just use the keywords.
    userInput = keywords?.join(' ') ?? ''
  }

  let elementData = ''
  const modes = ['matchAll', 'oneSibling', 'twoSiblings', 'parent', 'grandparent', 'matchAny']
  // TODO - improve this so that we stop faster
  if (matchTextOnly) {
    const elementDataPromises = modes.map(async mode => await summarize(html, keywords ?? [], action, mode, true))
    const results = await Promise.all(elementDataPromises)
    for (const result of results) {
      if (result !== '') {
        elementData = result
        break
      }
    }
  }

  if (elementData === '') {
    // Do it again, but don't match text only
    const elementDataPromises = modes.map(async mode => await summarize(html, keywords ?? [], action, mode, false))
    const results = await Promise.all(elementDataPromises)
    for (const result of results) {
      if (result !== '') {
        elementData = result
        break
      }
    }
  }

  if (elementData === '') {
    // Do it again, but split the keywords by space
    const elementDataPromises = modes.map(async mode => await summarize(html, keywords?.join(' ')?.split(' ') ?? [], action, mode, true))
    const results = await Promise.all(elementDataPromises)
    for (const result of results) {
      if (result !== '') {
        elementData = result
        break
      }
    }
  }

  // Scroll the page to get more data and try to find the element
  // Retry 10 times also to give user time to sign in if the landing page requires sign in
  let retry = 0
  while (elementData === '' && retry < 10) {
    // TODO - implement a scrollAllScrollables operation and call it here
    // await page.evaluate(() => {
    //   const allElements = Array.from(document.querySelectorAll('div'))
    //   const scrollables = allElements.filter(e => ((e.getAttribute('style')?.includes('overflow: auto') ?? false) || (e.getAttribute('style')?.includes('overflow: scroll') ?? false)))
    //   if (scrollables.length > 0) {
    //     scrollables[0].scrollBy(0, window.innerHeight)
    //   }
    // })
    await delay(2000)
    elementData = await summarize(html, keywords ?? [], action, 'matchAny', false)
    retry++
  }

  // Safeguard to try to avoid breaking the context window
  if (elementData.length > 200000) {
    elementData = elementData.substring(0, 200000)
  }

  const instructions = getActionInstructions(action, { userInput, elementData })
  const client = new GPTScript()
  const run = await client.evaluate({
    modelName: model,
    instructions
  })

  const output = (await run.text()).replace('\n', '').trim()
  return JSON.parse(output) as Locator
}

function matchKeywords ($: cheerio.CheerioAPI, e: cheerio.Element, keywords: string[], mode: string, textOnly: boolean): string | null {
  let html = ''
  let text = ''
  switch (mode) {
    case 'matchAll':
      if (textOnly && keywords.every(keyword => $(e).text().toLowerCase().includes(keyword.toLowerCase()) || $(e).attr('value')?.toLowerCase().includes(keyword.toLowerCase()))) {
        return $.html(e)
      } else if (!textOnly && keywords.every(keyword => $.html(e).toLowerCase().includes(keyword.toLowerCase()))) {
        return $.html(e)
      }
      break
    case 'oneSibling':
      if (textOnly) {
        if (e.prev !== null) {
          text += $(e.prev).text()
          html += $.html(e.prev)
        }
        text += $(e).text()
        html += $.html(e)
        if (e.next !== null) {
          text += $(e.next).text()
          html += $.html(e.next)
        }
        if (keywords.every(keyword => text.toLowerCase().includes(keyword.toLowerCase()) || $(e).attr('value')?.toLowerCase().includes(keyword.toLowerCase()))) {
          return html
        }
      } else {
        if (e.prev !== null) {
          html += $.html(e.prev)
        }
        html += $.html(e)
        if (e.next !== null) {
          html += $.html(e.next)
        }
        if (keywords.every(keyword => html.toLowerCase().includes(keyword.toLowerCase()))) {
          return html
        }
      }
      break
    case 'twoSiblings':
      if (textOnly) {
        if (e.prev?.prev !== null) {
          text += $(e.prev?.prev).text()
          html += $.html(e.prev?.prev)
        }
        if (e.prev !== null) {
          text += $(e.prev).text()
          html += $.html(e.prev)
        }
        text += $(e).text()
        html += $.html(e)
        if (e.next !== null) {
          text += $(e.next).text()
          html += $.html(e.next)
        }
        if (e.next?.next !== null) {
          text += $(e.next?.next).text()
          html += $.html(e.next?.next)
        }
        if (keywords.every(keyword => text.toLowerCase().includes(keyword.toLowerCase()) || $(e).attr('value')?.toLowerCase().includes(keyword.toLowerCase()))) {
          return html
        }
      } else {
        if (e.prev?.prev !== null) {
          html += $.html(e.prev?.prev)
        }
        if (e.prev !== null) {
          html += $.html(e.prev)
        }
        html += $.html(e)
        if (e.next !== null) {
          html += $.html(e.next)
        }
        if (e.next?.next !== null) {
          html += $.html(e.next?.next)
        }
        if (keywords.every(keyword => html.toLowerCase().includes(keyword.toLowerCase()))) {
          return html
        }
      }
      break
    case 'parent':
      if (e.parent !== null) {
        text = $(e.parent).text()
        html = $.html(e.parent)
        if (textOnly && keywords.every(keyword => text.toLowerCase().includes(keyword.toLowerCase()) || $(e).attr('value')?.toLowerCase().includes(keyword.toLowerCase()))) {
          return html
        } else if (!textOnly && keywords.every(keyword => html.toLowerCase().includes(keyword.toLowerCase()))) {
          return html
        }
      }
      break
    case 'grandparent':
      if (e.parent?.parent !== null) {
        text = $(e.parent?.parent).text()
        html = $.html(e.parent?.parent)
        if (textOnly && keywords.every(keyword => text.toLowerCase().includes(keyword.toLowerCase()) || $(e).attr('value')?.toLowerCase().includes(keyword.toLowerCase()))) {
          return html
        } else if (!textOnly && keywords.every(keyword => html.toLowerCase().includes(keyword.toLowerCase()))) {
          return html
        }
      }
      break
    case 'matchAny':
      if (textOnly && keywords.some(keyword => $(e).text().toLowerCase().includes(keyword.toLowerCase()) || $(e).attr('value')?.toLowerCase().includes(keyword.toLowerCase()))) {
        return $.html(e)
      } else if (keywords.some(keyword => $.html(e).toLowerCase().includes(keyword.toLowerCase()))) {
        return $.html(e)
      }
      break
  }

  return null
}

// summarize returns relevant HTML elements for the given keywords and action
export async function summarize (html: string, keywords: string[], action: string, mode: string, matchTextOnly: boolean): Promise<string> {
  const $ = cheerio.load(html)

  $('noscript').remove()
  $('style').remove()
  $('[style]').removeAttr('style')

  let resp = ''
  // For search, we need to find all the input and textarea elements and figure that out
  if (action === 'fill') {
    $('textarea').each(function () {
      if (keywords.length !== 0) {
        const res = matchKeywords($, this, keywords, mode, matchTextOnly)
        if (res !== null && res !== '') {
          resp += res + '\n\n'
        }
      } else {
        resp += $.html(this) + '\n\n'
      }
    })
    $('input[id]').each(function () {
      if (keywords.length !== 0) {
        const res = matchKeywords($, this, keywords, mode, matchTextOnly)
        if (res !== null && res !== '') {
          resp += res + '\n\n'
        }
      } else {
        resp += $.html(this) + '\n\n'
      }
    })
    $('input').each(function () {
      if (keywords.length !== 0) {
        const res = matchKeywords($, this, keywords, mode, matchTextOnly)
        if (res !== null && res !== '') {
          resp += res + '\n\n'
        }
      } else {
        resp += $.html(this) + '\n\n'
      }
    })
    $('form').each(function () {
      if (keywords.length !== 0) {
        const res = matchKeywords($, this, keywords, mode, matchTextOnly)
        if (res !== null && res !== '') {
          resp += res + '\n\n'
        }
      } else {
        resp += $.html(this) + '\n\n'
      }
    })
    $('div').each(function () {
      if (keywords.length !== 0) {
        if ($(this).attr('contenteditable') === 'true') {
          const res = matchKeywords($, this, keywords, mode, matchTextOnly)
          if (res !== null && res !== '') {
            resp += res + '\n\n'
          }
        }
      }
    })
  }

  if (action === 'check') {
    $('input[type="checkbox"]').parents().each(function () {
      const res = matchKeywords($, this, keywords, mode, matchTextOnly)
      if (res !== null && res !== '') {
        resp += res + '\n\n'
      }
    })
  }

  if (action === 'select') {
    $('select').each(function () {
      resp += $.html(this) + '\n\n'
    })
  }

  if (action === 'screenshot') {
    // For screenshot, we want to remove scripts, text-only elements, styles, and other junk
    // so that we can hand the more structural elements to the LLM for it to determine the best locator.
    $('script').remove()
    $('p').remove()
    $('h1').remove()
    $('h2').remove()
    $('h3').remove()
    $('h4').remove()
    $('h5').remove()
    $('li').remove()
    $('a').remove()
    $('[onclick]').removeAttr('onclick')
    $('[onload]').removeAttr('onload')
    $('[onerror]').removeAttr('onerror')
    $('body').each(function () {
      resp += findKeywordsInElement($, this, keywords, mode === 'matchAll') + '\n\n'
    })
  }

  if (action === 'click') {
    $('a').each(function () {
      if (keywords.length !== 0) {
        const res = matchKeywords($, this, keywords, mode, matchTextOnly)
        if (res !== null && res !== '') {
          resp += res + '\n\n'
        }
      } else {
        resp += $.html(this) + '\n\n'
      }
    })
    $('button').each(function () {
      if (keywords.length !== 0) {
        const res = matchKeywords($, this, keywords, mode, matchTextOnly)
        if (res !== null && res !== '') {
          resp += res + '\n\n'
        }
      } else {
        resp += $.html(this) + '\n\n'
      }
    })

    $('div').each(function () {
      if (keywords.length !== 0) {
        if (hasNoNonTextChildren(this)) {
          const res = matchKeywords($, this, keywords, mode, matchTextOnly)
          if (res !== null && res !== '') {
            resp += res + '\n\n'
          }
        }
      } else {
        resp += '<div '
        for (const attr of this.attributes) {
          resp += ` ${attr.name}="${attr.value}"`
        }
        resp += '>' + '\n'
        for (const c of this.children) {
          resp += $.html(c) + '\n'
        }
        resp += '</div>' + '\n\n'
      }
    })

    $('span').each(function () {
      if (keywords.length !== 0) {
        if (hasNoNonTextChildren(this)) {
          const res = matchKeywords($, this, keywords, mode, matchTextOnly)
          if (res !== null && res !== '') {
            resp += res + '\n\n'
          }
        }
      } else {
        resp += '<span '
        for (const attr of this.attributes) {
          resp += ` ${attr.name}="${attr.value}"`
        }
        resp += '>' + '\n'
        for (const c of this.children) {
          resp += $.html(c) + '\n'
        }
        resp += '</span>' + '\n\n'
      }
    })
  }

  return resp
}

function hasNoNonTextChildren (elem: cheerio.Element): boolean {
  for (const child of elem.children) {
    if (child.nodeType !== 3) {
      return false
    }
  }
  return true
}

function getActionInstructions (action: string, args: Record<string, string>): string {
  switch (action) {
    case 'fill':
      return `You are an expert in HTML and CSS.
      Given the following list of HTML elements:
      
      ## START LIST
      ${args.elementData}
      ## END LIST
      
      And given the following description of an element: "${args.userInput}",
      
      Generate a CSS selector that uniquely matches the element from the list that best fits the description.
      The element should be a text input, textarea, or contenteditable.
      Do not escape the selector unless necessary.
      Output example: {"selector": "button.className"`

    default:
      return `You are an expert in HTML and CSS.
      Given the following list of HTML elements:
      
      ## START LIST
      ${args.elementData}
      ## END LIST
      
      And given the following description of an element: "${args.userInput}",
      
      Generate a CSS selector that uniquely matches the element from the list that best fits the description.
      Do not escape the selector unless necessary.
      Output example: {"selector": "button.className"}`
  }
}

const findKeywordsInElement = ($: cheerio.CheerioAPI, elem: cheerio.Element, keywords: string[], matchAll: boolean): string => {
  for (const attr of elem.attributes) {
    if (keywords.every(keyword => attr.value.toLowerCase().includes(keyword.toLowerCase())) ||
      keywords.every(keyword => attr.name.toLowerCase().includes(keyword.toLowerCase()))) {
      return $.html(elem)
    }
  }

  let result = ''
  for (const c of $(elem).children()) {
    result += findKeywordsInElement($, c, keywords, matchAll)
  }
  return result
}
