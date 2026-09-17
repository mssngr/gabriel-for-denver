import { describe, expect, it, vi } from 'vitest'
import { sharePage } from './share'

const page = {
  title: 'Housing Crisis | Gabriel for Denver',
  url: 'https://gabrielfordenver.com/platform/housing-crisis/',
}

const domError = (name: string) => Object.assign(new Error(name), { name })

describe('sharePage', () => {
  it('opens the native share sheet when the browser has one', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    const outcome = await sharePage(page, { share, clipboard: { writeText } })
    expect(outcome).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: page.title, url: page.url })
    expect(writeText).not.toHaveBeenCalled()
  })

  // Dismissing the share sheet is a choice, not a failure. Copying the link
  // anyway would announce "Link copied" for something the reader cancelled.
  it('treats a dismissed share sheet as cancelled without copying', async () => {
    const share = vi.fn().mockRejectedValue(domError('AbortError'))
    const writeText = vi.fn()
    const outcome = await sharePage(page, { share, clipboard: { writeText } })
    expect(outcome).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies the link when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const outcome = await sharePage(page, { clipboard: { writeText } })
    expect(outcome).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(page.url)
  })

  it('falls back to copying when the share sheet fails for another reason', async () => {
    const share = vi.fn().mockRejectedValue(domError('NotAllowedError'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    const outcome = await sharePage(page, { share, clipboard: { writeText } })
    expect(outcome).toBe('copied')
  })

  it('reports that sharing is unavailable when copying is refused too', async () => {
    const writeText = vi.fn().mockRejectedValue(domError('NotAllowedError'))
    expect(await sharePage(page, { clipboard: { writeText } })).toBe(
      'unavailable',
    )
  })

  it('reports that sharing is unavailable when the browser offers neither', async () => {
    expect(await sharePage(page, {})).toBe('unavailable')
  })
})
