import { ref, watch, computed } from 'vue'
import { defineStore } from 'pinia'

export const useDeviceStore = defineStore('Device', () => {
	const isSkinnyScreen = ref(window.innerWidth < 768);
	function updateScreenSize() {
		isSkinnyScreen.value = window.innerWidth < 768;
	}
	window.addEventListener('resize', updateScreenSize);
	updateScreenSize();


	function isTouchDevice() {
		return (('ontouchstart' in window) ||
			(navigator.maxTouchPoints > 0) ||
			// @ts-ignore
			(navigator.msMaxTouchPoints > 0));
	}
	const isTouch = ref<boolean>(isTouchDevice());
	function detectTouch() {
		if (isTouch.value) return;
		isTouch.value = true;
	}
	window.addEventListener('touchstart', detectTouch);

	watch(isTouch, (newVal) => {
		if (newVal) {
			document.body.classList.add('touch');
		} else {
			document.body.classList.remove('touch');
		}
	}, { immediate: true });

	const isIOS = ref(/iPad|iPhone|iPod/.test(navigator.userAgent));
	const isAndroid = ref(/Android|android/.test(navigator.userAgent));
	const isDesktop = computed(() => !isIOS.value && !isAndroid.value);
	const platform = computed((): 'ios' | 'android' | 'desktop' => {
		if (isIOS.value) return 'ios';
		if (isAndroid.value) return 'android';
		return 'desktop';
	});

	return {
		isSkinnyScreen,
		isTouch,
		isIOS,
		isAndroid,
		isDesktop,
		platform,
	}
})
