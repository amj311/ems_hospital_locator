<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import DrawerModal from './utils/DrawerModal.vue';
import Button from 'primevue/button';
import Stepper from 'primevue/stepper';
import StepPanels from 'primevue/steppanels';
import StepPanel from 'primevue/steppanel';
import QrScanner from './QrScanner.vue';
import { ACTIVE_REQUEST_THRESHOLD_MS, type EncryptedLocationPayload, type LocationShareApi, type ProfileDetails, type ShareInit, type ShareRequest, type TimelineNode } from '@core/models/LocationShare.js';
import request from '@/services/request.js';
import { CryptoUtils } from '@core/utils/crypto.js';
import { AuthService } from '@/services/authService.js';
import Message from 'primevue/message';
import { time } from '@core/utils/timeUtils.js';
import InputText from 'primevue/inputtext';
import QrCode from './QrCode.vue';
import { useShareStore } from '@/stores/shares.store.js';
import { useUserStore } from '@/stores/user.store.js';
import ProfileAvatar from './ProfileAvatar.vue';
import { deviceLog, peek, wait } from '@core/utils/miscUtils.js';
import ToggleSwitch from 'primevue/toggleswitch';
import { pullLocation } from '@core/utils/geoUtils.js';

const drawerModal = ref<InstanceType<typeof DrawerModal> | null>(null);

defineExpose({ open });

const mode = ref<'approve' | 'request' | 'complete'>('approve');
const step = ref(1);

async function open() {
	mode.value = 'approve';
	step.value = 1;
    drawerModal.value?.trigger()?.open();
	startPolling();
}


const isConfirming = ref(false);
const confirmErrorMessage = ref('');

const shareFromPayload = ref<ShareInit>();
const shareProfile = ref(true);

// Perhaps useful for a cycling qr in the future
function updateShareInit() {
	const { device_id, exchange_public_key } = (AuthService.deviceCredentials || {});
	shareFromPayload.value = {
		role: 'share_init',
		fromDeviceId: device_id || '',
		expiresAt: Date.now() + ACTIVE_REQUEST_THRESHOLD_MS,
		fromExchangeKey: exchange_public_key || '',
		profile: shareProfile.value ? useUserStore().profile : null,
	};
	deviceLog("SHARE INIT PAYLOAD", shareFromPayload.value)
}
updateShareInit();

// receiving device creates share request
const reciprocateShare = ref(true);
const shareRequest = ref<ShareRequest | null>();

// polling on both ends
const POLL_INTERVAL_MS = time(1, 'second').ms;
const POLL_MAX_MS = ACTIVE_REQUEST_THRESHOLD_MS;
const pollingStart = ref(0);
const pollTimedOut = ref(false);
const pollRequestTimer = ref<ReturnType<typeof setInterval> | null>(null);

