
<script setup lang="ts">
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick, createApp } from 'vue';
// import UpsertLocationShareModal from '@/components/UpsertLocationShareModal.vue';
import SettingsDrawerModal from '@/components/SettingsDrawerModal.vue';
import NavTriggerDrawer from '@/components/utils/NavTrigger/NavTriggerDrawer.vue';
import { buildDirectionsUrl } from '@core/utils/directionsUtils';
import { useUserStore } from '@/stores/user.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useDeviceStore } from '@/stores/device.store';
import type { HydratedShare, LocationShareApi, TimelineNode } from '@core/models/LocationShare';
import { useShareStore } from '@/stores/shares.store';
import SharePin from '@/views/SharePin.vue';
import debounce from '@/utils/debounce';
import { time } from '@core/utils/timeUtils';
import { useMapStore } from '@/stores/map.store';
import { useRoute, useRouter } from 'vue-router';

import { Geolocation } from '@capacitor/geolocation';
import { CryptoUtils } from '@core/utils/crypto';
import { Capacitor } from '@capacitor/core';
import { StorageKeys, StorageService } from '@/services/StorageService';
import { distanceInMeters } from '@core/utils/geoUtils';
import request from '@/services/request';
import { reverseGeocode } from '@/utils/reverseGeocode';
import { peek } from '@core/utils/miscUtils';
import { useGeofenceStore } from '@/stores/geofences.store';

const router = useRouter();

const userStore = useUserStore();
const settingsStore = useSettingsStore();
const deviceStore = useDeviceStore();
const isLoggedIn = computed(() => userStore.hasAuth);

const shares = computed(() => useShareStore().sharedToDevice);
const userPosition = ref<{ lat: number; lon: number } | null>(null);
// const lastComputedPosition = ref<{ lat: number; lon: number } | null>(null);

// const selectedShareId = ref<string | null>(null);
// const selectedShare = computed(() => shares.value.find(f => f.deviceId === selectedShareId.value) ?? null);
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

const selectedShareLayer = ref<L.LayerGroup>();

watch(() => useMapStore().selectedShareDeviceId, (newId, prevId) => {
    if (prevId) {
        const prev = pinMarkers.get(prevId);
        prev?.getElement()?.classList.remove('locationshare-pin--selected');
        prev?.setZIndexOffset(0);
		selectedShareLayer.value?.remove();
    }
    if (!newId) return;
    drawSelectedShare(newId);
});

function drawSelectedShare(newId: string) {
	selectedShareLayer.value = L.layerGroup();
	const marker = pinMarkers.get(newId);
    marker?.getElement()?.classList.add('locationshare-pin--selected');
    marker?.setZIndexOffset(1000);
	const share = shares.value.find(s => s.deviceId === newId);
	if (!share) return;

	const nodes = share.timeline?.slice(-10) || [];
	
	const denoised = nodes.reverse().reduce((selected, n) => {
		if (!selected.length) {
			return [n];
		}
		const lastSelected = peek(selected)!;
		const distance = distanceInMeters(n.latitude, n.longitude, lastSelected.latitude, lastSelected.longitude);
		if (distance > Math.max(lastSelected.accuracy || 50, 100)) {
			selected.push(n);
		}
		return selected;
	}, [] as Array<TimelineNode>);
	
		denoised.forEach((n, i) => {
		if (i < denoised.length - 1) {
			const next = denoised[i+1];
			const line = L.polyline([{lat: n.latitude, lng: n.longitude}, { lat: next.latitude, lng: next.longitude }]);
			line.addTo(selectedShareLayer.value!);
		}
	})

	// draw accuracy circle
	const circle = L.circle(
		{ lat: share.lastPos!.latitude, lng: share.lastPos!.longitude },
		{
			stroke: false,
			radius: share.lastPos!.accuracy || 0,
		}
	);
	circle.addTo(selectedShareLayer.value);
	if (mapInstance) selectedShareLayer.value.addTo(mapInstance);
} 

onMounted(() => {
	const router = useRouter();
	const shareDeviceId = router.currentRoute.value.params.share_id as string;
	if (shareDeviceId) {
		drawSelectedShare(shareDeviceId);
	}
})

