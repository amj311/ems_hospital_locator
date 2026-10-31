App Overview

The app allows a producer device to share encrypted location updates with selected receiver devices.

The producer encrypts each location update locally using a shared symmetric key. Authorized receivers obtain that key through a secure pairing process, download encrypted records, and decrypt them locally. Receivers store and evaluate alert rules on their own devices.

The server provides authentication, access control, encrypted storage, synchronization, and generic push notifications. It must not have access to the location-encryption keys, plaintext locations, or receiver-side alert rules.

System Components

Producer device

- Obtains its current location.
- Generates and manages sharing-group keys.
- Encrypts location updates locally.
- Uploads encrypted records to the server.
- Shares keys with authorized receivers through approved secure-transfer methods.
- Rotates keys when receiver access changes.


Receiver device

- Securely imports a sharing key.
- Stores the key in protected device storage.
- Downloads encrypted location records.
- Decrypts records locally.
- Stores alert rules locally.
- Evaluates locations against local alert rules.
- Generates local notifications.
- Tracks synchronization state.


Server

- Authenticates accounts and devices.
- Maintains producer–receiver access relationships.
- Stores encrypted location records.
- Serves records only to authorized receivers.
- Sends generic synchronization notifications.
- Must never receive or recover sharing keys.
- Must never decrypt location records or evaluate alert rules.


Key-management layer

- Generates cryptographically random symmetric keys.
- Supports secure key transfer.
- Stores keys only in protected device storage.
- Tracks key versions.
- Supports key rotation and receiver removal.
- Prevents use of expired or revoked keys for new records.

Encryption Requirements

Symmetric encryption

- The app must use an authenticated encryption algorithm such as XChaCha20-Poly1305.
- AES-256-GCM may be used only with a correctly implemented nonce-management strategy.
- Cryptographic operations must use a vetted platform or third-party library.
- The app must not implement cryptographic primitives itself.
- Each sharing group must have a cryptographically random 256-bit symmetric key.
- Each location update must be encrypted before it leaves the producer device.
- The server must receive only encrypted location records.


Location-record format

Each encrypted record must include:

```json


{
  "record_id": "random-record-id",
  "producer_id": "opaque-producer-id",
  "sequence": 1842,
  "created_at": "2026-09-08T12:34:56Z",
  "key_version": 3,
  "nonce": "...",
  "ciphertext": "..."
}
```

The plaintext location payload may contain:

```json
{
  "latitude": 51.5007,
  "longitude": -0.1246,
  "accuracy_m": 20,
  "timestamp": "2026-09-08T12:34:56Z"
}
```

Coordinates must never appear in filenames, URLs, push notifications, record IDs, or unencrypted metadata.

Encryption procedure

For each location update:

- Serialize the location record using a canonical format.
- Retrieve the current sharing-group key.
- Generate a fresh random nonce.
- Authenticate relevant metadata as associated data.
- Encrypt the location payload with XChaCha20-Poly1305.
- Upload the nonce, ciphertext, and required metadata.


Conceptually:

```text


ciphertext =
    XChaCha20-Poly1305-Encrypt(
        key = group_key,
        nonce = fresh_random_nonce,
        plaintext = location_payload,
        associated_data =
            protocol_version ||
            producer_id ||
            record_id ||
            sequence ||
            key_version
    )

```

Requirements:

- A nonce must never be reused with the same key.
- The nonce may be stored beside the ciphertext.
- The nonce does not need to be secret.
- The authentication tag must be retained with the ciphertext.
- Failed authentication must cause the record to be rejected.


Decryption procedure

When a receiver downloads a record:

- Confirm that the receiver is authorized for the producer and key version.
- Retrieve the corresponding sharing key from protected storage.
- Reconstruct the associated data exactly.
- Decrypt and authenticate the ciphertext.
- Reject the record if authentication fails.
- Validate the sequence number and timestamp.
- Evaluate local alert rules only after successful decryption.


Conceptually:

