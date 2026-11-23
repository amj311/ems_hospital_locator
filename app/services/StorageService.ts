import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

// ============================================
// Native key-value storage handler
// ============================================

const KeysBase = {
	DEVICE_CREDENTIALS: 'beacon__device_credentials',
	DEVICE_SESSION_TOKEN: 'beacon__device_session_token',
	DEVICE_PROFILE: 'beacon__device_profile',
	DEVICE_LAST_PUBLISH: 'beacon__device_last_publish',
	DEVICE_LAST_LOAD: 'beacon__device_last_LOAD',
	LINKED_DEVICES: 'beacon__linked_devices',
	GEOFENCES: 'beacon__geofences',
	ALERTS: 'beacon__alerts',
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

const ADAPTER_KEYS = ['browser', 'native'] as const;
type AdapterKey = typeof ADAPTER_KEYS[number];

// Helper to manage the SQLite connection
let dbConnection: SQLiteDBConnection | null = null;
const sqliteConnection = new SQLiteConnection(CapacitorSQLite);

async function useSqlite<T>(query: (conn: SQLiteDBConnection) => Promise<T>) {
	if (!dbConnection) {
		// Create/Open the database
		dbConnection = await sqliteConnection.createConnection('beacon_storage', false, import.meta.env.VITE_SQL_SECRET, 1, false);
		await dbConnection.open();
		// Create a simple key-value table
		await dbConnection.execute(`CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT);`);
	}
	return await query(dbConnection);
}

const Adapters: Record<AdapterKey, Adapter> = {
	browser: {
		set: async (...args) => await localStorage.setItem(...args),
		get: async (...args) => await localStorage.getItem(...args),
		delete: async (...args) => await localStorage.removeItem(...args),
	},

	native: {
		set: async (key, value) => {
			// console.log("ABOUT TO SET SQLITE: "+key, JSON.stringify(value))
			await useSqlite(conn => conn.run(`INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?);`, [key, value]));
		},
		get: async (key) => {
			// console.log("ABOUT TO GET SQLITE: "+key)
			const result = await useSqlite(conn => conn.query(`SELECT value FROM kv_store WHERE key = ?;`, [key]));
			// console.log("GOT SQLITE", result?.values?.[0]?.value)
			return result.values && result.values.length > 0 ? result.values[0].value : null;
		},
		delete: async (key) => {
			await useSqlite(conn => conn.run(`DELETE FROM kv_store WHERE key = ?;`, [key]));
		},
	}
};


// Determine adapter based on platform
const storageAdapter = Capacitor.isNativePlatform() 
	? Adapters.native 
	: Adapters.browser;


export const StorageService = {
	/**
	  * Receives anything and stringifies it into storage
	  */
	async set<T = any>(key: AccessKey, value: T) {
		try {
			await storageAdapter.set(key, JSON.stringify(value));
		} catch (error) {
			console.warn('Failed to save to storage:', error);
			throw error;
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
			throw error;
		}
	}
}
