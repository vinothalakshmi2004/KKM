export const slugify = (text) =>
  String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'hotel';

/** "kkm-grand", then "kkm-grand-2", "kkm-grand-3"… until `exists(slug)` is false. */
export async function uniqueSlug(text, exists) {
  const base = slugify(text);
  let slug = base;
  for (let i = 2; await exists(slug); i += 1) slug = `${base}-${i}`;
  return slug;
}
