"use client";

import { useState, useRef, useEffect } from "react";
import {
  Pin, Search, ShoppingBag, Sparkles, ArrowRight, Check, Eye, Zap, Star,
  Loader2, X, ChevronRight, ExternalLink, ChevronDown, ArrowLeft,
} from "lucide-react";

interface DetectedProduct {
  id: string;
  category: string;
  subcategory: string;
  color: string;
  pattern: string;
  material_guess: string;
  style_descriptors: string[];
  brand_guess?: string;
  gender_presentation: string;
  search_query: string;
  confidence: number;
  // Position on image (0-100 percentage from GPT-4o)
  position_x?: number;
  position_y?: number;
}

interface ProductMatch {
  id: string;
  product_name: string;
  brand: string;
  price: number;
  currency: string;
  product_url: string;
  image_url: string;
  retailer: string;
  similarity_score: number;
}

interface PinData {
  id: string;
  image_url: string;
  analyzed: boolean;
}

type AppState = "landing" | "onboarding" | "scan" | "results";

interface Preferences {
  gender_presentation: string;
  top_size: string;
  bottom_size_pants: string;
  shoe_size: string;
  budget_range: string;
  style_tags: string[];
  preferred_brands: string[];
  excluded_brands: string[];
}

// Fallback positions by category if GPT-4o doesn't return coordinates
const CATEGORY_FALLBACK: Record<string, { x: number; y: number }> = {
  "accessories": { x: 50, y: 10 }, "jewelry": { x: 45, y: 15 }, "hats": { x: 50, y: 5 },
  "tops": { x: 50, y: 30 }, "outerwear": { x: 50, y: 28 },
  "dresses": { x: 50, y: 45 },
  "bags": { x: 30, y: 55 },
  "bottoms": { x: 50, y: 62 },
  "shoes": { x: 50, y: 88 }, "sneakers": { x: 50, y: 88 },
  "swimwear": { x: 50, y: 45 }, "activewear": { x: 50, y: 40 },
};

function getProductXY(product: DetectedProduct, index: number, total: number): { x: number; y: number } {
  // Use GPT-4o provided positions if available
  if (product.position_x !== undefined && product.position_y !== undefined &&
      product.position_x > 0 && product.position_y > 0) {
    return { x: product.position_x, y: product.position_y };
  }
  const fallback = CATEGORY_FALLBACK[product.category.toLowerCase()];
  if (fallback) return fallback;
  return { x: 40, y: 15 + (index / Math.max(total - 1, 1)) * 70 };
}

// Cache for analysis results
interface AnalysisCache {
  products: DetectedProduct[];
  matches: { [key: string]: ProductMatch[] };
}

// Colors for product tags
const TAG_COLORS = [
  { bg: "bg-rose-500", text: "text-rose-500", light: "bg-rose-50", border: "border-rose-200", ring: "ring-rose-200" },
  { bg: "bg-sky-500", text: "text-sky-500", light: "bg-sky-50", border: "border-sky-200", ring: "ring-sky-200" },
  { bg: "bg-amber-500", text: "text-amber-500", light: "bg-amber-50", border: "border-amber-200", ring: "ring-amber-200" },
  { bg: "bg-emerald-500", text: "text-emerald-500", light: "bg-emerald-50", border: "border-emerald-200", ring: "ring-emerald-200" },
  { bg: "bg-violet-500", text: "text-violet-500", light: "bg-violet-50", border: "border-violet-200", ring: "ring-violet-200" },
  { bg: "bg-orange-500", text: "text-orange-500", light: "bg-orange-50", border: "border-orange-200", ring: "ring-orange-200" },
];

