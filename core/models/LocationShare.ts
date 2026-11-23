import type { Coords } from "@core/utils/geoUtils";
import { time } from "@core/utils/timeUtils";

export const ACTIVE_REQUEST_THRESHOLD_MS = time(1, 'minute').ms;

/** Data stored on DB for each connection, one-way */
export type LocationShareApi = {
    location_share_id:    string,
    from_device_id:    string,
    to_device_id:      string,
	/** Expected to be asc */
	locationUpdates?: Array<{
		location: string, // json
	}>
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
	profile?: ProfileDetails | null,
	/**
	 * whether it should be represented not as a persons location but a tracked device
	 */
	isDevice?: string,
	// alerts?
}

export type TimelineNode = Coords & {
	timestamp: number,
	/* meters */
	accuracy?: number | null,
	/** meters per second */
	speed?: number | null,
	cityString?: string | null,
}

export type EncryptedLocationPayload = {
	nonce_64url: string,
	ciphertext_64url: string,
	keyId: string,
}


/** Data stored on device for each connection */
export type LinkedDeviceData = {
	deviceId: string,
	config: LinkedDeviceConfig,
	timeline: Array<TimelineNode>,
	sharingTheirs: boolean,
	sharingMine: boolean,
}

export type HydratedShare = LinkedDeviceData & {
	deviceId: string,
	lastPos?: TimelineNode,
};


/**
 * Shared by the offering device so the receiving device can generate a share key
 */
export type ShareInit = {
	role: 'share_init',
	fromDeviceId: string,
	fromExchangeKey: string,
	expiresAt: number,
	profile: ProfileDetails | null,
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


export type Geofence = Coords & {
	geofence_id: string,
	/** Meters */
	radius_m: number,
	name: string,
}