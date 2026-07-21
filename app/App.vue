<script setup lang="ts">
import SwipeAction from './components/utils/SwipeAction.vue';
import { useUserStore } from './stores/user.store';
import { AuthService } from './services/authService';
import Registration from './views/Registration.vue';
import { onBeforeMount, onBeforeUnmount, ref } from 'vue';
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
		<!-- <LoggedIn v-if="!waitingForAuth && userStore.hasAuth && userStore.currentUser" /> -->
		<div v-if="waitingForAuth" class="flex flex-column align-items-center" style="padding-top: calc(33vh - 5rem)">
			<img src="./assets/caduceus-vistaprint.png" alt="Talaria Logo" class="mb-4" style="width: 20em" />
			<div v-if="waitingForAuth || userStore.isLoading" class="flex align-items-center">
				<i class="pi pi-spin pi-spinner mr-2"></i>
				Loading...
			</div>
			<!-- <div v-else-if="userStore.hasAuth && !userStore.currentUser">Talaria is not available at this time.</div>
			<div v-else>
				<Button @click="AuthService.signInWithGoogle()">Sign in with Google</Button>
			</div> -->
		</div>

		<div v-else class="app-container">
			<!-- <header class="app-header">
				<nav class="main-nav">
					<router-link to="/" class="nav-link flex align-items-center gap-2">
						<i class="pi pi-home" />
						Home
					</router-link>
					<router-link to="/month" class="nav-link flex align-items-center gap-2">
						<i class="pi pi-wallet" />
						Budget
					</router-link>
					<router-link to="/accounts" class="nav-link flex align-items-center gap-1">
						<Icon name="bank" />
						Accounts
					</router-link>
					<router-link to="/rules" class="nav-link flex align-items-center gap-1">
						<Icon name="material-symbols::manufacturing" />
						Rules
					</router-link>
				</nav>
			</header> -->
			<main class="app-content">
				<RouterView />
			</main>
		</div>
	</div>

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
