import { prisma } from "../../prisma/client";
import { time } from "core/utils/timeUtils";
import type { LocationShare as LocationShareDb } from "@prisma/client";
import { normalizeToArray } from "core/utils/miscUtils";
import { ACTIVE_REQUEST_THRESHOLD_MS, type LocationShare, type ShareRequest } from "core/models/LocationShare";

export const ShareService = {
	async getSharedWithDevice(device_id: string) {
		const shares = await prisma.locationShare.findMany({
			where: {
				to_device_id: device_id,
				revoked_at: null,
			}
		})
		return dbShareToStandardMany(shares);
	},
	async getSharedFromDevice(device_id: string) {
		const shares = await prisma.locationShare.findMany({
			where: {
				from_device_id: device_id,
				revoked_at: null,
			}
		})
		return dbShareToStandardMany(shares);
	},

	async confirmDeviceByExchangeKey(device_id: string, exchange_public_key: string) {
 		return await prisma.device.findFirst({
            where: { exchange_public_key, device_id },
        });
	},

	async initShareRequest(request: ShareRequest) {
		// abort if a share already exists
		const approved = await prisma.locationShare.findMany({
			where: {
				to_device_id: request.to_device_id,
				from_device_id: request.from_device_id,
			}
		});
		if (approved.length > 0) {
			throw new Error("Share already exists");
		}

		// just deleted other pending for both devices
		// only allow one open request at a time
		await prisma.shareRequest.deleteMany({
			where: {
				OR: [
					{ to_device_id: request.to_device_id },
					{ from_device_id: request.from_device_id },
				]
			}
		});

		return await prisma.shareRequest.create({
			data: request
		})
	},

	async getActiveShareRequest(from_device_id: string): Promise<ShareRequest | null> {
		const request = await prisma.shareRequest.findFirst({
			where: {
				from_device_id,
				requested_at: {
					gt: new Date(Date.now() - ACTIVE_REQUEST_THRESHOLD_MS),
				},
			},
		});

		return !request ? null : {
			...request,
			requested_at: request.requested_at.toISOString(),
		} as unknown as ShareRequest;
	},

	async approveShareRequest(from_device_id: string, to_device_id: string): Promise<LocationShare> {
		const request = await prisma.shareRequest.findFirst({
			where: {
				from_device_id,
				to_device_id,
				requested_at: {
					gt: new Date(Date.now() - ACTIVE_REQUEST_THRESHOLD_MS),
				},
			},
		});
		if (!request) {
			throw new Error('bad request');
		}

		return dbShareToStandard(await prisma.locationShare.create({
			data: {
				from_device_id,
				to_device_id,
				shared_at: new Date(),
			}
		}))!
	},

	async getApprovedShare(to_device_id: string, from_device_id: string): Promise<LocationShare | null> {
		const share = await prisma.locationShare.findFirst({
			where: {
				to_device_id,
				from_device_id,
				revoked_at: null,
			}
		});
		return dbShareToStandard(share);
	}
};

function dbShareToStandardMany(shares: Array<NonNullable<LocationShareDb>>): Array<LocationShare> {
	const batch = normalizeToArray(shares);
	return batch.map(share => dbShareToStandard(share)!);
}

function dbShareToStandard(share: LocationShareDb | null): LocationShare | null {
	if (!share) {
		return null;
	}
	return {
		location_share_id: share.location_share_id,
		from_device_id: share.from_device_id,
		to_device_id: share.to_device_id,
		shared_at_iso: share.shared_at.toISOString(),
		location: share.location,
		updated_at: share.updated_at?.toISOString(),
	}
}