```text


location_payload =
    XChaCha20-Poly1305-Decrypt(
        key = group_key,
        nonce = record.nonce,
        ciphertext = record.ciphertext,
        associated_data =
            protocol_version ||
            record.producer_id ||
            record.record_id ||
            record.sequence ||
            record.key_version
    )

```

Key storage

- Keys must be stored using platform-protected storage.
- iOS devices should use Keychain, with Secure Enclave protection where applicable.
- Android devices should use Android Keystore, with hardware-backed protection where available.
- Keys must not be stored in plaintext files, ordinary preferences, logs, URLs, analytics events, or push payloads.
- Keys must not be included in server API responses after initial provisioning unless they are encrypted for the intended device.
- The app must minimize the time keys remain in ordinary application memory.
- Debug builds must not log keys or plaintext location data.

Key-Sharing Requirements

Preferred pairing method: QR-code transfer

The primary key-sharing method should be in-person QR-code pairing.

The pairing flow must:

- Generate a random sharing-group key.
- Display a temporary QR code on the producer device.
- Allow the receiver to scan the QR code.
- Display a short verification code or fingerprint on both devices.
- Require users to confirm that the codes match.
- Store the imported key in protected device storage.
- Expire and invalidate the QR payload after successful use or a short timeout.
- Prevent QR contents from appearing in logs, screenshots, or application history where practical.
- The QR code must not contain an ordinary account password or short PIN as the encryption key.

Alternative secure transfer methods

The app may support:

- Device-to-device encrypted transfer after user verification.
- Transfer through an existing authenticated end-to-end encrypted channel.
- A high-entropy recovery passphrase processed with Argon2id.
- A public-key-wrapped symmetric key for remote or large-scale sharing.
- If a short PIN is used for pairing, it must authenticate the pairing process only. It must not directly serve as the encryption key.

Key fingerprints

- Each sharing key must have a non-secret fingerprint.
- The fingerprint must be displayable on both devices.
- Users must be able to compare fingerprints during pairing.
- A changed fingerprint must produce a clear warning.
- The app must not silently replace an existing sharing key.


Key Rotation and Revocation

- Each sharing group must have a key version.
- Every encrypted record must include its key version.
- A new key must be generated when a receiver is removed.
- New records must use only the current key version.
- The removed receiver must be prevented from downloading future records.
- Remaining receivers must securely receive the new key before processing new records.
- Old records may remain decryptable by devices that already possess the old key.
- The app must clearly document that revocation cannot erase records already decrypted or copied.
- Key rotation must also be available manually after suspected device compromise.
- Old keys must be deleted from device storage when retention requirements permit.
- For stronger receiver isolation, use separate symmetric keys per producer–receiver relationship:

```text


Producer A ↔ Receiver B: key K_AB
Producer A ↔ Receiver C: key K_AC
```

For simpler group sharing, use one key per group:

```text


Producer A + Receiver B + Receiver C: key K_group
```

The per-relationship model provides better revocation isolation, while the group model requires less key management.

Location-Sharing Requirements

- Producers must periodically obtain their current location.
- Producers must encrypt each update locally.
- Each update must contain an opaque record ID and monotonically increasing sequence number.
- The server must store ciphertext without decrypting it.
- Receivers must download only records shared with them.
- Receivers must process updates in sequence order.
- Receivers must persist the last processed sequence number per producer.
- The system must handle missed, duplicate, delayed, and out-of-order updates.
- Receivers must periodically synchronize even if push notifications are missed.


Local Alert Requirements

- Receivers must store alert rules locally.
- Alert rules must not be uploaded to the server.
- Alert rules must support:
- Producer/device
- Geofence center
- Radius
- Entry condition
- Exit condition
- Enabled/disabled status
- Optional cooldown
- Receivers must evaluate decrypted locations locally.
- Receivers must track previous geofence state.
- Receivers must avoid repeated alerts while a producer remains in the same state.
- Receivers must generate local notifications.
- Receivers must be able to create, edit, disable, pause, and delete alert rules.


