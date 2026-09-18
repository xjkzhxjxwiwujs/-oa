package com.campus.reimburse.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class CryptoService {
    private final byte[] key;
    private final SecureRandom random = new SecureRandom();

    public CryptoService(@Value("${campus.aes-key}") String keyB64) {
        this.key = Base64.getDecoder().decode(keyB64);
    }

    public String encrypt(String plain) {
        if (plain == null || plain.isBlank()) {
            return null;
        }
        try {
            byte[] iv = new byte[12];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            byte[] enc = cipher.doFinal(plain.getBytes());
            byte[] out = new byte[iv.length + enc.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(enc, 0, out, iv.length, enc.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("encrypt failed", e);
        }
    }

    public String decrypt(String packed) {
        if (packed == null || packed.isBlank()) {
            return null;
        }
        try {
            byte[] all = Base64.getDecoder().decode(packed);
            byte[] iv = new byte[12];
            System.arraycopy(all, 0, iv, 0, 12);
            byte[] enc = new byte[all.length - 12];
            System.arraycopy(all, 12, enc, 0, enc.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(enc));
        } catch (Exception e) {
            return null;
        }
    }

    public String maskAccount(String enc) {
        String p = decrypt(enc);
        if (p == null || p.length() < 8) {
            return p == null ? null : "****";
        }
        return p.substring(0, 4) + " **** **** " + p.substring(p.length() - 4);
    }
}
