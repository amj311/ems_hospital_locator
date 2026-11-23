<script setup lang="ts">
import { onMounted, ref } from 'vue';
import 'leaflet/dist/leaflet.css';
import Button from 'primevue/button';
import { useUserStore } from '@/stores/user.store.js';
import InputText from 'primevue/inputtext';
import Stepper from 'primevue/stepper';
import StepList from 'primevue/steplist';
import StepPanels from 'primevue/steppanels';
import StepPanel from 'primevue/steppanel';
import Step from 'primevue/step';
import { CryptoUtils } from '@core/utils/crypto.js';
import Checkbox from 'primevue/checkbox';
import { useToast } from './utils/Toast.vue';
import { AuthService } from '@/services/authService.js';
import { type ProfileDetails } from '@core/models/LocationShare.js';
import ProfileEditor from './ProfileEditor.vue';

const userStore = useUserStore();

const profile = ref<ProfileDetails>({});
const pin = ref('');
const pinConfirm = ref('');

const mnemonic = ref(CryptoUtils.generateMnemonic());
const savedMnemonic = ref(false);

const view = ref<'default' | 'register'>('default');
const steps = ['profile', 'pin', 'pin-confirm', 'recovery'] as const;
const registerStep = ref<typeof steps[number]>('profile');

async function copyMnemonic() {
	try {
		await navigator.clipboard?.writeText(mnemonic.value);
		useToast().add({
			title: "Copied!",
			severity: 'success'
		})
	}
	catch (e) {
		useToast().add({
			title: "Failed to copy",
			severity: 'error'
		})
	}
}

function regenerateMnemonic() {
	mnemonic.value = CryptoUtils.generateMnemonic();
}

const isLoading = ref(false);

async function registerDevice() {
	try {
		isLoading.value = true;
		console.log("GOING TO REGISTER!!!!!")

		await AuthService.registerDevice(pin.value, mnemonic.value);
		useToast().add({
			title: "Device registered!",
			severity: 'success'
		});
		await useUserStore().setDeviceProfile(profile.value);
		await signinWithPassword();
	}
	catch (e) {
		console.error("Error registering device", JSON.stringify(e));
		throw new Error("Could not register device")
	}
	finally {
		isLoading.value = false;
	}
};

async function signinWithPassword() {
	try {
		isLoading.value = true;
		await AuthService.initSession(pin.value);
	}
	catch (e) {
		console.error("Error registering device", e);
		throw new Error("Could not register device")
	}
	finally {
		isLoading.value = false;
	}
};
</script>

<template>
	<div class="flex flex-column h-full align-items-center gap-3 text-center px-3" style="padding-top: calc(15vh - 5rem)">
		<img src="../assets/logo-orbit.png" alt="beacon Logo" class="mb-2" style="width: 15em" />
		<div v-if="userStore.isLoading" class="flex align-items-center">
			<i class="pi pi-spin pi-spinner mr-2"></i>
			Loading...
		</div>
		
		<template v-if="view === 'default'">
			<!-- Register device -->
			<div v-if="!userStore.deviceId" class="flex flex-column gap-2">
				<h1>Welcome to Beacon!</h1>
				<br/>
				<Button @click="view = 'register'">Setup this device</Button>
				<Button text severity="secondary">Recover device</Button>
			</div>

			<!-- Login -->
			<div v-else-if="!userStore.hasAuth" class="flex flex-column gap-2">
				<div>Enter your PIN to unlock the app</div>
				<InputText v-model="pin" class="text-center" />
				<Button @click="signinWithPassword" label="Unlock" :loading="isLoading"></Button>
				<Button text severity="secondary">Recover device</Button>
			</div>
		</template>

		<div v-if="view === 'register'" class="h-full flex-1 flex-col-center">
			<h2>Setting up device...</h2>

			<div v-if="isLoading" class="flex align-items-center">
				<i class="pi pi-spin pi-spinner mr-2"></i>
				Almost there...
			</div>

			<Stepper v-else :value="registerStep" class="flex-col-center flex-grow-1">
				<StepPanels class="flex-grow-1 flex-column justify-content-end">
					<StepPanel value="profile">
						<div class="flex flex-column gap-2">
							<p class="my-3">Setup your profile:</p>
							<ProfileEditor v-model="profile" />
							<Button label="Next" icon="pi pi-arrow-right" iconPos="right" :disabled="!profile.name" @click="registerStep = 'pin'" />
							<Button text label="Cancel" @click="view = 'default'" />
						</div>
					</StepPanel>
					<StepPanel value="pin">
						<div class="flex flex-column gap-2">
							<p>Enter a new PIN:</p>
							<InputText v-model="pin" class="text-center" type="password" autofocus />
							<Button label="Next" icon="pi pi-arrow-right" iconPos="right" :disabled="!pin" @click="registerStep = 'pin-confirm'" />
							<Button text label="Back" @click="registerStep = 'profile'" />
						</div>
					</StepPanel>
					<StepPanel value="pin-confirm">
						<div class="flex flex-column gap-2">
							<p>Confirm your PIN:</p>
							<InputText v-model="pinConfirm" class="text-center" type="password" autofocus />
							<Button label="Next" icon="pi pi-arrow-right" iconPos="right" :disabled="pinConfirm !== pin" @click="registerStep = 'recovery'" />
							<Button text label="Back" @click="registerStep = 'pin'" />
						</div>
					</StepPanel>
					<StepPanel value="recovery">
						<div class="flex flex-column gap-3 max-w-30rem mx-auto">
							<p>This passphrase will allow you to recover or revoke this device if it is compromised.</p>
							<p><b>Save it somewhere secure now.</b> It will never be shown again.</p>
							<div class="mnemonic-box">
								<div class="grid"><div v-for="word in mnemonic.split(' ')">{{word}}</div></div>
								<div class="flex justify-content-end mt-3">
									<Button size="small" text severity="secondary" icon="pi pi-copy" @click="copyMnemonic" label="Copy"/>
									<Button size="small" text severity="secondary" icon="pi pi-sync" @click="regenerateMnemonic" label="Regenerate"/>
								</div>
							</div>
							<div class="flex align-items-center justify-content-center gap-2">
								<Checkbox binary v-model="savedMnemonic" class="text-center" type="password" inputId="saved" />
								<label for="saved">I have saved my recovery phrase in a secure place</label>
							</div>
							<Button label="Finish setup" icon="pi pi-check" :disabled="!savedMnemonic" @click="registerDevice" />
							<Button text label="Back" @click="registerStep = 'pin-confirm'" />
						</div>
					</StepPanel>
				</StepPanels>

				<StepList>
					<div class="w-full flex-center-all gap-1 my-4">
						<template v-for="step in steps"><Step v-slot="{ active }" asChild :value="step"><div class="stepper" :class="{ active }" /></Step></template>
					</div>
				</StepList>
			</Stepper>
		</div>
	</div>
</template>

<style scoped lang="scss">
.mnemonic-box {
	background: #eeee;
	border: 1px solid #ddd;
	border-radius: 0.5rem;
	padding: 2rem 1rem 1rem 1rem;
	font-family: monospace;

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr;
	}
}

.stepper {
	width: 0.6rem;
	height: 0.5rem;
	border-radius: 0.5rem;
	background-color: var(--p-primary-300);
	transition: 200ms;

	&.active {
		width: 1.5rem;
		background-color: var(--p-primary-500);
	}
}
</style>
