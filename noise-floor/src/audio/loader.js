// File loader for the manifest seam. Any failure — missing file, network error,
// a codec the browser can't decode (e.g. Vorbis on older Safari) — resolves to
// null so the caller falls back to the procedural generators. That automatic
// fallback is the whole point of the manifest design: real audio when it loads,
// procedural placeholder when it doesn't, no code change either way.
export async function loadBuffer(ctx, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    return await ctx.decodeAudioData(data);
  } catch (_) {
    return null;
  }
}

// Load many; result array is index-aligned with `urls`, null where a load failed.
export function loadAll(ctx, urls) {
  return Promise.all(urls.map((u) => loadBuffer(ctx, u)));
}
