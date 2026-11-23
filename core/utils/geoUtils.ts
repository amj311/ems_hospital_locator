import { reverseGeocode } from "@/utils/reverseGeocode";
import { Capacitor } from "@capacitor/core";
import { Geolocation, type Position } from "@capacitor/geolocation";
import type { TimelineNode } from "@core/models/LocationShare";

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Computes the distance in meters between two lat/lon coordinates
 * using the Haversine formula.
 */
export function distanceInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

export type Coords = { latitude: number, longitude: number };

export async function pullLocation(): Promise<TimelineNode | null> {
	// native version
	if (Capacitor.isNativePlatform()) {
		try {
			// 1. Request and check permissions first
			const permissions = await Geolocation.checkPermissions();
			if (permissions.location !== 'granted') {
				await Geolocation.requestPermissions();
			}

			return await geoToTimelineNode(await Geolocation.getCurrentPosition({
				enableHighAccuracy: true,
			}));
		} catch (e: any) {
			return null;
		}
	}
   
	else {
		if (!navigator.geolocation) {
			return null;
		}

		return new Promise(res => navigator.geolocation.getCurrentPosition(
			async position => {
				res(await geoToTimelineNode(position))
			},
			(error) => {
				console.warn("could not get location", error);
				res(null);
			},
			{ enableHighAccuracy: true },
		));
	}
}

export async function geoToTimelineNode(position: Position | GeolocationPosition): Promise<TimelineNode> {
	return {
		timestamp: position.timestamp,
		latitude: position.coords.latitude,
		longitude: position.coords.longitude,
		speed: position.coords.speed,
		accuracy: position.coords.accuracy,
		cityString: (await reverseGeocode(position.coords))?.format('town, state'),
	}
}