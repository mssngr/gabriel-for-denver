/**
 * Look up an icon by the name stored in the CMS.
 *
 * The `lucideIcon` field is free text, and since the cutover every page's
 * header renders one icon per published guide — so an editor's typo used to
 * resolve to `undefined` and crash the whole build on its first page, not
 * just the guide's own. A missing icon is a blemish; a failed deploy is an
 * outage, so an unknown name renders nothing instead.
 *
 * `Object.hasOwn` rather than a plain lookup: `registry['toString']` would
 * otherwise hand back something inherited from `Object.prototype`, which is
 * neither an icon nor an error.
 */
export function resolveIcon<T>(
  name: string | undefined,
  registry: Record<string, T>,
): T | null {
  if (!name || !Object.hasOwn(registry, name)) return null
  return registry[name]
}