Push-Notification Requirements

- The server may send a generic “new data available” notification.
- Push payloads must not contain:
- Coordinates
- Geofence details
- Plaintext locations
- Encryption keys
- Alert results
- Push notifications should contain only opaque identifiers and synchronization information.
- Push notifications must be treated as wake-up hints, not guaranteed delivery.
- Receivers must periodically synchronize independently of push delivery.


Example:

```json


{
  "type": "sync_available",
  "producer_id": "opaque-producer-id",
  "latest_sequence": 1842
}
```

Security User Stories

- As a producer, I want my location encrypted before upload so the server cannot read it.
- As a receiver, I want to import the sharing key through a verified pairing process.
- As a receiver, I want my key stored in protected device storage.
- As a user, I want tampered location records rejected automatically.
- As a user, I want keys excluded from logs, URLs, push notifications, and server responses.
- As a producer, I want to rotate the sharing key when a receiver is removed.
- As a user, I want the server unable to decrypt locations or alert rules.
- As a receiver, I want local alerts to continue working after successful synchronization without sending alert rules to the server.
- As a user, I want to understand that revocation prevents future access but cannot erase data already decrypted by another device.




DEVICE REGISTRATION AND RECOVERY

Cryptographic identities

- Generate a unique asymmetric key pair for every device installation.
- Store each device private key in the platform secure key store where available.
- Generate a separate recovery key pair for each owner/node group.
- Never use the recovery private key as the device’s ordinary authentication key.
- Store only public keys and opaque identifiers on the server.
- Use standard, audited cryptographic libraries and signature algorithms.

Recovery artifact

- Generate the recovery key using a cryptographically secure random-number generator.
- Encode the recovery secret as a versioned QR code or high-entropy word sequence.
- Include a checksum to detect transcription errors.
- Include either:
- a fingerprint-derived recovery_key_id, or
- a random opaque recovery_id.
- Never transmit or store the recovery phrase/private key on the server.
- Do not use a short PIN, password, phone number, email address, or device identifier as the recovery key.


Revocation

- Recovery must support revoking the old device key.
- Revocation must invalidate:
- active sessions;
- refresh tokens;
- capabilities;
- pending operations;
- device-specific encryption access where applicable.
- Revocation must be enforceable server-side immediately.
- Use device status values such as active, suspended, and revoked.
- Do not allow a revoked device to revoke or recover itself.


Recovery-key rotation

- Support replacing the recovery public key.
- Require the current recovery key, a trusted device, or a separate recovery authority to authorize rotation.
- Store a recovery-key version or epoch.
- Invalidate the previous recovery key after successful rotation.
- Require the user to create and confirm a new recovery backup.

Data encryption

- Use separate encryption keys for location-sharing relationships.
- After device revocation, stop encrypting new data for that device.
- Rotate relationship encryption keys when necessary.
- Do not claim that revocation erases data the compromised device already decrypted or copied.


Privacy and operational controls

- Do not use names, email addresses, phone numbers, advertising IDs, IMEIs, or MAC addresses as identifiers.
- Use opaque random IDs or public-key fingerprints.
- Minimize authentication logs.
- Never log recovery secrets, private keys, access tokens, or precise location data.
- Rate-limit recovery attempts and alert remaining trusted devices after recovery or key changes.
- Do not rely on IP address or device fingerprinting to identify the owner.

### Original device registration

- The device connects to the genuine server over authenticated TLS.
- The device generates a unique device key pair:


```text
device_private_key
device_public_key
```

- The device stores device_private_key in secure device storage. It never leaves the device.
- The device generates a separate recovery key pair:

```text
recovery_private_key
recovery_public_key
```

- The device calculates a recovery lookup fingerprint:

```text
recovery_fingerprint = Hash(recovery_public_key)
```

- The device creates a recovery phrase or QR backup containing enough information to recreate the recovery private key and the recovery fingerprint.
- The user saves the recovery phrase offline.
- The device sends the server:


