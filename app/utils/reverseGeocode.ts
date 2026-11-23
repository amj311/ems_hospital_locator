import axios from "axios";
import type { Coords } from "@core/utils/geoUtils";

type AddressParts = {
	house_number?: string,
	road?: string,
	pedestrian?: string,
	footway?: string,
	city?: string,
	town?: string,
	village?: string,
	state?: string,
	country?: string,
	country_code?: string,
	county?: string,
	neighbourhood?: string,
	postcode?: string,
	suburb?: string,
	"ISO3166-2-lvl4"?: string,
}

class Address {
	constructor(
		public readonly address: AddressParts,
	) {}

	parts = {
		house_number: () => this.address.house_number,
		road: () => this.address.road,
		pedestrian: () => this.address.pedestrian,
		footway: () => this.address.footway,
		city: () => this.address.city,
		town: () => this.address.town,
		village: () => this.address.village,
		state: () => this.address.state,
		country_code: () => this.address.country_code,
		country: () => this.address.country,
		county: () => this.address.county,
		neighbourhood: () => this.address.neighbourhood,
		postcode: () => this.address.postcode,
		suburb: () => this.address.suburb,
	}

	getPartValue(part: string) {
		return this.parts[part]?.() || '';
	}

	format(template: string) {
		let res = template;
		for (const part in this.parts) {
			if (template.includes(part)) {
				res = res.replaceAll(part, this.getPartValue(part));
			}
		}
		return res;
	}

	toString(...parts: Array<keyof AddressParts>) {
		if (parts.length === 0) return JSON.stringify(this.address);
		return parts.map(p => this.address[p]).filter(Boolean).join(', ');
	}
}

export async function reverseGeocode(coords: Coords): Promise<Address | null> {
    try {
        const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: { lat: coords.latitude, lon: coords.longitude, format: 'json', addressdetails: 1 },
            headers: { 'Accept-Language': 'en', 'User-Agent': 'ems-hospital-locator' },
        });
        return data.address ? new Address(data.address) : null;
    } catch {
       return null;
    }
}