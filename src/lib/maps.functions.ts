import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ query: z.string().trim().min(1).max(120) });

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  googleMapsUri?: string;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
  error?: { message?: string };
};

export const searchPlaces = createServerFn({ method: "GET" })
  .validator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      return {
        places: [],
        error: "Google Maps search is not configured yet. Add GOOGLE_MAPS_API_KEY to the server environment.",
      };
    }

    try {
      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.primaryTypeDisplayName,places.formattedAddress,places.rating,places.googleMapsUri",
          },
          body: JSON.stringify({
            textQuery: data.query,
            maxResultCount: 8,
          }),
          cache: "no-store",
        },
      );

      const payload = (await response.json()) as GooglePlacesResponse;
      if (!response.ok) {
        console.error("[Google Maps] Places search failed", payload.error);
        return {
          places: [],
          error: "Google Maps could not complete that search. Check the API key, billing and Places API access.",
        };
      }

      return {
        places: (payload.places ?? []).map((place, index) => {
          const name = place.displayName?.text ?? "Unnamed place";
          const address = place.formattedAddress ?? "Address unavailable";
          const placeId = place.id;
          const mapsUrl =
            place.googleMapsUri ??
            (placeId
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`);

          return {
            id: placeId ?? `google-place-${index}`,
            name,
            category: place.primaryTypeDisplayName?.text ?? "Place",
            distance: address,
            rating: place.rating ?? 0,
            blurb: address,
            mapsUrl,
          };
        }),
      };
    } catch (error) {
      console.error("[Google Maps] Places request error", error);
      return {
        places: [],
        error: "Could not reach Google Maps. Please check your connection and try again.",
      };
    }
  });
