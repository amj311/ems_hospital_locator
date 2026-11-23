import type { Facility } from "@core/models/Facility";
import { FacilityService } from "../services/FacilityService";

export default (app, _, done) => {

	app.post('/', async function handler(request, reply) {
		const facilityData = request.body as Facility;
		const data = await FacilityService.upsertFacility(facilityData);
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
