import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { places as fallbackPlaces } from "@/features/core/data";

const input = z.object({ query: z.string().trim().min(1).max(120) });

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  location?: { latitude?: number; longitude?: number };
};

export const searchPlaces = createServerFn({ method: "GET" })
  .validator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return { places: fallbackPlaces, error: undefined };

    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.location",
      },
      body: JSON.stringify({ textQuery: data.query, maxResultCount: 8 }),
    });
    const payload = (await response.json()) as { places?: GooglePlace[]; error?: { message?: string } };
    if (!response.ok) return { places: fallbackPlaces, error: undefined };

    return {
      places: (payload.places ?? []).map((place, index) => ({
        id: place.id ?? `google-place-${index}`,
        name: place.displayName?.text ?? "Unnamed place",
        category: "Place",
        distance: place.formattedAddress ?? "Address unavailable",
        rating: place.rating ?? 0,
        open: true,
        blurb: place.formattedAddress ?? "Google Maps place",
        x: 20 + ((index * 17) % 60),
        y: 24 + ((index * 23) % 54),
      })),
    };
  });
