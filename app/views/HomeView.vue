
<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
// import UpsertLocationShareModal from '@/components/UpsertLocationShareModal.vue';
import SettingsDrawerModal from '@/components/SettingsDrawerModal.vue';
import Button from 'primevue/button';
import { useUserStore } from '@/stores/user.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useDeviceStore } from '@/stores/device.store';
import { useShareStore } from '@/stores/shares.store';
import ShareInitDrawer from '@/components/ShareInitDrawer.vue';
import DrawerModal from '@/components/utils/DrawerModal.vue';
import ProfileAvatar from '@/components/ProfileAvatar.vue';
import ProfileEditDrawer from '@/components/ProfileEditDrawer.vue';
import Icon from '@/components/utils/Icon.vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { wait } from 'core/utils/miscUtils';
import { useMapStore } from '@/stores/map.store';

const userStore = useUserStore();
const settingsStore = useSettingsStore();
const deviceStore = useDeviceStore();
const isLoggedIn = computed(() => userStore.hasAuth);

const profileDrawer = ref<InstanceType<typeof ProfileEditDrawer>>();
const shareInitDrawer = ref<InstanceType<typeof ShareInitDrawer>>();
const shareListDrawer = ref<InstanceType<typeof DrawerModal>>();
const settingsModal = ref<InstanceType<typeof SettingsDrawerModal>>();

// in/out animation
const isIn = ref(false);
onMounted(async () => {
	await nextTick();
	isIn.value = true;
});

onBeforeRouteLeave(async () => {
	isIn.value = false;
	await wait(300);
})

</script>


<template>
	<div class="nav-bar flex-row-center" :class="{ isIn }">
		<div class="main flex-row-center">
			<ProfileAvatar class="cursor-pointer ml-2" :profile="useUserStore().profile" :size="2.5" 
				@click="() => profileDrawer?.open()"
			/>
			<Button
				icon="pi pi-list"
				text
				rounded
				aria-label="Shares"
				size="large"
				@click="shareListDrawer?.trigger()?.open()"
			/>
			<Button icon="pi pi-plus" text
				rounded
				size="large"
				@click="() => shareInitDrawer?.open()"
			>
				<template #icon><Icon name="material-symbols::add_location_alt" /></template>
			</Button>
			<Button
				icon="pi pi-cog"
				text
				rounded
				aria-label="Settings"
				size="large"
				@click="() => settingsModal?.open()"
			/>
		</div>
		
		<div class="flex-grow-1" />
		<Button
			text
			rounded
			aria-label="Settings"
			size="large"
			severity="secondary"
			class="bg-white"
			@click="() => useMapStore().map?.centerOnUser()"
		>
			<template #icon><Icon name="material-symbols::my_location" /></template>
		</Button>


		<!-- LIST -->
		<DrawerModal ref="shareListDrawer" title="Shared locations" width="28rem">
			<div v-if="useShareStore().sharedToDevice.length === 0">No shares</div>

			<Button
				v-for="share of useShareStore().sharedToDevice"
				@click="async () => { shareListDrawer?.trigger()?.close(); await wait(100); useMapStore().selectShare(share.location_share_id) }"
				text
				severity="secondary"
				class="w-full justify-content-start"
			>
				<ProfileAvatar :profile="share.config.profile" :size="2" />
				<div class="flex-column align-items-start">
					<div class="text-xl font-medium">{{ share.config.profile.name || share.to_device_id }}</div>
					<div class="text-sm">a few minutes ago</div>
				</div>
				<div class="flex-grow-1" />
				<div>
					<!-- <Async :load="() => getCity(share.lastPos?.coords)" errorText="Unknown" /> -->
				</div>
			</Button>
		</DrawerModal>
		
		<ProfileEditDrawer ref="profileDrawer" />
		<ShareInitDrawer ref="shareInitDrawer" />
		<SettingsDrawerModal ref="settingsModal" />
	</div>
</template>

<style scoped lang="scss">

.nav-bar {
    position: absolute;
	bottom: -5rem;
	left: 0;
	right: 0;
    padding: 1rem;
    z-index: 1000;
	filter: drop-shadow(0 0.25rem 0.3rem #0005);

	transition: 300ms;

	&.isIn {
		bottom: 0;
	}

	.main {
		background-color: #fff;
		border-radius: 50rem;
	}
}
</style>
