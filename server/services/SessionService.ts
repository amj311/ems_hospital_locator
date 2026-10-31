import * as dotenv from "dotenv"
dotenv.config()

import { DeviceService } from "./DeviceService";

// Middleware to check if the request has a valid Firebase user session
export const sessionAuthMiddleware = async (request, reply) => {
    try {
        const authToken = request.headers.authorization;
		if (!authToken) {
			// Send 401 for no auth
			reply.status(401).send();
			return;
		}
        // Verify the Firebase ID token
        const validatedDevice = await DeviceService.validateSession(authToken);
		if (!validatedDevice) {
			// Send 401 for no auth
			reply.status(401).send();
			return;
		}

		// TODO include all applicable scope in session to verify access
		// Verify that the token belongs to the acting device
		const acting_device_id = request.body?.acting_device_id || request.params?.acting_device_id || request.query?.acting_device_id;
		if (acting_device_id && acting_device_id !== validatedDevice.device_id) {
			reply.status(401).send();
			return;
		}

		request.device = validatedDevice;
    }
	catch (error) {
        // Return an error response if the Firebase user session is not valid
		console.error(error)
		reply.status(500).send();
    }
};

export default sessionAuthMiddleware;