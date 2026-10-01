# Nutrition

The neutral `Food` model retains provenance and confidence. `FoodProvider` adapters currently cover USDA FoodData Central and Open Food Facts. Open Food Facts search uses its browser-CORS-compatible JSON route and barcode lookup uses the v2 product route; the UI requires explicit provider consent before either request. Local/demo and custom foods remain available when the network or a USDA key is unavailable. Search exposes loading, error, and no-result states, while barcode text entry remains available before native camera scanning.
