import { nextTick, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Coords } from 'core/utils/geoUtils';
import MapView from '@/views/MapView.vue';
import { useRouter } from 'vue-router';

export const useMapStore = defineStore('map', () => {
	const mapRef = ref<InstanceType<typeof MapView>>();
	const selectedShareId = ref(location.pathname.split('/select/')[1] || '');
	const centerCoords = ref<Coords | null>();

	const router = useRouter();
	watch(() => router.currentRoute.value?.params.share_id, (share_id) => {
		selectedShareId.value = share_id as string || '';
	}, { immediate: true });

	return {
		map: mapRef,
		setMapRef(map: InstanceType<typeof MapView>) {
			mapRef.value = map;
		},
		selectedShareId,
		selectShare(id: string | null) {
			router.push(id ? ('/select/' + id) : '/');
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
