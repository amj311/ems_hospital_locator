package com.simplyoliveapps.beacon;

import android.util.Base64;
import com.goterl.lazysodium.SodiumAndroid;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import org.json.JSONObject;

/** Cryptographic encoding compatible with core/utils/crypto.ts encryptLocation(). */
final class LocationCrypto {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int NONCE_LENGTH = 24;
    private static final int TAG_LENGTH_BYTES = 16;

    static JSONObject encrypt(byte[] groupKey, JSONObject location) throws Exception {
        byte[] nonce = new byte[NONCE_LENGTH];
        RANDOM.nextBytes(nonce);

        byte[] key = MessageDigest.getInstance("SHA-256").digest(groupKey);
        byte[] plaintext = location.toString().getBytes(StandardCharsets.UTF_8);
        byte[] ciphertext = new byte[plaintext.length + TAG_LENGTH_BYTES];
        long[] ciphertextLength = new long[1];
        SodiumAndroid sodium = new SodiumAndroid();
        if (sodium.sodium_init() < 0 || sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
            ciphertext,
            ciphertextLength,
            plaintext,
            plaintext.length,
            null,
            0,
            null,
            nonce,
            key
        ) != 0) {
            throw new IllegalStateException("Location encryption failed");
        }
        ciphertext = java.util.Arrays.copyOf(ciphertext, (int) ciphertextLength[0]);

        JSONObject encrypted = new JSONObject();
        encrypted.put("nonce_64url", base64Url(nonce));
        encrypted.put("ciphertext_64url", base64Url(ciphertext));
        encrypted.put("keyId", verificationCode(groupKey));
        return encrypted;
    }

    static byte[] fromBase64Url(String value) {
        return Base64.decode(value, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    private static String base64Url(byte[] value) {
        return Base64.encodeToString(value, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    private static String verificationCode(byte[] groupKey) throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(groupKey);
        long numericCode = ((hash[0] & 0xffL) << 24)
            | ((hash[1] & 0xffL) << 16)
            | ((hash[2] & 0xffL) << 8)
            | (hash[3] & 0xffL);
        return String.format(java.util.Locale.ROOT, "%06d", numericCode % 1_000_000L);
    }

    private LocationCrypto() {}
}