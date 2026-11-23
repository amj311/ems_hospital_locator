
import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js'
import { HDKey } from "micro-ed25519-hdkey";
import type { Challenge } from "@core/models/Device";
import type { EncryptedLocationPayload, ProfileDetails, ShareRequest, TimelineNode } from "@core/models/LocationShare";

const path = "m/44'/1234'/0'/0'";

type Bytes = Uint8Array<ArrayBufferLike>;

export const CryptoUtils = {
	/**
	 * Use Ed25519 key pairs for device authentication and challenge signing
	 */
	async createEd25519KeyPair(): Promise<{
		publicKey: Bytes;
		secretKey: Bytes;
	}> {
		return ed25519.keygen();
	},

	/**
	 * Use X25519 key pairs for symmetrical key cryptography
	 */
	async createX25519KeyPair(): Promise<{
		publicKey: Bytes;
		secretKey: Bytes;
	}> {
		return x25519.keygen();
	},

	/**
	 * Generate a new mnemonic and deterministic signing key.
	 */
	async createKeyPairFromMnemonic(mnemonic: string) {
		if (!validateMnemonic(mnemonic, wordlist)) {
			throw new Error("Invalid recovery phrase");
		}

		const seed = await mnemonicToSeed(mnemonic);
		const root = HDKey.fromMasterSeed(seed);
		const child = root.derive(path);

		return {
			secretKey: child.privateKey,
			publicKey: child.publicKeyRaw
		};
	},


	signChallenge(privateKey: Bytes, challenge: Challenge) {
		const message = buildChallengeMessage(challenge);
		const signature = ed25519.sign(message, privateKey);
		return signature;
	},


	/**
	   * Verify an Ed25519 signature using the Web Crypto API.
	   * @param publicKeyBase64url - Base64url-encoded SPKI public key
	   * @param data - The original data that was signed
	   * @param signatureBase64url - Base64url-encoded signature to verify
	   * @returns true if the signature is valid
	   */
	async verifyChallenge(
		publicKey: Bytes,
		challenge: Challenge,
		signature: Bytes
	): Promise<boolean> {
		try {

			const valid = ed25519.verify(
				signature,
				buildChallengeMessage(challenge),
				publicKey,
			);

			return valid;
		} catch (error) {
			console.error('Ed25519 signature verification failed:', error);
			return false;
		}
	},

	/**
	 * Create a SHA-256 hash of a string.
	 * @param data - The string to hash
	 * @returns Base64url-encoded SHA-256 hash
	 */
	async sha256Hash(data: string): Promise<string> {
		try {
			const dataBuffer = new TextEncoder().encode(data);
			const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
			return arrayBufferToBase64url(hashBuffer);
		} catch (error) {
			console.error('SHA-256 hashing failed:', error);
			throw new Error('Hash generation failed');
		}
	},

	/**
	 * RECOVERY KEYS
	 */
	generateMnemonic() {
		// 128 bits of entropy produces a 12-word mnemonic.
		return generateMnemonic(wordlist, 128);
	},



	keyPairToBase64(keyPair: { secretKey: Uint8Array, publicKey }) {
		return {
			secretKey64: this.bytesToBase64url(keyPair.secretKey),
			publicKey64: this.bytesToBase64url(keyPair.publicKey),
		};
	},



	bytesToBase64url: toBase64url,
	base64urlToBytes: fromBase64url,
	createShareRequest,
	unwrapShareRequest,
	generateVerificationCode,
	// fromBase64,
	// toBase64,

	encryptLocation,
	decryptLocation,
};

function toBase64url(bytes: Bytes): string {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
};

function fromBase64url(value: string): Bytes {
	const base64 = value
		.replaceAll("-", "+")
		.replaceAll("_", "/")
		.padEnd(Math.ceil(value.length / 4) * 4, "=");

	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
};

function buildChallengeMessage(challenge: Challenge) {
	return utf8([
		"beacon-auth-v1/recover",
		challenge.challenge_id,
		challenge.nonce,
		challenge.device_id,
		challenge.expires_at
	].join("\n"))
}




/**	   
 * * Helper: Convert ArrayBuffer to base64url string
	 */
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	const base64 = btoa(binary);
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const textEncoder = new TextEncoder();

function utf8(value) {
	return textEncoder.encode(value);
}


/**
 * BIP-39 mnemonic → 64-byte seed.
 *
 * BIP-39 specifies:
 * PBKDF2-HMAC-SHA512(
 *   password = NFKD(mnemonic),
 *   salt = NFKD("mnemonic" + passphrase),
 *   iterations = 2048
 * )
 */
