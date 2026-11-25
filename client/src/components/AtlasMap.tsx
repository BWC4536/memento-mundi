import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_TILE_URL, MAX_ZOOM, MIN_ZOOM, OSM_ATTRIBUTION, pinHtml, type AtlasPlace } from "./atlas-map-utils";

export type { AtlasPlace } from "./atlas-map-utils";

/**
 * Mapa del atlas con Leaflet + OpenStreetMap (sin claves ni cuentas).
 * Arrastre con ratón o dedo, pellizco táctil, doble toque/clic para acercar y
 * zoom con la rueda solo cuando el mapa tiene el foco (para no atrapar el scroll de la página).
 */

export type AtlasMapHandle = {
  zoomBy: (delta: number) => void;
  flyToPlace: (id: string, zoom?: number) => void;
};

type Props = {
  places: AtlasPlace[];
  selectedId?: string | null;
  initialCenter?: [number, number];
  initialZoom?: number;
  /** Las chinchetas aparecen al llegar a este zoom. */
  revealZoom?: number;
  className?: string;
  onSelect: (id: string) => void;
  onZoomChange?: (zoom: number) => void;
  /** Se llama si las teselas no se pueden descargar (sin red o servidor caído). */
  onTilesError?: () => void;
};

const AtlasMap = forwardRef<AtlasMapHandle, Props>(function AtlasMap(
  { places, selectedId, initialCenter = [25, 8], initialZoom = 2, revealZoom = 4, className = "", onSelect, onZoomChange, onTilesError },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new globalThis.Map<string, L.Marker>());
  const layerRef = useRef<L.LayerGroup | null>(null);
  // Zoom al que se dirige el mapa mientras anima: así varios toques seguidos en + suman en lugar de repetirse.
  const targetZoomRef = useRef<number | null>(null);
  const callbacks = useRef({ onSelect, onZoomChange, onTilesError, places, revealZoom });
  callbacks.current = { onSelect, onZoomChange, onTilesError, places, revealZoom };

  useImperativeHandle(ref, () => ({
    zoomBy: (delta) => {
      const map = mapRef.current;
      if (!map) return;
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (targetZoomRef.current ?? map.getZoom()) + delta));
      targetZoomRef.current = next;
      map.setZoom(next);
    },
    flyToPlace: (id, zoom = 7) => {
      const place = callbacks.current.places.find((item) => item.id === id);
      if (place) mapRef.current?.flyTo([place.lat, place.lng], zoom, { duration: 0.8 });
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: false,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1,
      scrollWheelZoom: false,
      zoomSnap: 0.5,
      inertia: true,
      bounceAtZoomLimits: false,
    });
    map.attributionControl.setPrefix(false);

    const tileUrl = (import.meta.env.VITE_MAP_TILE_URL as string | undefined) || DEFAULT_TILE_URL;
    let loaded = 0;
    let failed = 0;
    L.tileLayer(tileUrl, { maxZoom: 19, noWrap: true, attribution: OSM_ATTRIBUTION })
      .on("tileload", () => {
        loaded += 1;
      })
      .on("tileerror", () => {
        failed += 1;
        if (loaded === 0 && failed === 6) callbacks.current.onTilesError?.();
      })
      .addTo(map);

    const layer = L.layerGroup();
    layerRef.current = layer;
    mapRef.current = map;

    const syncMarkers = () => {
      const zoom = map.getZoom();
      callbacks.current.onZoomChange?.(zoom);
      if (zoom >= callbacks.current.revealZoom) layer.addTo(map);
      else layer.remove();
    };
    map.on("zoomend", () => {
      // Leaflet descarta un zoom nuevo mientras anima el anterior: si había toques en cola, se aplican ahora.
      const target = targetZoomRef.current;
      if (target !== null && Math.abs(target - map.getZoom()) > 0.01) map.setZoom(target);
      else targetZoomRef.current = null;
      syncMarkers();
    });

    // La rueda hace zoom solo cuando el mapa tiene el foco (clic o toque).
    map.on("click focus", () => map.scrollWheelZoom.enable());
    map.on("mouseout blur", () => map.scrollWheelZoom.disable());

    markersRef.current.clear();
    for (const place of callbacks.current.places) {
      const marker = L.marker([place.lat, place.lng], {
        icon: L.divIcon({ className: "atlas-pin", html: pinHtml(place, false), iconSize: [0, 0] }),
        keyboard: true,
        title: place.city,
      });
      marker.on("click", () => callbacks.current.onSelect(place.id));
      marker.addTo(layer);
      markersRef.current.set(place.id, marker);
    }
    syncMarkers();

    // Si el contenedor cambia de tamaño (giro del móvil, cambio de layout) el mapa se reajusta.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize()) : null;
    observer?.observe(container);

    return () => {
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
    };
    // El mapa se crea una sola vez; los cambios llegan por la ref de callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    for (const place of places) {
      markersRef.current.get(place.id)?.setIcon(L.divIcon({ className: "atlas-pin", html: pinHtml(place, place.id === selectedId), iconSize: [0, 0] }));
    }
  }, [places, selectedId]);

  return <div ref={containerRef} role="application" aria-label="Mapa del atlas: arrastra para moverte y pellizca para acercar" className={`atlas-map ${className}`} />;
});

export default AtlasMap;
