import type { Coords } from "core/utils/geoUtils";
import { time } from "core/utils/timeUtils";

export const ACTIVE_REQUEST_THRESHOLD_MS = time(1, 'minute').ms;

export type LocationShare = {
    location_share_id:    string,
    from_device_id:    string,
    to_device_id:      string,
    shared_at_iso:            string, // ISO
    location?: string | null,
    updated_at?: string | null,
};

export type ProfileDetails = {
	name?: string,
	icon?: string | null,
	color?: string,
}

/**
 * on-device info about a device sharing with them.
 * never saved to server
*/
export type LinkedDeviceConfig = {
	groupKey: string,
	profile: ProfileDetails,
	/**
	 * whether it should be represented not as a persons location but a tracked device
	 */
	isDevice?: string,
	// alerts?
}

export type TimelineNode = {
	coords: Coords,
	accuracy_m?: number,
	speed_mps?: number,
	timestamp: number,
	cityString?: string,
}

export type HydratedShare = LocationShare & {
	config: LinkedDeviceConfig,
	timeline: Array<TimelineNode>,
	lastPos?: TimelineNode,
	reciprocated?: LocationShare,
};


/**
 * Shared by the offering device so the receiving device can generate a share key
 */
export type ShareInit = {
	role: 'share_init',
	fromDeviceId: string,
	fromExchangeKey: string,
	expiresAt: number,
	profile: ProfileDetails,
}

/**
 * Returned from receiving device so offering device can extract share key
 */
export type ShareRequest = {
	from_device_id: string,
	to_device_id: string,
	requested_at: string,
	reciprocate?: boolean | null,
	share_payload: {
		to_exchange_key: string,
		cipher_text: string,
		nonce: string,
	}
}
