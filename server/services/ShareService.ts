import { prisma } from "../../prisma/client";
import { time } from "@core/utils/timeUtils";
import type { LocationShare as LocationShareDb } from "@prisma/client";
import { normalizeToArray } from "@core/utils/miscUtils";
import { ACTIVE_REQUEST_THRESHOLD_MS, type EncryptedLocationPayload, type LocationShareApi, type ShareRequest } from "@core/models/LocationShare";

export const ShareService = {
	async getSharedWithDevice(device_id: string, locationSince?: string) {
		const shares = await prisma.locationShare.findMany({
			where: {
				to_device_id: device_id,
				revoked_at: null,
			},
			include: {
				locationUpdates: locationSince ? {
					where: {
						timestamp: {
							gte: new Date(locationSince)
						},
					},
					orderBy: {
						timestamp: 'asc',
					}
				} : true,
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
		// abort if active share already exists
		const approved = await prisma.locationShare.findMany({
			where: {
				to_device_id: request.to_device_id,
				from_device_id: request.from_device_id,
				revoked_at: null,
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

	async approveShareRequest(from_device_id: string, to_device_id: string, location: EncryptedLocationPayload | null) {
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

		// if reciprocated, create other direction as well
		const shareFromRequester = request.reciprocate ? dbShareToStandard(await prisma.locationShare.upsert({
			where: {
				from_device_id_to_device_id: {
					from_device_id: to_device_id,
					to_device_id: from_device_id,
				}
			},
			create: {
				from_device_id: to_device_id,
				to_device_id: from_device_id,
				shared_at: new Date(),
			},
			update: {
				shared_at: new Date(),
				revoked_at: null,
			}
		}))! : null;

		const shareFromApprover = dbShareToStandard(await prisma.locationShare.upsert({
			where: {
				from_device_id_to_device_id: {
					from_device_id,
					to_device_id,
				}
			},
			create: {
				from_device_id,
				to_device_id,
				shared_at: new Date(),
			},
			update: {
				shared_at: new Date(),
				revoked_at: null,
			}
		}))!;

		if (location) {
			await this.updateLocation(from_device_id, to_device_id, location);
		}

		return {
			shareFromRequester,
			shareFromApprover,
		}
	},

	async getApprovedShare(to_device_id: string, from_device_id: string) {
		const shareFromApprover = dbShareToStandard(await prisma.locationShare.findFirst({
			where: {
				to_device_id,
				from_device_id,
				revoked_at: null,
			},
			include: {
				locationUpdates: {
					orderBy: {
						timestamp: 'asc',
					}
				},
			}
		}));

		if (!shareFromApprover) {
			return null;
		}

		const shareFromRequester = dbShareToStandard(await prisma.locationShare.findFirst({
			where: {
				to_device_id: from_device_id,
				from_device_id: to_device_id,
				revoked_at: null,
			}
		}));

		return {
			shareFromApprover,
			shareFromRequester,
		};
	},

	async updateLocation(from_device_id: string, to_device_id: string, payload: EncryptedLocationPayload) {
		const share = await prisma.locationShare.findFirst({
			where: {
				to_device_id,
				from_device_id,
				revoked_at: null,
			}
		});

		if (!share) {
			throw new Error("No share between devices!");
		}

		await prisma.locationUpdate.create({
			data: {
				location_share_id: share.location_share_id,
				location: JSON.stringify(payload),
				timestamp: new Date(),
			}
		})

		// only store a limited batch, enough for a sleeping device to catch up when it syncs
		// doesn't guarantee all devices get all history, just a recent batch when they are active
		const maxHistory = 20;
		const oldest = await prisma.locationUpdate.findFirst({
			where: {
				location_share_id: share.location_share_id,
			},
			orderBy: { timestamp: 'desc' },
			skip: maxHistory,
		})
		if (oldest) {
			await prisma.locationUpdate.deleteMany({
				where: {
					location_share_id: share.location_share_id,
					timestamp: {
						gte: oldest.timestamp,
					}
				}
			})
		}
	}
};

function dbShareToStandardMany(shares: Array<NonNullable<LocationShareDb>>): Array<LocationShareApi> {
	const batch = normalizeToArray(shares);
	return batch.map(share => dbShareToStandard(share)!);
}

function dbShareToStandard(share: LocationShareDb | null): LocationShareApi | null {
	if (!share) {
		return null;
	}
	return {
		location_share_id: share.location_share_id,
		from_device_id: share.from_device_id,
		to_device_id: share.to_device_id,
		locationUpdates: (share as any).locationUpdates,
	}
}