function getDirectionsUrl(locationshare: LocationShareApi): string {
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

let mapInstance: L.Map;
let map = ref<L.Map>();
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

	mapInstance = L.map(mapEl.value, { zoomControl: false }).setView([startLoc.lat, startLoc.lng], 11);
    // L.control.zoom({ position: 'topright' }).addTo(mapInstance);

    // CartoDB Voyager — road hierarchy with color distinctions, no API key required
    L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png', {
		attribution: '&copy; <a href="https://stadiamaps.com/attribution/" target="_blank">Stadia Maps</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(mapInstance);

	await useShareStore().loadShares();
	await useGeofenceStore().loadGeofences();
	setInterval(useShareStore().loadShares, time(1, 'minute').ms);

	mapInstance.on('click', (e: L.LeafletMouseEvent) => {
        // if (!isAddLocationShareMode.value && !newPin.value) return;
		// useMapStore().selectShare(null);
		// router.push('/');
		useMapStore().stateHandler?.onClick?.call(null, e);
    });

	startWatchingUser();
	map.value = mapInstance;
});

onBeforeUnmount(() => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    mapInstance?.remove();
});

watch(() => [shares, designationFilter.value, serviceFilters.value], renderPins, { deep: true });
watch(() => useMapStore().centerCoords, (coords) => {
	if (coords) {
		mapInstance?.setView({ lat: coords.latitude, lng: coords.longitude })
	}
})

