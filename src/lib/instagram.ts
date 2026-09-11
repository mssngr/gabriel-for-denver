export interface FeedframerPost {
  id: string
  caption: string | null
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS'
  mediaUrl: string
  thumbnailUrl: string | null
  permalink: string
}

interface FeedframerResponse {
  posts: FeedframerPost[]
}

const FEEDFRAMER_API_URL = 'https://feedframer.com/api/v1/me'
const POSTS_PER_PAGE = 6
const MAX_ALT_TEXT_LENGTH = 140

// Videos only expose a playable mediaUrl, so the thumbnail is what's actually
// displayable as an <img>; images have no thumbnail and use mediaUrl directly.
export function displayImageUrl(post: FeedframerPost): string {
  return post.thumbnailUrl || post.mediaUrl
}

// `fallback` is caller-supplied (rather than a hardcoded English string) so
// this stays correct on both the English and Spanish home pages.
export function altTextFor(post: FeedframerPost, fallback: string): string {
  if (!post.caption) return fallback
  if (post.caption.length <= MAX_ALT_TEXT_LENGTH) return post.caption
  return `${post.caption.slice(0, MAX_ALT_TEXT_LENGTH)}…`
}

export async function getInstagramPosts(
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<FeedframerPost[]> {
  if (!apiKey) return []

  try {
    const response = await fetchImpl(
      `${FEEDFRAMER_API_URL}?api_key=${apiKey}&page[size]=${POSTS_PER_PAGE}`,
    )
    if (!response.ok) {
      throw new Error(`Feedframer API returned ${response.status}`)
    }
    const data = (await response.json()) as FeedframerResponse
    return data.posts ?? []
  } catch (error) {
    console.warn('Failed to fetch Instagram feed from Feedframer:', error)
    return []
  }
}
