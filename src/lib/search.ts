import type { ProductMatch, UserPreferences } from "@/types";

export async function searchProducts(
  query: string,
  preferences?: UserPreferences | null
): Promise<ProductMatch[]> {
  const matches: ProductMatch[] = [];

  // Build enhanced query with preferences
  let enhancedQuery = query;
  if (preferences) {
    if (preferences.gender_presentation) {
      enhancedQuery = `${preferences.gender_presentation} ${enhancedQuery}`;
    }
  }

  // Try SerpAPI Google Shopping
  if (process.env.SERPAPI_KEY) {
    try {
      const params = new URLSearchParams({
        api_key: process.env.SERPAPI_KEY,
        engine: "google_shopping",
        q: enhancedQuery,
        num: "8",
        hl: "en",
        gl: "us",
      });

      // Add price filter based on budget
      if (preferences?.budget_range) {
        const budgetMap: Record<string, string> = {
          "Budget ($0-50)": "0,50",
          "Mid-range ($50-150)": "50,150",
          "Premium ($150-500)": "150,500",
          "Luxury ($500+)": "500,",
        };
        const range = budgetMap[preferences.budget_range];
        if (range) {
          params.set("tbs", `mr:1,price:1,ppr_min:${range.split(",")[0]},ppr_max:${range.split(",")[1] || ""}`);
        }
      }

      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      const data = await res.json();

      const results = data.shopping_results || [];
      for (const r of results.slice(0, 6)) {
        // product_link goes to Google Shopping product page (which has "buy" buttons to retailers)
        // If no product_link, construct a Google Shopping search URL
        const productUrl = r.product_link
          || `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(r.title || query)}`;

        matches.push({
          id: `match_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          detected_product_id: "",
          product_name: r.title || "Unknown Product",
          brand: r.source || "Unknown",
          price: r.extracted_price || parsePrice(r.price) || 0,
          currency: "USD",
          product_url: productUrl,
          image_url: r.thumbnail || "",
          retailer: r.source || "Unknown",
          similarity_score: r.rating ? r.rating / 5 : 0.8,
          in_stock: true,
          size_available: true,
        });
      }
    } catch (err) {
      console.error("SerpAPI search failed:", err);
    }
  }

  // Fallback: direct Google Shopping search links
  if (matches.length === 0) {
    const googleShopUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(enhancedQuery)}`;
    matches.push({
      id: `match_${Date.now()}_fallback`,
      detected_product_id: "",
      product_name: `Search "${query}" on Google Shopping`,
      brand: "Google Shopping",
      price: 0,
      currency: "USD",
      product_url: googleShopUrl,
      image_url: "",
      retailer: "Google Shopping",
      similarity_score: 0.5,
      in_stock: true,
      size_available: true,
    });
  }

  // Filter by preferences
  if (preferences) {
    return matches.filter((m) => {
      if (preferences.excluded_brands.some((b) =>
        m.brand.toLowerCase().includes(b.toLowerCase())
      )) {
        return false;
      }
      return true;
    });
  }

  return matches;
}

function parsePrice(priceStr?: string): number {
  if (!priceStr) return 0;
  const match = priceStr.match(/[\d,.]+/);
  if (!match) return 0;
  return parseFloat(match[0].replace(",", ""));
}
