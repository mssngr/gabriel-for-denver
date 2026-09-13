const MARKER = 'data-sheet-inert'

/**
 * Marks everything outside the open plank sheet `inert`, so a keyboard user
 * can't tab into content the scrim is covering.
 *
 * Derived from "what is open right now" rather than applied as open/close
 * deltas, and that is the whole design. Opening a second panel while the first
 * is still open runs both a promote and a demote whose ancestor chains overlap
 * — two competing "everything except me" passes over the same siblings. The
 * delta version left the header and footer interactive behind the scrim and
 * left the first band permanently inert, which disables its own toggle, since
 * `inert` cascades to descendants. Recomputing from scratch every time is
 * idempotent, so any ordering of those events converges on the right answer.
 *
 * Only elements this function marked are ever released, so an `inert` set for
 * some other reason survives.
 */
export function applySheetInert(
  open: Element | null,
  body: HTMLElement = document.body,
): void {
  for (const marked of Array.from(body.querySelectorAll(`[${MARKER}]`))) {
    ;(marked as HTMLElement).inert = false
    marked.removeAttribute(MARKER)
  }
  if (!open || !body.contains(open)) return

  let element: Element | null = open
  while (element && element !== body) {
    const parent: HTMLElement | null = element.parentElement
    if (!parent) return
    for (const sibling of Array.from(parent.children)) {
      if (sibling === element) continue
      // Already inert for some other reason: leave it unmarked, so releasing
      // the sheet later doesn't hand interactivity back to something that was
      // never ours to enable.
      if ((sibling as HTMLElement).inert) continue
      ;(sibling as HTMLElement).inert = true
      sibling.setAttribute(MARKER, '')
    }
    element = parent
  }
}
