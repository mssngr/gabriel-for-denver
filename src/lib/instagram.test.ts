import { describe, expect, it, vi } from 'vitest'
import {
  altTextFor,
  displayImageUrl,
  type FeedframerPost,
  getInstagramPosts,
} from './instagram'

function makePost(overrides: Partial<FeedframerPost> = {}): FeedframerPost {
  return {
    id: '1',
    caption: null,
    mediaType: 'IMAGE',
    mediaUrl: 'https://cdn.feedframer.com/example/media.jpg',
    thumbnailUrl: null,
    permalink: 'https://www.instagram.com/p/example/',
    ...overrides,
  }
}

describe('displayImageUrl', () => {
  it('prefers the thumbnail when one exists (video posts)', () => {
    const post = makePost({
      mediaType: 'VIDEO',
      mediaUrl: 'https://cdn.feedframer.com/example/video.mp4',
      thumbnailUrl: 'https://cdn.feedframer.com/example/thumbnail.jpg',
    })
    expect(displayImageUrl(post)).toBe(
      'https://cdn.feedframer.com/example/thumbnail.jpg',
    )
  })

  it('falls back to the media URL when there is no thumbnail (image posts)', () => {
    const post = makePost({
      mediaType: 'IMAGE',
      mediaUrl: 'https://cdn.feedframer.com/example/media.jpg',
      thumbnailUrl: null,
    })
    expect(displayImageUrl(post)).toBe(
      'https://cdn.feedframer.com/example/media.jpg',
    )
  })
})

describe('altTextFor', () => {
  it('falls back to a generic description when there is no caption', () => {
    const post = makePost({ caption: null })
    expect(altTextFor(post)).toBe('Instagram post from Gabriel for Denver')
  })

  it('returns a short caption as-is', () => {
    const post = makePost({ caption: 'Knocking doors in Capitol Hill today!' })
    expect(altTextFor(post)).toBe('Knocking doors in Capitol Hill today!')
  })

  it('truncates a long caption to 140 characters with an ellipsis', () => {
    const longCaption = 'a'.repeat(200)
    const alt = altTextFor(makePost({ caption: longCaption }))
    expect(alt).toBe(`${'a'.repeat(140)}…`)
  })
})

describe('getInstagramPosts', () => {
  it('returns no posts and skips the request entirely when there is no API key', async () => {
    const fetchImpl = vi.fn()
    const posts = await getInstagramPosts(undefined, fetchImpl)
    expect(posts).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('requests Feedframer with the API key and a 6-post page size', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ posts: [] }),
    })
    await getInstagramPosts('test-key', fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://feedframer.com/api/v1/me?api_key=test-key&page[size]=6',
    )
  })

  it('returns the posts from a successful response', async () => {
    const post = makePost()
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ posts: [post] }),
    })
    const posts = await getInstagramPosts('test-key', fetchImpl)
    expect(posts).toEqual([post])
  })

  it('returns no posts when the response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const posts = await getInstagramPosts('test-key', fetchImpl)
    expect(posts).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('returns no posts when the request throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const posts = await getInstagramPosts('test-key', fetchImpl)
    expect(posts).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
