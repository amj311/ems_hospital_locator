<script setup lang="ts">
import { ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import DrawerModal from './utils/DrawerModal.vue';
import Button from 'primevue/button';
import type { Facility } from 'core/models/Facility';
import Stepper from 'primevue/stepper';
import StepPanels from 'primevue/steppanels';
import StepPanel from 'primevue/steppanel';
import QrScanner from './QrScanner.vue';
import { ACTIVE_REQUEST_THRESHOLD_MS, type LocationShare, type ProfileDetails, type ShareInit, type ShareRequest } from 'core/models/LocationShare.js';
import request from '@/services/request.js';
import { CryptoUtils } from 'core/utils/crypto.js';
import { AuthService } from '@/services/authService.js';
import Message from 'primevue/message';
import { time } from 'core/utils/timeUtils.js';
import InputText from 'primevue/inputtext';
import QrCode from './QrCode.vue';
import { useShareStore } from '@/stores/shares.store.js';
import { useUserStore } from '@/stores/user.store.js';
import ProfileAvatar from './ProfileAvatar.vue';
import { wait } from 'core/utils/miscUtils.js';

const drawerModal = ref<InstanceType<typeof DrawerModal> | null>(null);

async function open() {
    drawerModal.value?.trigger()?.open();
	startPolling();
}

defineExpose({ open });
const emit = defineEmits<{
    save: [facility: Facility];
    delete: [facilityId: string];
}>();

const mode = ref<'init' | 'request' | 'complete'>('init');
const step = ref(1);

const isConfirming = ref(false);
const confirmErrorMessage = ref('');

const shareInit = ref<ShareInit>();

// Perhaps useful for a cycling qr in the future
function updateShareInit() {
	const { device_id, exchange_public_key } = (AuthService.deviceCredentials || {});
	shareInit.value = {
		role: 'share_init',
		fromDeviceId: device_id || '',
		expiresAt: Date.now() + ACTIVE_REQUEST_THRESHOLD_MS,
		fromExchangeKey: exchange_public_key || '',
		profile: useUserStore().profile,
	};
}
updateShareInit();

// receiving device creates share request
const reciprocateShare = ref(false);
const shareRequest = ref<ShareRequest | null>();

// polling on both ends
const POLL_INTERVAL_MS = time(1, 'second').ms;
const POLL_MAX_MS = ACTIVE_REQUEST_THRESHOLD_MS;
const pollingStart = ref(0);
const pollTimedOut = ref(false);
const pollRequestTimer = ref<ReturnType<typeof setInterval> | null>(null);

function startPolling() {
	pollTimedOut.value = false;
	pollingStart.value = Date.now();
	pollRequestTimer.value = setInterval(pollRequests, POLL_INTERVAL_MS);
}
async function pollRequests() {
	// just branch here based on mode
	if (mode.value === 'init') {
		const { data } = await request.get('/shares/poll-request/' + AuthService.deviceCredentials?.device_id, { timeout: 1000 });
		if (data.data) {
			endPolling();
			handleFoundRequest(data.data);
		}
	}
	if (mode.value === 'request') {
		const { data } = await request.get('/shares/poll-approval/' + AuthService.deviceCredentials?.device_id +'/' +shareRequest.value!.from_device_id, { timeout: 1000 });
		if (data.data) {
			endPolling();
			doCompleteAndEdit(data.data, shareInit.value!.profile!);
		}
	}

	if (Date.now() > pollingStart.value + POLL_MAX_MS) {
		endPolling(true);
	}
}
function endPolling(timedOut = false) {
	pollingStart.value = 0;
	clearInterval(pollRequestTimer.value!);
	pollTimedOut.value = timedOut;
}

watch(() => drawerModal.value?.trigger()?.show, (show) => {
	if (!show) endPolling();
})


function handleInitCodes(codes: Array<string>) {
	for (const code of codes) {
		try {
			const payload = JSON.parse(code) as ShareInit;
			if (payload.fromDeviceId
				&& payload.fromDeviceId !== AuthService.deviceCredentials!.device_id
				&& payload.fromExchangeKey
				&& new Date(payload.expiresAt).getTime() > Date.now()
			) {
				moveToCreateRequestPage(payload);
			}
			else {
				confirmErrorMessage.value = "Couldn't read that... Are you scanning the correct code?";
			}
		} catch {}
	}
}

async function moveToCreateRequestPage(initPayload: ShareInit) {
	confirmErrorMessage.value = "";
	isConfirming.value = true;

	try {
		const wrappedKey = await CryptoUtils.createGroupKey(
			AuthService.deviceCredentials!.device_id,
			CryptoUtils.base64urlToBytes(AuthService.deviceCredentials!.exchange_private_key),
			CryptoUtils.base64urlToBytes(initPayload.fromExchangeKey),
			useUserStore().profile,
		);
		const { data } = await request.post('/shares/init-request', {
			...wrappedKey.request,
			from_device_id: initPayload.fromDeviceId,
			acting_device_id: wrappedKey.request.to_device_id,
			reciprocate: reciprocateShare.value,
		});
		if (data.data) {
			shareInit.value = initPayload;
			shareRequest.value = data.data;
			groupKey.value = wrappedKey.groupKey;
			groupFingerprint.value = wrappedKey.groupFingerprint;
			startPolling();
		}
	}
	catch (e) {
		console.warn(e);
		confirmErrorMessage.value = 'Could not pair with device.';
		isConfirming.value = false;
		return;
	}

	isConfirming.value = false;
	step.value = 2;
}

// when sharing device has found an active request
async function handleFoundRequest(request: ShareRequest) {
	confirmErrorMessage.value = "";
	codeConfirm.value = '';
	isConfirming.value = true;
	step.value = 2;

	// extract group key
	try {
		const key = await CryptoUtils.unwrapGroupKey(
			CryptoUtils.base64urlToBytes(AuthService.deviceCredentials!.exchange_private_key),
			request.share_payload
		);
		shareRequest.value = request;
		groupKey.value = key.groupKey;
		groupFingerprint.value = key.groupFingerprint;
		toProfile.value = key.toProfile;
	}
	catch (e) {
		console.error(e);
		confirmErrorMessage.value = 'Could not pair with device.';
		isConfirming.value = false;
		return;
	}

	isConfirming.value = false;
}

async function approveShare() {
	confirmErrorMessage.value = "";

	if (codeConfirm.value !== groupFingerprint.value) {
		confirmErrorMessage.value = "Invalid pairing code"
	}

	try {
		const { data } = await request.post('/shares/approve-request/' + AuthService.deviceCredentials?.device_id + '/' + shareRequest.value!.to_device_id);
		if (data.success) {
			doCompleteAndEdit(data.data, toProfile.value!);
		}
	}
	catch (e) {
		console.error(e);
		confirmErrorMessage.value = "Failed to accept sharing"
	}
}

const groupKey = ref('');
const groupFingerprint = ref('');
const codeConfirm = ref('');
const toProfile = ref<ProfileDetails>();

function doCompleteAndEdit(locationShare: LocationShare, newProfile: ProfileDetails) {
	mode.value = 'complete';
	// hold complete screen for a moment before moving to share edit
	setTimeout(async () => {
		await useShareStore().saveNewShare(locationShare, { groupKey: groupKey.value, profile: newProfile });
		drawerModal.value?.trigger()?.close();
		await wait(100);
		useShareStore().beginEditShare(locationShare.location_share_id);
	}, 1000);
}

</script>

<template>
    <DrawerModal ref="drawerModal" title="New Share" width="28rem">
		<Stepper v-if="mode === 'init'" :value="step">
			<StepPanels>
				<StepPanel :value="1">
					<div class="flex flex-column gap-4">
						<p>Share your location with this QR code:</p>
						<div class="square relative">
							<QrCode :payload="JSON.stringify(shareInit)" :class="{ 'opacity-50': pollTimedOut }">
								<template #center>
									<ProfileAvatar :profile="useUserStore().profile" :size="5" />
								</template>
							</QrCode>
							<div class="absolute-full flex-center-all">
								<Message v-if="pollTimedOut" severity="warn">
									<div class="flex-row-center w-full">
										Code expired.
										<div class="flex-grow-1" />
										<Button text size="small" label="Refresh" @click="() => { updateShareInit(); startPolling() }" />
									</div>
								</Message>
							</div>
						</div>

						<Button text icon="pi pi-qrcode" label="Scan a code" @click="() => { endPolling(); mode = 'request' }" />
					</div>
				</StepPanel>
				<StepPanel :value="2">
					<div class="flex flex-column gap-4 max-w-30rem mx-auto" v-if="toProfile">
						<div class="flex-col-center gap-2">
							<p>Sharing location to</p>
							<div class="flex-row-center gap-2 font-semibold text-2xl">
								<ProfileAvatar :profile="toProfile" :size="1.5" />
								<div>{{ toProfile.name }}</div>
							</div>
						</div>
						<p>Enter the pairing code from the other device:</p>
						<InputText v-model="codeConfirm" max="6" class="text-center" />
						<Message v-if="confirmErrorMessage" severity="warn">{{ confirmErrorMessage }}</Message>
						<Button label="Share location" icon="pi pi-check" :disabled="codeConfirm.length < 6" @click="approveShare" />
						<Button text label="Back" @click="step = 1" />
					</div>
				</StepPanel>
				<StepPanel :value="3">
					
				</StepPanel>
			</StepPanels>
		</Stepper>

		<Stepper v-if="mode === 'request'" :value="step">
			<StepPanels>
				<!-- SCAN SOMEONES QR -->
				<StepPanel :value="1">
					<div class="flex flex-column gap-4">
						<p>Scan a QR code to begin location sharing:</p>
						<QrScanner v-if="step === 1" @detect="handleInitCodes" :loading="isConfirming" />
						<Message v-if="confirmErrorMessage" severity="warn">{{ confirmErrorMessage }}</Message>
						<Button text label="Back" @click="mode = 'init'" />
					</div>
				</StepPanel>
				<StepPanel :value="2">
					<div v-if="shareInit && shareRequest" class="flex flex-column gap-4">
						<div class="flex-col-center gap-2">
							<p>Requesting location from</p>
							<div class="flex-row-center gap-2 font-semibold text-2xl">
								<ProfileAvatar :profile="shareInit.profile" :size="1.5" />
								<div>{{ shareInit.profile.name }}</div>
							</div>
						</div>
						<p>Pairing code:</p>
						<div class="code-box">{{ groupFingerprint }}</div>
						<div v-if="pollingStart" class="flex-center-all gap-2">
							<i class="pi pi-spin pi-spinner" />
							<div>Waiting for approval...</div>
						</div>
						<Message v-else-if="pollTimedOut" severity="warn">Share request was not accepted</Message>
						<Button text label="Back" @click="step = 1" />
					</div>
				</StepPanel>
			</StepPanels>
		</Stepper>

		<div v-if="mode === 'complete'">
			<div class="flex flex-col-center gap-4 max-w-30rem mx-auto mt-2 mb-5">
				<img src="/app/assets/share-complete.png" class="w-8rem mx-auto" />
				<h2>Share complete!</h2>
			</div>
		</div>
    </DrawerModal>
</template>

<style scoped>
.code-box {
	background: #eeee;
	border: 1px solid #ddd;
	border-radius: 0.5rem;
	padding: 1rem 1rem 1rem;
	text-align: center;
	font-family: monospace;
	font-weight: bold;
	font-size: larger;
}
</style>
