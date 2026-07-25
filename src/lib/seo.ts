/** Swaps a pathname between its English and Spanish (`/es`-prefixed) equivalent. */
export function alternatePath(pathname: string, locale: 'en' | 'es') {
  const isSpanish = pathname === '/es' || pathname.startsWith('/es/')
  const enPath = isSpanish ? pathname.replace(/^\/es/, '') || '/' : pathname
  return locale === 'en' ? enPath : `/es${enPath === '/' ? '' : enPath}`
}

/** Strips common markdown syntax so content can be reused as plain-text meta description. */
export function stripMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
