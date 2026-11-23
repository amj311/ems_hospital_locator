
<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue';
// import UpsertLocationShareModal from '@/components/UpsertLocationShareModal.vue';
import SettingsDrawerModal from '@/components/SettingsDrawerModal.vue';
import Button from 'primevue/button';
import { useUserStore } from '@/stores/user.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useDeviceStore } from '@/stores/device.store';
import { useShareStore } from '@/stores/shares.store';
import ShareInitDrawer from '@/components/ShareInitDrawer.vue';
import DrawerModal from '@/components/utils/DrawerModal.vue';
import ProfileAvatar from '@/components/ProfileAvatar.vue';
import ProfileEditDrawer from '@/components/ProfileEditDrawer.vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { useMapStore } from '@/stores/map.store';
import { reverseGeocode } from '@/utils/reverseGeocode';
import type { Coords } from '@core/utils/geoUtils';
import Async from '@/components/utils/Async.vue';
import { wait } from '@core/utils/miscUtils';
import type { Geofence, HydratedShare, TimelineNode } from '@core/models/LocationShare';
import { ago } from '@core/utils/timeUtils';
import InputText from 'primevue/inputtext';
import Slider from 'primevue/slider';
import L, { circle } from 'leaflet';
import { useGeofenceStore } from '@/stores/geofences.store';

const editingFence = ref<Partial<Geofence>>({ radius_m: 100 });

function setDraft() {
	const storeFence = useGeofenceStore().editingGeofence;
	editingFence.value = storeFence ? { ...storeFence } : { radius_m: 100 };
	if (storeFence) {
		useMapStore().centerOn(storeFence);
	}
}

setDraft();

watch(() => useGeofenceStore().editingGeofence, setDraft)

let fenceLayer: L.LayerGroup = L.layerGroup();
let fenceCircle = L.circle({ lat: 0, lng: 0 }, { radius: 0, color: 'orange' });
fenceCircle.addTo(fenceLayer);

watch(() => editingFence.value, (fence) => {
	if (fence.latitude && fence.longitude) {
		fenceCircle.setLatLng({ lat: fence.latitude, lng: fence.longitude });
		fenceCircle.setRadius(editingFence.value.radius_m!);
		useMapStore().map!.addLayer(fenceLayer);
	}
	else {
		fenceLayer.remove();
	}
}, { immediate: true, deep: true })

// in/out animation
const isIn = ref(false);
onMounted(async () => {
	await nextTick();
	await wait(100);
	isIn.value = true;

	useMapStore().setHandler({
		onClick(e) {
			editingFence.value.latitude = e.latlng.lat;
			editingFence.value.longitude = e.latlng.lng;
		}
	})

	setDraft();
});

onBeforeRouteLeave(async () => {
	isIn.value = false;
	useMapStore().clearHandler();
	fenceLayer?.remove();
	await wait(300);
})

const canSave = computed(() => (
	editingFence.value.name
	&& editingFence.value.latitude
	&& editingFence.value.longitude
	&& editingFence.value.radius_m
))

</script>


<template>
	<div class="selected-card-wrapper flex-column bg-white border-round-3xl gap-3" :class="{ isIn }">
		<p class="flex-row-center gap-2">
			<i class="pi pi-map-marker" />
			Tap the map to set the center of this geofence.
		</p>
		<InputText fluid class="w-full fluid" v-model="editingFence.name" placeholder="Name" />
		<div class="flex-row-center gap-3">
			Radius:
			<Slider class="flex-grow-1" v-model="editingFence.radius_m" :min="50" :max="500" />
		</div>

		<div class="flex-row-center mt-1">
			<div class="flex-grow-1"></div>
			<Button text severity="secondary" label="Cancel" @click="useGeofenceStore().cancelEdit();" />
			<Button label="Save" :disabled="!canSave" @click="() => { useGeofenceStore().upsertGeofence(editingFence); $router.back() }" />
		</div>
	</div>
</template>

<style lang="scss">

.selected-card-wrapper {
	position: absolute;
	bottom: 1rem;
	left: 1rem;
	right: 1rem;
    padding: 1rem;
    z-index: 1000;
	filter: drop-shadow(0 0.25rem 0.3rem #0005);

	translate: 0 calc(100% + 2rem);
	transition: 300ms;

	&.isIn {
		translate: 0 0;
	}

	.main {
		background-color: #fff;
		border-radius: 50rem;
	}
}

</style>
