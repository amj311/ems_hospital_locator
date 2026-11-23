import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { MapsProvider } from '@core/utils/directionsUtils';

const defaultSettings = {
	is_tv: false,
	tv_nav: false,
	show_debug: false,
	mapsProvider: 'system' as MapsProvider,
}

export const useSettingsStore = defineStore('Settings', () => {
	const localSettings = ref<typeof defaultSettings>(JSON.parse(localStorage.getItem('localSettings') || JSON.stringify(defaultSettings)));
	watch(() => localSettings.value, () => localStorage.setItem('localSettings', JSON.stringify(localSettings.value)), { deep: true, immediate: true });

	// watch(() => ({
	// 	is_tv: localSettings.value.is_tv,
	// 	tv_nav: localSettings.value.tv_nav,
	// }), () => {
	// 	useScreenStore().setAsTv(localSettings.value.is_tv);
	// 	useScreenStore().setTvNavigation(localSettings.value.is_tv && localSettings.value.tv_nav);
	// });

	return {
		localSettings,
	}
})
