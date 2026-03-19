import OpenAI from "openai";
import type { DetectedProduct } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VISION_SYSTEM_PROMPT = `You are a fashion product identification AI. Analyze the image and identify EVERY visible fashion product (clothing, shoes, bags, accessories, jewelry).

For each product, return a JSON array. Each item must have:
{
  "category": "tops|bottoms|dresses|outerwear|shoes|bags|accessories|jewelry|swimwear|activewear",
  "subcategory": "e.g., blouse, jeans, sneakers, crossbody bag, necklace",
  "color": "primary color(s)",
  "pattern": "solid|striped|floral|plaid|animal print|geometric|abstract|none",
  "material_guess": "e.g., cotton, denim, leather, silk, knit, suede",
  "style_descriptors": ["e.g., minimalist, bohemian, streetwear, preppy, vintage"],
  "brand_guess": "brand name if visible or recognizable, null otherwise",
  "gender_presentation": "Women's|Men's|Unisex",
  "search_query": "optimized Google Shopping search query to find this exact item",
  "confidence": 0.0-1.0
}

Be specific and detailed. The search_query should be precise enough to find similar products online. Return ONLY a valid JSON array, no markdown.`;

export async function analyzeImage(imageUrl: string): Promise<DetectedProduct[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Identify all fashion products in this image." },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim() || "[]";
    let jsonText = text;
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const products = JSON.parse(jsonText);
    return products.map((p: Record<string, unknown>, i: number) => ({
      id: `prod_${Date.now()}_${i}`,
      pin_id: "",
      ...p,
    }));
  } catch (error) {
    console.error("Vision analysis failed:", error);
    return [];
  }
}
