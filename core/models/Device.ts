export type DeviceDb = {
    device_id: string;
    public_key: string;           // PEM-encoded public key (e.g. ECDSA P-256)
    exchange_public_key: string; // PEM-encoded exchange public key (reserved for future)
    recovery_public_key: string; // PEM-encoded recovery public key (reserved for future)
    recovery_fingerprint: string; // Hash(recovery_public_key) — reserved for future
	password_hash: string,
    revoked_at: Date | null;
    revoked_by_device_id: string | null;
};

export type DeviceDraft = Pick<DeviceDb, 'public_key' | 'exchange_public_key'  | 'recovery_public_key' | 'recovery_fingerprint' | 'password_hash'>;
export type DeviceAuthReturn = Pick<DeviceDb, 'device_id'>;

/**
 * Represents a single challenge instance for device authentication (nonce mechanism).
 */
export type Challenge = {
    challenge_id: string;
    device_id: string;
    nonce: string;      // 32-byte random, base64url encoded
    expires_at: Date;   // When the challenge expires
    used_at: Date | null; // Null if not yet used
    created_at: Date;   // When the challenge was issued
};

export type Session = {
	access_token: string,
	expires_at_ms: number,
	refresh_token: string,
	refresh_token_expires_at: number,
}
