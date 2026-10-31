
<script setup lang="ts">
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick, createApp } from 'vue';
// import UpsertLocationShareModal from '@/components/UpsertLocationShareModal.vue';
import SettingsDrawerModal from '@/components/SettingsDrawerModal.vue';
import NavTriggerDrawer from '@/components/utils/NavTrigger/NavTriggerDrawer.vue';
import { buildDirectionsUrl } from 'core/utils/directionsUtils';
import { useUserStore } from '@/stores/user.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useDeviceStore } from '@/stores/device.store';
import type { LocationShare } from 'core/models/LocationShare';
import { useShareStore } from '@/stores/shares.store';
import SharePin from '@/views/SharePin.vue';
import debounce from '@/utils/debounce';
import { time } from 'core/utils/timeUtils';
import { useMapStore } from '@/stores/map.store';
import { useRouter } from 'vue-router';

const router = useRouter();

const userStore = useUserStore();
const settingsStore = useSettingsStore();
const deviceStore = useDeviceStore();
const isLoggedIn = computed(() => userStore.hasAuth);

const shares = computed(() => useShareStore().sharedToDevice);
const userPosition = ref<{ lat: number; lon: number } | null>(null);
// const lastComputedPosition = ref<{ lat: number; lon: number } | null>(null);

const selectedShareId = ref<string | null>(null);
const selectedShare = computed(() => shares.value.find(f => f.location_share_id === selectedShareId.value) ?? null);
const designationFilter = ref<string | null>(null);
const serviceFilters = ref<string[]>([]);

const sortedShares = computed(() => {
    return [...shares.value].sort((a, b) => {
		return 0;
    });
});

// const cardEls = new Map<string, HTMLElement>();
// const cardScrollEl = ref<HTMLElement | null>(null);

// function setCardEl(id: string, el: any) {
//     if (el) cardEls.set(id, el as HTMLElement);
//     else cardEls.delete(id);
// }

// watch(filteredShares, () => {
//     nextTick(() => {
//         if (cardScrollEl.value && !selectedShare.value) cardScrollEl.value.scrollLeft = 0;
//     });
// });

watch(() => useMapStore().selectedShareId, (newId, prevId) => {
    if (prevId) {
        const prev = pinMarkers.get(prevId);
        prev?.getElement()?.classList.remove('locationshare-pin--selected');
        prev?.setZIndexOffset(0);
    }
    if (!newId) return;
    const marker = pinMarkers.get(newId);
    marker?.getElement()?.classList.add('locationshare-pin--selected');
    marker?.setZIndexOffset(1000);
    // map?.panTo([locationshare.lat, locationshare.lon]);
    // nextTick(() => {
    //     cardEls.get(locationshare.location_share_id!)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    // });
});

function getDirectionsUrl(locationshare: LocationShare): string {
    return buildDirectionsUrl(
        settingsStore.localSettings.mapsProvider,
        userPosition.value,
        { lat: 0, lon: 0 },
        // { lat: locationshare.lat, lon: locationshare.lon },
        deviceStore.platform
    );
}

// watch(lastComputedPosition, async (pos) => {
//     if (!pos) return;
//     const res = await request.get('/locationshare', { params: { lat: pos.lat, lon: pos.lon } });
//     shares = res.data.data;
// });

const mapEl = ref<HTMLElement | null>(null);
const locationError = ref('');

let map: L.Map | null = null;
let userMarker: L.Marker | null = null;
let pinMarkers = new Map<string, L.Marker>();
let pinApps = new Map<string, ReturnType<typeof createApp>>();
let watchId: number | null = null;

const newPin = ref<L.LatLng | null>(null);
const isAddLocationShareMode = ref(false);
let droppedPin: L.Marker | null = null;

// const upsertLocationShareModal = ref<InstanceType<typeof UpsertLocationShareModal> | null>(null);
const detailDrawer = ref<InstanceType<typeof NavTriggerDrawer> | null>(null);
const settingsModal = ref<InstanceType<typeof SettingsDrawerModal> | null>(null);

function openLocationShareDetail(locationshare: LocationShare) {
    selectedShareId.value = locationshare.location_share_id!;
    detailDrawer.value?.trigger()?.open();
}

// Fix Leaflet's broken default icon paths when bundled with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

const defaultCities = [
	{ // Paris
		"lat": 48.85113008823867,
		"lng": 2.3493763804435734
	},
	{ // london
		"lat": 51.499463021823225,
		"lng": -0.13044588267803195
	},
	{ // seattle
		"lat": 47.60269643906755,
		"lng": -122.33474012464286
	},
	{ // pheonix
		"lat": 33.46502912845904,
		"lng": -112.07736968994142
	}
]

onMounted(async () => {
    if (!mapEl.value) return;

	const defaultLocationIdx = Math.floor(Math.random() * defaultCities.length);
	const startLoc = defaultCities[defaultLocationIdx] || { let: 0, lng: 0 };

    map = L.map(mapEl.value, { zoomControl: false }).setView([startLoc.lat, startLoc.lng], 11);
    // L.control.zoom({ position: 'topright' }).addTo(map);

    // CartoDB Voyager — road hierarchy with color distinctions, no API key required
    L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png', {
		attribution: '&copy; <a href="https://stadiamaps.com/attribution/" target="_blank">Stadia Maps</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(map);

	await useShareStore().loadShares();

	map.on('click', (e: L.LeafletMouseEvent) => {
        // if (!isAddLocationShareMode.value && !newPin.value) return;
		useMapStore().selectShare(null);
		router.push('/');
    });

	startWatchingUser();
});

