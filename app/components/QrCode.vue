<script setup lang="ts">
import "webrtc-adapter";
import { onMounted, onBeforeUnmount, reactive, watch, ref, nextTick, computed } from "vue";
import Button from "primevue/button";
import { QrcodeStream, QrcodeDropZone, QrcodeCapture } from 'vue-qrcode-reader'
import { getQrUrl } from "@core/utils/qr";

const { payload } = defineProps<{
	payload: string,
}>();

const loading = ref(true);

watch(() => payload, () => {
	loading.value = true;
})
</script>

<template>
	<div class="qr-code relative square border-round-xl overflow-hidden">
		<div v-if="loading" class="bg-black-alpha-20">
			<div class="load-splash absolute-full"></div>
			<div class="absolute-full flex-center-all">
				<i class="pi pi-spin pi-spinner text-white text-6xl font-bold" />
			</div>
		</div>
		<div :class="{ 'opacity-0': loading }">
			<img :src="getQrUrl(payload)" class="w-full square" @load="loading = false" />
			<div class="absolute-full flex-center-all">
				<div class="square flex-center-all" style="width: 25%; background: #fff; border-radius: 50%;">
					<slot name="center"><img src="/app/assets/logo-orbit.png" class="p-2" style="width: 100%" /></slot>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.load-splash {
	background-image: url(/app/assets//qr-code.jpg);
	background-position: center;
	background-size: 120%;
	opacity: 50%
}
</style>
