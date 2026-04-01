<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { Form, type FormSubmitEvent } from '@primevue/forms';
import DrawerModal from './utils/DrawerModal.vue';
import InputText from 'primevue/inputtext';
import InputMask from 'primevue/inputmask';
import MultiSelect from 'primevue/multiselect';
import Select from 'primevue/select';
import Button from 'primevue/button';
import type { Facility } from 'core/models/Facility';
import type { FacilityDesignation } from 'core/models/Designation';
import { KNOWN_DESIGNATIONS } from 'core/models/Designation';
import type { FacilityService } from 'core/models/Service';
import { KNOWN_SERVICES, SERVICE_CATEGORIES } from 'core/models/Service';

const drawerModal = ref<InstanceType<typeof DrawerModal> | null>(null);
const isGeocoding = ref(false);
const isEditing = ref(false);
const formKey = ref(0);
const formInitialValues = ref({ name: '', address_1: '' });
const showLocationPicker = ref(false);
const locationMapEl = ref<HTMLElement | null>(null);
let locationMap: L.Map | null = null;
const originalLocation = ref<{ lat: number; lon: number } | null>(null);

function resetLocation() {
    if (!originalLocation.value) return;
    form.lat = originalLocation.value.lat;
    form.lon = originalLocation.value.lon;
    if (locationMap) {
        const latlng: L.LatLngExpression = [originalLocation.value.lat, originalLocation.value.lon];
        locationMap.panTo(latlng);
    }
}

watch(showLocationPicker, async (show) => {
    if (show) {
        await nextTick();
        if (!locationMapEl.value) return;
        const lat = form.lat || 39.5;
        const lon = form.lon || -98.35;
        const zoom = form.lat ? 17 : 4;
        locationMap = L.map(locationMapEl.value, {
            zoomControl: true,
            attributionControl: false,
            scrollWheelZoom: 'center',
        }).setView([lat, lon], zoom);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 19,
        }).addTo(locationMap);

        let isZooming = false;
        locationMap.on('zoomstart', () => { isZooming = true; });
        locationMap.on('zoomend', () => {
			// zooming can slightly change the center, so move us back when finished
			locationMap!.panTo([form.lat, form.lon], { animate: false });
			isZooming = false;
		});
        locationMap.on('moveend', () => {
            if (isZooming) return;
            const center = locationMap!.getCenter();
            form.lat = parseFloat(center.lat.toFixed(6));
            form.lon = parseFloat(center.lng.toFixed(6));
        });
        locationMap.on('click', (e: L.LeafletMouseEvent) => {
            locationMap!.panTo(e.latlng);
        });
        const ResetControl = L.Control.extend({
            onAdd() {
                const btn = L.DomUtil.create('a', 'leaflet-bar-part') as HTMLAnchorElement;
                btn.title = 'Reset location';
                btn.href = '#';
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
                btn.style.cssText = 'display:flex;align-items:center;justify-content:center;';
                L.DomEvent.on(btn, 'click', (e) => {
                    L.DomEvent.preventDefault(e);
                    L.DomEvent.stopPropagation(e);
                    resetLocation();
                });
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.appendChild(btn);
                return container;
            },
        });
        new ResetControl({ position: 'topleft' }).addTo(locationMap);
    } else {
        locationMap?.remove();
        locationMap = null;
    }
});

const emit = defineEmits<{
    save: [facility: Facility];
}>();

const form = reactive({
    facility_id: undefined as string | undefined,
    name: '',
    phone: '',
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    lat: 0,
    lon: 0,
    designations: [] as FacilityDesignation[],
    services: [] as FacilityService[],
});

const CATEGORY_LABELS: Record<string, string> = {
    emergency_access: 'Emergency Access',
    imaging_diagnostics: 'Imaging & Diagnostics',
    cardiac: 'Cardiac',
    neurology: 'Neurology',
    surgery: 'Surgery',
    critical_care: 'Critical Care',
    specialty_units: 'Specialty Units',
    respiratory_resuscitation: 'Respiratory & Resuscitation',
    toxicology: 'Toxicology',
    rehabilitation: 'Rehabilitation',
};

const serviceOptions = SERVICE_CATEGORIES.map(category => ({
    label: CATEGORY_LABELS[category] ?? category,
    items: Object.values(KNOWN_SERVICES)
        .filter(s => s.categories[0] === category)
        .map(s => ({ label: s.displayName, value: s.type })),
})).filter(group => group.items.length > 0);

const selectedServiceTypes = computed({
    get: () => form.services.map(s => s.type),
    set: (types: string[]) => {
        form.services = types.map(type => ({ type }));
    },
});

const designationOptions = Object.values(KNOWN_DESIGNATIONS).map(d => ({
    label: d.displayName,
    value: d.type,
}));

const selectedDesignationTypes = computed({
    get: () => form.designations.map(d => d.type),
    set: (types: string[]) => {
        form.designations = types.map(type => {
            const existing = form.designations.find(d => d.type === type);
            return existing ?? { type, level: null };
        });
    },
});