onBeforeUnmount(() => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    map?.remove();
});

watch(() => [shares, designationFilter.value, serviceFilters.value], renderPins, { deep: true });
watch(() => useMapStore().centerCoords, (coords) => {
	if (coords) {
		map?.setView(coords)
	}
})

function renderPins() {
    if (!map) return;
    pinMarkers.forEach(m => m.remove());
    pinApps.forEach(m => m.unmount());
    pinMarkers = new Map();
    pinApps = new Map();

    // const filteredIds = new Set(filteredShares.value.map(f => f.location_share_id!));
    const hasActiveFilter = designationFilter.value !== null || serviceFilters.value.length > 0;

    for (const share of useShareStore().sharedToDevice) {
		if (!share.lastPos) { continue; }

		const pinId =  'locationshare-pin' + share.location_share_id;

		const isSelected = selectedShare.value?.location_share_id === share.location_share_id;
        const isSubdued = false;
        // const isSubdued = isAddLocationShareMode.value || (hasActiveFilter && !filteredIds.has(pin.location_share_id!));
        const icon = L.divIcon({
			className: '',
            html: /* html */`<div id="${pinId}"></div>`,
        });
        const marker = L.marker([share.lastPos?.coords.lat, share.lastPos?.coords.lng], { icon, zIndexOffset: isSubdued ? -100 : 0 });
        marker.on('click', () => {
			if (!isSubdued) {
				useMapStore().selectShare(share.location_share_id);
			}
        });

		marker.on('add', function() {
			// 1. Get the container element reference
			const rootElement = document.getElementById(pinId);

			if (!rootElement) return;
			
			// 2. Mount Vue into that container
			const app = createApp(SharePin, { share });
			app.mount(rootElement);
			pinApps.set(share.location_share_id, app);
		});

        marker.addTo(map);
        pinMarkers.set(share.location_share_id!, marker);
        if (isSelected) {
            nextTick(() => {
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

function handleLocationUpdate(pos: GeolocationPosition) {
	console.log(pos);
	locationError.value = '';
	const { latitude, longitude } = pos.coords;

	userPosition.value = { lat: latitude, lon: longitude };

	if (!userMarker) {
		const userIcon = L.divIcon({
			className: '',
			html: /* html */`<div class="user-location-marker"><div class="user-location-pulse"></div><div class="user-location-dot"></div></div>`,
		});
		userMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(map!);
	} else {
		userMarker.setLatLng([latitude, longitude]);
	}
}
const bounceLocationUpdate = debounce(handleLocationUpdate, time(1, 'minute').ms, { doFirst: true, allowInterval: true });

function startWatchingUser() {
    if (!navigator.geolocation) {
        locationError.value = 'Geolocation is not supported by this browser.';
        return;
    }

	// start map at user location
	navigator.geolocation.getCurrentPosition(position => {
		console.log(position);
		const { latitude, longitude } = position.coords;
		map!.setView([latitude, longitude], 13);
	})

	// periodically update user location
    watchId = navigator.geolocation.watchPosition(
        bounceLocationUpdate,
        (err) => {
            locationError.value = `Location unavailable: ${err.message}`;
        },
        { enableHighAccuracy: true }
    );
}

defineExpose({
	map,
	centerOnUser,
})

</script>


<template>
    <div class="map-wrapper">
        <div ref="mapEl" class="map-container" />
        <div v-if="locationError" class="location-error">{{ locationError }}</div>
    </div>
</template>

<style>
.leaflet-control-attribution {
	position: fixed;
	top: 0;
	right: 0;
}

.share-pin-wrapper {
	filter: drop-shadow(0 0.05rem 0.1rem #0005);
}
</style>

<style scoped lang="scss">
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

.nav-bar {
    position: absolute;
    bottom: 1rem;
    left: 1rem;
	right: 1rem;
    z-index: 1000;
	filter: drop-shadow(0 0.25rem 0.3rem #0005);

	.main {
		background-color: #fff;
		border-radius: 50rem;
	}
}

.locationshare-pin {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
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
	width: 80vw;
    max-width: 25rem;
    scroll-snap-align: center;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.18);
    padding: 0.75rem 0.875rem;
    cursor: pointer;
    border: 2px solid transparent;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
// body.touch .facility-card-item {
// 	width: 80vw;
// }

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
	--p-tag-font-size: .7rem;
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

.facility-card-btn--details {
    background: #f3e5f5;
    color: #6a1b9a;
}

.facility-card-btn--details:hover {
    background: #e1bee7;
}

.facility-detail {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 0.25rem 0;
}

.facility-detail-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.facility-detail-section-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #888;
}

.facility-detail-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
}

.facility-detail-text {
    font-size: 0.9rem;
    color: #222;
    line-height: 1.5;
}

.facility-detail-phone {
    font-size: 0.9rem;
    color: #1a73e8;
    text-decoration: none;
}

.facility-detail-phone:hover {
    text-decoration: underline;
}

.facility-detail-services {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    color: #333;
    line-height: 1.7;
}

.facility-detail-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
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
