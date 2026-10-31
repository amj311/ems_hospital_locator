import { computed, nextTick, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { HydratedShare, LocationShare, ProfileDetails, LinkedDeviceConfig, ShareInit, TimelineNode } from 'core/models/LocationShare';
import request from '@/services/request';
import { useUserStore } from './user.store';
import { peek } from 'core/utils/miscUtils';
import { StorageKeys, StorageService } from '@/services/StorageService';
import type { Optional } from 'core/utils/typeUtils';

type LinkedDeviceData = {
	config: LinkedDeviceConfig,
	timeline: Array<TimelineNode>,
}

export const useShareStore = defineStore('share', () => {
	const loadedSharesToDevice = ref<Array<LocationShare>>([]);
	const loadedSharesFromDevice = ref<Array<LocationShare>>([]);
	const deviceData = ref<Record<string, LinkedDeviceData>>({});
	const isLoading = ref(true);

	const loadShares = async () => {
		isLoading.value = true;
		try {
			const { data } = await request.get('/shares/for/' + useUserStore().deviceId);
			if (data.success) {
				loadedSharesFromDevice.value = data.data.sharedFromDevice;
				loadedSharesToDevice.value = data.data.sharedToDevice;
			}
		}
		catch (e) {
			console.log('ERROR LOADING SHARES')
			console.log(e);
		}
		finally {
			isLoading.value = false;
		}
	};

	async function loadDeviceData(device_id: string): Promise<LinkedDeviceData> {
		if (deviceData.value[device_id]) return deviceData.value[device_id];
		const data = await StorageService.get<LinkedDeviceData>(StorageKeys.linkedDeviceData(device_id));
		deviceData.value[device_id] = data!;
		return data!;
	}

	const testHistory = [{
		coords: { // seattle
			"lat": 47.60269643906755,
			"lng": -122.33474012464286
		},
		timestamp: Date.now(),
	}];

	// Merge server shares with local config
	const sharedToDevice = ref<Array<HydratedShare>>([]);
	watch(() => ({ shares: loadedSharesToDevice.value, data: deviceData.value }), async ({shares}) => {
		sharedToDevice.value = await Promise.all(shares.map(async share => {
			const data = await loadDeviceData(share.from_device_id);
			data.timeline = testHistory;
			return {
				...share,
				...data,
				lastPos: peek(data.timeline),
				reciprocated: loadedSharesFromDevice.value.find(sharedFromDevice => share.to_device_id === sharedFromDevice.to_device_id)
			}
		}))
	}, { deep: true });

	const sharedFromDevice = ref<Array<HydratedShare>>([]);
	watch(() => ({ shares: loadedSharesFromDevice.value, data: deviceData.value }), async ({shares}) => {
		sharedFromDevice.value = await Promise.all(shares.map(async share => {
			const data = await loadDeviceData(share.to_device_id);
			data.timeline = testHistory;
			return {
				...share,
				...data,
				lastPos: peek(data.timeline),
				reciprocated: loadedSharesToDevice.value.find(sharedToDevice => sharedToDevice.from_device_id === share.from_device_id)
			}
		}))
	}, { deep: true });

	const editingShareId = ref('');
	const editingShare = computed(() => {
		return sharedToDevice.value.find(s => s.location_share_id === editingShareId.value);
	});
	
	async function patchDeviceData(other_device_id: string, patchData: Optional<LinkedDeviceData>) {
		const data = await loadDeviceData(other_device_id);
		// replace old values with the provided new values
		// leave the original of anything not provided
		const newData: LinkedDeviceData = {
			...data,
			...patchData,
		}

		// also upserts if no record exists yet
		await StorageService.set(StorageKeys.linkedDeviceData(other_device_id), newData);
		deviceData.value[other_device_id] = newData;
	}

	async function upsertShareConfig(other_device_id: string, config: LinkedDeviceConfig) {
		await patchDeviceData(other_device_id, { config });
	}
	async function saveNewShare(locationShare: LocationShare, newConfig: LinkedDeviceConfig) {
		const otherDeviceId = locationShare.from_device_id === useUserStore().deviceId
			? locationShare.to_device_id
			: locationShare.from_device_id
		;
		await upsertShareConfig(otherDeviceId, newConfig);
		loadedSharesToDevice.value.push(locationShare);
	}

	return {
		sharedToDevice,
		sharedFromDevice,
		loadShares,
		isLoading,
		beginEditShare(shareId) {
			console.log(shareId)
			editingShareId.value = shareId;
		},
		cancelEditShare() {
			editingShareId.value = '';
		},
		editingShare,
		upsertShareConfig,
		saveNewShare,
	};
});