function getLevelOptions(type: string) {
    const levels = KNOWN_DESIGNATIONS[type]?.levels ?? {};
    return Object.entries(levels).map(([num, { label }]) => ({ label, value: Number(num) }));
}

function resetForm() {
    form.facility_id = undefined;
    form.name = '';
    form.phone = '';
    form.address_1 = '';
    form.address_2 = '';
    form.city = '';
    form.state = '';
    form.lat = 0;
    form.lon = 0;
    form.designations = [];
    form.services = [];
}

async function open(facility: Partial<Facility>) {
    locationMap?.remove();
    locationMap = null;
    showLocationPicker.value = false;
    resetForm();
    isEditing.value = !!facility.facility_id;
    form.facility_id = facility.facility_id;
    form.name = facility.name ?? '';
    form.phone = facility.phone ?? '';
    form.address_1 = facility.address_1 ?? '';
    form.address_2 = facility.address_2 ?? '';
    form.city = facility.city ?? '';
    form.state = facility.state ?? '';
    form.lat = facility.lat ?? 0;
    form.lon = facility.lon ?? 0;
    originalLocation.value = { lat: form.lat, lon: form.lon };
    form.designations = facility.Designations ? [...facility.Designations] : [];
    form.services = facility.Services ? [...facility.Services] : [];
    if (!isEditing.value && facility.lat != null && facility.lon != null) {
        await reverseGeocode(facility.lat, facility.lon);
    }
    formInitialValues.value = { name: form.name, address_1: form.address_1 };
    formKey.value++;
    drawerModal.value?.open();
}

async function reverseGeocode(lat: number, lng: number) {
    isGeocoding.value = true;
    try {
        const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: { lat, lon: lng, format: 'json', addressdetails: 1 },
            headers: { 'Accept-Language': 'en', 'User-Agent': 'ems-hospital-locator' },
        });
        const addr = data.address ?? {};
        const houseNumber = addr.house_number ?? '';
        const road = addr.road ?? addr.pedestrian ?? addr.footway ?? '';
        form.address_1 = [houseNumber, road].filter(Boolean).join(' ');
        form.city = addr.city ?? addr.town ?? addr.village ?? '';
        form.state = addr.state ?? '';
    } catch {
        // silently fail — user can fill in manually
    } finally {
        isGeocoding.value = false;
    }
}

function resolver({ values }: { values: Record<string, string> }) {
    const errors: Record<string, { message: string }[]> = {};
    if (!values.name) {
        errors.name = [{ message: 'Name is required.' }];
    }
    if (values.address_1) {
        const hasNumber = /\d/.test(values.address_1);
        const hasLetter = /[a-zA-Z]/.test(values.address_1);
        if (!hasNumber || !hasLetter) {
            errors.address_1 = [{ message: 'Address must include a street number and name (e.g. 123 Main St)' }];
        }
    }
    return { errors };
}

function onFormSubmit({ valid, states }: FormSubmitEvent) {
    if (!valid) return;
    emit('save', {
        ...(form.facility_id && { facility_id: form.facility_id }),
        name: states.name.value,
        phone: form.phone || undefined,
        lat: form.lat,
        lon: form.lon,
        address_1: states.address_1.value || undefined,
        address_2: form.address_2 || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        Designations: form.designations.length ? form.designations : undefined,
        Services: form.services.length ? form.services : undefined,
    });
    drawerModal.value?.close();
}

defineExpose({ open });
</script>

