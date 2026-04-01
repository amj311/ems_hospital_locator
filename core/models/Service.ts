export type FacilityService = {
	facility_service_id?: string,
	type: string,
}

export const SERVICE_CATEGORIES = [
	'emergency_access',
	'imaging_diagnostics',
	'cardiac',
	'neurology',
	'surgery',
	'critical_care',
	'specialty_units',
	'respiratory_resuscitation',
	'toxicology',
	'rehabilitation',
] as const

export type ServiceCategory = typeof SERVICE_CATEGORIES[number]

export type ServiceDefinition = {
	type: string,
	displayName: string,
	categories: ServiceCategory[],
}

export const KNOWN_SERVICES: Record<string, ServiceDefinition> = {
	emergency_department: {
		type: 'emergency_department',
		displayName: 'Emergency Department (24/7)',
		categories: ['emergency_access'],
	},
	trauma_bay: {
		type: 'trauma_bay',
		displayName: 'Trauma Bay',
		categories: ['emergency_access'],
	},
	helipad: {
		type: 'helipad',
		displayName: 'Helipad',
		categories: ['emergency_access'],
	},
	ambulance_bay: {
		type: 'ambulance_bay',
		displayName: 'Ambulance Bay',
		categories: ['emergency_access'],
	},
	ct_scanner: {
		type: 'ct_scanner',
		displayName: 'CT Scanner',
		categories: ['imaging_diagnostics'],
	},
	mri: {
		type: 'mri',
		displayName: 'MRI',
		categories: ['imaging_diagnostics'],
	},
	xray: {
		type: 'xray',
		displayName: 'X-Ray',
		categories: ['imaging_diagnostics'],
	},
	ultrasound: {
		type: 'ultrasound',
		displayName: 'Ultrasound / FAST',
		categories: ['imaging_diagnostics'],
	},
	angiography: {
		type: 'angiography',
		displayName: 'Angiography Suite',
		categories: ['imaging_diagnostics'],
	},
	fluoroscopy: {
		type: 'fluoroscopy',
		displayName: 'Fluoroscopy',
		categories: ['imaging_diagnostics'],
	},
	cardiac_cath_lab: {
		type: 'cardiac_cath_lab',
		displayName: 'Cardiac Catheterization Lab',
		categories: ['cardiac'],
	},
	cardiac_surgery: {
		type: 'cardiac_surgery',
		displayName: 'Cardiac Surgery / Open Heart',
		categories: ['cardiac', 'surgery'],
	},
	electrophysiology: {
		type: 'electrophysiology',
		displayName: 'Electrophysiology Lab',
		categories: ['cardiac'],
	},
	echocardiography: {
		type: 'echocardiography',
		displayName: 'Echocardiography',
		categories: ['cardiac', 'imaging_diagnostics'],
	},
	ecmo: {
		type: 'ecmo',
		displayName: 'ECMO',
		categories: ['cardiac', 'respiratory_resuscitation'],
	},
	lvad_implantation: {
		type: 'lvad_implantation',
		displayName: 'LVAD Implantation',
		categories: ['cardiac', 'surgery'],
	},
	neurosurgery: {
		type: 'neurosurgery',
		displayName: 'Neurosurgery',
		categories: ['neurology', 'surgery'],
	},
	interventional_neurology: {
		type: 'interventional_neurology',
		displayName: 'Interventional Neurology (Thrombectomy)',
		categories: ['neurology'],
	},
	tpa_administration: {
		type: 'tpa_administration',
		displayName: 'tPA Administration',
		categories: ['neurology'],
	},
	neuro_icu: {
		type: 'neuro_icu',
		displayName: 'Neuro ICU',
		categories: ['neurology', 'critical_care'],
	},
	general_surgery: {
		type: 'general_surgery',
		displayName: 'General Surgery (24/7)',
		categories: ['surgery'],
	},
	orthopedic_surgery: {
		type: 'orthopedic_surgery',
		displayName: 'Orthopedic Surgery',
		categories: ['surgery'],
	},
	vascular_surgery: {
		type: 'vascular_surgery',
		displayName: 'Vascular Surgery',
		categories: ['surgery'],
	},
	thoracic_surgery: {
		type: 'thoracic_surgery',
		displayName: 'Thoracic Surgery',
		categories: ['surgery'],
	},
	plastic_surgery: {
		type: 'plastic_surgery',
		displayName: 'Plastic / Reconstructive Surgery',
		categories: ['surgery'],
	},
	hand_surgery: {
		type: 'hand_surgery',
		displayName: 'Hand / Reimplantation Surgery',
		categories: ['surgery'],
	},
	ophthalmic_surgery: {
		type: 'ophthalmic_surgery',
		displayName: 'Ophthalmologic Surgery',
		categories: ['surgery'],
	},
	icu_adult: {
		type: 'icu_adult',
		displayName: 'ICU (Adult General)',
		categories: ['critical_care'],
	},
	cardiac_icu: {
		type: 'cardiac_icu',
		displayName: 'Cardiac ICU',
		categories: ['critical_care', 'cardiac'],
	},
	surgical_icu: {
		type: 'surgical_icu',
		displayName: 'Surgical ICU',
		categories: ['critical_care', 'surgery'],
	},
	burn_icu: {
		type: 'burn_icu',
		displayName: 'Burn ICU',
		categories: ['critical_care', 'specialty_units'],
	},
	pediatric_icu: {
		type: 'pediatric_icu',
		displayName: 'Pediatric ICU',
		categories: ['critical_care', 'specialty_units'],
	},
	neonatal_icu: {
		type: 'neonatal_icu',
		displayName: 'Neonatal ICU',
		categories: ['critical_care', 'specialty_units'],
	},
	burn_unit: {
		type: 'burn_unit',
		displayName: 'Burn Unit',
		categories: ['specialty_units'],
	},
	psychiatric_unit: {
		type: 'psychiatric_unit',
		displayName: 'Psychiatric / Behavioral Health Unit',
		categories: ['specialty_units'],
	},
	dialysis: {
		type: 'dialysis',
		displayName: 'Dialysis / Renal Services',
		categories: ['specialty_units'],
	},
	hyperbaric_chamber: {
		type: 'hyperbaric_chamber',
		displayName: 'Hyperbaric Chamber',
		categories: ['specialty_units'],
	},
	labor_delivery: {
		type: 'labor_delivery',
		displayName: 'Labor & Delivery',
		categories: ['specialty_units'],
	},
	high_risk_obstetrics: {
		type: 'high_risk_obstetrics',
		displayName: 'High-Risk Obstetrics / Maternal ICU',
		categories: ['specialty_units', 'critical_care'],
	},
	pediatric_ed: {
		type: 'pediatric_ed',
		displayName: 'Pediatric Emergency Department',
		categories: ['specialty_units', 'emergency_access'],
	},
	mechanical_ventilation: {
		type: 'mechanical_ventilation',
		displayName: 'Mechanical Ventilation',
		categories: ['respiratory_resuscitation'],
	},
	massive_transfusion: {
		type: 'massive_transfusion',
		displayName: 'Massive Transfusion Protocol',
		categories: ['respiratory_resuscitation'],
	},
	blood_bank: {
		type: 'blood_bank',
		displayName: 'Blood Bank (24/7)',
		categories: ['respiratory_resuscitation'],
	},
	toxicology: {
		type: 'toxicology',
		displayName: 'Toxicology Consultation',
		categories: ['toxicology'],
	},
	poison_control: {
		type: 'poison_control',
		displayName: 'Poison Control Resources',
		categories: ['toxicology'],
	},
	physical_therapy: {
		type: 'physical_therapy',
		displayName: 'Physical Therapy',
		categories: ['rehabilitation'],
	},
	occupational_therapy: {
		type: 'occupational_therapy',
		displayName: 'Occupational Therapy',
		categories: ['rehabilitation'],
	},
	speech_therapy: {
		type: 'speech_therapy',
		displayName: 'Speech Therapy',
		categories: ['rehabilitation'],
	},
}
