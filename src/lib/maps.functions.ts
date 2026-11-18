import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ query: z.string().trim().min(1).max(120) });

type GeoapifyFeature = {
  properties?: {
    place_id?: string;
    name?: string;
    address_line1?: string;
    formatted?: string;
    country?: string;
    categories?: string[];
    lat?: number;
    lon?: number;
    distance?: number;
  };
};

type GeoapifyPlacesResponse = {
  features?: GeoapifyFeature[];
  message?: string;
};

type GeoapifyGeocodeResponse = {
  results?: Array<{ lat?: number; lon?: number }>;
  message?: string;
};

const GLOBAL_SEARCH_REGIONS = [
  { name: "Nairobi", lat: -1.286389, lon: 36.817223 },
  { name: "Lagos", lat: 6.5244, lon: 3.3792 },
  { name: "Cairo", lat: 30.0444, lon: 31.2357 },
  { name: "London", lat: 51.5072, lon: -0.1276 },
  { name: "Paris", lat: 48.8566, lon: 2.3522 },
  { name: "New York", lat: 40.7128, lon: -74.006 },
  { name: "Sao Paulo", lat: -23.5505, lon: -46.6333 },
  { name: "Dubai", lat: 25.2048, lon: 55.2708 },
  { name: "Mumbai", lat: 19.076, lon: 72.8777 },
  { name: "Singapore", lat: 1.3521, lon: 103.8198 },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
  { name: "Sydney", lat: -33.8688, lon: 151.2093 },
];

const categoryFor = (term: string) => {
  const value = term.toLowerCase();
  if (/restaurant|food|eatery|dining/.test(value)) return "catering.restaurant";
  if (/cafe|coffee|tea/.test(value)) return "catering.cafe";
  if (/bar|pub|nightlife/.test(value)) return "catering.bar";
  if (/fast food|takeaway|pizza|burger/.test(value)) return "catering.fast_food";
  if (/hotel|accommodation|lodging/.test(value)) return "accommodation.hotel";
  if (/hospital|clinic|doctor/.test(value)) return "healthcare";
  if (/pharmacy|chemist/.test(value)) return "healthcare.pharmacy";
  if (/school/.test(value)) return "education.school";
  if (/university|college/.test(value)) return "education.university";
  if (/bank/.test(value)) return "service.financial.bank";
  if (/atm/.test(value)) return "service.financial.atm";
  if (/fuel|petrol|gas station/.test(value)) return "service.vehicle.fuel";
  if (/supermarket|grocery/.test(value)) return "commercial.supermarket";
  if (/mall|shopping centre|shopping center/.test(value)) return "commercial.shopping_mall";
  if (/gym|fitness/.test(value)) return "leisure.fitness";
  if (/park|garden/.test(value)) return "leisure.park";
  if (/museum/.test(value)) return "entertainment.museum";
  if (/tourist|attraction|sightseeing/.test(value)) return "tourism.attraction";
  return "commercial,catering,accommodation,healthcare,education,entertainment,tourism";
};

const isCategorySearch = (term: string) =>
  /restaurant|food|eatery|dining|cafe|coffee|tea|bar|pub|nightlife|fast food|takeaway|pizza|burger|hotel|accommodation|lodging|hospital|clinic|doctor|pharmacy|chemist|school|university|college|bank|atm|fuel|petrol|gas station|supermarket|grocery|mall|shopping centre|shopping center|gym|fitness|park|garden|museum|tourist|attraction|sightseeing/i.test(term);

const categoryLabel = (categories?: string[]) => {
  const category = categories?.[0]?.split(".").pop()?.replaceAll("_", " ");
  return category ? category.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Place";
};

