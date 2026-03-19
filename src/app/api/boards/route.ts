import { NextResponse } from "next/server";

// Extract the unique image identifier from a pinimg URL
// e.g., "https://i.pinimg.com/736x/ab/cd/ef/abcdef123.jpg" → "ab/cd/ef/abcdef123.jpg"
function getImageId(url: string): string {
  const match = url.match(/\/(?:originals|736x|564x|474x|236x|170x|150x150)\/(.+)/);
  return match ? match[1] : url;
}

async function scrapePinterestBoard(boardUrl: string) {
  try {
    const res = await fetch(boardUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    const html = await res.text();

    // Collect ALL pinimg URLs
    const allUrls: string[] = [];
    const imgRegex = /https:\/\/i\.pinimg\.com\/[^\s"'\\]+/g;
    const matches = html.match(imgRegex) || [];
    for (const url of matches) {
      const clean = url.replace(/\\u002F/g, "/").replace(/\\/g, "");
      allUrls.push(clean);
    }

    // Also extract from JSON data
    const jsonRegex = /"url":\s*"(https:\/\/i\.pinimg\.com\/[^"]+)"/g;
    let match;
    while ((match = jsonRegex.exec(html)) !== null) {
      const clean = match[1].replace(/\\u002F/g, "/").replace(/\\/g, "");
      allUrls.push(clean);
    }

    // Deduplicate by image ID — keep the highest resolution version
    const imageMap = new Map<string, string>();
    const sizePriority = ["originals", "736x", "564x", "474x", "236x"];

    for (const url of allUrls) {
      // Skip tiny images, profile pics, icons
      if (url.includes("/30x30/") || url.includes("/75x75/") || url.includes("/140x140/") || url.includes("/150x150/") || url.includes("/170x/")) continue;
      if (url.length < 40) continue;
      if (!url.match(/\.(jpg|jpeg|png|webp)/i)) continue;
      // Must be a content image, not a UI element
      if (!url.includes("/originals/") && !url.includes("/736x/") && !url.includes("/564x/") && !url.includes("/474x/")) continue;

      const imageId = getImageId(url);
      const existing = imageMap.get(imageId);

      if (!existing) {
        imageMap.set(imageId, url);
      } else {
        // Keep higher resolution
        const existingPriority = sizePriority.findIndex((s) => existing.includes(`/${s}/`));
        const newPriority = sizePriority.findIndex((s) => url.includes(`/${s}/`));
        if (newPriority >= 0 && (existingPriority < 0 || newPriority < existingPriority)) {
          imageMap.set(imageId, url);
        }
      }
    }

    return Array.from(imageMap.values()).slice(0, 50);
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
