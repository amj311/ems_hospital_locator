import { nextTick, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Coords } from '@core/utils/geoUtils';
import MapView from '@/views/MapView.vue';
import { useRouter } from 'vue-router';

type MapStateHandler = {
	onClick: (e: L.LeafletMouseEvent) => void,
}

export const useMapStore = defineStore('map', () => {
	const mapRef = ref<InstanceType<typeof MapView>>();
	const selectedShareDeviceId = ref(location.pathname.split('/select/')[1] || '');
	const centerCoords = ref<Coords | null>();

	const focusMode = ref(false);
	const stateHandler = ref<MapStateHandler | null>(null);
	
	const router = useRouter();
	watch(() => router.currentRoute.value?.params.share_id, (share_device_id) => {
		selectedShareDeviceId.value = share_device_id as string || '';
	}, { immediate: true });

	return {
		map: mapRef,		
		setMapRef(map: InstanceType<typeof MapView>) {
			mapRef.value = map;
		},

		stateHandler,
		setHandler(h: MapStateHandler) {
			stateHandler.value = h;
		},
		clearHandler() {
			stateHandler.value = null;
		},

		selectedShareDeviceId,
		selectShare(deviceId: string | null) {
			router.push(deviceId ? ('/select/' + deviceId) : '/');
		},
		centerCoords,
		async centerOn(coords?: Coords) {
			// force change
			centerCoords.value = null;
			await nextTick();
			centerCoords.value = coords || null;
		}
	};
});
