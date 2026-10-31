import type { ShareRequest } from "core/models/LocationShare";
import { ShareService } from "server/services/ShareService";

export default (fastify, _, done) => {

	// Get all locations shared to a device
    fastify.get('/for/:acting_device_id', async (request, reply) => {
        const { acting_device_id } = request.params;

        if (!acting_device_id) {
            return reply.status(400).send({ success: false, message: 'device_id required' });
        }

        try {
            const sharedToDevice = await ShareService.getSharedWithDevice(acting_device_id);
            const sharedFromDevice = await ShareService.getSharedFromDevice(acting_device_id);
            return { success: true, data: { sharedToDevice, sharedFromDevice } };
        } catch (err) {
            console.error('Error getting shared with device:', err);
            return reply.status(500).send({ success: false });
        }
    });

	fastify.get('/exists', async (request, reply) => {
        const { device_id, exchange_public_key } = request.query;

        if (!device_id || !exchange_public_key) {
            return reply.status(400).send({ success: false, error_code: 'bad request' });
        }

        try {
            const device = await ShareService.confirmDeviceByExchangeKey(device_id, exchange_public_key);
            return { success: true, data: Boolean(device) };
        } catch (err) {
            console.error('Error registering device:', err);
            return reply.status(500).send({ success: false, message: 'Failed to register device' });
        }
    });

	/**
	 * A receiving device requests to have the location from a sharing device.
	 * The sharing device has presented itself by some means (QR, NFC) and is polling for the
	 * receiving device tgo make this request.
	 */
	fastify.post('/init-request', async (request, reply) => {
		try {
			const {
				from_device_id,
				from_exchange_key,
				acting_device_id,
				share_payload,
				requested_at,
				reciprocate,
			 } = request.body;
			// verify other device exists
			const fromDevice = await ShareService.confirmDeviceByExchangeKey(from_device_id, from_exchange_key);
			if (!fromDevice) { 
				return reply.status(400).send({ success: false, message: 'bad request' });
			}

			const data = await ShareService.initShareRequest({
				from_device_id,
				to_device_id: acting_device_id,
				requested_at,
				reciprocate,
				share_payload,
			});
			return { success: true, data };
		}
		catch (e) {
			console.error(e);
			return reply.status(500).send({ success: false });
		}
	});

	/**
	 * The sharing device polls for new requests while it is in sharing mode.
	 * Requests are extremely short lived so this interaction must be instantaneous, and only for one device at a time.
	 */
	fastify.get('/poll-request/:acting_device_id', async (request, reply) => {
		try {
			const { acting_device_id } = request.params;
			const data = await ShareService.getActiveShareRequest(acting_device_id);
			return { success: true, data };
		}
		catch (e) {
			console.error(e);
			return reply.status(500).send({ success: false });
		}
	});

	/**
	 * The sharing device polls for new requests while it is in sharing mode.
	 * Requests are extremely short lived so this interaction must be instantaneous, and only for one device at a time.
	 */
	fastify.post('/approve-request/:acting_device_id/:to_device_id', async (request, reply) => {
		try {
			const { acting_device_id: from_device_id, to_device_id } = request.params;
			const data = await ShareService.approveShareRequest(from_device_id, to_device_id);
			return { success: true, data };
		}
		catch (e) {
			console.error(e);
			return reply.status(500).send({ success: false });
		}
	});

	/**
	 * The receiving device polls for approval on its request
	 */
	fastify.get('/poll-approval/:acting_device_id/:from_device_id', async (request, reply) => {
		try {
			const { acting_device_id, from_device_id } = request.params;
			const data = await ShareService.getApprovedShare(acting_device_id, from_device_id);
			return { success: true, data };
		}
		catch (e) {
			console.error(e);
			return reply.status(500).send({ success: false });
		}
	});

    done();
};