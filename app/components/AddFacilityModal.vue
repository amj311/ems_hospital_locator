<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import axios from 'axios';
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

const emit = defineEmits<{
    save: [facility: Facility];
}>();

const form = reactive({
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

async function open(lat: number, lng: number) {
    form.name = '';
    form.phone = '';
    form.address_1 = '';
    form.address_2 = '';
    form.city = '';
    form.state = '';
    form.lat = lat;
    form.lon = lng;
    form.designations = [];
    form.services = [];
    drawerModal.value?.open();
    await reverseGeocode(lat, lng);
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

function submit() {
    emit('save', {
        name: form.name,
        phone: form.phone || undefined,
        lat: form.lat,
        lon: form.lon,
        address_1: form.address_1 || undefined,
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
    <DrawerModal ref="drawerModal" title="New Facility" width="28rem">
        <div class="flex flex-column gap-3 mb-4">
            <div class="flex flex-column gap-1">
                <label for="facility-name">Name</label>
                <InputText id="facility-name" v-model="form.name" placeholder="Facility name" fluid />
            </div>
            <div class="flex flex-column gap-1">
                <label for="facility-phone">Phone <small class="text-color-secondary">(optional)</small></label>
                <InputMask id="facility-phone" v-model="form.phone" mask="(999) 999-9999" placeholder="(555) 555-5555" fluid />
            </div>
            <div class="flex flex-column gap-1">
                <label for="facility-address1">Address Line 1</label>
                <InputText id="facility-address1" v-model="form.address_1" placeholder="123 Main St" :loading="isGeocoding" fluid />
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

            <small class="text-color-secondary">
                <i class="pi pi-map-marker" style="font-size: 0.75rem" />
                {{ form.lat.toFixed(5) }}, {{ form.lon.toFixed(5) }}
            </small>

            <div class="flex flex-column gap-2">
                <label>Designations <small class="text-color-secondary">(optional)</small></label>
                <MultiSelect
                    v-model="selectedDesignationTypes"
                    :options="designationOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Search designations..."
                    :showToggleAll="false"
                    filter
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
                    placeholder="Search services..."
                    :showToggleAll="false"
                    filter
                    fluid
                />
            </div>
        </div>
        <div class="flex align-items-center justify-content-end gap-2">
            <Button label="Cancel" severity="secondary" text @click="() => drawerModal?.close()" />
            <Button
                label="Add Facility"
                icon="pi pi-plus"
                :disabled="!form.name"
                @click="submit"
            />
        </div>
    </DrawerModal>
</template>
