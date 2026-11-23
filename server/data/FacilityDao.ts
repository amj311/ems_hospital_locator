import type { Facility } from "@core/models/Facility";
import { prisma } from "../../prisma/client";

export const FacilityDao = {
	async upsertFacility(data: Facility) {
		if (data.facility_id) {
			return await this.updateFacility(data.facility_id, data);
		}
		return await this.createFacility(data);
	},

	async createFacility(data: Facility) {
		const { Designations, Services, ...scalarData } = data;
		return await prisma.facility.create({
			data: {
				...scalarData,
				...(Designations?.length && {
					Designations: { createMany: { data: Designations.map(({ type, level }) => ({ type, level: level ?? null })) } },
				}),
				...(Services?.length && {
					Services: { createMany: { data: Services.map(({ type }) => ({ type })) } },
				}),
			},
			include: { Designations: true, Services: true },
		});
	},

	async getAllFacilities() {
		return await prisma.facility.findMany({
			include: { Designations: true, Services: true },
		});
	},

	async getFacilitiesNear(lat: number, lon: number, radiusMeters: number) {
		const METERS_PER_LAT_DEGREE = 111320;
		const latDelta = radiusMeters / METERS_PER_LAT_DEGREE;
		const lonDelta = radiusMeters / (METERS_PER_LAT_DEGREE * Math.cos(lat * Math.PI / 180));
		return await prisma.facility.findMany({
			where: {
				lat: { gte: lat - latDelta, lte: lat + latDelta },
				lon: { gte: lon - lonDelta, lte: lon + lonDelta },
			},
			include: { Designations: true, Services: true },
		});
	},

	async getFacilityById(facilityId: string) {
		return await prisma.facility.findUnique({
			where: {
				facility_id: facilityId,
			},
			include: { Designations: true, Services: true },
		});
	},

	async updateFacility(facilityId: string, data: Partial<Facility>) {
		const { Designations, Services, ...scalarData } = data;
		return await prisma.facility.update({
			where: {
				facility_id: facilityId,
			},
			data: {
				...scalarData,
				...(Designations !== undefined && {
					Designations: {
						deleteMany: { facility_id: facilityId },
						...(Designations.length && {
							createMany: { data: Designations.map(({ type, level }) => ({ type, level: level ?? null })) },
						}),
					},
				}),
				...(Services !== undefined && {
					Services: {
						deleteMany: { facility_id: facilityId },
						...(Services.length && {
							createMany: { data: Services.map(({ type }) => ({ type })) },
						}),
					},
				}),
			},
			include: { Designations: true, Services: true },
		});
	},

	async deleteFacility(facilityId: string) {
		await prisma.facility.delete({
			where: {
				facility_id: facilityId,
			},
		});
	},
};
