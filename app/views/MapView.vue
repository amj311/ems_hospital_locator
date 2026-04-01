
<script setup lang="ts">
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick } from 'vue';
import AddFacilityModal from '@/components/AddFacilityModal.vue';
import type { Facility } from 'core/models/Facility';
import { KNOWN_DESIGNATIONS } from 'core/models/Designation';
import { KNOWN_SERVICES, SERVICE_CATEGORIES } from 'core/models/Service';
import Tag from 'primevue/tag';
import Select from 'primevue/select';
import MultiSelect from 'primevue/multiselect';
import { distanceInMeters } from 'core/utils/geoUtils';
import request from '@/services/request';

const props = withDefaults(defineProps<{
    followUser?: boolean;
}>(), {
    followUser: true,
});

const OSRM_UPDATE_THRESHOLD_METERS = 200;

const facilities = ref<Facility[]>([]);
const userPosition = ref<{ lat: number; lon: number } | null>(null);
const lastComputedPosition = ref<{ lat: number; lon: number } | null>(null);
const pinDistances = ref<Map<string, number>>(new Map());
const pinTimes = ref<Map<string, number>>(new Map());
const selectedFacility = ref<Facility | null>(null);
const selectedDesignation = ref<string | null>(null);
const selectedService = ref<string[]>([]);

const sortedFacilities = computed(() => {
    return [...facilities.value].sort((a, b) => {
        const ta = pinTimes.value.get(a.facility_id!);
        const tb = pinTimes.value.get(b.facility_id!);
        if (ta !== undefined && tb !== undefined) return ta - tb;
        if (ta !== undefined) return -1;
        if (tb !== undefined) return 1;
        const da = pinDistances.value.get(a.facility_id!) ?? Infinity;
        const db = pinDistances.value.get(b.facility_id!) ?? Infinity;
        return da - db;
    });
});

const availableDesignations = computed(() => {
    const types = new Set<string>();
    for (const f of facilities.value) {
        for (const d of f.Designations ?? []) {
            types.add(d.type);
        }
    }
    return [...types].map(type => ({
        type,
        displayName: KNOWN_DESIGNATIONS[type]?.displayName ?? type,
    }));
});

