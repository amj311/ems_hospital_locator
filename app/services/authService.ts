import request from './request';
import { CredentialService, type DeviceCredentials } from '@/services/credentialService';
import { CryptoUtils } from 'core/utils/crypto';
import type { Challenge, DeviceDraft, Session } from 'core/models/Device';

// ============================================
// Device Authentication Credentials
// ============================================

export type DeviceCredentialsDraft = Omit<DeviceCredentials, 'device_id'>;

// In-memory store for device credentials
let deviceCredentials: DeviceCredentials | null = null;

// Session token from device authentication
let deviceSession: Session | null = null;

/**
 * Restore all device state from localStorage (credentials + session token)
 */
async function restoreDeviceState() {
	const credentials = await CredentialService.loadCredentialsFromStorage();
	const sessionToken = await CredentialService.loadSessionTokenFromStorage();
	
	if (credentials) {
		deviceCredentials = credentials;
	}
	if (sessionToken) {
		deviceSession = sessionToken;
	}
}

// ============================================
// Export AuthService
// ============================================

export const AuthService = {
	onLogInOrOut: (session: { device_id?: string, sessionToken: string | null }) => {},

	publishAuthChanged() {
		this.onLogInOrOut({
			device_id: deviceCredentials?.device_id,
			sessionToken: this.getValidToken(),
		})
	},

	get deviceCredentials() {
		return deviceCredentials;
	},

	getValidToken() {
		if (deviceSession && deviceSession.expires_at_ms > Date.now()) return deviceSession.access_token;
		return null;
	},
	getValidRefreshToken() {
		if (deviceSession && deviceSession.refresh_token_expires_at > Date.now()) return deviceSession.refresh_token;
		return null;
	},

	// ============================================
	// Device Authentication Methods
	// ============================================

	/**
	 * Go through all app init process to authenticate and get an auth token if possible.
	 * All end states are published though this.publishAuthChanged.
	 * When this promise, returns the consumer should display the appropriate state.
	 */
	async doInitAuthFlow() {
		await restoreDeviceState();
		this.publishAuthChanged();

		// device is not registered
		if (!deviceCredentials) {
			return;
		}
		
		// there is an active session
		if (this.getValidToken()) {
			return;
		}

		// Attempt to refresh session
		if (this.getValidRefreshToken()) {
			await this.refreshSession();
		}

		// otherwise a password is required to get a new session
	},

	/**
	 * Register a new device with the server.
	 * Overwrites any previous credentials.
	 */
	async registerDevice(password: string, mnemonic: string): Promise<DeviceCredentials> {
		// disallow if the device already registered.
		// The previous registration should be removed first
		// to mitigate phantom devices.
		if (await CredentialService.loadCredentialsFromStorage()) {
			throw new Error("This device is already registered!");
		}

		try {
			// Step 1: Generate Ed25519 key pair
			const { publicKey64, secretKey64 } = CryptoUtils.keyPairToBase64(await CryptoUtils.createEd25519KeyPair());
			const { publicKey64: exchangePublicKey, secretKey64: exchangeSecretKey } = CryptoUtils.keyPairToBase64(await CryptoUtils.createX25519KeyPair());
			const { publicKey64: publicRecoveryKey, secretKey64: privateRecoveryKey } = CryptoUtils.keyPairToBase64(await CryptoUtils.createKeyPairFromMnemonic(mnemonic));

			const draft: DeviceCredentialsDraft = {
				public_key: publicKey64,
				private_key: secretKey64,
				exchange_public_key: exchangePublicKey,
				exchange_private_key: exchangeSecretKey,
				recovery_public_key: publicRecoveryKey,
				recovery_private_key: privateRecoveryKey,
				recovery_fingerprint: await CryptoUtils.sha256Hash(publicRecoveryKey),
			}

			const response = await request.post('/auth/register', {
				public_key: draft.public_key,
				exchange_public_key: draft.exchange_public_key,
				recovery_public_key: draft.recovery_public_key,
				recovery_fingerprint: draft.recovery_fingerprint,
				password_hash: await CryptoUtils.sha256Hash(password),
			} as DeviceDraft);

			if (!response.data.success) {
				throw new Error(response.data.message || 'Failed to register device');
			}

			const { device_id } = response.data.data;
			
			return this.setDeviceCredentials({
				...draft,
				device_id,
			});
		} catch (error: any) {
			console.error('registerDevice error:', error);
			throw new Error(error.response?.data?.message || 'Failed to register device');
		}
	},

	/**
	 * Request a challenge for device authentication
	 * @param deviceId - The registered device ID
	 */
	async requestChallenge(deviceId: string): Promise<Challenge> {
		try {
			const response = await request.post('/auth/challenge', {
				device_id: deviceId,
			});

			if (!response.data.success) {
				throw new Error(response.data.message || 'Failed to get challenge');
			}

			return response.data.data;
		} catch (error: any) {
			console.error('requestChallenge error:', error);
			throw new Error(error.response?.data?.message || 'Failed to request challenge');
		}
	},

	/**
	 * Attempts to refresh session with refresh token
	*/
	async refreshSession(): Promise<Session | null> {
		const refreshToken = this.getValidRefreshToken();
		if (!refreshToken || !deviceCredentials) {
			return null;
		}

		// let refresh fail silently. User will just need to login.
		try {
			const response = await request.post('/auth/session-refresh', {
				device_id: deviceCredentials.device_id,
				refresh_token_hash: await CryptoUtils.sha256Hash(refreshToken),
			});
			if (response.data.data) {
				return this.setSession(response.data.data as Session)
			}
			return null;
		}
		catch {
			return null;
		}
	},

	/**
	  * Perform the complete device authentication flow.
	  * Intended for use after the previous session has been invalidated.
	  * 
	  * @returns Session token data
	  */
	async initSession(passwordAttempt: string): Promise<Session> {
		if (!deviceCredentials) {
			throw new Error('Device not registered. Call registerDevice first.');
		}

		// Step 1: Request challenge
		const challenge = await this.requestChallenge(deviceCredentials.device_id);
		
		// Step 2: Sign the challenge with stored creds
		const signature = await CryptoUtils.signChallenge(
			CryptoUtils.base64urlToBytes(deviceCredentials.private_key),
			challenge,
		);
		
		// Step 3: Exchange signed challenge for session token
		try {
			const response = await request.post('/auth/session', {
				device_id: deviceCredentials.device_id,
				challenge_id: challenge.challenge_id,
				signature: CryptoUtils.bytesToBase64url(signature),
				password_attempt: await CryptoUtils.sha256Hash(passwordAttempt),
			});

			if (!response.data.success) {
				throw new Error(response.data.message || 'Challenge authentication failed');
			}

			const session = response.data.data as Session;
			this.setSession(session);
			return session;
		} catch (error: any) {
			console.error('authenticateWithChallenge error:', error);
			throw new Error(error.response?.data?.message || 'Challenge authentication failed');
		}
	},

	setSession(session: Session) {
		deviceSession = session;
		CredentialService.saveSessionTokenToStorage(session);
		this.publishAuthChanged();
		return session;
	},

	clearSession() {
		deviceSession = null;
		CredentialService.removeSessionTokenFromStorage();
		this.publishAuthChanged();
	},

	/**
	 * Get the current device session token
	 * Returns in-memory token, or loads from localStorage if not set
	 */
	async getDeviceSessionToken(): Promise<string | null> {
		if (deviceSession) {
			return deviceSession.access_token;
		}
		return (await CredentialService.loadSessionTokenFromStorage())?.access_token || null;
	},

	/**
	 * Get the current device credentials
	 * Returns in-memory credentials, or loads from localStorage if not set
	 */
	async getDeviceCredentials(): Promise<DeviceCredentials | null> {
		if (deviceCredentials) {
			return deviceCredentials;
		}
		return await CredentialService.loadCredentialsFromStorage();
	},

	/**
	 * Set device credentials (for restoring from secure storage)
	 * Also persists to localStorage
	 */
	setDeviceCredentials(credentials: DeviceCredentials): DeviceCredentials {
		deviceCredentials = credentials;
		CredentialService.saveCredentialsToStorage(credentials);
		// don't publish auth change here - a session update should follow next
		return credentials;
	},

	/**
	   * Clear device credentials and session
	   * Also removes from localStorage
	   */
	clearDeviceCredentials(): void {
		deviceCredentials = null;
		deviceSession = null;
		CredentialService.removeCredentialsFromStorage();
		this.publishAuthChanged();
	},

};
