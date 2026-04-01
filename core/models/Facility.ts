import type { FacilityDesignation } from './Designation'
import type { FacilityService } from './Service'

export type Facility = {
	facility_id?: string,
	name: string,
	phone?: string,
	lat: number,
	lon: number,
	address_1?: string,
	address_2?: string,
	city?: string,
	state?: string,
	Designations?: FacilityDesignation[],
	Services?: FacilityService[],
}