function startPolling() {
	endPolling();
	pollTimedOut.value = false;
	pollingStart.value = Date.now();
	pollRequestTimer.value = setInterval(pollRequests, POLL_INTERVAL_MS);
}
async function pollRequests() {
	// just branch here based on mode
	if (mode.value === 'approve') {
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
			const { shareFromApprover } = data.data;
			const approverLocation = peek<{ location: string }>(shareFromApprover.locationUpdates)?.location;
			otherDeviceLocation.value = approverLocation ? CryptoUtils.decryptLocation(CryptoUtils.base64urlToBytes(groupKey.value), JSON.parse(approverLocation)) : undefined;
			doCompleteAndEdit(data.data);
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

onBeforeUnmount(endPolling);

watch(() => drawerModal.value?.trigger()?.show, (show) => {
	if (!show) endPolling();
})

watch(() => shareFromPayload.value, () => {
	if (pollingStart.value || pollTimedOut.value) {
		startPolling();
	}
})


function handleInitCodes(codes: Array<string>) {
	for (const code of codes) {
		try {
			const payload = JSON.parse(code) as ShareInit;
			deviceLog("QR payload", code);
			if (payload.fromDeviceId
				&& payload.fromDeviceId !== AuthService.deviceCredentials!.device_id
				&& payload.fromExchangeKey
				&& new Date(payload.expiresAt).getTime() > Date.now()
			) {
				deviceLog("code accepted")
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
		const wrappedKey = await CryptoUtils.createShareRequest(
			AuthService.deviceCredentials!.device_id,
			CryptoUtils.base64urlToBytes(AuthService.deviceCredentials!.exchange_private_key),
			CryptoUtils.base64urlToBytes(initPayload.fromExchangeKey),
			useUserStore().profile,
			reciprocateShare.value ? await pullLocation() : null,
		);
		const { data } = await request.post('/shares/init-request', {
			...wrappedKey.request,
			from_device_id: initPayload.fromDeviceId,
			acting_device_id: wrappedKey.request.to_device_id,
			reciprocate: reciprocateShare.value,
		});
		if (data.data) {
			shareFromPayload.value = initPayload;
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
		const unwrapped = await CryptoUtils.unwrapShareRequest(
			CryptoUtils.base64urlToBytes(AuthService.deviceCredentials!.exchange_private_key),
			request.share_payload
		);
		shareRequest.value = request;
		groupKey.value = unwrapped.requestPayload.groupKey64;
		groupFingerprint.value = unwrapped.groupFingerprint;
		toProfile.value = unwrapped.requestPayload.toProfile;
		otherDeviceLocation.value = unwrapped.requestPayload.fromLocation || undefined;
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
		const location = await pullLocation();
		const { data } = await request.post(
			'/shares/approve-request/' + AuthService.deviceCredentials?.device_id + '/' + shareRequest.value!.to_device_id,
			location ? CryptoUtils.encryptLocation(
				CryptoUtils.base64urlToBytes(groupKey.value),
				location,
			) : null,
		);
		if (data.success) {
			doCompleteAndEdit(data.data);
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
const otherDeviceLocation = ref<TimelineNode | null>();

async function doCompleteAndEdit({ shareFromApprover, shareFromRequester }) {
	const otherDeviceId = mode.value === 'approve' ? shareRequest.value!.to_device_id : shareRequest.value!.from_device_id;
	const shareFromDevice = mode.value === 'approve' ? shareFromApprover : shareFromRequester;
	const shareToDevice = mode.value === 'approve' ? shareFromRequester : shareFromApprover;
	await useShareStore().saveNewShare(
		{
			deviceId: otherDeviceId,
			config: {
				groupKey: groupKey.value,
				profile: mode.value === 'approve' ? toProfile.value : shareFromPayload.value!.profile,
			},
			sharingTheirs: Boolean(shareToDevice),
			sharingMine: Boolean(shareFromDevice),
			timeline: otherDeviceLocation.value ? [otherDeviceLocation.value] : [],
		},
		shareFromDevice,
		shareToDevice,
	);
	mode.value = 'complete';
	// hold complete screen for a moment before moving to share edit
	setTimeout(async () => {
		drawerModal.value?.trigger()?.close();
		await wait(100);
		useShareStore().beginEditShare(otherDeviceId);
	}, 1000);
}

</script>

<template>
    <DrawerModal ref="drawerModal" title="New Share" width="28rem">
		<Stepper v-if="mode === 'approve'" :value="step">
			<StepPanels>
				<StepPanel :value="1">
					<div class="flex flex-column gap-4">
						<p>Share your location with this QR code:</p>
						<div class="square relative">
							<QrCode :payload="JSON.stringify(shareFromPayload)" :class="{ 'opacity-50': pollTimedOut }">
								<template #center v-if="shareProfile">
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
						<label class="flex-row-center gap-2" for="shareProfile">
							<ToggleSwitch binary v-model="shareProfile" @change="updateShareInit" inputId="shareProfile" />
							<div>Include profile details</div>
						</label>
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
			</StepPanels>
		</Stepper>

		<Stepper v-if="mode === 'request'" :value="step">
			<StepPanels>
				<!-- SCAN SOMEONES QR -->
				<StepPanel :value="1">
					<div class="flex flex-column gap-4">
						<p>Scan a QR code to begin location sharing:</p>
						<QrScanner v-if="step === 1" @detect="handleInitCodes" :loading="isConfirming" />
						<label class="flex-row-center gap-2" for="reciprocateShare">
							<ToggleSwitch binary v-model="reciprocateShare" @change="updateShareInit" inputId="reciprocateShare" />
							<div>Share my location as well</div>
						</label>
						<Message v-if="confirmErrorMessage" severity="warn">{{ confirmErrorMessage }}</Message>
						<Button text label="Back" @click="mode = 'approve'" />
					</div>
				</StepPanel>
				<StepPanel :value="2">
					<div v-if="shareFromPayload && shareRequest" class="flex flex-column gap-4">
						<div class="flex-col-center gap-2">
							<p>Requesting location from</p>
							<div class="flex-row-center gap-2 font-semibold text-2xl">
								<ProfileAvatar :profile="shareFromPayload.profile" :size="1.5" />
								<div>{{ shareFromPayload.profile?.name || "New device" }}</div>
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