export default function Home() {
  const [state, setState] = useState<AppState>("landing");
  const [boardUrl, setBoardUrl] = useState("");
  const [pins, setPins] = useState<PinData[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [selectedPin, setSelectedPin] = useState<PinData | null>(null);
  const [products, setProducts] = useState<DetectedProduct[]>([]);
  const [matches, setMatches] = useState<{ [key: string]: ProductMatch[] }>({});
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisCache, setAnalysisCache] = useState<Map<string, AnalysisCache>>(new Map());
  const imageRef = useRef<HTMLDivElement>(null);
  const [preferences, setPreferences] = useState<Preferences>({
    gender_presentation: "Women's",
    top_size: "M",
    bottom_size_pants: "28",
    shoe_size: "US 8",
    budget_range: "Mid-range ($50-150)",
    style_tags: [],
    preferred_brands: [],
    excluded_brands: [],
  });
  const [onboardingStep, setOnboardingStep] = useState(0);

  const handleFetchBoard = async () => {
    if (!boardUrl.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardUrl: boardUrl.trim() }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setPins(data.pins); setState("results"); }
    } catch { setError("Failed to fetch board."); }
    finally { setLoading(false); }
  };

  const handleAnalyzePin = async (pin: PinData) => {
    setSelectedPin(pin);
    setShowAnalysis(true);
    setActiveProductId(null);

    // Check cache first
    const cached = analysisCache.get(pin.id);
    if (cached) {
      setProducts(cached.products);
      setMatches(cached.matches);
      setAnalyzing(false);
      return;
    }

    setAnalyzing(true);
    setProducts([]);
    setMatches({});
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: pin.image_url, preferences }),
      });
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
        setMatches(data.matches || {});
        pin.analyzed = true;
        // Store in cache
        setAnalysisCache((prev) => {
          const next = new Map(prev);
          next.set(pin.id, { products: data.products, matches: data.matches || {} });
          return next;
        });
      }
    } catch { setError("Analysis failed"); }
    finally { setAnalyzing(false); }
  };

  const closeAnalysis = () => {
    setShowAnalysis(false);
    setSelectedPin(null);
    setProducts([]);
    setMatches({});
    setActiveProductId(null);
  };

  // Landing Page
  if (state === "landing") {
    return (
      <div className="min-h-screen bg-white">
        <nav className="border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-sm z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <Pin className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">PinFind</span>
            </div>
            <button onClick={() => setState("onboarding")} className="bg-red-500 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-red-600 transition">
              Get Started
            </button>
          </div>
        </nav>

        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              AI-Powered Visual Shopping
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Turn your Pinterest boards into
              <span className="text-red-500"> shopping lists</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Paste a Pinterest board URL. Our AI identifies every product in your pins and finds where to buy them — with direct links to retailers.
            </p>
            <button onClick={() => setState("onboarding")} className="inline-flex items-center gap-2 bg-red-500 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-red-600 transition hover:shadow-xl hover:shadow-red-200">
              Start Shopping Your Pins <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>

        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { icon: <Pin className="h-7 w-7" />, title: "Paste Board URL", desc: "Share any public Pinterest board link" },
                { icon: <Eye className="h-7 w-7" />, title: "AI Scans Pins", desc: "GPT-4o Vision identifies every product" },
                { icon: <Search className="h-7 w-7" />, title: "Find Products", desc: "Direct links to real retailer websites" },
                { icon: <ShoppingBag className="h-7 w-7" />, title: "Shop & Save", desc: "Buy items filtered to your size & budget" },
              ].map((step, i) => (
                <div key={i} className="text-center">
                  <div className="w-14 h-14 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">{step.icon}</div>
                  <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-sm">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
            {[
              { icon: <Zap />, title: "Instant Analysis", desc: "AI identifies clothing, shoes, bags, accessories, and jewelry in seconds." },
              { icon: <Star />, title: "Personalized Results", desc: "Results filtered by your sizes, budget, and style preferences." },
              { icon: <ShoppingBag />, title: "Direct Retailer Links", desc: "Click through to Nordstrom, Saks, ASOS — buy directly from the store." },
              { icon: <Eye />, title: "Interactive Labels", desc: "See every detected product labeled on the image — click to shop." },
            ].map((f) => (
              <div key={f.title} className="flex gap-4 p-6 border border-gray-200 rounded-xl">
                <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center flex-shrink-0">{f.icon}</div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{f.title}</h3>
                  <p className="text-gray-600 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="bg-gray-900 text-gray-400 py-8 px-4 text-center text-sm">
          <p>© {new Date().getFullYear()} PinFind. AI-powered visual shopping.</p>
        </footer>
      </div>
    );
  }

  // Onboarding
  if (state === "onboarding") {
    const steps = [
      {
        title: "What do you shop for?",
        content: (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Style Presentation</label>
            <div className="grid grid-cols-2 gap-3">
              {["Women's", "Men's", "Unisex", "Non-binary"].map((opt) => (
                <button key={opt} onClick={() => setPreferences({ ...preferences, gender_presentation: opt })}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition ${preferences.gender_presentation === opt ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: "Your sizes",
        content: (
          <div className="space-y-4">
            {[
              { label: "Top Size", key: "top_size" as const, options: ["XS", "S", "M", "L", "XL", "XXL"] },
              { label: "Pants Size", key: "bottom_size_pants" as const, options: ["24", "26", "28", "30", "32", "34", "36"] },
              { label: "Shoe Size", key: "shoe_size" as const, options: ["US 5", "US 6", "US 7", "US 8", "US 9", "US 10", "US 11", "US 12"] },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">{field.label}</label>
                <div className="flex flex-wrap gap-2">
                  {field.options.map((opt) => (
                    <button key={opt} onClick={() => setPreferences({ ...preferences, [field.key]: opt })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${preferences[field.key] === opt ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: "Budget & Style",
        content: (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Budget Range</label>
              <div className="space-y-2">
                {["Budget ($0-50)", "Mid-range ($50-150)", "Premium ($150-500)", "Luxury ($500+)", "No limit"].map((opt) => (
                  <button key={opt} onClick={() => setPreferences({ ...preferences, budget_range: opt })}
                    className={`w-full p-3 rounded-xl border-2 text-sm font-medium text-left transition ${preferences.budget_range === opt ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Style Tags</label>
              <div className="flex flex-wrap gap-2">
                {["minimalist", "streetwear", "classic", "bohemian", "preppy", "cottagecore", "edgy", "romantic", "sporty", "vintage"].map((tag) => (
                  <button key={tag} onClick={() => {
                    const tags = preferences.style_tags.includes(tag) ? preferences.style_tags.filter((t) => t !== tag) : [...preferences.style_tags, tag];
                    setPreferences({ ...preferences, style_tags: tags });
                  }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${preferences.style_tags.includes(tag) ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ),
      },
    ];

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
          <div className="flex gap-2 mb-8">
            {steps.map((_, i) => (<div key={i} className={`flex-1 h-1.5 rounded-full ${i <= onboardingStep ? "bg-red-500" : "bg-gray-200"}`} />))}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{steps[onboardingStep].title}</h2>
          {steps[onboardingStep].content}
          <div className="flex justify-between mt-8">
            <button onClick={() => onboardingStep > 0 ? setOnboardingStep(onboardingStep - 1) : setState("landing")} className="text-gray-500 hover:text-gray-700 font-medium">Back</button>
            <button onClick={() => onboardingStep < steps.length - 1 ? setOnboardingStep(onboardingStep + 1) : setState("scan")}
              className="bg-red-500 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-red-600 transition flex items-center gap-2">
              {onboardingStep < steps.length - 1 ? "Next" : "Start Scanning"} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Scan
  if (state === "scan") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><Pin className="h-8 w-8" /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Paste a Pinterest Board URL</h2>
          <p className="text-gray-600 mb-8">We&apos;ll scan the board and identify products in every pin.</p>
          <div className="flex gap-2 mb-4">
            <input type="url" value={boardUrl} onChange={(e) => setBoardUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFetchBoard()}
              placeholder="https://pinterest.com/username/board-name"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
            <button onClick={handleFetchBoard} disabled={loading || !boardUrl.trim()}
              className="bg-red-500 text-white px-5 py-3 rounded-xl font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center gap-2">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />} Scan
            </button>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>}
          <p className="text-gray-400 text-xs mt-4">Board must be public. We don&apos;t store your Pinterest data.</p>
        </div>
      </div>
    );
  }

  // Results Dashboard with interactive analysis overlay
  const activeProduct = products.find((p) => p.id === activeProductId);
  const activeColor = activeProductId ? TAG_COLORS[products.findIndex((p) => p.id === activeProductId) % TAG_COLORS.length] : null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center"><Pin className="h-5 w-5 text-white" /></div>
            <span className="font-bold text-gray-900">PinFind</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">{pins.filter((p) => !failedImages.has(p.id)).length} pins</span>
          </div>
          <button onClick={() => { setState("scan"); setPins([]); setSelectedPin(null); closeAnalysis(); }}
            className="text-sm text-red-500 font-medium hover:text-red-600 flex items-center gap-1">
            <Pin className="h-3.5 w-3.5" /> New Board
          </button>
        </div>
      </header>

      {/* Analysis Overlay */}
      {showAnalysis && selectedPin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex">
          {/* Left: Image with product tags */}
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="relative max-w-lg w-full" ref={imageRef}>
              {/* Close button */}
              <button onClick={closeAnalysis}
                className="absolute -top-12 left-0 text-white/80 hover:text-white flex items-center gap-2 text-sm font-medium z-10">
                <ArrowLeft className="h-4 w-4" /> Back to pins
              </button>

              {/* Main image */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img src={selectedPin.image_url} alt="Selected pin" className="w-full" />

                {/* Scanning animation */}
                {analyzing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="bg-white/95 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-lg">
                      <Loader2 className="h-6 w-6 text-red-500 animate-spin" />
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Scanning for products...</p>
                        <p className="text-xs text-gray-500">AI is analyzing this image</p>
                      </div>
                    </div>
                    {/* Scanning line animation */}
                    <div className="absolute left-0 right-0 h-0.5 bg-red-500/50 animate-pulse" style={{ top: "50%" }} />
                  </div>
                )}

                {/* Hotspot dots on products */}
                {!analyzing && products.map((product, i) => {
                  const color = TAG_COLORS[i % TAG_COLORS.length];
                  const pos = getProductXY(product, i, products.length);
                  const isActive = activeProductId === product.id;

                  return (
                    <button
                      key={`dot-${product.id}`}
                      onClick={() => setActiveProductId(isActive ? null : product.id)}
                      className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 cursor-pointer z-10 ${
                        isActive ? "scale-125" : "hover:scale-110"
                      }`}
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    >
                      {/* Pulsing ring */}
                      <div className={`absolute inset-0 rounded-full ${color.bg} animate-ping opacity-30`} style={{ width: 28, height: 28, margin: -6 }} />
                      {/* Dot */}
                      <div className={`w-4 h-4 rounded-full ${color.bg} border-2 border-white shadow-lg`} />
                    </button>
                  );
                })}

                {/* Label + line for active product */}
                {!analyzing && products.map((product, i) => {
                  const color = TAG_COLORS[i % TAG_COLORS.length];
                  const pos = getProductXY(product, i, products.length);
                  const isActive = activeProductId === product.id;
                  if (!isActive) return null;

                  // Line goes from the dot to the right edge
                  return (
                    <div key={`label-${product.id}`}>
                      {/* SVG line from dot to right edge */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none z-5">
                        <line
                          x1={`${pos.x}%`} y1={`${pos.y}%`}
                          x2="100%" y2={`${pos.y}%`}
                          stroke="white" strokeWidth="2" strokeDasharray="6,4" opacity="0.8"
                        />
                        <circle cx={`${pos.x}%`} cy={`${pos.y}%`} r="6" fill="white" opacity="0.9" />
                      </svg>
                      {/* Label positioned near the dot */}
                      <div
                        className="absolute z-20 pointer-events-none"
                        style={{
                          left: `${Math.min(pos.x + 3, 65)}%`,
                          top: `${pos.y}%`,
                          transform: "translateY(-50%)",
                        }}
                      >
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold shadow-xl ${color.bg}`}>
                          <span className="capitalize">{product.subcategory}</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Non-active product labels (smaller) */}
                {!analyzing && products.map((product, i) => {
                  const color = TAG_COLORS[i % TAG_COLORS.length];
                  const pos = getProductXY(product, i, products.length);
                  const isActive = activeProductId === product.id;
                  if (isActive || activeProductId !== null) return null;

                  return (
                    <div
                      key={`minilabel-${product.id}`}
                      className="absolute z-10 pointer-events-none"
                      style={{
                        left: `${Math.min(pos.x + 2, 70)}%`,
                        top: `${pos.y}%`,
                        transform: "translateY(-50%)",
                      }}
                    >
                      <div className={`px-2 py-1 rounded-full text-white text-[10px] font-semibold shadow-lg ${color.bg} opacity-90`}>
                        {product.subcategory}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Product count badge */}
              {!analyzing && products.length > 0 && (
                <div className="absolute -bottom-10 left-0 right-0 text-center">
                  <span className="text-white/70 text-sm">{products.length} products detected — click labels to shop</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Product sidebar */}
          <div className="w-96 bg-white h-full overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">
                  {activeProduct ? activeProduct.subcategory : analyzing ? "Scanning..." : `${products.length} Products Found`}
                </h3>
                <button onClick={closeAnalysis} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>
              {activeProduct && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{activeProduct.color}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{activeProduct.material_guess}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{activeProduct.pattern}</span>
                  {activeProduct.brand_guess && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{activeProduct.brand_guess}</span>}
                </div>
              )}
            </div>

            {/* Loading state */}
            {analyzing && (
              <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 text-red-500 animate-spin mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Finding products and retailers...</p>
              </div>
            )}

            {/* Product list (no product selected) */}
            {!analyzing && !activeProductId && products.length > 0 && (
              <div className="p-3 space-y-2">
                <p className="text-xs text-gray-400 px-2 mb-2">Click a product label on the image, or select below:</p>
                {products.map((product, i) => {
                  const color = TAG_COLORS[i % TAG_COLORS.length];
                  const matchCount = (matches[product.id] || []).length;
                  return (
                    <button key={product.id} onClick={() => setActiveProductId(product.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border ${color.border} ${color.light} hover:shadow-md transition text-left`}>
                      <div className={`w-3 h-3 rounded-full ${color.bg} flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm capitalize">{product.subcategory}</p>
                        <p className="text-xs text-gray-500">{product.color} • {product.material_guess}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <ShoppingBag className="h-3.5 w-3.5" />
                        {matchCount}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active product matches */}
            {!analyzing && activeProductId && activeProduct && (
              <div>
                <button onClick={() => setActiveProductId(null)}
                  className="flex items-center gap-1 px-5 py-2 text-xs text-gray-500 hover:text-gray-700 font-medium">
                  <ArrowLeft className="h-3 w-3" /> All products
                </button>
                <div className="px-3 pb-3 space-y-2">
                  {(matches[activeProductId] || []).map((match) => (
                    <a key={match.id} href={match.product_url} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl border ${activeColor?.border || "border-gray-200"} bg-white hover:shadow-md transition group`}>
                      {match.image_url ? (
                        <img src={match.image_url} alt="" className="w-16 h-16 rounded-xl object-cover bg-gray-100 flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="h-5 w-5 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 font-medium line-clamp-2 leading-snug">{match.product_name}</p>
                        <p className="text-xs text-gray-500 mt-1">{match.retailer}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {match.price > 0 && <p className="text-sm font-bold text-gray-900">${match.price.toFixed(2)}</p>}
                        <span className="text-xs text-red-500 font-medium flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition">
                          Shop <ExternalLink className="h-3 w-3" />
                        </span>
                      </div>
                    </a>
                  ))}
                  {(matches[activeProductId] || []).length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-gray-400 text-sm">No matches found for this product.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No products */}
            {!analyzing && products.length === 0 && (
              <div className="p-8 text-center">
                <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="font-medium text-gray-700">No fashion products detected</p>
                <p className="text-gray-400 text-sm mt-1">Try a different pin with clothing or accessories.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pin Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Select a pin to analyze</h2>
        </div>
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 space-y-4">
          {pins.filter((p) => !failedImages.has(p.id)).map((pin) => (
            <div key={pin.id} onClick={() => handleAnalyzePin(pin)}
              className="relative rounded-xl overflow-hidden cursor-pointer group break-inside-avoid border-2 border-transparent hover:border-red-300 transition shadow-sm hover:shadow-lg">
              <img src={pin.image_url} alt="Pin" className="w-full bg-gray-200"
                onError={() => setFailedImages((prev) => new Set(prev).add(pin.id))} />
              {pin.analyzed && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                <div className="bg-white/90 rounded-full px-4 py-2 opacity-0 group-hover:opacity-100 transition shadow-lg flex items-center gap-2">
                  <Eye className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-semibold text-gray-900">Analyze</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
