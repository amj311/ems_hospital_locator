// ============================================
// Native key-value storage handler
// ============================================

const KeysBase = {
	DEVICE_CREDENTIALS: 'beacon__device_credentials',
	DEVICE_SESSION_TOKEN: 'beacon__device_session_token',
	DEVICE_PROFILE: 'beacon__device_profile',
} as const;

const PartitionsBase = {
	LINKED_DATA: 'beacon__linked_device_data',
}

type StorageKey = typeof KeysBase[keyof typeof KeysBase];
type PartitionKey = typeof PartitionsBase[keyof typeof PartitionsBase];
type AccessKey = StorageKey | `${PartitionKey}__${string}`;

export const StorageKeys = {
	...KeysBase,
	linkedDeviceData(device_id: string) {
		return `${PartitionsBase.LINKED_DATA}__${device_id}` as AccessKey;
	}
} as const;

interface Adapter {
	set(key: AccessKey, value: string): Promise<void>,
	get(key: AccessKey): Promise<string | null>,
	delete(key: AccessKey): Promise<void>,
}

const ADAPTER_KEYS = ['browser'] as const;
type AdapterKey = typeof ADAPTER_KEYS[number];

const Adapters: Record<AdapterKey, Adapter> = {
	browser: {
		set: async (...args) => await localStorage.setItem(...args),
		get: async (...args) => await localStorage.getItem(...args),
		delete: async (...args) => await localStorage.removeItem(...args),
	}
};

const storageAdapter = Adapters.browser;

export const StorageService = {
	/**
	  * Receives anything and stringifies it into storage
	  */
	async set<T = any>(key: AccessKey, value: T) {
		try {
			await storageAdapter.set(key, JSON.stringify(value));
		} catch (error) {
			console.warn('Failed to save to storage:', error);
		}
	},


	/**
	  * Receives anything and parses it out of storage
	  */
	async get<T = any, F = null>(key: AccessKey, fallback: F = null as F): Promise<T | F> {
		try {
			const res = JSON.parse((await storageAdapter.get(key)) || 'null') as T || fallback;
			return res;
		} catch (error) {
			console.warn('Failed to get from storage:', error);
			return fallback;
		}
	},

	async delete(key: AccessKey) {
		try {
			return await storageAdapter.delete(key);
		} catch (error) {
			console.warn('Failed to get from storage:', error);
		}
	}
}
