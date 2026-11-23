import { ref } from 'vue'
import { defineStore } from 'pinia'
import { StorageKeys, StorageService } from '@/services/StorageService';
import type { Geofence } from '@core/models/LocationShare';
import { CryptoUtils } from '@core/utils/crypto';
import { useRouter } from 'vue-router';



export const useGeofenceStore = defineStore('Geofence', () => {
	const router = useRouter();
	
	const geofences = ref<Record<string, Geofence>>({});
	const alerts = ref<Record<string, Array<string>>>({}); // geofence ids by device id or "everyone"
	const isLoading = ref(true);
	const editingGeofence = ref<Geofence>();

	const loadGeofences = async () => {
		isLoading.value = true;
		try {
			geofences.value = await StorageService.get(StorageKeys.GEOFENCES) || {};
			alerts.value = await StorageService.get(StorageKeys.ALERTS) || { EVERYONE: [] };
		}
		catch (e) {
			console.log('ERROR LOADING GeofenceS')
			console.log(e);
		}
		finally {
			isLoading.value = false;
		}
	};

	async function upsertGeofence(newData: Partial<Geofence>) {
		let geofenceId = newData.geofence_id;
		if (!geofenceId) {
			geofenceId = String(Math.floor(Math.random() * 1000000000000));
		}
		newData.geofence_id = geofenceId;
		await StorageService.set(StorageKeys.GEOFENCES, geofences.value);
		geofences.value[geofenceId] = newData as Geofence;
		editingGeofence.value = undefined;
	};

	async function saveAlerts() {
		await StorageService.set(StorageKeys.ALERTS, alerts.value);
	};

	return {
		geofences,
		isLoading,
		loadGeofences,
		editingGeofence,
		startEdit(fence: Geofence) {
			editingGeofence.value = fence;
			router.push('fence');
		},
		cancelEdit() {
			editingGeofence.value = undefined;
			router.back();
		},
		upsertGeofence,

		getDeviceAlerts(deviceId: string) {
			const everyoneAlerts = alerts.value['EVERYONE'] || [];
			const deviceAlerts = alerts.value[deviceId] || [];
			return [
				...everyoneAlerts.map(geofenceId => ({ isEveryone: true, geofenceId })),
				...deviceAlerts.map(geofenceId => ({ geofenceId })),
			];
		},

		getFenceAlerts(geofenceId: string) {
			return {
				isEveryone: alerts.value['EVERYONE']?.some(id => id === geofenceId),
				devices: Array.from(Object.entries(alerts.value)).filter(([id, fenceIds]) => id !== 'EVERYONE' && fenceIds.some(fenceId => fenceId === geofenceId))
			}
		},

		async toggleAlertEveryone(geofenceId: string) {
			const isOn = alerts.value['EVERYONE']?.some(id => id === geofenceId);
			if (isOn) {
				// remove
				alerts.value['EVERYONE'] = alerts.value['EVERYONE'].filter(id => id !== geofenceId);
				await saveAlerts();
			}
			else {
				// add
				alerts.value['EVERYONE'] = [...(alerts.value['EVERYONE'] || []), geofenceId]
				await saveAlerts();
			}
		},

		async toggleDeviceAlert(deviceId: string, geofenceId: string) {
			const isOn = alerts.value[deviceId]?.some(id => id === geofenceId);
			if (isOn) {
				// remove
				alerts.value[deviceId] = alerts.value[deviceId].filter(id => id !== geofenceId);
				await saveAlerts();
			}
			else {
				// add
				alerts.value[deviceId] = [...(alerts.value[deviceId] || []), geofenceId]
				await saveAlerts();
			}
		},

	};
});
