<script setup lang="ts">
import { ref } from 'vue';
import 'leaflet/dist/leaflet.css';
import DrawerModal from './utils/DrawerModal.vue';
import Button from 'primevue/button';
import { AuthService } from '@/services/authService.js';
import { useUserStore } from '@/stores/user.store.js';

const userStore = useUserStore();
const drawerModal = ref<InstanceType<typeof DrawerModal> | null>(null);

const emit = defineEmits<{
}>();

async function open() {
    drawerModal.value?.open();
}

async function checkAuth(operation: () => void) {
	if (userStore.hasAuth) {
		return operation();
	}
    open();
}

defineExpose({ open, checkAuth });

const loggingIn = ref(false);

async function logInWithGoogle() {
	try {
		loggingIn.value = true;
		await AuthService.signInWithGoogle();
	}
	catch (e) {
		console.error(e);
	}
	finally {
		loggingIn.value = false;
	}
}
</script>

<template>
    <DrawerModal ref="drawerModal" width="28rem">
		<div class="flex flex-column align-items-center gap-3 text-center">
			<img src="../assets/caduceus-vistaprint.png" alt="Talaria Logo" style="width: 20em" />
			<template v-if="loggingIn" class="flex align-items-center">
				<i class="pi pi-spin pi-spinner mr-2"></i>
				Loading...
			</template>
			<template v-else-if="userStore.hasAuth && !userStore.currentUser">Account creation is not available at this time.</template>
			<template v-else>
				<p>Log in as a first-responder account to access advanced features!</p>
				<Button @click="logInWithGoogle">Sign in with Google</Button>
			</template>
		</div>
	
    </DrawerModal>
</template>

<style scoped>
</style>
