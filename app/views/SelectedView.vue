
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
import { reverseGeocode } from '@/utils/reverseGeocode';
import type { Coords } from '@core/utils/geoUtils';
import Async from '@/components/utils/Async.vue';
import { wait } from '@core/utils/miscUtils';
import type { Geofence, HydratedShare, TimelineNode } from '@core/models/LocationShare';
import { ago } from '@core/utils/timeUtils';
import { useGeofenceStore } from '@/stores/geofences.store';

const userStore = useUserStore();
const settingsStore = useSettingsStore();
const deviceStore = useDeviceStore();
const isLoggedIn = computed(() => userStore.hasAuth);

const profileDrawer = ref<InstanceType<typeof ProfileEditDrawer>>();
const shareInitDrawer = ref<InstanceType<typeof ShareInitDrawer>>();
const shareListDrawer = ref<InstanceType<typeof DrawerModal>>();

const route = useRoute();
const router = useRouter();
const shareDeviceId = route.params.share_id as string;
const share = computed(() => useShareStore().sharedToDevice.find(s => s.deviceId === shareDeviceId));

watch(() => share.value?.lastPos, (coords) => {
	if (coords) {
		useMapStore().selectShare(shareDeviceId);
		useMapStore().centerOn(coords);
	}
}, { deep: true, immediate: true })

async function getCity(share?: HydratedShare) {
	if (share?.lastPos?.cityString) return share.lastPos.cityString;
	if (!share?.lastPos) return 'Unknown';
	const address = await reverseGeocode(share.lastPos);
	return address?.format('town, state');
}

const deviceAlerts = ref([] as any);
function loadDeviceAlerts() {
	if (share.value?.deviceId) {
		deviceAlerts.value = useGeofenceStore().getDeviceAlerts(share.value.deviceId);
	}
}

// in/out animation
const isIn = ref(false);
onMounted(async () => {
	await nextTick();
	await wait(100);
	isIn.value = true;

	useMapStore().setHandler({
		onClick() {
			useMapStore().selectShare(null);
			router.push('/');
		}
	})
	loadDeviceAlerts();
});

onBeforeRouteLeave(async (newRoute) => {
	isIn.value = false;
	await wait(300);

	useMapStore().clearHandler();
})


const expanded = ref(false);

const addAlertDrawer = ref<InstanceType<typeof DrawerModal>>();
const editFenceDrawer = ref<InstanceType<typeof DrawerModal>>();

function startAddAlert() {
	if (Object.keys(useGeofenceStore().geofences).length === 0) {
		router.push('fence')
	}
	else {
		addAlertDrawer.value?.trigger()?.open();
	}
}

async function doAddAlert(fence: Geofence) {
	await useGeofenceStore().toggleDeviceAlert(share.value!.deviceId, fence.geofence_id);
	loadDeviceAlerts();
	addAlertDrawer.value?.trigger()?.close();
}

async function removeAlert(geofence_id: string) {
	await useGeofenceStore().toggleDeviceAlert(share.value!.deviceId, geofence_id);
	loadDeviceAlerts();
}

function newFence() {
	console.log("pushed")
	router.push('/fence');
}

</script>


<template>
	<div class="selected-card-wrapper bg-white" :class="{ isIn, expanded }" v-if="share">
		<!-- top -->
		<div
			class="flex-row-center gap-2 w-full"
			@click="expanded = true"
		>
			<ProfileAvatar :profile="share.config.profile" :size="3.3" />
			<div class="flex-column align-items-start flex-grow-1">
				<div class="flex-row-center w-full">
					<div class="text-xl font-medium">{{ share.config.profile?.name || "Device: " + share.deviceId.split("-")[0] }}</div>
					<div class="flex-grow-1" />
					<Button icon="pi pi-pencil" text severity="secondary" @click.stop="() => useShareStore().beginEditShare(share?.deviceId)" />
					<Button v-if="!expanded" icon="pi pi-chevron-up" text severity="secondary" @click="expanded = true" />
					<Button v-else icon="pi pi-chevron-down" text severity="secondary" @click.stop="expanded = false" />
				</div>
				<div class="flex-row-center text-sm gap-2" v-if="share.lastPos">
					<Async :load="() => getCity(share)" errorText="Unknown" />
					{{ ago(share.lastPos.timestamp) }}
				</div>
			</div>
		</div>

		<!-- body -->
		<div class="collapse-body flex-column gap-4">
			
			<div class="flex-column gap-2">
				<h3 class="flex-row-center gap-2">
					<i class="pi pi-map" />
					Timeline
				</h3>

				<div v-for="node of share.timeline.slice().reverse().slice(0,5)" class="flex justify-content-between">
					<Async :load="() => getCity(share)" errorText="Unknown" />
					<span>{{ ago(node.timestamp) }}</span>
				</div>
				<div v-if="share.timeline.length === 0">
					No location history for this device
				</div>
			</div>


			<div class="flex-column gap-2">
				<h3 class="flex-row-center gap-2">
					<i class="pi pi-bell" />
					Alerts
				</h3>

				<div>
					<div v-for="alert of deviceAlerts" class="flex-row-center">
						{{  useGeofenceStore().geofences[alert.geofenceId].name }}
						<span v-if="alert.isEveryone" class="text-400">&nbsp;&nbsp;All devices</span>
						<div class="flex-grow-1" />
						<Button text severity="secondary" icon="pi pi-times" size="small" @click="removeAlert(alert.geofenceId)" v-if="!alert.isEveryone" />
					</div>
				</div>
				<div v-if="deviceAlerts.length === 0">
					No location alerts for this device
				</div>
				<Button label="Add alert" icon="pi pi-plus" size="small" severity="secondary" @click="startAddAlert" />
			</div>
		</div>
	</div>

	<DrawerModal ref="addAlertDrawer">
		<p>Select a fence to get notified when this device enters or exits the area:</p>
		<div class="flex-column mt-2">
			<Button v-for="fence in Array.from(Object.values(useGeofenceStore().geofences)).filter(fence => !deviceAlerts.some(a => a.geofenceId === fence.geofence_id))" text severity="secondary" class="flex-row-center justify-content-between p-0 pl-2" @click="doAddAlert(fence)">
				{{  fence.name }}
				<!-- <Button text severity="secondary" icon="pi pi-pencil" @click="editFence" /> -->
			</Button>
		</div>
		<Button label="Add geofence" icon="pi pi-plus" size="small" severity="secondary" @click="newFence" />
	</DrawerModal>

	<DrawerModal ref="editFenceDrawer"></DrawerModal>
</template>

<style scoped lang="scss">

.selected-card-wrapper {
	position: absolute;
	bottom: 1rem;
	left: 1rem;
	right: 1rem;
    padding: 0.75rem;
    z-index: 1000;
	filter: drop-shadow(0 0.25rem 0.3rem #0005);
	border-radius: 1rem;

	translate: 0 calc(100% + 2rem);
	transition: 300ms;

	&.isIn {
		translate: 0 0;
	}

	.collapse-body {
		max-height: 0;
		overflow: hidden;
		transition: 300ms;
	}

	&.expanded {
		bottom: 0;
		left: 0;
		right: 0;
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
		filter: drop-shadow(0 0rem 0.3rem #0005);

	
		.collapse-body {
			margin-top: 1em;
			max-height: calc(100vh - 10rem);
			overflow-y: auto;
		}
	}



	.main {
		background-color: #fff;
		border-radius: 50rem;
	}
}
</style>
