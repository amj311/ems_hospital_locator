/**
 * Shared base64url encoding/decoding utilities.
 * Works in both browser (Web Crypto API) and Node.js environments.
 */

/**
 * Convert Uint8Array to base64url string.
 * Browser: uses btoa
 * Node: uses Buffer
 */
export function uint8ArrayToBase64url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	// Use Buffer in Node.js, btoa in browser
	const base64 = typeof Buffer !== 'undefined'
		? Buffer.from(binary, 'binary').toString('base64')
		: btoa(binary);
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Convert base64url string to Uint8Array.
 * Browser: uses atob
 * Node: uses Buffer
 */
export function base64urlToUint8Array(base64url: string): Uint8Array {
	// Pad with '=' to make length a multiple of 4
	const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
	const padding = (4 - (padded.length % 4)) % 4;
	const base64 = padded + '='.repeat(padding);
	
	let binary: string;
	if (typeof Buffer !== 'undefined') {
		binary = Buffer.from(base64, 'base64').toString('binary');
	} else {
		binary = atob(base64);
	}
	
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Convert ArrayBuffer to base64url string.
 */
export function arrayBufferToBase64url(buffer: ArrayBuffer): string {
	return uint8ArrayToBase64url(new Uint8Array(buffer));
}

/**
 * Convert base64url string to ArrayBuffer.
 */
export function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
	return base64urlToUint8Array(base64url).buffer;
}