```text
device_public_key
recovery_public_key
recovery_fingerprint
device_id
```

- The server verifies that:

```text
Hash(recovery_public_key) == recovery_fingerprint
```

- The server returns a challenge.
- The device signs the challenge with both private keys.
- The server verifies both signatures and stores the registration.

The server stores public information only:

```text
device_id
recovery_fingerprint
recovery_public_key
device_public_key
device_status
```

The server never receives:

```text
device_private_key
recovery_private_key
recovery_phrase
```

### Normal device authentication

- The device connects to the server.
- The server sends a fresh challenge.
- The device signs the challenge with device_private_key.
- The server verifies the signature using device_public_key.
- If the signature is valid and the device is not revoked, the server permits the requested action.
  - The recovery key is not used for ordinary requests.

### Starting recovery on a new device

- The new device generates a new device key pair:

```text
new_device_private_key
new_device_public_key
```

- The user enters or scans the recovery phrase.
- The new device recreates:

```text
recovery_private_key
recovery_public_key
```

- The new device calculates:

```text
recovery_fingerprint = Hash(recovery_public_key)
```

- The new device sends the fingerprint to the server:

```text
recovery_fingerprint
```

- The server looks up the fingerprint and finds the associated node/group and registered recovery public key.
- The server sends the new device a fresh, single-use recovery challenge.
  - The fingerprint is only a lookup value. It does not grant access by itself.

### Authorizing recovery

- The new device creates a recovery request:

```text
operation = "register new device"
recovery_fingerprint
new_device_public_key
server_challenge
request_id
expiration
```

- The new device signs the complete request with recovery_private_key.
- The new device sends the request and signature to the server.
- The server verifies:
  - the recovery fingerprint matches the recovery public key;
  - the signature is valid;
  - the challenge is fresh and unused;
  - the request ID has not been used;
  - the recovery key is active;
  - the new device public key is valid.
- If all checks pass, the server accepts the recovery request.


### Revoking the old device

The recovery request can specify the old device:

```text
old_device_id
revoke_old_device = true
```

The server verifies that old_device_id belongs to the node/group associated with the recovery fingerprint.

The server then:

- Marks the old device’s public key as revoked.
- Invalidates its active sessions.
- Invalidates its refresh tokens and capabilities.
- Rejects future requests signed by its private key.
- Stops granting it access to future location data.
- Rotates encryption keys that the old device should no longer possess.

The old private key is not deleted remotely. It simply becomes unauthorized.

### Registering the new device

After successful recovery, the server stores:

```text
new_device_public_key
device_id
device_status = active
```

The new device then uses new_device_private_key for normal authentication.

The recovery private key is not used for ordinary API requests.

### Rotating the recovery key

After recovery, the new device generates a new recovery key pair.
It calculates a new fingerprint:

```text
new_recovery_fingerprint = Hash(new_recovery_public_key)
```

- It creates and saves a new recovery phrase.
- It signs a recovery-key replacement request using the current recovery private key.
- The server verifies the signature.
- The server stores the new recovery public key and fingerprint.
- The server invalidates the old recovery key.
- The user confirms that the new recovery backup was saved.



The complete lifecycle is:

```text
Original device:
  generate device key
  generate recovery key
  calculate recovery fingerprint
  register both public keys and fingerprint

Normal use:
  authenticate with device private key

Recovery:
  new device generates new device key
  recovery phrase recreates recovery private key
  recovery fingerprint identifies the node/group
  server returns a challenge
  recovery key signs the recovery request
  server registers the new device key
  server revokes the old device key

After recovery:
  generate a new recovery key
  calculate a new fingerprint
  replace the old recovery key
```


The roles remain separate:

```text
Device private key   → ordinary authentication
Recovery private key → authorize recovery and revocation
Recovery fingerprint → locate the associated node/group
Server public key    → authenticate the server to the device
```




### REQUEST AUTHENTICATION

When the device needs a session token:

http


