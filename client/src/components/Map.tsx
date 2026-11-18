/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Pure utility functions; not attached to map.
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * - Combines DirectionsService (standalone) + DirectionsRenderer (map-attached)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 *
 * -------------------------------
 * 🌦️ MAP LAYERS (attach directly to map)
 * - new google.maps.TrafficLayer().setMap(map);
 * - new google.maps.TransitLayer().setMap(map);
 * - new google.maps.BicyclingLayer().setMap(map);
 *
 * -------------------------------
 * ✅ SUMMARY
 * - “map-attached” → AdvancedMarkerElement, DirectionsRenderer, Layers.
 * - “standalone” → Geocoder, DirectionsService, DistanceMatrixService, ElevationService.
 * - “data-only” → Place, Geometry utilities.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

/*
 * Carga de Google Maps:
 *  1. VITE_GOOGLE_MAPS_API_KEY (clave propia de Google Cloud) → script oficial de Google.
 *  2. Si no existe, VITE_FRONTEND_FORGE_API_KEY → proxy de Manus (solo funciona en Manus).
 *  3. Sin ninguna, el mapa no se carga y se avisa con `onError`.
 * VITE_GOOGLE_MAPS_MAP_ID es opcional: los marcadores avanzados necesitan un Map ID
 * (en producción conviene crear uno propio; DEMO_MAP_ID es solo para pruebas).
 */
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const FORGE_API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY as string | undefined;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;
const MAP_LIBRARIES = "marker,places,geocoding,geometry";
export const GOOGLE_MAPS_MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || "DEMO_MAP_ID";

export function getMapsScriptUrl(env: { googleKey?: string; forgeKey?: string; proxyUrl?: string } = { googleKey: GOOGLE_MAPS_API_KEY, forgeKey: FORGE_API_KEY, proxyUrl: MAPS_PROXY_URL }) {
  if (env.googleKey) {
    return `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(env.googleKey)}&v=weekly&libraries=${MAP_LIBRARIES}&language=es&loading=async`;
  }
  if (env.forgeKey && env.proxyUrl) {
    return `${env.proxyUrl}/maps/api/js?key=${encodeURIComponent(env.forgeKey)}&v=weekly&libraries=${MAP_LIBRARIES}`;
  }
  return null;
}

export const isMapsConfigured = getMapsScriptUrl() !== null;

const MAPS_SCRIPT_URL = getMapsScriptUrl();

let mapScriptPromise: Promise<void> | null = null;
let authFailed = false;
const authFailureListeners = new Set<() => void>();

function loadMapScript() {
  if (!MAPS_SCRIPT_URL) return Promise.reject(new Error("Google Maps no está configurado (falta VITE_GOOGLE_MAPS_API_KEY)."));
  if (authFailed) return Promise.reject(new Error("La clave de Google Maps no es válida para este dominio."));
  if (window.google?.maps?.Map) return Promise.resolve();
  if (mapScriptPromise) return mapScriptPromise;

  // Google llama a esta función global cuando la clave es inválida o el dominio no está autorizado.
  (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
    authFailed = true;
    authFailureListeners.forEach((listener) => listener());
  };

  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${MAPS_SCRIPT_URL}"]`);

  mapScriptPromise = new Promise<void>((resolve, reject) => {
    const ready = async () => {
      try {
        // Con loading=async las clases se cargan bajo demanda.
        if (typeof window.google?.maps?.importLibrary === "function") {
          await window.google.maps.importLibrary("maps");
          await window.google.maps.importLibrary("marker");
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    if (existingScript) {
      existingScript.addEventListener("load", () => void ready(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MAPS_SCRIPT_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => void ready();
    script.onerror = () => {
      mapScriptPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });

  return mapScriptPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  /** Se llama si el mapa no puede cargarse (sin clave, sin red o clave no autorizada). */
  onError?: (error: Error) => void;
  showControls?: boolean;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  onError,
  showControls = true,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);

  const init = usePersistFn(async () => {
    await loadMapScript();
    if (!mapContainer.current) {
      console.error("Map container not found");
      return;
    }
    map.current = new window.google.maps.Map(mapContainer.current, {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeControl: showControls,
      fullscreenControl: showControls,
      zoomControl: showControls,
      streetViewControl: showControls,
      mapId: GOOGLE_MAPS_MAP_ID,
    });
    if (onMapReady) {
      onMapReady(map.current);
    }
  });

  const reportError = usePersistFn((error: Error) => {
    onError?.(error);
  });

  useEffect(() => {
    const onAuthFailure = () => reportError(new Error("La clave de Google Maps no es válida para este dominio."));
    authFailureListeners.add(onAuthFailure);
    void init().catch((error) => {
      console.error("Failed to initialize Google Maps", error);
      reportError(error instanceof Error ? error : new Error(String(error)));
    });
    return () => {
      authFailureListeners.delete(onAuthFailure);
    };
  }, [init, reportError]);

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
