export type MapsProvider = 'google' | 'apple' | 'system';
export type Platform = 'ios' | 'android' | 'desktop';

/**
 * Format coordinates for use in directions URLs
 */
function formatCoords(lat: number, lon: number): string {
	return `${lat},${lon}`;
}

/**
 * Build Google Maps directions URL
 * @param origin - origin coordinates as "lat,lon" or { lat, lon }
 * @param dest - destination coordinates as "lat,lon" or { lat, lon }
 */
export function getGoogleDirectionsUrl(
	origin: string | { lat: number; lon: number } | null,
	dest: string | { lat: number; lon: number }
): string {
	const destStr = typeof dest === 'string' ? dest : formatCoords(dest.lat, dest.lon);
	
	if (!origin) {
		return `https://www.google.com/maps/search/${destStr}`;
	}
	
	const originStr = typeof origin === 'string' ? origin : formatCoords(origin.lat, origin.lon);
	return `https://www.google.com/maps/dir/${originStr}/${destStr}`;
}

/**
 * Build Apple Maps directions URL
 * @param origin - origin coordinates as "lat,lon" or { lat, lon }
 * @param dest - destination coordinates as "lat,lon" or { lat, lon }
 */
export function getAppleMapsUrl(
	origin: string | { lat: number; lon: number } | null,
	dest: string | { lat: number; lon: number }
): string {
	const destStr = typeof dest === 'string' ? dest : `${dest.lat},${dest.lon}`;
	
	if (!origin) {
		return `https://maps.apple.com/?q=${destStr}`;
	}
	
	const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lon}`;
	return `https://maps.apple.com/?saddr=${originStr}&daddr=${destStr}`;
}

/**
 * Build system-default directions URL based on platform
 * - iOS: Apple Maps HTTPS
 * - Android: geo: intent scheme
 * - Desktop: Google Maps HTTPS
 */
export function getSystemDirectionsUrl(
	origin: string | { lat: number; lon: number } | null,
	dest: string | { lat: number; lon: number },
	platform: Platform
): string {
	if (platform === 'ios') {
		return getAppleMapsUrl(origin, dest);
	}
	
	if (platform === 'android') {
		const destStr = typeof dest === 'string' ? dest : `${dest.lat},${dest.lon}`;
		// geo: scheme for Android system delegation; fails silently in browser
		return `geo:${destStr}?q=${destStr}`;
	}
	
	// Desktop: use Google Maps
	return getGoogleDirectionsUrl(origin, dest);
}

/**
 * Build directions URL based on provider preference
 * @param provider - maps provider choice ('google', 'apple', or 'system')
 * @param origin - user's origin location or null
 * @param dest - destination facility location
 * @param platform - detected platform ('ios', 'android', 'desktop')
 */
export function buildDirectionsUrl(
	provider: MapsProvider,
	origin: { lat: number; lon: number } | null,
	dest: { lat: number; lon: number },
	platform: Platform
): string {
	if (provider === 'google') {
		return getGoogleDirectionsUrl(origin, dest);
	}
	
	if (provider === 'apple') {
		return getAppleMapsUrl(origin, dest);
	}
	
	// provider === 'system'
	return getSystemDirectionsUrl(origin, dest, platform);
}
