import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ query: z.string().trim().min(1).max(120) });

type GeoapifyFeature = {
  properties?: {
    place_id?: string;
    name?: string;
    address_line1?: string;
    formatted?: string;
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

const DEFAULT_LOCATION = { lat: -1.286389, lon: 36.817223 };

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

const categoryLabel = (categories?: string[]) => {
  const category = categories?.[0]?.split(".").pop()?.replaceAll("_", " ");
  return category ? category.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Place";
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
    const locationTerm = (parts?.[2] ?? "Nairobi, Kenya").trim();
    const categories = categoryFor(searchTerm);

    try {
      const geocodeUrl = new URL("https://api.geoapify.com/v1/geocode/search");
      geocodeUrl.searchParams.set("text", locationTerm);
      geocodeUrl.searchParams.set("format", "json");
      geocodeUrl.searchParams.set("limit", "1");
      geocodeUrl.searchParams.set("apiKey", key);

      const geocodeResponse = await fetch(geocodeUrl, { cache: "no-store" });
      const geocodePayload = (await geocodeResponse.json()) as GeoapifyGeocodeResponse;
      if (!geocodeResponse.ok) {
        console.error("[Geoapify] Location lookup failed", geocodePayload.message);
        return { places: [], error: "Could not find that location. Try a city or neighbourhood, such as Nairobi." };
      }

      const center = geocodePayload.results?.[0];
      const lat = typeof center?.lat === "number" ? center.lat : DEFAULT_LOCATION.lat;
      const lon = typeof center?.lon === "number" ? center.lon : DEFAULT_LOCATION.lon;

      const placesUrl = new URL("https://api.geoapify.com/v2/places");
      placesUrl.searchParams.set("categories", categories);
      placesUrl.searchParams.set("bias", `proximity:${lon},${lat}`);
      placesUrl.searchParams.set("limit", "8");
      placesUrl.searchParams.set("lang", "en");
      const isCategorySearch = /restaurant|food|eatery|dining|cafe|coffee|tea|bar|pub|nightlife|fast food|takeaway|pizza|burger|hotel|accommodation|lodging|hospital|clinic|doctor|pharmacy|chemist|school|university|college|bank|atm|fuel|petrol|gas station|supermarket|grocery|mall|shopping centre|shopping center|gym|fitness|park|garden|museum|tourist|attraction|sightseeing/i.test(searchTerm);
      if (!isCategorySearch) placesUrl.searchParams.set("name", searchTerm);
      placesUrl.searchParams.set("apiKey", key);

      const response = await fetch(placesUrl, { cache: "no-store" });
      const payload = (await response.json()) as GeoapifyPlacesResponse;
      if (!response.ok) {
        console.error("[Geoapify] Places search failed", payload.message);
        return {
          places: [],
          error: "Geoapify could not complete that search. Please try another place or search term.",
        };
      }

      return {
        places: (payload.features ?? []).map((feature, index) => {
          const place = feature.properties ?? {};
          const name = place.name ?? place.address_line1 ?? "Unnamed place";
          const address = place.formatted ?? place.address_line1 ?? "Address unavailable";
          const placeLat = place.lat ?? lat;
          const placeLon = place.lon ?? lon;
          return {
            id: place.place_id ?? `geoapify-place-${index}`,
            name,
            category: categoryLabel(place.categories),
            distance: typeof place.distance === "number"
              ? `${(place.distance / 1000).toFixed(1)} km from search area`
              : address,
            rating: 0,
            blurb: address,
            mapsUrl: `https://www.openstreetmap.org/?mlat=${placeLat}&mlon=${placeLon}#map=17/${placeLat}/${placeLon}`,
            lat: placeLat,
            lon: placeLon,
          };
        }),
      };
    } catch (error) {
      console.error("[Geoapify] Places request error", error);
      return {
        places: [],
        error: "Could not reach Geoapify. Please check your connection and try again.",
      };
    }
  });
