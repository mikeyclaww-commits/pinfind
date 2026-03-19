import { NextResponse } from "next/server";

// Scrape pins from a public Pinterest board URL
async function scrapePinterestBoard(boardUrl: string) {
  try {
    // Fetch the board page
    const res = await fetch(boardUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    const html = await res.text();

    // Extract image URLs from the page
    const imageUrls: string[] = [];

    // Look for pin images in the HTML (Pinterest embeds image URLs in various formats)
    const imgRegex = /https:\/\/i\.pinimg\.com\/[^\s"']+/g;
    const matches = html.match(imgRegex) || [];

    for (const url of matches) {
      // Only get reasonably sized images (skip tiny thumbnails)
      if (url.includes("/736x/") || url.includes("/564x/") || url.includes("/originals/")) {
        if (!imageUrls.includes(url)) {
          imageUrls.push(url);
        }
      }
    }

    // Also try to extract from JSON data embedded in the page
    const jsonRegex = /"images":\s*\{[^}]*"orig":\s*\{[^}]*"url":\s*"([^"]+)"/g;
    let match;
    while ((match = jsonRegex.exec(html)) !== null) {
      if (!imageUrls.includes(match[1])) {
        imageUrls.push(match[1]);
      }
    }

    // Filter out invalid/broken URLs
    const validUrls = imageUrls.filter((url) => {
      // Must be a full URL with proper path
      if (url.length < 30) return false;
      // Skip tiny images and profile pics
      if (url.includes("/30x30/") || url.includes("/75x75/") || url.includes("/140x140/") || url.includes("/150x150/")) return false;
      // Must end with an image extension or have proper pinimg path
      if (!url.match(/\.(jpg|jpeg|png|webp)$/i) && !url.includes("/736x/") && !url.includes("/564x/") && !url.includes("/originals/")) return false;
      return true;
    });

    return validUrls.slice(0, 50); // Limit to 50 pins for MVP
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