function renderPins() {
    if (!mapInstance) return;
    pinMarkers.forEach(m => m.remove());
    pinApps.forEach(m => m.unmount());
    pinMarkers = new Map();
    pinApps = new Map();

    // const filteredIds = new Set(filteredShares.value.map(f => f.deviceId!));
    const hasActiveFilter = designationFilter.value !== null || serviceFilters.value.length > 0;

    for (const share of useShareStore().sharedToDevice) {
		if (!share.lastPos) { continue; }

		const pinId =  'locationshare-pin' + share.deviceId;

		const isSelected = useMapStore().selectedShareDeviceId === share.deviceId;
        const isSubdued = false;
        // const isSubdued = isAddLocationShareMode.value || (hasActiveFilter && !filteredIds.has(pin.deviceId!));
        const icon = L.divIcon({
			className: '',
            html: /* html */`<div id="${pinId}"></div>`,
        });
        const marker = L.marker([share.lastPos?.latitude, share.lastPos?.longitude], { icon, zIndexOffset: isSubdued ? -100 : 0 });
        marker.on('click', () => {
			if (!isSubdued) {
				useMapStore().selectShare(share.deviceId);
			}
        });

		marker.on('add', function() {
			// 1. Get the container element reference
			const rootElement = document.getElementById(pinId);

			if (!rootElement) return;
			
			// 2. Mount Vue into that container
			const app = createApp(SharePin, { share });
			app.mount(rootElement);
			pinApps.set(share.deviceId, app);
		});

        marker.addTo(mapInstance);
        pinMarkers.set(share.deviceId!, marker);
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
	if (!mapInstance) return;

    if (userMarker) {
        mapInstance.setView(userMarker.getLatLng(), mapInstance.getZoom());
    } else if (!navigator.geolocation) {
        locationError.value = 'Geolocation is not supported by this browser.';
    } else {
        navigator.geolocation.getCurrentPosition(
            (pos) => mapInstance!.setView([pos.coords.latitude, pos.coords.longitude], mapInstance!.getZoom()),
            (err) => { locationError.value = `Location unavailable: ${err.message}`; },
            { enableHighAccuracy: true }
        );
    }
}

async function handleNewLocation(pos: GeolocationPosition) {
	locationError.value = '';
	const { latitude, longitude } = pos.coords;

	userPosition.value = { lat: latitude, lon: longitude };

	if (!useMapStore().selectedShareDeviceId) {
		if (!userMarker) {
			const userIcon = L.divIcon({
				className: '',
				html: /* html */`<div class="user-location-marker"><div class="user-location-pulse"></div><div class="user-location-dot"></div></div>`,
			});
			userMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(mapInstance!);
		} else {
			userMarker.setLatLng([latitude, longitude]);
		}
	}

	void publishNewLocation(pos);
}
const bounceLocationUpdate = debounce(handleNewLocation, time(1, 'minute').ms, { doFirst: true, allowInterval: true });

/**
 * How far to have moved to count as moving
 */
const MOVEMENT_TRIGGER_RADIUS_M = 50;
const MIN_PUBLISH_INTERVAL = time(1, 'minutes').ms;
/** For baseline staying up to date. "As of x minutes ago". May be configurable. */
const REG_PUBLISH_INTERVAL = time(10, 'minutes').ms;

/**
 * Runs every time the device reports a new location. Saves the location locally and determines whether or not to publish.
 * @param newPos
 */
async function publishNewLocation(newPos: GeolocationPosition) {
	let shouldPublish = false;

	const lastPublish = await StorageService.get<GeolocationPosition>(StorageKeys.DEVICE_LAST_PUBLISH);
	// initialize record from storage if not yet
	// after first successful store this will only be true once on service start
	if (!lastPublish) {
		shouldPublish = true;
	}

	if (lastPublish) {
		// detect movement based on threshold parameters
		// consider the very latest record even if it is older
		const distanceFromRecord = distanceInMeters(newPos.coords.latitude, newPos.coords.longitude, lastPublish.coords.latitude, lastPublish.coords.longitude);
		const timeFromRecord = newPos.timestamp - lastPublish.timestamp;
		const moved = distanceFromRecord >= MOVEMENT_TRIGGER_RADIUS_M && timeFromRecord >= MIN_PUBLISH_INTERVAL;
		const shouldDoRegularUpdate = timeFromRecord >= REG_PUBLISH_INTERVAL;
		shouldPublish = moved || shouldDoRegularUpdate;
	}
	
	if (!shouldPublish) {
		return;
	}

	// confirm successful publish before saving this location
	try {
		const payload: TimelineNode = {
			timestamp: newPos.timestamp,
			latitude: newPos.coords.latitude,
			longitude: newPos.coords.longitude,
			speed: newPos.coords.speed,
			accuracy: newPos.coords.accuracy,
			cityString: (await reverseGeocode(newPos.coords))?.format('town, state'),
		}
		for (const share of useShareStore().sharedFromDevice) {
			const encrypted = CryptoUtils.encryptLocation(
				CryptoUtils.base64urlToBytes(share.config.groupKey),
				payload,
			);
			await request.post('/shares/location', {
				acting_device_id: useUserStore().deviceId,
				to_device_id: share.deviceId,
				location: encrypted,
			})
		}
		await StorageService.set(StorageKeys.DEVICE_LAST_PUBLISH, newPos);
	}
	catch (e) {
		console.error(e);
	}
}

async function startWatchingUser() {
	// native version
	if (Capacitor.isNativePlatform()) {
		try {
			// 1. Request and check permissions first
			const permissions = await Geolocation.checkPermissions();
			if (permissions.location !== 'granted') {
				await Geolocation.requestPermissions();
			}

			// 2. Get initial position to center the map
			const position = await Geolocation.getCurrentPosition({
				enableHighAccuracy: true
			});
			
			const { latitude, longitude } = position.coords;
			mapInstance!.setView([latitude, longitude], 13);
			bounceLocationUpdate(position);

			// 3. Start watching position
			// The plugin uses a callback function rather than returning a watchId
			await Geolocation.watchPosition({
				enableHighAccuracy: true
			}, (position, err) => {
				if (err) {
					locationError.value = `Location unavailable: ${err.message}`;
					return;
				}
				if (position) {
					bounceLocationUpdate(position);
				}
			});

		} catch (e: any) {
			locationError.value = `Error: ${e.message}`;
		}
	}
   
	else {
		if (!navigator.geolocation) {
			locationError.value = 'Geolocation is not supported by this browser.';
			return;
		}

		// start map at user location
		navigator.geolocation.getCurrentPosition(
			position => {
				const { latitude, longitude } = position.coords;
				mapInstance!.setView([latitude, longitude], 13);
			},
			(err) => {
				locationError.value = `Location unavailable: ${err.message}`;
			},
			{ enableHighAccuracy: true },
		)

		// periodically update user location
		watchId = navigator.geolocation.watchPosition(
			bounceLocationUpdate,
			(err) => {
				locationError.value = `Location unavailable: ${err.message}`;
			},
			{ enableHighAccuracy: true }
		);
	}
}


defineExpose({
	map,
	centerOnUser,
	addLayer(l: L.LayerGroup) {
		l.addTo(mapInstance);
	}
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