const availableServices = computed(() => {
    const types = new Set<string>();
    for (const f of facilities.value) {
        for (const s of f.Services ?? []) {
            types.add(s.type);
        }
    }
    return [...types].map(type => ({
        type,
        displayName: KNOWN_SERVICES[type]?.displayName ?? type,
    }));
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

const serviceOptions = computed(() => {
    const available = new Set(availableServices.value.map(s => s.type));
    return SERVICE_CATEGORIES
        .map(category => ({
            label: CATEGORY_LABELS[category] ?? category,
            items: Object.values(KNOWN_SERVICES)
                .filter(s => s.categories[0] === category && available.has(s.type))
                .map(s => ({ label: s.displayName, value: s.type })),
        }))
        .filter(group => group.items.length > 0);
});

const filteredFacilities = computed(() => {
    return sortedFacilities.value.filter(f => {
        const matchesDesignation = !selectedDesignation.value ||
            f.Designations?.some(d => d.type === selectedDesignation.value);
        const matchesService = !selectedService.value.length ||
            f.Services?.some(s => selectedService.value.includes(s.type));
        return matchesDesignation && matchesService;
    });
});

const designationOptions = computed(() =>
    availableDesignations.value.map(d => ({ label: d.displayName, value: d.type }))
);

const cardEls = new Map<string, HTMLElement>();

function setCardEl(id: string, el: any) {
    if (el) cardEls.set(id, el as HTMLElement);
    else cardEls.delete(id);
}

watch(selectedFacility, (facility, prevFacility) => {
    if (prevFacility) {
        const prev = pinMarkers.get(prevFacility.facility_id!);
        prev?.getElement()?.classList.remove('facility-pin--selected');
        prev?.setZIndexOffset(0);
    }
    if (!facility) return;
    const marker = pinMarkers.get(facility.facility_id!);
    marker?.getElement()?.classList.add('facility-pin--selected');
    marker?.setZIndexOffset(1000);
    map?.panTo([facility.lat, facility.lon]);
    nextTick(() => {
        cardEls.get(facility.facility_id!)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
});

function facilityTime(facility: Facility): string | null {
    const seconds = pinTimes.value.get(facility.facility_id!);
    return seconds !== undefined ? formatTime(seconds) : null;
}

function getDirectionsUrl(facility: Facility): string {
    const dest = `${facility.lat},${facility.lon}`;
    const origin = userPosition.value ? `${userPosition.value.lat},${userPosition.value.lon}` : '';
    return `https://www.google.com/maps/dir/${origin}/${dest}`;
}

// Straight-line distances (kept for efficiency/sorting use)
watch([facilities, lastComputedPosition], ([newFacilities, pos]) => {
    if (!pos) return;
    const entries = newFacilities.map((f) => {
        const dist = distanceInMeters(pos.lat, pos.lon, f.lat, f.lon);
        return [f.facility_id!, dist] as [string, number];
    });
    pinDistances.value = new Map(entries);
}, { deep: true });

// Driving times via OSRM table API (one request for closest facilities)
watch([facilities, lastComputedPosition], async ([newFacilities, pos]) => {
    if (!pos || !newFacilities.length) return;

    // Only compute drive times for the 10 closest facilities by straight-line distance
    const closest = [...newFacilities]
        .map(f => ({ f, dist: distanceInMeters(pos.lat, pos.lon, f.lat, f.lon) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 10)
        .map(({ f }) => f);

    const coords = [
        `${pos.lon},${pos.lat}`,
        ...closest.map(f => `${f.lon},${f.lat}`),
    ].join(';');
    try {
        const res = await request.get('/facility/route-table', { params: { coords } });
        const durations: (number | null)[] = res.data.data?.durations?.[0] ?? [];
        const entries = closest
            .map((f, i) => [f.facility_id!, durations[i + 1]] as [string, number | null])
            .filter(([, d]) => d != null) as [string, number][];
        pinTimes.value = new Map(entries);
    } catch {
        // silently ignore OSRM errors
    }
}, { deep: true });

watch(lastComputedPosition, async (pos) => {
    if (!pos) return;
    const res = await request.get('/facility', { params: { lat: pos.lat, lon: pos.lon } });
    facilities.value = res.data.data;
});

const mapEl = ref<HTMLElement | null>(null);
const locationError = ref('');

let map: L.Map | null = null;
let userMarker: L.Marker | null = null;
let pinMarkers = new Map<string, L.Marker>();
let watchId: number | null = null;

const newPin = ref<L.LatLng | null>(null);
let droppedPin: L.Marker | null = null;

const addFacilityModal = ref<InstanceType<typeof AddFacilityModal> | null>(null);

// Fix Leaflet's broken default icon paths when bundled with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

onMounted(() => {
    if (!mapEl.value) return;

    map = L.map(mapEl.value, { zoomControl: false }).setView([39.5, -98.35], 4);
    L.control.zoom({ position: 'topright' }).addTo(map);

    // CartoDB Voyager — road hierarchy with color distinctions, no API key required
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(map);

    renderPins();
    startWatchingUser();

    map.on('click', (e: L.LeafletMouseEvent) => {
        selectedFacility.value = null;
        if (droppedPin) droppedPin.remove();
        newPin.value = e.latlng;
        droppedPin = L.marker(e.latlng).addTo(map!);
    });

    const RecenterControl = L.Control.extend({
        onAdd() {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const btn = L.DomUtil.create('a', 'leaflet-bar-part', container) as HTMLAnchorElement;
            btn.title = 'Center on my location';
            btn.href = '#';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;
            L.DomEvent.on(btn, 'click', (e) => {
                L.DomEvent.preventDefault(e);
                L.DomEvent.stopPropagation(e);
                centerOnUser();
            });
            return container;
        },
    });
    new RecenterControl({ position: 'topright' }).addTo(map);
});

onBeforeUnmount(() => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    map?.remove();
});

watch([facilities, pinDistances, pinTimes, selectedDesignation, selectedService], renderPins, { deep: true });

function renderPins() {
    if (!map) return;
    pinMarkers.forEach(m => m.remove());
    pinMarkers = new Map();

    const filteredIds = new Set(filteredFacilities.value.map(f => f.facility_id!));
    const hasActiveFilter = selectedDesignation.value !== null || selectedService.value.length > 0;

    for (const pin of facilities.value) {
        const timeSeconds = pinTimes.value.get(pin.facility_id!);
        const timeLabel = timeSeconds !== undefined ? formatTime(timeSeconds) : '';
        const isSubdued = hasActiveFilter && !filteredIds.has(pin.facility_id!);
        const icon = L.divIcon({
            className: '',
            html: /* html */`
				<div class="facility-pin${isSubdued ? ' facility-pin--subdued' : ''}">
					<div class="facility-pin-icon">🏥</div>
					<div class="facility-pin-label">
						<div class="w-full text-ellipsis">${pin.name}</div>
						${timeLabel ? `<span class="facility-pin-dist">${timeLabel}</span>` : ''}
					</div>
				</div>`,
            iconSize: [24, 48],
            iconAnchor: [12, 12],
            popupAnchor: [0, -14],
        });
        const marker = L.marker([pin.lat, pin.lon], { icon });
        marker.on('click', () => {
			if (!isSubdued) {
				selectedFacility.value = pin;
				clearNewPin();
			}
        });
        marker.addTo(map);
        pinMarkers.set(pin.facility_id!, marker);
        if (selectedFacility.value?.facility_id === pin.facility_id) {
            nextTick(() => {
                marker.getElement()?.classList.add('facility-pin--selected');
                marker.setZIndexOffset(1000);
            });
        }
    }
}

function formatDistance(meters: number): string {
    const miles = meters / 1609.344;
    if (miles < 0.1) {
        const feet = Math.round(meters * 3.28084);
        return `${feet} ft`;
    }
    return `${miles.toFixed(1)} mi`;
}

function formatTime(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}

function centerOnUser() {
    if (userMarker) {
        map!.setView(userMarker.getLatLng(), map!.getZoom());
    } else if (!navigator.geolocation) {
        locationError.value = 'Geolocation is not supported by this browser.';
    } else {
        navigator.geolocation.getCurrentPosition(
            (pos) => map!.setView([pos.coords.latitude, pos.coords.longitude], map!.getZoom()),
            (err) => { locationError.value = `Location unavailable: ${err.message}`; },
            { enableHighAccuracy: true }
        );
    }
}

function clearNewPin() {
    droppedPin?.remove();
    droppedPin = null;
    newPin.value = null;
}

function createFacility() {
    if (!newPin.value) return;
    addFacilityModal.value?.open(newPin.value.lat, newPin.value.lng);
}

async function onFacilitySaved(facility: Facility) {
    const res = await request.post('/facility', facility);
    facilities.value.push(res.data.data);
    clearNewPin();
}

function designationLabel(d: { type: string; level?: number | null }): string {
    const def = KNOWN_DESIGNATIONS[d.type];
    if (!def) return d.type;
    const levelLabel = d.level != null ? def.levels[d.level]?.label : undefined;
    return levelLabel ? `${def.displayName} ${levelLabel}` : def.displayName;
}

function startWatchingUser() {
    if (!navigator.geolocation) {
        locationError.value = 'Geolocation is not supported by this browser.';
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        (pos) => {
            locationError.value = '';
            const { latitude, longitude } = pos.coords;

            userPosition.value = { lat: latitude, lon: longitude };

            // Only trigger expensive recomputations once the user has moved meaningfully
            const prev = lastComputedPosition.value;
            if (!prev || distanceInMeters(prev.lat, prev.lon, latitude, longitude) >= OSRM_UPDATE_THRESHOLD_METERS) {
                lastComputedPosition.value = { lat: latitude, lon: longitude };
            }

            if (!userMarker) {
                const userIcon = L.divIcon({
                    className: '',
                    html: /* html */`<div class="user-location-marker"><div class="user-location-pulse"></div><div class="user-location-dot"></div></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                });
                userMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(map!);

                if (props.followUser) {
                    map!.setView([latitude, longitude], 13);
                }
            } else {
                userMarker.setLatLng([latitude, longitude]);
            }
        },
        (err) => {
            locationError.value = `Location unavailable: ${err.message}`;
        },
        { enableHighAccuracy: true }
    );
}
</script>


<template>
    <div class="map-wrapper">
        <div ref="mapEl" class="map-container" />
        <div v-if="locationError" class="location-error">{{ locationError }}</div>
        <div v-if="newPin" class="new-facility-bar">
            <span class="new-facility-coords">{{ newPin.lat.toFixed(5) }}, {{ newPin.lng.toFixed(5) }}</span>
            <button class="new-facility-btn" @click="createFacility">+ Create Facility Here</button>
            <button class="new-facility-cancel" @click="clearNewPin" aria-label="Cancel">✕</button>
        </div>
        <Transition name="card-tray">
            <div v-if="!newPin && sortedFacilities.length" class="facility-card-tray p-3 flex flex-column gap-1">
				<div class="flex gap-2">
					<Select
						v-if="availableDesignations.length" 
						v-model="selectedDesignation"
						:options="designationOptions"
						option-label="label"
						option-value="value"
						placeholder="Designation"
						show-clear
						data-testid="designation-filter-select"
					/>
					<MultiSelect
						v-if="availableServices.length"
						v-model="selectedService"
						:options="serviceOptions"
						option-label="label"
						option-value="value"
						option-group-label="label"
						option-group-children="items"
						:show-toggle-all="false"
						placeholder="Services"
						style="max-width: 220px"
						data-testid="service-filter-select"
					/>
				</div>
                <div class="facility-card-scroll flex gap-2">
                    <div
                        v-for="facility in filteredFacilities"
                        :key="facility.facility_id"
                        :ref="(el: any) => setCardEl(facility.facility_id!, el)"
                        class="facility-card-item flex flex-column"
                        :class="{ 'facility-card-item--selected': selectedFacility?.facility_id === facility.facility_id }"
                        @click="selectedFacility = facility"
                    >
                        <div class="facility-card-item-name">{{ facility.name }}</div>
                        <div v-if="facility.Designations?.length" class="facility-card-item-designations">
                            <Tag
                                v-for="d in facility.Designations"
                                :key="d.facility_designation_id ?? d.type"
                                :value="designationLabel(d)"
                                severity="warn"
                            />
                        </div>
                        <div v-if="pinTimes.get(facility.facility_id!)" class="facility-card-item-time">
                            🕐 {{ formatTime(pinTimes.get(facility.facility_id!)!) }}
                        </div>
                        <div class="flex-grow-1"></div>
                        <div class="facility-card-item-actions">
                            <a
                                v-if="facility.phone"
                                :href="'tel:' + facility.phone"
                                class="facility-card-btn facility-card-btn--call"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.68 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.17h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 6.29 6.29l1.13-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                Call
                            </a>
                            <a
                                :href="getDirectionsUrl(facility)"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="facility-card-btn facility-card-btn--directions"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                                Directions
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
    <AddFacilityModal ref="addFacilityModal" @save="onFacilitySaved" />
</template>

<style scoped>
.map-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
}

.map-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
}

.location-error {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    font-size: 0.85rem;
    pointer-events: none;
}

.new-facility-bar {
    position: absolute;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    padding: 0.5rem 0.75rem;
    z-index: 1000;
    white-space: nowrap;
}

.new-facility-coords {
    font-size: 0.8rem;
    color: #555;
}

.new-facility-btn {
    background: #1a73e8;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.4rem 0.9rem;
    font-size: 0.9rem;
    cursor: pointer;
    font-weight: 600;
}

.new-facility-btn:hover {
    background: #1558b0;
}

.new-facility-cancel {
    background: none;
    border: none;
    color: #888;
    font-size: 1rem;
    cursor: pointer;
    padding: 0 0.25rem;
    line-height: 1;
}

.new-facility-cancel:hover {
    color: #333;
}

.facility-card-tray {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    z-index: 1000;
}

.facility-card-tray-header {
    padding: 0.6rem 1rem 0.4rem;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(6px);
    border-top: 1px solid rgba(0, 0, 0, 0.07);
}

.facility-card-scroll {
    overflow-x: auto;
	overflow-y: visible;
    scrollbar-width: none;
    -ms-overflow-style: none;
    scroll-snap-type: x mandatory;
	margin: 0 -1rem;
	padding: .5rem 1rem;
    /* scroll-padding: 1rem; */
}

.facility-card-scroll::-webkit-scrollbar {
    display: none;
}

.facility-card-item {
    flex: 0 0 auto;
    min-width: 160px;
	max-width: 80vw;
    scroll-snap-align: center;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
    padding: 0.75rem 0.875rem;
    cursor: pointer;
    border: 2px solid transparent;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.facility-card-item--selected {
    border-color: #1a73e8;
    box-shadow: 0 4px 18px rgba(26, 115, 232, 0.25);
}

.facility-card-item-name {
    font-size: 0.875rem;
    font-weight: 700;
    color: #1a1a1a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 0.2rem;
}

.facility-card-item-designations {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.3rem;
}



.facility-card-item-time {
    font-size: 0.78rem;
    color: #555;
}

.facility-card-item-actions {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.5rem;
}

.facility-card-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.75rem;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    border: none;
    flex: 1;
    justify-content: center;
}

.facility-card-btn--call {
    background: #e8f5e9;
    color: #2e7d32;
}

.facility-card-btn--call:hover {
    background: #c8e6c9;
}

.facility-card-btn--directions {
    background: #e3f2fd;
    color: #1565c0;
}

.facility-card-btn--directions:hover {
    background: #bbdefb;
}

.card-tray-enter-active,
.card-tray-leave-active {
    transition: transform 0.3s ease, opacity 0.3s ease;
}

.card-tray-enter-from,
.card-tray-leave-to {
    transform: translateY(100%);
    opacity: 0;
}

.card-actions-enter-active,
.card-actions-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.card-actions-enter-from,
.card-actions-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
</style>

<style>
.facility-pin {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}

.facility-pin-icon {
    font-size: 2rem;
    line-height: 1;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
}

.facility-pin-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: #1a1a1a;
    background: rgb(255, 255, 255);
    padding: 1px 4px;
    border-radius: 3px;
    white-space: nowrap;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
}

.facility-pin-dist {
    font-size: 0.65rem;
    font-weight: 400;
    color: #555;
}

.facility-pin--selected .facility-pin-label {
    border: 1px solid #1a73e8;
    font-weight: 800;
    color: #1a73e8;
}

.facility-pin--selected .facility-pin-icon {
    filter: drop-shadow(0 1px 4px rgba(26, 115, 232, 0.6));
}

.facility-pin--subdued .facility-pin-icon {
    opacity: 0.6;
    filter: grayscale(100%);
}

.facility-pin--subdued .facility-pin-label {
    opacity: 0.6;
}

.user-location-marker {
    position: relative;
}

.user-location-dot {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #1a73e8;
    border: 2.5px solid white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
    z-index: 1;
}

.user-location-pulse {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(1);
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #1a73e8;
    opacity: 0.55;
    animation: user-location-pulse 2s ease-out infinite;
}

@keyframes user-location-pulse {
    0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.55; }
    100% { transform: translate(-50%, -50%) scale(4.5); opacity: 0; }
}
</style>