async function mnemonicToSeed(mnemonic, passphrase = "") {
	const normalizedMnemonic = mnemonic.normalize("NFKD");
	const normalizedPassphrase = passphrase.normalize("NFKD");

	const baseKey = await crypto.subtle.importKey(
		"raw",
		utf8(normalizedMnemonic),
		"PBKDF2",
		false,
		["deriveBits"]
	);

	const salt = utf8(`mnemonic${normalizedPassphrase}`);

	const seedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt,
			iterations: 2048,
			hash: "SHA-512",
		},
		baseKey,
		64 * 8
	);

	return new Uint8Array(seedBits);
}


/**
 * GENERATING AND SHARING SHARED SECRET BETWEEN DEVICES
 */

type CipherPayload = {
	groupKey64: string,
	toProfile: ProfileDetails,
	fromLocation?: TimelineNode | null,
}

/**
 * WRAPPING (Sender Side)
 * Encrypts the groupKey specifically for the receiver's publicKey.
 * The "SHARE TO" device creates this after receiving the public key from the "SHARE FROM" device
 */
async function createShareRequest(selfDeviceId: string, selfPrivateExchangeKey: Bytes, fromPublicExchangeKey: Bytes, toProfile: ProfileDetails, fromLocation?: TimelineNode | null): Promise<{ groupKey: string, groupFingerprint: string, request: ShareRequest }> {
	// console.log("createGroupKey", {
	// 	selfPrivateExchangeKey,
	// 	fromPublicExchangeKey
	// })
	// console.log(selfPrivateExchangeKey);
	// console.log(bytesToBase64url(x25519.getPublicKey(selfPrivateExchangeKey)));
	const groupKey = getRandomBytes(48);
	// 1. Generate a Shared Secret via ECDH
	// This secret is the same for both parties, but cannot be derived by others
	const sharedSecret = getSharedSecret(selfPrivateExchangeKey, fromPublicExchangeKey);
	// console.log({sharedSecret})

	// 2. Use HKDF to derive a high-entropy Wrapping Key from the shared secret
	// We use a static 'salt' or 'info' string to ensure the key is bound to this purpose
	const wrappingKey = hkdf(sha256, sharedSecret, new Uint8Array(), fromBase64url('groupkeywrap'), 32);

	// 3. Encrypt the groupKey using XChaCha20-Poly1305
	const nonce = getRandomBytes(24);
	const xchacha = xchacha20poly1305(wrappingKey, nonce);

	// Associated Data can be the receiver's public key to prevent "misbinding" attacks
	const selfPublicExchangeKey = x25519.getPublicKey(selfPrivateExchangeKey);

	const cipherPayload: CipherPayload = {
		groupKey64: toBase64url(groupKey),
		toProfile,
		fromLocation,
	}
	const ciphertext = xchacha.encrypt(new TextEncoder().encode(JSON.stringify(cipherPayload)));

	// console.log({
	// 	toPrivateKey: selfPrivateExchangeKey,
	// 	toPublicKey: selfPublicExchangeKey,
	// 	fromPublicKey: fromPublicExchangeKey,
	// 	nonce,
	// 	ciphertext,
	// })

	return {
		groupKey: toBase64url(groupKey),
		groupFingerprint: generateVerificationCode(groupKey),
		request: {
			to_device_id: selfDeviceId,
			from_device_id: selfDeviceId,
			requested_at: new Date().toISOString(),
			share_payload: {
				nonce: toBase64url(nonce),
				cipher_text: toBase64url(ciphertext),
				to_exchange_key: toBase64url(selfPublicExchangeKey),
			},
		}
	};
}

/**
 * UNWRAPPING (Receiver Side)
 * Decrypts the groupKey using the receiver's privateKey.
 * The "share from" device uses this to derive the groupKey from the payload from the "share to" device
 */
async function unwrapShareRequest(selfPrivateExchangeKey: Bytes, wrappedPayload: ShareRequest['share_payload']) {
	const toPublicExchangeKey = fromBase64url(wrappedPayload.to_exchange_key);
	const nonce = fromBase64url(wrappedPayload.nonce);
	const ciphertext = fromBase64url(wrappedPayload.cipher_text);
	// console.log("unwrap group key", {
	// 	selfPrivateExchangeKey,
	// 	toPublicExchangeKey,
	// 	base64urlPublic: wrappedPayload.toExchangeKey
	// })
	// 1. Recreate the exact same Shared Secret
	const sharedSecret = getSharedSecret(selfPrivateExchangeKey, toPublicExchangeKey);
	//   console.log({sharedSecret})

	// 2. Derive the same Wrapping Key using HKDF
	const wrappingKey = hkdf(sha256, sharedSecret, new Uint8Array(), fromBase64url('groupkeywrap'), 32);

	// 3. Decrypt and Authenticate
	const xchacha = xchacha20poly1305(wrappingKey, nonce);

	try {
		const deciphered = xchacha.decrypt(ciphertext);
		const payload = JSON.parse(new TextDecoder().decode(deciphered)) as CipherPayload;
		return {
			groupFingerprint: generateVerificationCode(fromBase64url(payload.groupKey64)),
			requestPayload: payload,
		}
	} catch (e) {
		console.error(e)
		throw new Error("Failed to unwrap key: Invalid keys or tampered payload.");
	}
}


