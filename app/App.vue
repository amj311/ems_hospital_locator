<script setup lang="ts">
import SwipeAction from './components/utils/SwipeAction.vue';
import { useUserStore } from './stores/user.store';
import { AuthService } from './services/authService';
import Registration from './views/Registration.vue';
import { onBeforeMount, onBeforeUnmount, ref } from 'vue';
import LoggedIn from './views/LoggedIn.vue';
import PromptModal from './components/utils/PromptModal.vue';
import Toast from 'primevue/toast';
import Button from 'primevue/button';
import Snackbar from './components/utils/Toast.vue';
import Message from 'primevue/message';
import MapView from './views/MapView.vue';
import { useDeviceStore } from './stores/device.store';

const userStore = useUserStore();
const sessionInterval = setInterval(userStore.loadSessionData, 60000);

const waitingForAuth = ref(true);
setTimeout(() => {
	waitingForAuth.value = false;
}, 1000); // wait for 1 second before showing the app

onBeforeUnmount(() => {
	clearInterval(sessionInterval);
});

</script>

<template>
	<!-- Message styles used for Toast are not bundled unless the component is used somewhere -->
	<Message severity="info" style="display: none;" />

	<div class="app h-full" :class="{ touch: useDeviceStore().isTouch }">
		<LoggedIn v-if="!waitingForAuth && userStore.hasAuth && userStore.currentUser" />
		<div v-else class="flex flex-column align-items-center" style="padding-top: calc(33vh - 5rem)">
			<img src="./assets/caduceus-vistaprint.png" alt="Talaria Logo" class="mb-4" style="width: 20em" />
			<div v-if="waitingForAuth || userStore.isLoading" class="flex align-items-center">
				<i class="pi pi-spin pi-spinner mr-2"></i>
				Loading...
			</div>
			<div v-else-if="userStore.hasAuth && !userStore.currentUser">Talaria is not available at this time.</div>
			<div v-else>
				<Button @click="AuthService.signInWithGoogle()">Sign in with Google</Button>
			</div>
		</div>
	</div>

	<PromptModal />
	<Snackbar />
</template>

<style scoped></style>
