import { computed, nextTick, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { HydratedShare, LocationShareApi, ProfileDetails, LinkedDeviceConfig, ShareInit, TimelineNode, LinkedDeviceData } from '@core/models/LocationShare';
import request from '@/services/request';
import { useUserStore } from './user.store';
import { peek, wait } from '@core/utils/miscUtils';
import { StorageKeys, StorageService } from '@/services/StorageService';
import type { Optional } from '@core/utils/typeUtils';
import { CryptoUtils } from '@core/utils/crypto';


export const useShareStore = defineStore('share', () => {
	const loadedSharesToDevice = ref<Array<LocationShareApi>>([]);
	const loadedSharesFromDevice = ref<Array<LocationShareApi>>([]);
	const isLoading = ref(true);

	const loadShares = async () => {
		isLoading.value = true;
		try {
			await loadLinkedDevices();
			const lastLoad = await StorageService.get(StorageKeys.DEVICE_LAST_LOAD);
			const { data } = await request.get('/shares/for/' + useUserStore().deviceId + '/' + (lastLoad || '01-01-1990'));
			if (data.success) {
				loadedSharesFromDevice.value = data.data.sharedFromDevice;
				loadedSharesToDevice.value = data.data.sharedToDevice;
				await syncLinkedDevices();
				updateHydratedShares();
				await StorageService.set(StorageKeys.DEVICE_LAST_LOAD, new Date().toISOString());
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

	const linkedDevices = ref<Record<string, LinkedDeviceData>>({});
	
	async function loadLinkedDevices() {
		linkedDevices.value = {};
		let deviceIds = await StorageService.get(StorageKeys.LINKED_DEVICES);
		if (!deviceIds) {
			deviceIds = [];
			await StorageService.set(StorageKeys.LINKED_DEVICES, deviceIds);
		}
		await Promise.all(deviceIds.map(async (deviceId) => {
			const data = await StorageService.get(StorageKeys.linkedDeviceData(deviceId));
			linkedDevices.value[deviceId] = { deviceId, ...data };
		}))
	}

	async function syncLinkedDevices() {
		for (const deviceId in linkedDevices.value) {
			// update shared flags based on server data
			// REQUIRES SERVER DATA SUCCESSFULLY LOADED
			linkedDevices.value[deviceId].sharingTheirs = loadedSharesToDevice.value.some(share => share.from_device_id === deviceId);
			linkedDevices.value[deviceId].sharingMine = loadedSharesFromDevice.value.some(share => share.to_device_id === deviceId);

			// if they are no longer sharing with us and we are no longer sharing with them, remove entirely
			if (!linkedDevices.value[deviceId].sharingTheirs && !linkedDevices.value[deviceId].sharingMine) {
				delete linkedDevices.value[deviceId];
				await StorageService.delete(StorageKeys.linkedDeviceData(deviceId));
				// device id index will be synced at end
			}
			else {
				// if they are no longer sharing with us, delete the history
				if (!linkedDevices.value[deviceId].sharingTheirs) {
					linkedDevices.value[deviceId].timeline = [];
				}

				// if they are sharing with us, update latest position
				if (linkedDevices.value[deviceId].sharingTheirs) {
					const latestOnDevice = peek(linkedDevices.value[deviceId].timeline) as TimelineNode;
					loadedSharesToDevice.value.find(share => share.from_device_id === deviceId)?.locationUpdates?.forEach(update => {
						const decrypted = CryptoUtils.decryptLocation(
							CryptoUtils.base64urlToBytes(linkedDevices!.value[deviceId]!.config.groupKey),
							JSON.parse(update.location),
						)
						if (decrypted && decrypted.timestamp > latestOnDevice.timestamp) {
							linkedDevices.value[deviceId].timeline.push(decrypted);
						}
					});
				}
				await StorageService.set(StorageKeys.linkedDeviceData(deviceId), linkedDevices.value[deviceId]);
			}
		}
		// CASE: share exists remotely but not on device.
		// Every share must be written to device when it is approved.
		// This is essential because the device alone stores the group key.
		// TODO: a share on remote but not on device needs to be displayed as broken with a flow for fixing.

		await StorageService.set(StorageKeys.LINKED_DEVICES, Array.from(Object.keys(linkedDevices.value)));
	}

	function getDeviceData(device_id: string): LinkedDeviceData {
		const data = linkedDevices.value[device_id];
		if (!data) {
			throw new Error("No data for that device id");
		}
		return data;
	}

	const testHistory = [{
		coords: { // seattle
			"lat": 47.60269643906755,
			"lng": -122.33474012464286
		},
		timestamp: Date.now(),
	}];

	const hydratedShares = ref<Array<HydratedShare>>([]);
	function updateHydratedShares() {
		hydratedShares.value = Array.from(Object.values(linkedDevices.value)).map(share => ({
			...share,
			timeline: share.timeline || testHistory,
			lastPos: peek(share.timeline || testHistory),
		}))
	}

	const sharedToDevice = computed(() => hydratedShares.value.filter(share => share.sharingTheirs));
	const sharedFromDevice = computed(() => hydratedShares.value.filter(share => share.sharingMine));

	const editingShareDeviceId = ref('');
	const editingShare = computed(() => {
		return linkedDevices.value[editingShareDeviceId.value];
	});
	
	async function patchDeviceData(other_device_id: string, patchData: Optional<LinkedDeviceData>) {
		const data = await getDeviceData(other_device_id);
		// replace old values with the provided new values
		// leave the original of anything not provided
		const newData: LinkedDeviceData = {
			...data,
			...patchData,
		}

		// also upserts if no record exists yet
		await StorageService.set(StorageKeys.linkedDeviceData(other_device_id), newData);
		linkedDevices.value[other_device_id] = newData;
		updateHydratedShares();
	}

	async function upsertShareConfig(other_device_id: string, config: LinkedDeviceConfig) {
		await patchDeviceData(other_device_id, { config });
	}
	async function saveNewShare(newDeviceData: LinkedDeviceData, sharedFromDevice: LocationShareApi | null, sharedToDevice: LocationShareApi | null) {
		await StorageService.set(StorageKeys.linkedDeviceData(newDeviceData.deviceId), newDeviceData);
		linkedDevices.value[newDeviceData.deviceId] = newDeviceData;
		
		if (sharedToDevice) loadedSharesToDevice.value.push(sharedToDevice);
		if (sharedFromDevice) loadedSharesFromDevice.value.push(sharedFromDevice);
		
		await syncLinkedDevices();
		updateHydratedShares();
	}

	return {
		sharedToDevice,
		sharedFromDevice,
		loadShares,
		isLoading,
		beginEditShare(shareId) {
			editingShareDeviceId.value = shareId;
		},
		cancelEditShare() {
			editingShareDeviceId.value = '';
		},
		async saveShare(draft: LinkedDeviceData) {
			if (!editingShareDeviceId.value) return;
			// only profile is updated right now
			const data = await getDeviceData(draft.deviceId);
			data.config.profile = draft.config.profile;
			await patchDeviceData(draft.deviceId, data);
			editingShareDeviceId.value = '';
			await wait(200);
		},
		editingShare,
		upsertShareConfig,
		saveNewShare,
	};
});
