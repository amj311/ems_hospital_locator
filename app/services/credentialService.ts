// ============================================
// Credential Store
// ============================================

import type { Session } from "core/models/Device";
import { StorageKeys, StorageService } from "./StorageService";

/**
 * Device authentication credentials stored locally
 */
export interface DeviceCredentials {
	device_id: string;
	public_key: string;
	private_key: string; // Store private key for signing challenges
	exchange_public_key: string;
	exchange_private_key: string;
	recovery_public_key: string;
	recovery_private_key: string;
	recovery_fingerprint: string;
}

export const CredentialService = {
	/**
	  * Save device credentials to localStorage
	  */
	async saveCredentialsToStorage(credentials: DeviceCredentials | null) {
		try {
			StorageService.set(StorageKeys.DEVICE_CREDENTIALS, credentials);
		} catch (error) {
			console.warn('Failed to save credentials to localStorage:', error);
		}
	},

	/**
	  * Load device credentials from localStorage
	  */
	async loadCredentialsFromStorage(): Promise<DeviceCredentials | null> {
		try {
			return await StorageService.get<DeviceCredentials>(StorageKeys.DEVICE_CREDENTIALS);
		} catch (error) {
			console.warn('Failed to load credentials from localStorage:', error);
			return null;
		}
	},

	/**
	  * Remove device credentials from localStorage
	  */
	async removeCredentialsFromStorage() {
		try {
			await StorageService.delete(StorageKeys.DEVICE_CREDENTIALS);
			await StorageService.delete(StorageKeys.DEVICE_SESSION_TOKEN);
		} catch (error) {
			console.warn('Failed to remove credentials from localStorage:', error);
		}
	},

	/**
	  * Save session token to localStorage
	  */
	async saveSessionTokenToStorage(session: Session | null) {
		try {
			await StorageService.set<Session | null>(StorageKeys.DEVICE_SESSION_TOKEN, session);
		} catch (error) {
			console.warn('Failed to save session token to localStorage:', error);
		}
	},

	/**
	  * Load session token from localStorage
	  */
	async loadSessionTokenFromStorage(): Promise<Session | null> {
		try {
			return await StorageService.get<Session>(StorageKeys.DEVICE_SESSION_TOKEN);
		} catch (error) {
			console.warn('Failed to load session token from localStorage:', error);
			return null;
		}
	},

	/**
	  * Remove session token from localStorage
	  */
	async removeSessionTokenFromStorage() {
		try {
			StorageService.delete(StorageKeys.DEVICE_SESSION_TOKEN);
		} catch (error) {
			console.warn('Failed to remove session token from localStorage:', error);
		}
	},


}
