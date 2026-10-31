import { CryptoUtils } from "core/utils/crypto";
import { DeviceService } from "../services/DeviceService";

export default (fastify, _, done) => {

     // Register a new device — called once per device to establish identity
    fastify.post('/register', async (request, reply) => {
        const { public_key, recovery_public_key, exchange_public_key, recovery_fingerprint, password_hash } = request.body as {
            public_key: string;
            exchange_public_key: string;
            recovery_public_key: string;
            recovery_fingerprint: string;
            password_hash: string;
        };

        if (!public_key) {
            return reply.status(400).send({ success: false, error_code: 'bad request' });
        }

        try {
            const device = await DeviceService.registerDevice({
                public_key,
                exchange_public_key: exchange_public_key,
                recovery_public_key: recovery_public_key,
                recovery_fingerprint: recovery_fingerprint,
				password_hash,
            });
            return { success: true, data: {
                device_id: device.device_id,
                public_key: device.public_key,
                recovery_fingerprint: device.recovery_fingerprint,
            }};
        } catch (err) {
            console.error('Error registering device:', err);
            return reply.status(500).send({ success: false, message: 'Failed to register device' });
        }
    });
    fastify.post('/challenge', async (request, reply) => {
        const { device_id } = request.body as { device_id?: string };

        if (!device_id) {
            return reply.status(400).send({ success: false,  error_code: 'bad request' });
        }

        // Always create a challenge (prevents device enumeration)
        try {
            const challenge = await DeviceService.createChallenge(device_id);
            return { success: true, data: {
                challenge_id: challenge.challenge_id,
                nonce: challenge.nonce,
                expires_at: challenge.expires_at,
            }};
        } catch (err) {
            console.error('Error creating challenge:', err);
            return reply.status(500).send({ success: false, message: 'Failed to create challenge' });
        }
    });

    // Step 2: Exchange signed challenge for session token
    fastify.post('/session', async (request, reply) => {
        const { device_id, challenge_id, signature, password_attempt } = request.body as {
            device_id: string;
            challenge_id: string;
            signature: string;
            password_attempt: string;
        };

        if (!device_id || !challenge_id || !signature) {
            return reply.status(400).send({ success: false, error_code: 'bad request' });
        }

        // 1. Consume the challenge (verifies not expired, not used)
        const challenge = await DeviceService.consumeChallenge(challenge_id);
        if (!challenge) {
            return reply.status(401).send({ success: false, error_code: 'INVALID_CHALLENGE' });
        }

        // 3. Verify the signature against the registered public key
        const device = await DeviceService.getDeviceById(device_id);
        if (!device || device.revoked_at !== null) {
            return reply.status(401).send({ success: false, error_code: 'UNKNOWN_DEVICE' });
        }

		const isValid = CryptoUtils.verifyChallenge(
			CryptoUtils.base64urlToBytes(device.public_key), 
			challenge,
			CryptoUtils.base64urlToBytes(signature),
		);

        if (!isValid) {
            return reply.status(401).send({ success: false, error_code: 'INVALID_CREDENTIALS' });
        }

		// 4. also verify human-provided password
		if (device.password_hash !== password_attempt) {
            return reply.status(401).send({ success: false, error_code: 'INVALID_CREDENTIALS' });
		}

        // 4. Generate a short-lived opaque session token
		const session = await DeviceService.createSession(device_id);
        
        return { success: true, data: session };
    });

    fastify.post('/session-refresh', async (request, reply) => {
        const { device_id, refresh_token_hash } = request.body as {
            device_id: string;
            refresh_token_hash: string;
        };

        if (!device_id || !refresh_token_hash) {
            return reply.status(400).send({ success: false, error_code: 'bad request' });
        }

        const device = await DeviceService.getDeviceById(device_id);
        if (!device || device.revoked_at !== null) {
            return reply.status(401).send({ success: false, error_code: 'UNKNOWN_DEVICE' });
        }

		const session = await DeviceService.refreshSession(device_id, refresh_token_hash);
        
        return { success: true, data: session };
    });

    done();
};