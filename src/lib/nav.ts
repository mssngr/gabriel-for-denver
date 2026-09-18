/**
 * Whether a nav link points at the page being viewed, or at a section it sits
 * inside — which is what the header highlights.
 *
 * Compares whole path segments rather than substrings: a guide slug that
 * merely starts another's (`food-security` inside `food-security-funding`)
 * would otherwise light up two nav items at once. Language is part of the
 * href, so an English link never matches its Spanish page.
 */
export function isCurrentSection(currentPath: string, href: string): boolean {
  const path = currentPath.replace(/\/$/, '')
  const target = href.replace(/\/$/, '')
  return path === target || path.startsWith(`${target}/`)
}
