<script setup lang="ts">
import "webrtc-adapter";
import { onMounted, onBeforeUnmount, reactive, watch, ref, nextTick, computed } from "vue";
import Button from "primevue/button";
import { QrcodeStream, QrcodeDropZone, QrcodeCapture } from 'vue-qrcode-reader'

const { loading: externalLoading, ...props } = defineProps<{
	onDetect: (data: Array<string>) => void,
	loading?: boolean,
}>();

const loading = ref(true);
const cameraOn = ref(false);
const showScanner = ref(true);
const scannerError = ref<Error | null>();

async function tryScanner() {
	// try removing the scanner and bringing it back
	showScanner.value = false;
	scannerError.value = null;
	loading.value = true;
	await nextTick();
	showScanner.value = true;
};

const cameraDenied = computed(() => scannerError.value?.name === 'NotAllowedError');

</script>

<template>
	<div class="qr-scanner relative square bg-black-alpha-10 flex-center-all overflow-hidden border-round-2xl">
		<div id="interactive" class="viewport scanner absolute-full">
			<video />
			<canvas class="drawingBuffer" />
		</div>
		<QrcodeStream
			v-if="showScanner && !cameraDenied"
			class="absolute-full"
			:constraints="{
				facingMode: '',
			}"
			:formats="['qr_code']"
			@detect="codes => onDetect(codes.map(c => c.rawValue))"
			:torch="true"
			@camera-on="() => { loading = false; cameraOn = true; scannerError = null }"
			@camera-off="() => { loading = false; cameraOn = false }"
			@error="e => scannerError = e"
		/>
		

		<div v-if="loading" class="absolute-full flex-center-all">
			<i class="pi pi-spin pi-spinner text-2xl" />
		</div>
		<div v-else-if="!cameraOn || cameraDenied" class="absolute-full flex-col-center-all gap-3">
			<div v-if="cameraDenied" class="text-center">
				Camera has been denied.<br />Please allow camera and try again.
			</div>
			<Button @click="tryScanner" label="Start scanning" />
		</div>
		<div v-else class="frame absolute-full flex-center-all">
			<img src="/app/assets/qr-code.jpg" style="width: 75%; border-radius: 2rem; opacity: 0.2" />
		</div>

		<div v-if="externalLoading" class="absolute-full flex-center-all">
			<i class="pi pi-spin pi-spinner text-6xl text-white font-bold" />
		</div>
		
  	</div>
</template>

<style scoped>
.qr-scanner {
	position: relative;
}
.frame {
	background-color: #0002;
}
</style>
