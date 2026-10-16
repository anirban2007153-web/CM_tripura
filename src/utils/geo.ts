/**
 * CleanMap Tripura - Geospatial & Geolocation Utilities
 */

// In-memory cache for reverse geocode queries to avoid duplicate network calls
const reverseGeocodeCache = new Map<string, string>();

/**
 * Reverse geocodes coordinates to a human-readable street/neighbourhood address using OpenStreetMap Nominatim.
 * Handles network failures, timeouts, and rate limits gracefully.
 * Does not fabricate addresses.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
  timeoutMs: number = 4500
): Promise<{ address: string; source: 'nominatim' } | null> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (reverseGeocodeCache.has(cacheKey)) {
    return {
      address: reverseGeocodeCache.get(cacheKey)!,
      source: 'nominatim',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const road = addr.road || addr.pedestrian || addr.footway || addr.path || addr.street;
        const area = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district;
        const city = addr.city || addr.town || addr.village || addr.city_district;

        const parts: string[] = [];
        if (road) parts.push(road);
        if (area && area !== road) parts.push(area);
        if (city && city !== area && city !== road) parts.push(city);

        if (parts.length > 0) {
          const readable = parts.join(', ');
          reverseGeocodeCache.set(cacheKey, readable);
          return { address: readable, source: 'nominatim' };
        } else if (data.display_name) {
          const shortName = data.display_name.split(',').slice(0, 3).join(',').trim();
          reverseGeocodeCache.set(cacheKey, shortName);
          return { address: shortName, source: 'nominatim' };
        }
      }
    }
  } catch {
    // Graceful fallback on network timeout, offline or rate limit
  }

  return null;
}

/**
 * Format GeolocationPositionError into user-friendly diagnostic guidance
 */
export function formatGeolocationError(error: GeolocationPositionError | { code: number; message: string }): {
  title: string;
  message: string;
  code: string;
} {
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return {
        title: 'Location Permission Denied',
        message: 'GPS access was not granted by your browser. You can still pinpoint your exact location manually by tapping or dragging the pin on the map.',
        code: 'ERR_GPS_PERMISSION_DENIED',
      };
    case 2: // POSITION_UNAVAILABLE
      return {
        title: 'Location Unavailable',
        message: 'Your device could not determine a position (GPS hardware or cellular positioning is unavailable or switched off). Please select your location on the map.',
        code: 'ERR_GPS_POSITION_UNAVAILABLE',
      };
    case 3: // TIMEOUT
      return {
        title: 'GPS Acquisition Timed Out',
        message: 'The GPS fix timed out before a reliable lock was established. Satellite visibility may be blocked. You can tap the map or retry in an open area.',
        code: 'ERR_GPS_TIMEOUT',
      };
    default:
      return {
        title: 'Location Detection Notice',
        message: error.message || 'Unable to retrieve device position. Please select your location manually on the interactive map.',
        code: 'ERR_GPS_UNKNOWN',
      };
  }
}
