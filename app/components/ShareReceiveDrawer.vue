<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { Form, type FormSubmitEvent } from '@primevue/forms';
import DrawerModal from './utils/DrawerModal.vue';
import InputText from 'primevue/inputtext';
import InputMask from 'primevue/inputmask';
import MultiSelect from 'primevue/multiselect';
import Select from 'primevue/select';
import Button from 'primevue/button';
import type { Facility } from 'core/models/Facility';
import type { FacilityDesignation } from 'core/models/Designation';
import { KNOWN_DESIGNATIONS } from 'core/models/Designation';
import type { FacilityService } from 'core/models/Service';
import { KNOWN_SERVICES, SERVICE_CATEGORIES } from 'core/models/Service';
import { getQrUrl } from 'core/utils/qr.js';
import { useShareStore } from '@/stores/shares.store.js';
import Stepper from 'primevue/stepper';
import StepList from 'primevue/steplist';
import Step from 'primevue/step';
import StepPanels from 'primevue/steppanels';
import StepPanel from 'primevue/steppanel';
import QrScanner from './QrScanner.vue';
import type { ShareComplete, ShareInit } from 'core/models/LocationShare.js';
import request from '@/services/request.js';
import { CryptoUtils } from 'core/utils/crypto.js';
import { useUserStore } from '@/stores/user.store.js';
import { AuthService } from '@/services/authService.js';
import { useToast } from './utils/Toast.vue';
import Message from 'primevue/message';

const drawerModal = ref<InstanceType<typeof DrawerModal> | null>(null);

const emit = defineEmits<{
    save: [facility: Facility];
    delete: [facilityId: string];
}>();

const step = ref(1);

async function open() {
    drawerModal.value?.open();
}

defineExpose({ open });

function getQrSrc(payload: ShareComplete) {
	return getQrUrl(JSON.stringify(payload));
}

function handleDetectedCodes(codes: Array<string>) {
	for (const code of codes) {
		console.log(code)
		try {
			const payload = JSON.parse(code) as ShareInit;
			if (payload.role === 'share_init'
				&& payload.fromDeviceId
				&& payload.fromDeviceId !== AuthService.deviceCredentials!.device_id
				&& payload.fromExchangeKey
			) {
				moveToQrPage(payload);
			}
			else {
				confirmErrorMessage.value = "Couldn't read that... Are you scanning the correct code?";
			}
		} catch {}
	}
}

const isConfirming = ref(false);
const confirmErrorMessage = ref('');
async function moveToQrPage(payload: ShareInit) {
	confirmErrorMessage.value = "";
	isConfirming.value = true;

	try {
		// verify with server
		const { data } = await request.get('/shares/exists', {
			params: {
				device_id: payload.fromDeviceId,
				exchange_public_key: payload.fromExchangeKey,
			}
		});
		if (!data.data) {
			confirmErrorMessage.value = 'Could not verify device.';
			isConfirming.value = false;
			return;
		}
	}
	catch (e) {
		console.warn(e);
		confirmErrorMessage.value = 'Could not verify device.';
		isConfirming.value = false;
		return;
	}

	// extract group key
	try {
		const key = await CryptoUtils.createGroupKey(
			AuthService.deviceCredentials!.device_id,
			CryptoUtils.base64urlToBytes(AuthService.deviceCredentials!.exchange_private_key),
			CryptoUtils.base64urlToBytes(payload.fromExchangeKey)
		);
		groupKey.value = key.groupKey;
		groupFingerprint.value = key.groupFingerprint;
		shareCompletePayload.value = key.request;
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

const groupKey = ref('');
const groupFingerprint = ref('');
const shareCompletePayload = ref<ShareComplete | null>();

</script>

<template>
    <DrawerModal ref="drawerModal" title="New Share" width="28rem">
		
    </DrawerModal>
</template>

<style scoped>
</style>
