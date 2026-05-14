// Extract a dominant hue from an album-art image URL.
// Loads the image into a tiny offscreen canvas, computes a saturated-weighted
// average color, returns { hue, dominant, shadow, bg } compatible with the
// rest of the app's `art` shape. Cached by URL to avoid re-loading.

(function () {
  const cache = new Map();

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      switch (mx) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
        case g: h = ((b - r) / d + 2); break;
        case b: h = ((r - g) / d + 4); break;
      }
      h *= 60;
    }
    return [h, s, l];
  };

  function buildArt(hue) {
    const c1 = `oklch(0.62 0.14 ${hue})`;
    const c2 = `oklch(0.32 0.13 ${(hue + 50) % 360})`;
    return { hue, dominant: c1, shadow: c2, bg: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` };
  }

  async function extractFromUrl(url) {
    if (!url) return null;
    if (cache.has(url)) return cache.get(url);
    const promise = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const size = 24;
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;
          // Saturated-weighted average — favors the most vivid pixels.
          let hSum = 0, wSum = 0;
          let avgR = 0, avgG = 0, avgB = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 200) continue;
            const [h, s, l] = rgbToHsl(r, g, b);
            const w = s * (1 - Math.abs(0.5 - l) * 1.6);
            if (w <= 0) continue;
            // Use vector sum on the color wheel to avoid hue wrap-around bias.
            hSum += w * Math.cos((h * Math.PI) / 180);
            avgR += w * Math.sin((h * Math.PI) / 180);
            wSum += w;
            avgG += r * w; avgB += g * w;
          }
          const hue = wSum > 0
            ? (Math.atan2(avgR, hSum) * 180 / Math.PI + 360) % 360
            : 220;
          resolve(hue);
        } catch (e) {
          // CORS or canvas-tainted — fall back to a neutral hue.
          resolve(220);
        }
      };
      img.onerror = () => resolve(220);
      img.src = url;
    }).then((hue) => ({
      url,
      ...buildArt(hue),
    }));
    cache.set(url, promise);
    return promise;
  }

  // Synchronous fallback that builds art from a deterministic hash of a string
  // — used until the async image extraction completes.
  function fallbackArt(seed) {
    let h = 0;
    for (let i = 0; i < (seed || '').length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return buildArt(h % 360);
  }

  window.AlbumColor = { extractFromUrl, fallbackArt, buildArt };
})();
