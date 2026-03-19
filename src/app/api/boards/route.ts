import { NextResponse } from "next/server";

// Extract the unique image path from a pinimg URL (after the size prefix)
function getImageId(url: string): string {
  const match = url.match(/\/(?:originals|736x|564x|474x|236x|170x|150x150)\/(.+)/);
  return match ? match[1].split("?")[0] : url;
}

async function scrapePinterestBoard(boardUrl: string) {
  try {
    // Fetch with headers that get the full server-rendered page
    const res = await fetch(boardUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    const html = await res.text();

    // Collect ALL pinimg URLs from the HTML
    const allUrls: string[] = [];

    // Match all pinimg URLs (handle escaped slashes in JSON)
    const patterns = [
      /https?:\/\/i\.pinimg\.com\/[^\s"'\\)>]+/g,
      /https?:\\u002F\\u002Fi\.pinimg\.com\\u002F[^\s"'\\)>]+/g,
    ];

    for (const pattern of patterns) {
      const matches = html.match(pattern) || [];
      for (const url of matches) {
        const clean = url
          .replace(/\\u002F/g, "/")
          .replace(/\\/g, "")
          .replace(/['")\]}>]+$/, ""); // Clean trailing chars
        allUrls.push(clean);
      }
    }

    // Deduplicate by image ID — keep highest resolution
    const imageMap = new Map<string, string>();
    const sizePriority = ["originals", "736x", "564x", "474x"];

    for (const url of allUrls) {
      // Skip non-content images
      if (url.includes("/150x150/") || url.includes("/75x75/") || url.includes("/30x30/") || url.includes("/140x140/") || url.includes("/170x/") || url.includes("/236x/")) continue;
      if (url.length < 50) continue;
      // Must be a content-sized image
      if (!url.includes("/originals/") && !url.includes("/736x/") && !url.includes("/564x/") && !url.includes("/474x/")) continue;
      // Must have image extension
      if (!url.match(/\.(jpg|jpeg|png|webp)/i)) continue;
      // Skip UI/icon images
      if (url.includes("user/") || url.includes("board/") || url.includes("avatar")) continue;

      const imageId = getImageId(url);
      if (!imageId || imageId.length < 10) continue;

      const existing = imageMap.get(imageId);
      if (!existing) {
        imageMap.set(imageId, url);
      } else {
        // Keep higher resolution
        const existingIdx = sizePriority.findIndex((s) => existing.includes(`/${s}/`));
        const newIdx = sizePriority.findIndex((s) => url.includes(`/${s}/`));
        if (newIdx >= 0 && (existingIdx < 0 || newIdx < existingIdx)) {
          imageMap.set(imageId, url);
        }
      }
    }

    return Array.from(imageMap.values());
  } catch (error) {
    console.error("Pinterest scrape error:", error);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { boardUrl } = await req.json();

    if (!boardUrl || !boardUrl.includes("pinterest")) {
      return NextResponse.json({ error: "Please provide a valid Pinterest board URL" }, { status: 400 });
    }

    const imageUrls = await scrapePinterestBoard(boardUrl);

    if (imageUrls.length === 0) {
      return NextResponse.json({
        error: "Couldn't find any pins. Make sure the board is public and the URL is correct.",
      }, { status: 404 });
    }

    const pins = imageUrls.map((url, i) => ({
      id: `pin_${Date.now()}_${i}`,
      image_url: url,
      original_pin_url: boardUrl,
      analyzed: false,
    }));

    return NextResponse.json({ pins, count: pins.length });
  } catch (error) {
    console.error("Board fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch board" }, { status: 500 });
  }
}
