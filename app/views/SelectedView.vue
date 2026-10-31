
<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
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
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { useMapStore } from '@/stores/map.store';
import { reverseGeocode } from '@/components/utils/reverseGeocode';
import type { Coords } from 'core/utils/geoUtils';
import Async from '@/components/utils/Async.vue';
import { wait } from 'core/utils/miscUtils';
import type { HydratedShare, TimelineNode } from 'core/models/LocationShare';

const userStore = useUserStore();
const settingsStore = useSettingsStore();
const deviceStore = useDeviceStore();
const isLoggedIn = computed(() => userStore.hasAuth);

const profileDrawer = ref<InstanceType<typeof ProfileEditDrawer>>();
const shareInitDrawer = ref<InstanceType<typeof ShareInitDrawer>>();
const shareListDrawer = ref<InstanceType<typeof DrawerModal>>();

const route = useRoute();
const shareId = route.params.share_id as string;
const share = computed(() => useShareStore().sharedToDevice.find(s => s.location_share_id === shareId));

watch(() => share.value?.lastPos?.coords, (coords) => {
	if (coords) {
		useMapStore().selectShare(shareId);
		useMapStore().centerOn(coords);
	}
}, { deep: true, immediate: true })

onBeforeRouteLeave(route => {
})

async function getCity(share?: HydratedShare) {
	if (share?.lastPos?.cityString) return share.lastPos.cityString;
	if (!share?.lastPos) return 'Unknown';
	const address = await reverseGeocode(share.lastPos.coords);
	return address?.format('city, state')
}


// in/out animation
const isIn = ref(false);
onMounted(async () => {
	console.log("mounted!!!")
	await nextTick();
	await wait(100);
	isIn.value = true;
});

onBeforeRouteLeave(async (newRoute) => {
	isIn.value = false;
	await wait(300);
})


</script>


<template>
	<div class="selected-card-wrapper flex-row-center bg-white border-round-3xl" :class="{ isIn }">
		<div v-if="!share?.config.profile"></div>
		<template v-else>
			<div
				class="flex-row-center gap-2 justify-content-start w-full"
			>
				<ProfileAvatar :profile="share.config.profile" :size="3" />
				<div class="flex-column align-items-start">
					<div class="text-xl font-medium">{{ share.config.profile.name || share.to_device_id }}</div>
					<div class="text-sm">a few minutes ago</div>
				</div>
				<div class="flex-grow-1" />
				<div>
					<Async :load="() => getCity(share)" errorText="Unknown" />
				</div>
			</div>
		</template>
	</div>
</template>

<style scoped lang="scss">

.selected-card-wrapper {
	position: absolute;
	bottom: 1rem;
	left: 1rem;
	right: 1rem;
    padding: 1rem;
    z-index: 1000;
	filter: drop-shadow(0 0.25rem 0.3rem #0005);

	translate: 0 calc(100% + 2rem);
	transition: 300ms;

	&.isIn {
		translate: 0 0;
	}

	.main {
		background-color: #fff;
		border-radius: 50rem;
	}
}
</style>
