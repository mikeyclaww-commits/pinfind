export interface UserPreferences {
  id?: string;
  user_id: string;
  gender_presentation: "Women's" | "Men's" | "Unisex" | "Non-binary";
  top_size: string;
  bottom_size_pants: string;
  bottom_size_jeans: string;
  dress_size: string;
  shoe_size: string;
  shoe_width: "Narrow" | "Standard" | "Wide";
  bra_size?: string;
  ring_size?: string;
  budget_range: "Budget ($0-50)" | "Mid-range ($50-150)" | "Premium ($150-500)" | "Luxury ($500+)" | "No limit";
  preferred_brands: string[];
  excluded_brands: string[];
  preferred_retailers: string[];
  style_tags: string[];
  color_preferences: string[];
  material_preferences: string[];
  sustainability_preference: boolean;
}

export interface Pin {
  id: string;
  board_id: string;
  user_id: string;
  image_url: string;
  original_pin_url: string;
  source_url?: string;
  title?: string;
  description?: string;
  analyzed: boolean;
  created_at: string;
}

export interface DetectedProduct {
  id: string;
  pin_id: string;
  category: string;
  subcategory: string;
  color: string;
  pattern: string;
  material_guess: string;
  style_descriptors: string[];
  brand_guess?: string;
  gender_presentation: string;
  search_query: string;
  bounding_box?: string;
  confidence: number;
}

export interface ProductMatch {
  id: string;
  detected_product_id: string;
  product_name: string;
  brand: string;
  price: number;
  currency: string;
  product_url: string;
  image_url: string;
  retailer: string;
  similarity_score: number;
  in_stock: boolean;
  size_available: boolean;
}

export interface Board {
  id: string;
  user_id: string;
  pinterest_board_id: string;
  name: string;
  description?: string;
  pin_count: number;
  cover_image_url?: string;
  last_scanned?: string;
  created_at: string;
}

export interface AnalysisResult {
  pin: Pin;
  products: DetectedProduct[];
  matches: { [productId: string]: ProductMatch[] };
}