<template>
    <DrawerModal ref="drawerModal" :title="isEditing ? 'Edit Facility' : 'New Facility'" width="28rem">
        <Form :key="formKey" v-slot="$form" :initialValues="formInitialValues" :resolver="resolver" @submit="onFormSubmit">
        <div class="flex flex-column gap-3 mb-4">
            <div class="flex flex-column gap-1">
                <label for="facility-name">Name</label>
                <InputText id="facility-name" name="name" placeholder="Facility name" :invalid="$form.name?.invalid" fluid />
                <small v-if="$form.name?.invalid" class="text-red-500">{{ $form.name?.error?.message }}</small>
            </div>
            <div class="flex flex-column gap-1">
                <label for="facility-phone">Phone <small class="text-color-secondary">(optional)</small></label>
                <InputMask id="facility-phone" v-model="form.phone" mask="(999) 999-9999" placeholder="(555) 555-5555" fluid />
            </div>
            <div class="flex flex-column gap-1">
                <label for="facility-address1">Address Line 1</label>
                <InputText id="facility-address1" name="address_1" placeholder="123 Main St" :invalid="$form.address_1?.invalid" fluid />
                <small v-if="$form.address_1?.invalid" class="text-red-500">{{ $form.address_1?.error?.message }}</small>
            </div>
            <div class="flex flex-column gap-1">
                <label for="facility-address2">Address Line 2 <small class="text-color-secondary">(optional)</small></label>
                <InputText id="facility-address2" v-model="form.address_2" placeholder="Suite, Unit, etc." fluid />
            </div>
            <div class="flex gap-2">
                <div class="flex flex-column gap-1 flex-grow-1">
                    <label for="facility-city">City</label>
                    <InputText id="facility-city" v-model="form.city" placeholder="City" :loading="isGeocoding" fluid />
                </div>
                <div class="flex flex-column gap-1" style="width: 7rem">
                    <label for="facility-state">State</label>
                    <InputText id="facility-state" v-model="form.state" placeholder="TX" :maxlength="2" :loading="isGeocoding" fluid />
                </div>
            </div>

            <div class="location-picker">
				<button
                    type="button"
                    class="location-row"
                    :class="{ 'is-open': showLocationPicker }"
                    @click="showLocationPicker = !showLocationPicker"
                >
                    <i class="pi pi-map-marker" style="font-size: 0.75rem" />
                    <span class="text-color-secondary">{{ form.lat.toFixed(5) }}, {{ form.lon.toFixed(5) }}</span>
                    <i class="pi ml-auto" :class="showLocationPicker ? 'pi-angle-up' : 'pi-angle-down'" style="font-size: 0.75rem" />
                </button>
				<div class="location-selector-expand" v-if="showLocationPicker">
				 	<div class="location-map-note">
                        <i class="pi pi-info-circle" style="font-size: 0.7rem" />
                        Position the crosshair over the <strong>ambulance bay</strong>
                    </div>
					<div class="location-map-wrapper">
					
						<div ref="locationMapEl" class="location-map" />
						<div class="location-crosshair" aria-hidden="true">
							<div class="location-crosshair-h" />
							<div class="location-crosshair-v" />
							<div class="location-crosshair-dot" />
						</div>
					</div>
				</div>
            </div>

            <div class="flex flex-column gap-2">
                <label>Designations <small class="text-color-secondary">(optional)</small></label>
                <MultiSelect
                    v-model="selectedDesignationTypes"
                    :options="designationOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Add designations..."
                    :showToggleAll="false"
                    fluid
                />
                <div
                    v-if="form.designations.length"
                    class="flex flex-column gap-2"
                >
                    <div
                        v-for="designation in form.designations"
                        :key="designation.type"
                        class="flex align-items-center justify-content-between gap-2"
                    >
                        <span class="text-sm flex-grow-1">{{ KNOWN_DESIGNATIONS[designation.type]?.displayName }}</span>
                        <Select
                            v-if="getLevelOptions(designation.type).length"
                            v-model="designation.level"
                            :options="getLevelOptions(designation.type)"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Level"
                            size="small"
                            style="width: 11rem"
                        />
                        <Button
                            icon="pi pi-times"
                            size="small"
                            severity="secondary"
                            text
                            rounded
                            @click="selectedDesignationTypes = selectedDesignationTypes.filter(t => t !== designation.type)"
                        />
                    </div>
                </div>
            </div>
            <div class="flex flex-column gap-2">
                <label>Services <small class="text-color-secondary">(optional)</small></label>
                <MultiSelect
                    v-model="selectedServiceTypes"
                    :options="serviceOptions"
                    optionLabel="label"
                    optionValue="value"
                    optionGroupLabel="label"
                    optionGroupChildren="items"
                    placeholder="Add services..."
                    :showToggleAll="false"
                    filter
                    fluid
                />
            </div>
        </div>
        <div class="flex align-items-center justify-content-end gap-2">
            <Button label="Cancel" severity="secondary" text @click="() => drawerModal?.close()" />
            <Button
                :label="isEditing ? 'Save Changes' : 'Add Facility'"
                :icon="isEditing ? 'pi pi-save' : 'pi pi-plus'"
                type="submit"
                :disabled="!$form.name?.value || $form.address_1?.invalid"
            />
        </div>
        </Form>
    </DrawerModal>
</template>

<style scoped>
.location-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    background: none;
    border: 1px solid var(--p-content-border-color);
    border-radius: 6px;
    padding: 0.35rem 0.6rem;
    cursor: pointer;
    font-size: 0.8rem;
    color: inherit;
    transition: background 0.15s;
}
.location-row:hover {
    background: var(--p-content-hover-background);
}
.location-row.is-open {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
}
.location-selector-expand {
    border: 1px solid var(--p-content-border-color);
    border-top: none;
    border-radius: 0 0 6px 6px;
    overflow: hidden;
}
.location-map-wrapper {
    position: relative;
}
.location-map-note {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
    color: var(--p-text-muted-color, #888);
    border-bottom: 1px solid var(--p-content-border-color);
}
.location-map {
    height: 220px;
    width: 100%;
}
.location-crosshair {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1000;
}
.location-crosshair-h,
.location-crosshair-v {
    position: absolute;
    background: rgba(0, 0, 0, 0.45);
}
.location-crosshair-h {
    top: 50%;
    left: calc(50% - 12px);
    right: calc(50% - 12px);
    height: 1.5px;
    transform: translateY(-50%);
}
.location-crosshair-v {
    left: 50%;
    top: calc(50% - 12px);
    bottom: calc(50% - 12px);
    width: 1.5px;
    transform: translateX(-50%);
}
.location-crosshair-dot {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    transform: translate(-50%, -50%);
}
</style>
