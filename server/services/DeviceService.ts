import { prisma } from "../../prisma/client";
import type { DeviceDb, Challenge, DeviceDraft, Session } from "../../core/models/Device";
import { randomBytes } from 'node:crypto'
import { CryptoUtils } from "@core/utils/crypto";
import { time } from "@core/utils/timeUtils";
import type { Device } from "@prisma/client";

export const DeviceService = {
    // Register a new device — called after successful challenge signing
    async registerDevice(data: DeviceDraft): Promise<DeviceDb> {
        return await prisma.device.create({ data });
    },

    // Look up device by ID
    async getDeviceById(deviceId: string): Promise<DeviceDb | null> {
        return await prisma.device.findUnique({
            where: { device_id: deviceId },
        });
    },

    // Create a one-time challenge
    async createChallenge(deviceId: string): Promise<Challenge> {
        const nonce = randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
		// delete existing challenge
		await prisma.challenge.deleteMany({
			where: { device_id: deviceId },
		})
        return await prisma.challenge.create({
            data: { device_id: deviceId, nonce, expires_at: expiresAt },
        });
    },

    // Verify and consume a challenge — returns nonce if valid, null if invalid/expired/used
    async consumeChallenge(challengeId: string): Promise<Challenge | null> {
        const challenge = await prisma.challenge.findUnique({
            where: { challenge_id: challengeId },
        });

        if (!challenge || challenge.used_at !== null) return null;
        if (challenge.expires_at < new Date()) return null;

        // Mark as used atomically
        await prisma.challenge.update({
            where: { challenge_id: challengeId },
            data: { used_at: new Date() },
        });

        return challenge;
    },

	 // Create a one-time challenge
    async createSession(deviceId: string): Promise<Session> {
    	const accessToken = randomBytes(48).toString('base64url');
        const expiresAt = time(30, 'minutes').fromNow;
    	const refreshToken = randomBytes(48).toString('base64url');
        const refreshExpiresAt = time(1, 'week').fromNow;

		// delete existing session
		await prisma.session.deleteMany({
			where: { device_id: deviceId },
		})
        
		await prisma.session.create({
            data: {
				device_id: deviceId,
				token_hash: await CryptoUtils.sha256Hash(accessToken),
				expires_at: expiresAt.date,
				refresh_token_hash: await CryptoUtils.sha256Hash(refreshToken),
				refresh_expires_at: refreshExpiresAt.date,
			},
        });

		return {
			access_token: accessToken,
			expires_at_ms: expiresAt.ms,
			refresh_token: refreshToken,
			refresh_token_expires_at: refreshExpiresAt.ms,
		}
    },

    async terminateSession(deviceId: string): Promise<void> {
		await prisma.session.deleteMany({
			where: { device_id: deviceId },
		})
    },


    async validateSession(accessTokenHash: string) {
		if (!accessTokenHash) return null;
		const token = await prisma.session.findFirst({
			where: {
				token_hash: accessTokenHash
			},
		});
		if (!token || token.expires_at < new Date()) {
			return null;
		}
		return await this.getDeviceById(token.device_id);
    },



    async refreshSession(deviceId: string, refreshTokenHash: string): Promise<Session> {
		const session = await prisma.session.findFirst({
			where: {
				device_id: deviceId,
				refresh_token_hash: refreshTokenHash,
			},
		});
		if (!session || session.refresh_expires_at < new Date()) {
			throw new Error("INVALID SESSION REFRESH")
		}
		return await this.createSession(deviceId);
    },

};