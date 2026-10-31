<script setup lang="ts">
import SwipeAction from './components/utils/SwipeAction.vue';
import { useUserStore } from './stores/user.store';
import { AuthService } from './services/authService';
import Registration from './views/Registration.vue';
import { onBeforeMount, onBeforeUnmount, onMounted, ref } from 'vue';
import PromptModal from './components/utils/PromptModal.vue';
import Toast from 'primevue/toast';
import Button from 'primevue/button';
import Snackbar from './components/utils/Toast.vue';
import Message from 'primevue/message';
import { useDeviceStore } from './stores/device.store';
import { time } from 'core/utils/timeUtils.js';
import LoginForm from './components/LoginForm.vue';
import { useRouter } from 'vue-router';
import MapView from './views/MapView.vue';
import ShareEditDrawer from './components/ShareEditDrawer.vue';
import { useMapStore } from './stores/map.store.js';

const userStore = useUserStore();
const sessionInterval = setInterval(userStore.loadSessionData, time(1, 'minute').ms);

const waitingForAuth = ref(true);
setTimeout(() => {
	waitingForAuth.value = false;
}, 1000); // wait for 1 second before showing the app

onMounted(async () => {
	await userStore.loadSessionData();
});

onBeforeUnmount(() => {
	clearInterval(sessionInterval);
});

</script>

<template>
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
					<!-- <Transition :duration="30000"> -->
						<component :is="Component" />
					<!-- </Transition> -->
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