POST /v1/auth/challenge
Content-Type: application/json

{
  "device_id": "device-123"
}
The server creates a cryptographically random challenge and stores it temporarily:

text


challenge_id: c-789
device_id: device-123
nonce: random 32-byte value
expires_at: now + 2 minutes
used: false
Response:

json


{
  "challenge_id": "c-789",
  "nonce": "base64url-random-nonce",
  "expires_at": "2026-09-21T12:02:00Z"
}
The challenge should be short-lived and single-use.

3. Sign the challenge on the device

The device constructs a canonical message. For example:

text


my-app/auth/v1
device_id=device-123
challenge_id=c-789
nonce=base64url-random-nonce
It signs the exact byte sequence with its private key.

The device then sends:

http


POST /v1/auth/session
Content-Type: application/json

{
  "device_id": "device-123",
  "challenge_id": "c-789",
  "signature": "base64url-signature"
}
The server retrieves the nonce using challenge_id, so the device does not need to send it again.

4. Verify and issue a session token

The server must:

Find the device.
Confirm that the device is active.
Retrieve the stored challenge.
Confirm that it has not expired or been used.
Reconstruct the canonical message exactly.
Verify the signature with the stored public key.
Mark the challenge as used.
Issue a short-lived session token.
Response:

json


{
  "access_token": "opaque-or-signed-token",
  "token_type": "Bearer",
  "expires_in": 900
}
A 15-minute lifetime is a reasonable default.

5. Make API requests

http


GET /v1/device/data
Authorization: Bearer opaque-or-signed-token
The API validates the token and authorizes the request based on the device, scopes, and endpoint.

6. Reauthenticate when needed

If the token expires, the device repeats:

text


request challenge → sign challenge → exchange signature for token
There is no long-lived refresh token in this design.

The device should also reauthenticate if the server returns:

http


401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token"
It should avoid retrying indefinitely; use bounded retries and backoff.

Token requirements

A session token should be:

Short-lived, typically 5–30 minutes
Bound to a specific device
Limited by scopes or permissions
Invalid after device revocation
Unusable before its issued_at time or after its expires_at time
Unpredictable if opaque, using at least 128 bits of randomness
Sent only over HTTPS
If using a signed token such as a JWT, validate:

text


iss  issuer
aud  intended API
sub  device identifier
iat  issued-at time
exp  expiration time
jti  unique token identifier, if revocation or replay tracking is needed
scope permissions
If using opaque tokens, store a hash of the token server-side rather than the raw token where practical.

Challenge requirements

Each challenge should be:

Generated with a cryptographically secure random generator
At least 128 bits; 256 bits is a common choice
Bound to the device ID
Bound to the authentication protocol and version
Valid for only a short period, such as 1–5 minutes
Single-use
Stored atomically so concurrent requests cannot reuse it
Rate-limited per device, account, and IP address
The signed message should include a domain or protocol label, for example:

text


my-app/device-auth/v1
This prevents a signature from being accidentally reused in another part of the system.

Minimal server state

You need persistent device state:

text


devices:
  device_id
  public_key
  status
  key_version
You need temporary challenge state:

text


challenges:
  challenge_id
  device_id
  nonce
  expires_at
  used_at
If tokens are opaque, you also need session state:

text


sessions:
  token_hash
  device_id
  scopes
  created_at
  expires_at
  revoked_at
If tokens are self-contained signed tokens, you can avoid storing every active session, but immediate token revocation becomes harder. At minimum, check the device’s current status on requests or maintain a revocation mechanism.

Recommended failure behavior

Return generic authentication errors rather than revealing whether a device exists:

http


401 Unauthorized
Use 403 Forbidden after successful authentication when the device lacks permission. Do not issue a token if:

The device is unknown or revoked
The challenge is missing, expired, or already used
The signature is invalid
The key version is no longer active
Rate limits have been exceeded
This produces a simple design: the key pair provides durable device identity, the challenge proves possession of the private key, and the short-lived session token handles ordinary API traffic.