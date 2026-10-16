import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { reverseGeocodeCoordinates } from '../utils/geo';

interface LocationPickerMapProps {
  lat: number;
  lng: number;
  selectedWard: string;
  accuracy?: number | null;
  isLocating?: boolean;
  onLocationChange: (
    lat: number,
    lng: number,
    estimatedWard?: string,
    landmarkSuggestion?: string,
    accuracy?: number | null
  ) => void;
  onRequestGeolocation?: () => void;
}

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  lat,
  lng,
  selectedWard,
  accuracy = null,
  isLocating = false,
  onLocationChange,
  onRequestGeolocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tileError, setTileError] = useState<boolean>(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({ lat, lng });
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  const invalidateMapSize = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
    }
  }, []);

  // Debounced address resolution helper
  const resolveLocationDetails = useCallback(
    (newLat: number, newLng: number, currentAcc?: number | null) => {
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current);
      }

      onLocationChange(newLat, newLng, selectedWard, undefined, currentAcc);

      // Debounce detailed reverse geocoding to prevent rapid API requests
      geocodeTimerRef.current = setTimeout(async () => {
        setIsGeocoding(true);
        try {
          const result = await reverseGeocodeCoordinates(newLat, newLng);
          if (result && result.address) {
            onLocationChange(newLat, newLng, selectedWard, result.address, currentAcc);
          }
        } finally {
          setIsGeocoding(false);
        }
      }, 650);
    },
    [onLocationChange, selectedWard]
  );

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 15,
      minZoom: 11,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      touchZoom: true,
      dragging: true,
    });

    map.attributionControl.setPrefix(
      '<a href="https://leafletjs.com" title="Leaflet" target="_blank" rel="noopener noreferrer">Leaflet</a>'
    );

    const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });

    tileLayer.on('tileerror', () => setTileError(true));
    tileLayer.on('tileload', () => setTileError(false));
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    // Draggable Custom Pin
    const pinIcon = L.divIcon({
      className: 'cleanmap-picker-pin',
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      popupAnchor: [0, -38],
      html: `
        <div style="position: relative; width: 32px; height: 40px; cursor: grab; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.38));">
          <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
            <path d="M16 0C7.16344 0 0 7.16344 0 16C0 27.2 14.4 39.1 15.04 39.62C15.32 39.86 15.68 40 16 40C16.32 40 16.68 39.86 16.96 39.62C17.6 39.1 32 27.2 32 16C32 7.16344 24.8366 0 16 0Z" fill="#003e1c"/>
            <circle cx="16" cy="15" r="7" fill="#ffffff"/>
            <circle cx="16" cy="15" r="4" fill="#003e1c"/>
          </svg>
        </div>
      `,
    });

    const marker = L.marker([lat, lng], {
      icon: pinIcon,
      draggable: true,
    }).addTo(map);

    markerRef.current = marker;
    mapInstanceRef.current = map;

    // Update coordinates when marker is dragged
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      setCurrentCoords({ lat: position.lat, lng: position.lng });
      // When user manually drags, remove accuracy circle
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      resolveLocationDetails(position.lat, position.lng, null);
    });

    // Update coordinates when map is clicked
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: newLat, lng: newLng } = e.latlng;
      marker.setLatLng([newLat, newLng]);
      setCurrentCoords({ lat: newLat, lng: newLng });
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      resolveLocationDetails(newLat, newLng, null);
    });

    // Invalidate size on settlement
    const t1 = setTimeout(invalidateMapSize, 60);
    const t2 = setTimeout(invalidateMapSize, 250);
    const t3 = setTimeout(invalidateMapSize, 600);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          invalidateMapSize();
        });
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    const handleResize = () => invalidateMapSize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [lat, lng, invalidateMapSize, resolveLocationDetails]);

  // Sync if parent updates lat/lng (e.g. from GPS detection or Ward select)
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.setView([lat, lng], 16);
      setCurrentCoords({ lat, lng });

      // If accuracy radius is supplied from GPS, display accuracy circle
      if (accuracy && accuracy > 0) {
        if (accuracyCircleRef.current) {
          mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
        }
        const circle = L.circle([lat, lng], {
          radius: Math.min(accuracy, 800), // Cap max visual radius to prevent blowout
          color: '#1e5631',
          fillColor: '#1e5631',
          fillOpacity: 0.14,
          weight: 1.5,
          dashArray: '4, 4',
        }).addTo(mapInstanceRef.current);

        circle.bindTooltip(`GPS Accuracy Radius: ±${Math.round(accuracy)}m`, {
          direction: 'top',
          className: 'cleanmap-leaflet-tooltip',
        });
        accuracyCircleRef.current = circle;
      } else if (accuracyCircleRef.current) {
        mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
    }
  }, [lat, lng, accuracy]);

  const handleZoom = (delta: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + delta);
  };

  const handleCenterOnAgartala = () => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    const centerLat = 23.8315;
    const centerLng = 91.2868;
    mapInstanceRef.current.setView([centerLat, centerLng], 15);
    if (accuracyCircleRef.current) {
      mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
      accuracyCircleRef.current = null;
    }
  };

  return (
    <div className="relative w-full h-60 sm:h-72 rounded-xl overflow-hidden shadow-sm border border-outline-variant/30 flex flex-col bg-surface-container">
      {/* Map Element Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0 touch-pan-x touch-pan-y"
        tabIndex={0}
        aria-label="Interactive Location Picker Map for Agartala"
      />

      {/* Tile Error Notice */}
      {tileError && (
        <div className="absolute top-1 left-1 right-1 z-20 bg-error-container text-on-error-container px-2.5 py-1.5 rounded text-xs flex items-center justify-between shadow">
          <span>Map tiles connecting... Pin coordinates remain active.</span>
          <button
            onClick={() => setTileError(false)}
            className="underline font-bold ml-1 cursor-pointer p-1"
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      {/* Floating Guidance Strip */}
      <div className="absolute top-2 left-2 z-10 pointer-events-auto max-w-[70%]">
        <div className="bg-surface/95 backdrop-blur-md px-2.5 py-1 rounded-md text-label-sm font-label-sm text-on-surface shadow flex items-center gap-1.5 border border-outline-variant/20">
          <span className="material-symbols-outlined text-sm text-primary flex-shrink-0">touch_app</span>
          <span className="truncate text-xs">
            {isGeocoding ? 'Resolving street address...' : 'Tap map or drag pin to adjust coordinates'}
          </span>
        </div>
      </div>

      {/* Floating Map Controls - Min 44px touch targets on mobile */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 pointer-events-auto">
        <button
          aria-label="Zoom in"
          className="w-10 h-10 sm:w-9 sm:h-9 bg-surface/95 backdrop-blur-md rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container shadow border border-outline-variant/30 cursor-pointer"
          type="button"
          onClick={() => handleZoom(1)}
        >
          <span className="material-symbols-outlined text-base">add</span>
        </button>
        <button
          aria-label="Zoom out"
          className="w-10 h-10 sm:w-9 sm:h-9 bg-surface/95 backdrop-blur-md rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container shadow border border-outline-variant/30 cursor-pointer"
          type="button"
          onClick={() => handleZoom(-1)}
        >
          <span className="material-symbols-outlined text-base">remove</span>
        </button>
        <button
          aria-label="Recenter on Central Agartala"
          className="w-10 h-10 sm:w-9 sm:h-9 bg-surface/95 backdrop-blur-md rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container shadow border border-outline-variant/30 cursor-pointer"
          title="Recenter on Central Agartala"
          type="button"
          onClick={handleCenterOnAgartala}
        >
          <span className="material-symbols-outlined text-base">center_focus_strong</span>
        </button>
        {onRequestGeolocation && (
          <button
            aria-label="Detect current GPS location"
            className={`w-10 h-10 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shadow border cursor-pointer transition-colors ${
              isLocating
                ? 'bg-secondary text-on-secondary border-secondary animate-pulse'
                : 'bg-primary text-on-primary hover:bg-primary-container border-primary/20'
            }`}
            title="Use My Current Location"
            type="button"
            onClick={onRequestGeolocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <span className="inline-block w-4 h-4 border-2 border-on-secondary border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <span className="material-symbols-outlined text-base">my_location</span>
            )}
          </button>
        )}
      </div>

      {/* Bottom Coordinates, Accuracy & Ward Strip */}
      <div className="absolute bottom-6 sm:bottom-2 left-2 right-2 z-10 pointer-events-auto bg-surface/95 backdrop-blur-md p-2 rounded-lg flex flex-wrap items-center justify-between text-label-sm font-label-sm gap-1.5 border border-outline-variant/20 shadow-sm">
        <div className="flex items-center gap-1.5 text-on-surface truncate min-w-0">
          <span className="material-symbols-outlined text-sm text-primary flex-shrink-0">location_on</span>
          <span className="truncate text-xs font-semibold">{selectedWard}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {accuracy !== null && accuracy !== undefined && (
            <span className="px-1.5 py-0.5 bg-secondary-container text-on-secondary-container font-mono text-[10px] sm:text-xs rounded font-bold">
              ±{Math.round(accuracy)}m
            </span>
          )}
          <span className="px-1.5 py-0.5 bg-surface-container text-on-surface font-mono text-[10px] sm:text-xs rounded font-bold border border-outline-variant/30">
            {currentCoords.lat.toFixed(4)}° N, {currentCoords.lng.toFixed(4)}° E
          </span>
        </div>
      </div>
    </div>
  );
};
