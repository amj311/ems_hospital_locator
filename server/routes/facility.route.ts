import type { Facility } from "core/models/Facility";
import { FacilityService } from "../services/FacilityService";
import axios from "axios";

export default (app, _, done) => {

	app.get('/route-table', async function handler(request, reply) {
		const { coords } = request.query as { coords?: string };
		if (!coords) {
			return reply.status(400).send({ success: false, message: 'coords query param required' });
		}
		const osrmBase = process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org';
		const osrmUrl = `${osrmBase}/table/v1/driving/${coords}?sources=0&annotations=duration`;
		try {
			const { data } = await axios.get(osrmUrl, { timeout: 10000 });
			return { success: true, data };
		} catch (err) {
			console.error('OSRM request failed:', err);
			return reply.status(502).send({ success: false, message: 'OSRM request failed' });
		}
	});

	app.post('/', async function handler(request, reply) {
		const facilityData = request.body as Facility;
		const data = await FacilityService.createFacility(facilityData);
		return {
			success: true,
			data,
		};
	});

	app.get('/', async function handler(request, reply) {
		const TWENTY_FIVE_MILES_METERS = 40234;
		const { lat, lon, radius } = request.query as { lat?: string; lon?: string; radius?: string };
		if (lat != null && lon != null) {
			const latNum = parseFloat(lat);
			const lonNum = parseFloat(lon);
			if (isNaN(latNum) || isNaN(lonNum)) {
				return reply.status(400).send({ success: false, message: 'Invalid lat/lon' });
			}
			const radiusMeters = radius ? parseFloat(radius) : TWENTY_FIVE_MILES_METERS;
			const data = await FacilityService.getFacilitiesNear(latNum, lonNum, radiusMeters);
			return { success: true, data };
		}
		const data = await FacilityService.getAllFacilities();
		return { success: true, data };
	});

	app.get('/:id', async function handler(request, reply) {
		const facilityId = request.params.id;
		const data = await FacilityService.getFacilityById(facilityId);
		return {
			success: true,
			data,
		};
	});

	app.put('/:id', async function handler(request, reply) {
		const facilityId = request.params.id;
		const facilityData = request.body as Partial<Facility>;
		const data = await FacilityService.updateFacility(facilityId, facilityData);
		return {
			success: true,
			data,
		};
	});

	app.delete('/:id', async function handler(request, reply) {
		const facilityId = request.params.id;
		await FacilityService.deleteFacility(facilityId);
		return {
			success: true,
		};
	});

	done();
};