const toPlace = (feature: GeoapifyFeature, index: number, fallback?: { lat: number; lon: number }) => {
  const place = feature.properties ?? {};
  const name = place.name ?? place.address_line1 ?? "Unnamed place";
  const address = place.formatted ?? place.address_line1 ?? "Address unavailable";
  const lat = place.lat ?? fallback?.lat;
  const lon = place.lon ?? fallback?.lon;
  return {
    id: place.place_id ?? `geoapify-place-${lat ?? "x"}-${lon ?? "y"}-${index}`,
    name,
    category: categoryLabel(place.categories),
    country: place.country ?? "",
    distance: typeof place.distance === "number"
      ? `${(place.distance / 1000).toFixed(1)} km from search area`
      : place.country ?? address,
    rating: 0,
    blurb: address,
    mapsUrl: typeof lat === "number" && typeof lon === "number"
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`
      : undefined,
    lat,
    lon,
  };
};

const fetchPlaces = async (
  key: string,
  categories: string,
  searchTerm: string,
  center: { lat: number; lon: number },
) => {
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", categories);
  url.searchParams.set("bias", `proximity:${center.lon},${center.lat}`);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  if (!isCategorySearch(searchTerm)) url.searchParams.set("name", searchTerm);
  url.searchParams.set("apiKey", key);

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as GeoapifyPlacesResponse;
  if (!response.ok) throw new Error(payload.message ?? "Geoapify places search failed");
  return payload.features ?? [];
};

export const searchPlaces = createServerFn({ method: "GET" })
  .validator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    const key = process.env.GEOAPIFY_API_KEY;
    if (!key) {
      return {
        places: [],
        error: "Geoapify search is not configured yet. Check the GEOAPIFY_API_KEY environment variable in Vercel.",
      };
    }

    const parts = data.query.match(/^(.*?)\s+in\s+(.+)$/i);
    const searchTerm = (parts?.[1] ?? data.query).trim();
    const categories = categoryFor(searchTerm);

    try {
      if (parts) {
        const locationTerm = parts[2].trim();
        const geocodeUrl = new URL("https://api.geoapify.com/v1/geocode/search");
        geocodeUrl.searchParams.set("text", locationTerm);
        geocodeUrl.searchParams.set("format", "json");
        geocodeUrl.searchParams.set("limit", "1");
        geocodeUrl.searchParams.set("apiKey", key);

        const geocodeResponse = await fetch(geocodeUrl, { cache: "no-store" });
        const geocodePayload = (await geocodeResponse.json()) as GeoapifyGeocodeResponse;
        if (!geocodeResponse.ok) {
          console.error("[Geoapify] Location lookup failed", geocodePayload.message);
          return { places: [], error: "Could not look up that location. Check the spelling or try a city and country." };
        }

        const center = geocodePayload.results?.[0];
        if (typeof center?.lat !== "number" || typeof center?.lon !== "number") {
          return { places: [], error: `Could not find "${locationTerm}". Try a city, region, or country name.` };
        }

        const features = await fetchPlaces(key, categories, searchTerm, {
          lat: center.lat,
          lon: center.lon,
        });
        return {
          places: features.map((feature, index) => toPlace(feature, index, {
            lat: center.lat!,
            lon: center.lon!,
          })),
          scope: "local" as const,
        };
      }

      // Category/name-only searches fan out across geographic regions so one
      // Nairobi-biased request cannot dominate the global result set.
      const regionResults = await Promise.allSettled(
        GLOBAL_SEARCH_REGIONS.map(async (region) => ({
          region,
          features: await fetchPlaces(key, categories, searchTerm, region),
        })),
      );

      const successful = regionResults
        .filter((result): result is PromiseFulfilledResult<{
          region: (typeof GLOBAL_SEARCH_REGIONS)[number];
          features: GeoapifyFeature[];
        }> => result.status === "fulfilled");

      if (successful.length === 0) {
        const firstFailure = regionResults.find((result) => result.status === "rejected");
        console.error("[Geoapify] All global region searches failed", firstFailure);
        return { places: [], error: "Global place search is temporarily unavailable. Please try again." };
      }

      const seen = new Set<string>();
      const places = successful.flatMap(({ region, features }) =>
        features.map((feature, index) => toPlace(feature, index, region))
      ).filter((place) => {
        const key = place.id || `${place.name.toLowerCase()}-${place.lat?.toFixed(4)}-${place.lon?.toFixed(4)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return {
        places: places.slice(0, 72),
        scope: "global" as const,
        partial: successful.length < GLOBAL_SEARCH_REGIONS.length,
      };
    } catch (error) {
      console.error("[Geoapify] Places request error", error);
      return {
        places: [],
        error: "Could not reach Geoapify. Please check your connection and try again.",
      };
    }
  });
