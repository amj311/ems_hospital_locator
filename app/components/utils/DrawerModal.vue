<script lang="ts" setup>
import { defineComponent, ref, watch, onMounted, onUnmounted, computed, onBeforeMount, onBeforeUnmount } from 'vue';
import Dialog from 'primevue/dialog';
import Drawer from 'primevue/drawer';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { defineStore } from 'pinia';
import NavTrigger from './NavTrigger/NavTrigger.vue';
import { wait } from '@core/utils/miscUtils.js';

// Define the component using Options API
const navTriggerRef = ref<InstanceType<typeof NavTrigger> | null>(null);
const isMobile = ref(false);
const showContent = ref(false);
const showModal = ref(false);

const { closeable = true, destroyOnClose } = defineProps<{
	title?: string;
	width?: string;
	closeable?: boolean,
	onClose?: () => void,
	destroyOnClose?: boolean,
	modal?: boolean,
	blockScroll?: boolean,
}>();

/**
 * Checks if the device is mobile based on screen width
 */
function checkMobileScreen() {
	isMobile.value = window.innerWidth < 576;
}

onBeforeMount(() => {
	checkMobileScreen();
	window.addEventListener('resize', checkMobileScreen);
});

onBeforeUnmount(() => {
	window.removeEventListener('resize', checkMobileScreen);
});

defineExpose({
	trigger() { return navTriggerRef.value },
})

// When opening, allow template to hydrate before loading modal
async function doOpen() {
	showContent.value = true;
	await wait(100);
	showModal.value = true;
}
// When closing, have modal close before removing content
async function doClose() {
	showModal.value = false;
	await wait(500);
	if (destroyOnClose) {
		showContent.value = false;
	}
}

</script>

<template>
	<NavTrigger ref="navTriggerRef" triggerKey="prompt-modal" @close="doClose" @open="doOpen">
		<template>
			<!-- <template v-show="show"> -->
				<!-- Dialog for desktop view -->
				<Dialog
					v-if="!isMobile"
					:visible="showModal"
					:modal="modal"
					:blockScroll="blockScroll"
					:style="{ width: width || '30rem' }"
				>
					<slot></slot>
					<template #header v-if="title">
						<h3>{{ title }}</h3>
					</template>
					<template #closebutton>
						<Button text severity="secondary" class="border-circle" icon="pi pi-times" v-if="closeable" @click="() => navTriggerRef?.close()"></Button>
					</template>
					<template v-for="(slotFn, name) in $slots" #[name]="slotProps">
						<slot :name="name" v-bind="slotProps" />
					</template>
				</Dialog>

				<!-- Drawer for mobile view -->
				<Drawer
					v-else
					:visible="showModal"
					position="bottom"
					:style="{ height: 'auto', maxHeight: '100vh' }"
					:modal="modal"
					:blockScroll="blockScroll"
				>
					<slot></slot>
					<template #header v-if="title">
						<h3>{{ title }}</h3>
					</template>
					<template #closebutton>
						<Button text severity="secondary" class="border-circle" icon="pi pi-times" v-if="closeable" @click="() => navTriggerRef?.close()"></Button>
					</template>
					<template v-for="(slotFn, name) in $slots" #[name]="slotProps">
						<slot :name="name" v-bind="slotProps" />
					</template>
				</Drawer>
			<!-- </template> -->
		</template>
	</NavTrigger>
</template>

<style scoped lang="scss">
</style>
