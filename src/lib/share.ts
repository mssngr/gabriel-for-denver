/**
 * Sharing a link to a guide page or one of its planks.
 *
 * Uses the native share sheet where the browser has one (most phones), and
 * copies the link otherwise. Kept free of the DOM and the global `navigator`
 * so each path can be unit tested by handing in a stand-in.
 */

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable'

export type ShareTarget = { title: string; url: string }

/** The two browser capabilities this needs, both optional. */
export type ShareCapabilities = {
  share?: (data: ShareData) => Promise<void>
  clipboard?: { writeText: (text: string) => Promise<void> }
}

export async function sharePage(
  target: ShareTarget,
  capabilities: ShareCapabilities,
): Promise<ShareOutcome> {
  if (capabilities.share) {
    try {
      await capabilities.share({ title: target.title, url: target.url })
      return 'shared'
    } catch (error) {
      // Dismissing the sheet is a choice. Copying anyway would announce
      // "Link copied" for something the reader just cancelled.
      if (error instanceof Error && error.name === 'AbortError') {
        return 'cancelled'
      }
    }
  }

  if (!capabilities.clipboard) return 'unavailable'
  try {
    await capabilities.clipboard.writeText(target.url)
    return 'copied'
  } catch {
    return 'unavailable'
  }
}
