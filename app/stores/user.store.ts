import { ref } from 'vue'
import { defineStore } from 'pinia'
import { AuthService } from '@/services/authService';
import { StorageKeys, StorageService } from '@/services/StorageService';
import { type ProfileDetails } from '@core/models/LocationShare';

export const useUserStore = defineStore('user', () => {
	const hasLoadedSessionData = ref(false);
	const loginError = ref<String>('');
	const isAuthenticated = ref(false);
	const deviceId = ref<string>();
	const isLoading = ref(false);

	AuthService.onLogInOrOut = ({ device_id, sessionToken }) => {
		deviceId.value = device_id;
		isAuthenticated.value = Boolean(sessionToken);
	};

	const loadSessionData = async () => {
		isLoading.value = true;
		try {
			await AuthService.doInitAuthFlow(); // attempts session init
			loginError.value = '';
		}
		catch (e) {
			console.log('ERROR LOADING AUTH USER')
			console.log(e);
			loginError.value = 'Failed to load user. ' + e;
		}
		finally {
			hasLoadedSessionData.value = true;
			isLoading.value = false;
		}
	};

	const profile = ref<ProfileDetails>({});
	(async () => {
		profile.value = await StorageService.get<ProfileDetails, ProfileDetails>(StorageKeys.DEVICE_PROFILE, {});
		await loadSessionData();
	})();

	return {
		hasLoadedSessionData,
		hasAuth: isAuthenticated,
		loginError,
		deviceId,
		loadSessionData,
		isLoading,

		profile,
		async setDeviceProfile(newProfile: ProfileDetails) {
			await StorageService.set<ProfileDetails>(StorageKeys.DEVICE_PROFILE, newProfile);
			profile.value = newProfile;
		}
	};
});
