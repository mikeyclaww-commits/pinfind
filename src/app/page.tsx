"use client";

import { useState } from "react";
import { Pin, Search, ShoppingBag, Sparkles, ArrowRight, Check, Eye, Zap, Star, Loader2, X, ChevronRight, ExternalLink } from "lucide-react";

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
      if (data.error) {
        setError(data.error);
      } else {
        setPins(data.pins);
        setState("results");
      }
    } catch {
      setError("Failed to fetch board. Please check the URL.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzePin = async (pin: PinData) => {
    setSelectedPin(pin);
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
      }
    } catch {
      setError("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // Landing Page
  if (state === "landing") {
    return (
      <div className="min-h-screen bg-white">
        {/* Nav */}
        <nav className="border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-sm z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <Pin className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">PinFind</span>
            </div>
            <button
              onClick={() => setState("onboarding")}
              className="bg-red-500 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-red-600 transition"
            >
              Get Started
            </button>
          </div>
        </nav>

        {/* Hero */}
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
              Paste a Pinterest board URL. Our AI identifies every product in your pins and finds where to buy them — across brands, price points, and retailers.
            </p>
            <button
              onClick={() => setState("onboarding")}
              className="inline-flex items-center gap-2 bg-red-500 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-red-600 transition hover:shadow-xl hover:shadow-red-200"
            >
              Start Shopping Your Pins
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { icon: <Pin className="h-7 w-7" />, title: "Paste Board URL", desc: "Share any public Pinterest board link" },
                { icon: <Eye className="h-7 w-7" />, title: "AI Scans Pins", desc: "GPT-4o Vision identifies every product" },
                { icon: <Search className="h-7 w-7" />, title: "Find Products", desc: "Search across retailers for matches" },
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

        {/* Features */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
            {[
              { icon: <Zap />, title: "Instant Analysis", desc: "AI identifies clothing, shoes, bags, accessories, and jewelry in seconds." },
              { icon: <Star />, title: "Personalized Results", desc: "Results filtered by your sizes, budget, and style preferences." },
              { icon: <ShoppingBag />, title: "Multi-Retailer Search", desc: "Find products across Nordstrom, ASOS, Zara, Net-a-Porter, and more." },
              { icon: <Eye />, title: "Visual Matching", desc: "Not just keywords — AI understands color, pattern, material, and style." },
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

        {/* Footer */}
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
                <button
                  key={opt}
                  onClick={() => setPreferences({ ...preferences, gender_presentation: opt })}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition ${
                    preferences.gender_presentation === opt ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
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
                    <button
                      key={opt}
                      onClick={() => setPreferences({ ...preferences, [field.key]: opt })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                        preferences[field.key] === opt ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
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
                  <button
                    key={opt}
                    onClick={() => setPreferences({ ...preferences, budget_range: opt })}
                    className={`w-full p-3 rounded-xl border-2 text-sm font-medium text-left transition ${
                      preferences.budget_range === opt ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Style Tags</label>
              <div className="flex flex-wrap gap-2">
                {["minimalist", "streetwear", "classic", "bohemian", "preppy", "cottagecore", "edgy", "romantic", "sporty", "vintage"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const tags = preferences.style_tags.includes(tag)
                        ? preferences.style_tags.filter((t) => t !== tag)
                        : [...preferences.style_tags, tag];
                      setPreferences({ ...preferences, style_tags: tags });
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                      preferences.style_tags.includes(tag) ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
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
          {/* Progress */}
          <div className="flex gap-2 mb-8">
            {steps.map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= onboardingStep ? "bg-red-500" : "bg-gray-200"}`} />
            ))}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-6">{steps[onboardingStep].title}</h2>
          {steps[onboardingStep].content}

          <div className="flex justify-between mt-8">
            <button
              onClick={() => onboardingStep > 0 ? setOnboardingStep(onboardingStep - 1) : setState("landing")}
              className="text-gray-500 hover:text-gray-700 font-medium"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (onboardingStep < steps.length - 1) {
                  setOnboardingStep(onboardingStep + 1);
                } else {
                  setState("scan");
                }
              }}
              className="bg-red-500 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-red-600 transition flex items-center gap-2"
            >
              {onboardingStep < steps.length - 1 ? "Next" : "Start Scanning"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Scan / Board URL input
  if (state === "scan") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Pin className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Paste a Pinterest Board URL</h2>
          <p className="text-gray-600 mb-8">We&apos;ll scan the board and identify products in every pin.</p>

          <div className="flex gap-2 mb-4">
            <input
              type="url"
              value={boardUrl}
              onChange={(e) => setBoardUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetchBoard()}
              placeholder="https://pinterest.com/username/board-name"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
            <button
              onClick={handleFetchBoard}
              disabled={loading || !boardUrl.trim()}
              className="bg-red-500 text-white px-5 py-3 rounded-xl font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              Scan
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}

          <p className="text-gray-400 text-xs mt-4">Board must be public. We don&apos;t store your Pinterest data.</p>
        </div>
      </div>
    );
  }

  // Results Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
              <Pin className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">PinFind</span>
            <span className="text-gray-400">•</span>
            <span className="text-sm text-gray-500">{pins.length} pins loaded</span>
          </div>
          <button
            onClick={() => { setState("scan"); setPins([]); setSelectedPin(null); }}
            className="text-sm text-red-500 font-medium hover:text-red-600"
          >
            Scan New Board
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Pin Grid */}
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Your Pins</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {pins.filter((pin) => !failedImages.has(pin.id)).map((pin) => (
              <div
                key={pin.id}
                onClick={() => handleAnalyzePin(pin)}
                className={`relative rounded-xl overflow-hidden cursor-pointer group border-2 transition ${
                  selectedPin?.id === pin.id ? "border-red-500 ring-2 ring-red-200" : "border-transparent hover:border-gray-300"
                }`}
              >
                <img
                  src={pin.image_url}
                  alt="Pin"
                  className="w-full aspect-[3/4] object-cover bg-gray-100"
                  onError={() => setFailedImages((prev) => new Set(prev).add(pin.id))}
                />
                {pin.analyzed && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                  <span className="text-white font-medium opacity-0 group-hover:opacity-100 transition text-sm">
                    Analyze
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Panel */}
        <div className="w-96 flex-shrink-0">
          {!selectedPin && !analyzing && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Eye className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-bold text-gray-700 mb-1">Click a pin to analyze</h3>
              <p className="text-gray-400 text-sm">AI will identify every product and find where to buy them.</p>
            </div>
          )}

          {analyzing && selectedPin && (
            <div className="space-y-4">
              {/* Selected pin preview */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <img src={selectedPin.image_url} alt="Selected pin" className="w-full max-h-72 object-cover" />
                <div className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-red-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="font-semibold text-sm">Analyzing this pin...</span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">Identifying products and searching retailers</p>
                </div>
              </div>
            </div>
          )}

          {selectedPin && !analyzing && products.length > 0 && (
            <div className="space-y-4">
              {/* Selected pin preview */}
              <div className="bg-white rounded-xl border-2 border-red-200 overflow-hidden">
                <img src={selectedPin.image_url} alt="Selected pin" className="w-full max-h-64 object-cover" />
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">{products.length} Products Found</h3>
                <button onClick={() => { setSelectedPin(null); setProducts([]); }} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Product Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 capitalize">{product.subcategory}</h4>
                        <p className="text-sm text-gray-500">{product.color} • {product.material_guess} • {product.pattern}</p>
                      </div>
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-medium">
                        {Math.round(product.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {product.style_descriptors?.map((tag: string) => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>

                  {/* Matches */}
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-gray-400 font-medium uppercase">Shop Similar</p>
                    {(matches[product.id] || []).slice(0, 6).map((match) => (
                      <a
                        key={match.id}
                        href={match.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-red-200 hover:bg-red-50/50 transition group cursor-pointer"
                      >
                        {match.image_url ? (
                          <img src={match.image_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="h-5 w-5 text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 font-medium line-clamp-2 leading-snug">{match.product_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{match.retailer}</p>
                        </div>
                        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                          {match.price > 0 && (
                            <p className="text-sm font-bold text-gray-900">${match.price.toFixed(2)}</p>
                          )}
                          <span className="text-xs text-red-500 font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                            Shop <ExternalLink className="h-3 w-3" />
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedPin && !analyzing && products.length === 0 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <img src={selectedPin.image_url} alt="Selected pin" className="w-full max-h-64 object-cover" />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <h3 className="font-bold text-gray-700 mb-1">No products detected</h3>
                <p className="text-gray-400 text-sm">This pin might not contain fashion items, or try a different pin.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
