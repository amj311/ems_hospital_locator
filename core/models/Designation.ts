export type DesignationDefinition = {
	type: string,
	displayName: string,
	levels: Record<number, { label: string }>,
}

export const KNOWN_DESIGNATIONS: Record<string, DesignationDefinition> = {
	trauma: {
		type: 'trauma',
		displayName: 'Trauma',
		levels: {
			1: { label: 'Level I' },
			2: { label: 'Level II' },
			3: { label: 'Level III' },
			4: { label: 'Level IV' },
		},
	},
	stroke: {
		type: 'stroke',
		displayName: 'Stroke',
		levels: {
			1: { label: 'Comprehensive' },
			2: { label: 'Thrombectomy-Capable' },
			3: { label: 'Primary' },
		},
	},
	nicu: {
		type: 'nicu',
		displayName: 'NICU',
		levels: {
			1: { label: 'Level IV' },
			2: { label: 'Level III' },
			3: { label: 'Level II' },
			4: { label: 'Level I' },
		},
	},
	pediatric_trauma: {
		type: 'pediatric_trauma',
		displayName: 'Pediatric Trauma',
		levels: {
			1: { label: 'Level I' },
			2: { label: 'Level II' },
			3: { label: 'Level III' },
		},
	},
	burn: {
		type: 'burn',
		displayName: 'Verified Burn',
		levels: {},
	},
	stemi: {
		type: 'stemi',
		displayName: 'STEMI Receiving',
		levels: {},
	},
	cardiac_arrest: {
		type: 'cardiac_arrest',
		displayName: 'Cardiac Arrest Receiving',
		levels: {},
	},
	chest_pain: {
		type: 'chest_pain',
		displayName: 'Accredited Chest Pain',
		levels: {},
	},
	pediatric_emergency: {
		type: 'pediatric_emergency',
		displayName: 'Pediatric Emergency Care',
		levels: {},
	},
	comprehensive_cardiac: {
		type: 'comprehensive_cardiac',
		displayName: 'Comprehensive Cardiac',
		levels: {},
	},
	lvad: {
		type: 'lvad',
		displayName: 'LVAD',
		levels: {},
	},
}

export type FacilityDesignation = {
	facility_designation_id?: string,
	type: string,
	level?: number | null,
}
