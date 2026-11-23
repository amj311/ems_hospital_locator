import type { Facility } from "@core/models/Facility";
import { FacilityDao } from "../data/FacilityDao";

export const FacilityService = {
	async upsertFacility(data: Facility) {
		return await FacilityDao.upsertFacility(data);
	},

	async createFacility(data: Facility) {
		return await FacilityDao.createFacility(data);
	},

	async getAllFacilities() {
		return await FacilityDao.getAllFacilities();
	},

	async getFacilitiesNear(lat: number, lon: number, radiusMeters: number) {
		return await FacilityDao.getFacilitiesNear(lat, lon, radiusMeters);
	},

	async getFacilityById(facilityId: string) {
		return await FacilityDao.getFacilityById(facilityId);
	},

	async updateFacility(facilityId: string, data: Partial<Facility>) {
		return await FacilityDao.updateFacility(facilityId, data);
	},

	async deleteFacility(facilityId: string) {
		await FacilityDao.deleteFacility(facilityId);
	},
};
