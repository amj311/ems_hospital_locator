<script setup lang="ts">
import { useUserStore } from './stores/user.store';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import PromptModal from './components/utils/PromptModal.vue';
import Snackbar from './components/utils/Toast.vue';
import Message from 'primevue/message';
import { useDeviceStore } from './stores/device.store';
import { time } from '@core/utils/timeUtils.js';
import LoginForm from './components/LoginForm.vue';
import MapView from './views/MapView.vue';
import ShareEditDrawer from './components/ShareEditDrawer.vue';
import { useMapStore } from './stores/map.store.js';

const userStore = useUserStore();
const sessionInterval = setInterval(userStore.loadSessionData, time(1, 'minute').ms);

const waitingForAuth = ref(true);
const waitingForIcons = ref(true);
setTimeout(() => {
	waitingForAuth.value = false;
}, 1000); // wait for 1 second before showing the app

onBeforeUnmount(() => {
	clearInterval(sessionInterval);
});

</script>

<template>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" @load="waitingForIcons = false" />

	<!-- Message styles used for Toast are not bundled unless the component is used somewhere -->
	<Message severity="info" style="display: none;" />

	<div class="app h-full" :class="{ touch: useDeviceStore().isTouch }">
		<div v-if="waitingForAuth || !userStore.hasLoadedSessionData" class="flex flex-column align-items-center" style="padding-top: calc(15vh - 5rem)">
			<img src="./assets/logo-orbit.png" alt="beacon Logo" class="mb-2" style="width: 15em" />
			<div>Loading...</div>
		</div>

		<LoginForm v-else-if="!userStore.hasAuth" />

		<div v-else class="app-container">
			<main class="app-content relative">
				<MapView :ref="mapRef => useMapStore().setMapRef(mapRef as InstanceType<typeof MapView>)" />
				<RouterView v-slot="{ Component }">
					<component :is="Component" />
				</RouterView>
			</main>
		</div>

	</div>

	<ShareEditDrawer ref="shareEditDrawer" />
	<PromptModal />
	<Snackbar />
</template>

<style scoped>

.app-container {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.app-header {
	padding: 1rem;
	background-color: #f5f5f5;
	border-bottom: 1px solid #e0e0e0;
}

.main-nav {
	display: flex;
}

.nav-link {
	padding: 0.5rem 1rem;
	text-decoration: none;
	color: #333;
	font-weight: 500;
}

.nav-link.router-link-active {
	color: #4CAF50;
	border-bottom: 2px solid #4CAF50;
}

.app-content {
	flex: 1;
}
</style>
