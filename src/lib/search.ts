import type { ProductMatch, UserPreferences } from "@/types";

interface SearchResult {
  title: string;
  link: string;
  source: string;
  price?: string;
  thumbnail?: string;
  extracted_price?: number;
}

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
    if (preferences.preferred_brands.length > 0) {
      // Boost preferred brands
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
          params.set("price", range);
        }
      }

      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      const data = await res.json();

      const results = data.shopping_results || [];
      for (const r of results.slice(0, 8)) {
        matches.push({
          id: `match_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          detected_product_id: "",
          product_name: r.title || "Unknown Product",
          brand: r.source || "Unknown",
          price: r.extracted_price || parsePrice(r.price) || 0,
          currency: "USD",
          product_url: r.link || "",
          image_url: r.thumbnail || "",
          retailer: r.source || "Unknown",
          similarity_score: 0.85,
          in_stock: true,
          size_available: true,
        });
      }
    } catch (err) {
      console.error("SerpAPI search failed:", err);
    }
  }

  // Fallback: generate mock results for demo
  if (matches.length === 0) {
    const mockRetailers = ["Nordstrom", "ASOS", "Zara", "H&M", "Net-a-Porter", "Revolve"];
    for (let i = 0; i < 4; i++) {
      const retailer = mockRetailers[i % mockRetailers.length];
      const basePrice = Math.floor(Math.random() * 150) + 25;
      matches.push({
        id: `match_${Date.now()}_${i}`,
        detected_product_id: "",
        product_name: `${query} - Similar Style`,
        brand: retailer,
        price: basePrice,
        currency: "USD",
        product_url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`,
        image_url: "",
        retailer,
        similarity_score: 0.7 - i * 0.1,
        in_stock: true,
        size_available: true,
      });
    }
  }

  // Filter by preferences
  if (preferences) {
    return matches.filter((m) => {
      if (preferences.excluded_brands.some((b) => m.brand.toLowerCase().includes(b.toLowerCase()))) {
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
