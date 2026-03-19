import { NextResponse } from "next/server";
import { analyzeImage } from "@/lib/vision";
import { searchProducts } from "@/lib/search";
import type { ProductMatch } from "@/types";

export async function POST(req: Request) {
  try {
    const { imageUrl, preferences } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL required" }, { status: 400 });
    }

    // Step 1: Analyze image with GPT-4o Vision
    const products = await analyzeImage(imageUrl);

    if (products.length === 0) {
      return NextResponse.json({
        products: [],
        matches: {},
        message: "No fashion products detected in this image",
      });
    }

    // Step 2: Search for each detected product
    const matches: { [productId: string]: ProductMatch[] } = {};

    for (const product of products) {
      const productMatches = await searchProducts(product.search_query, preferences);
      matches[product.id] = productMatches.map((m) => ({
        ...m,
        detected_product_id: product.id,
      }));
    }

    return NextResponse.json({ products, matches });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