function generateVerificationCode(sharedSecret: Bytes) {
	// 1. Hash the shared secret to get a fixed-length fingerprint
	const hash = sha256(sharedSecret);

	// 2. Convert the first 4 bytes of the hash into a number
	// This gives us a value between 0 and 4,294,967,295
	const view = new DataView(hash.buffer);
	const numericCode = view.getUint32(0);

	// 3. Format as a 6-digit code (modulo 1,000,000)
	// We pad with leading zeros to ensure it is always 6 digits
	return (numericCode % 1000000).toString().padStart(6, '0');
}

function getSharedSecret(selfPrivate: Bytes, otherPublic: Bytes) {
	// console.log("creating shared secret with", { selfPrivate, otherPublic });
	return x25519.getSharedSecret(selfPrivate, otherPublic);
}


// async function testFlow(fromKeyPair, toKeyPair) {
// 	// getSharedSecret(toKeyPair.secretKey, fromKeyPair.publicKey);
// 	// getSharedSecret(fromKeyPair.secretKey, toKeyPair.publicKey);

// 	const wrapControl = await createGroupKey('test-id', toKeyPair.secretKey, fromKeyPair.publicKey);
// 	// console.log(wrapControl);
// 	// console.log("public key compare", toKeyPair.publicKey, fromBase64url(wrapControl.payload.toExchangeKey))
// 	const unwrap = await unwrapGroupKey(fromKeyPair.secretKey, wrapControl.payload);
// 	// console.log("GROUP KEY COMPARE", wrapControl.groupKey, unwrap.groupKey)
// }

// const freshKey = x25519.keygen(); // from
// const freshKey2 = x25519.keygen(); // to

// console.log("\n\nCONTROL ===============");
// testFlow(freshKey, freshKey2);


const fromDeviceId = "38f4efbf-fc34-42fb-a69d-0524e5374866";
const fromPublicExchangeKey = "6nW_158dU389D1nGGOP4xyKZ_tTtV9CUj5r4KoqeFyo";
const fromPrivateExchangeKey = "C8guucnNlAavVl43CN6RXBZc5VMnuWX0QSgwPHayA-8";
const fromPair = {
	publicKey: fromBase64url(fromPublicExchangeKey),
	secretKey: fromBase64url(fromPrivateExchangeKey),
}

const toDeviceId = "c5d425ee-0e81-40dd-b91f-9b3f6821d961";
const toPublicExchangeKey = "zVJSQV0w3U4H4pgygnhu_2pUpXvd54YbQi_RgUUncE4";
const toPrivateExchangeKey = "7WYEZL28W6YNWOXXNmKG_S8mD4aQSP7hOIs-XGQFUAg";
const toPair = {
	publicKey: fromBase64url(toPublicExchangeKey),
	secretKey: fromBase64url(toPrivateExchangeKey),
}

// console.log("TEST ===========")
// testFlow(fromPair, toPair);

/**
 * Web-compatible random bytes generator using window.crypto
 */
function getRandomBytes(length): Bytes {
	let hasWindow = false;
	try {
		hasWindow = Boolean(window);
	} catch { };

	if (hasWindow)
		return window.crypto.getRandomValues(new Uint8Array(length));
	else {
		const nodeCrypto = require('node:crypto');
		return nodeCrypto.randomBytes(length);
	}
}


function encryptLocation(groupKey: Bytes, locationPayload: TimelineNode): EncryptedLocationPayload {
	const plaintext = new TextEncoder().encode(JSON.stringify(locationPayload));

	// Use Web Crypto API for the nonce
	const nonce = getRandomBytes(24);

	const xchacha = xchacha20poly1305(sha256(groupKey), nonce);
	const ciphertext = xchacha.encrypt(plaintext);

	return {
		nonce_64url: toBase64url(nonce),
		ciphertext_64url: toBase64url(ciphertext),
		keyId: generateVerificationCode(groupKey),
	};
}

function decryptLocation(groupKey: Bytes, payload: EncryptedLocationPayload): TimelineNode | null {
	const nonce = fromBase64url(payload.nonce_64url);
	const ciphertext = fromBase64url(payload.ciphertext_64url);

	// use key id as fingerprint to make sure we're decoding a message written with the same key
	const ourKeyId = generateVerificationCode(groupKey);
	if (ourKeyId !== payload.keyId) {
		console.warn("Refused to decrypt a location from a different group key")
		return null;
	}

	try {
		const xchacha = xchacha20poly1305(sha256(groupKey), nonce);
		const plaintextBytes = xchacha.decrypt(ciphertext);
		return JSON.parse(new TextDecoder().decode(plaintextBytes));
	} catch (e) {
		throw new Error("Decryption failed: Integrity check failed.");
	}
}
