import type { ProductMatch, UserPreferences } from "@/types";

async function fetchDirectLinks(
  serpApiKey: string,
  pageToken: string
): Promise<{ name: string; link: string; price?: string; logo?: string }[]> {
  try {
    const params = new URLSearchParams({
      api_key: serpApiKey,
      engine: "google_immersive_product",
      page_token: pageToken,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const stores = data?.product_results?.stores || [];
    return stores.map((s: Record<string, string>) => ({
      name: s.name || "Unknown",
      link: s.link || "",
      price: s.price || s.base_price || "",
      logo: s.logo || "",
    }));
  } catch {
    return [];
  }
}

export async function searchProducts(
  query: string,
  preferences?: UserPreferences | null
): Promise<ProductMatch[]> {
  const matches: ProductMatch[] = [];
  const serpApiKey = process.env.SERPAPI_KEY || "";

  let enhancedQuery = query;
  if (preferences?.gender_presentation) {
    enhancedQuery = `${preferences.gender_presentation} ${enhancedQuery}`;
  }

  if (serpApiKey) {
    try {
      const params = new URLSearchParams({
        api_key: serpApiKey,
        engine: "google_shopping",
        q: enhancedQuery,
        num: "6",
        hl: "en",
        gl: "us",
      });

      if (preferences?.budget_range) {
        const budgetMap: Record<string, string> = {
          "Budget ($0-50)": "0,50",
          "Mid-range ($50-150)": "50,150",
          "Premium ($150-500)": "150,500",
          "Luxury ($500+)": "500,",
        };
        const range = budgetMap[preferences.budget_range];
        if (range) {
          const [min, max] = range.split(",");
          params.set("tbs", `mr:1,price:1,ppr_min:${min}${max ? `,ppr_max:${max}` : ""}`);
        }
      }

      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      const data = await res.json();
      const results = data.shopping_results || [];

      // For the first 3 results, try to get direct retailer links
      for (let i = 0; i < Math.min(results.length, 6); i++) {
        const r = results[i];
        const token = r.immersive_product_page_token;

        let directStores: { name: string; link: string; price?: string; logo?: string }[] = [];

        // Only fetch direct links for first 2 products (to save API calls)
        if (token && i < 2) {
          directStores = await fetchDirectLinks(serpApiKey, token);
        }

        if (directStores.length > 0) {
          // Add each retailer as a separate match with direct link
          for (const store of directStores.slice(0, 3)) {
            matches.push({
              id: `match_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              detected_product_id: "",
              product_name: r.title || "Unknown Product",
              brand: store.name,
              price: r.extracted_price || parsePrice(r.price) || parsePrice(store.price) || 0,
              currency: "USD",
              product_url: store.link, // DIRECT retailer link
              image_url: r.thumbnail || "",
              retailer: store.name,
              similarity_score: r.rating ? r.rating / 5 : 0.85,
              in_stock: true,
              size_available: true,
            });
          }
        } else {
          // Fallback: use Google Shopping product page
          matches.push({
            id: `match_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            detected_product_id: "",
            product_name: r.title || "Unknown Product",
            brand: r.source || "Unknown",
            price: r.extracted_price || parsePrice(r.price) || 0,
            currency: "USD",
            product_url: r.product_link || `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(r.title || query)}`,
            image_url: r.thumbnail || "",
            retailer: r.source || "Unknown",
            similarity_score: r.rating ? r.rating / 5 : 0.8,
            in_stock: true,
            size_available: true,
          });
        }
      }
    } catch (err) {
      console.error("SerpAPI search failed:", err);
    }
  }

  // Fallback
  if (matches.length === 0) {
    matches.push({
      id: `match_${Date.now()}_fallback`,
      detected_product_id: "",
      product_name: `Search "${query}" on Google Shopping`,
      brand: "Google Shopping",
      price: 0,
      currency: "USD",
      product_url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(enhancedQuery)}`,
      image_url: "",
      retailer: "Google Shopping",
      similarity_score: 0.5,
      in_stock: true,
      size_available: true,
    });
  }

  // Filter excluded brands
  if (preferences) {
    return matches.filter((m) =>
      !preferences.excluded_brands.some((b) => m.brand.toLowerCase().includes(b.toLowerCase()))
    );
  }

  return matches;
}

function parsePrice(priceStr?: string): number {
  if (!priceStr) return 0;
  const match = priceStr.match(/[\d,.]+/);
  if (!match) return 0;
  return parseFloat(match[0].replace(",", ""));
}
