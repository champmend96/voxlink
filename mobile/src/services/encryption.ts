import nacl from "tweetnacl";
import { encode as encodeBase64, decode as decodeBase64 } from "tweetnacl-util";
import * as SecureStore from "expo-secure-store";

const PRIVATE_KEY_STORE_KEY = "voxlink_e2e_private_key";
const PUBLIC_KEY_STORE_KEY = "voxlink_e2e_public_key";

export interface KeyPair {
  publicKey: string; // base64
  privateKey: string; // base64
}

class EncryptionService {
  private keyPair: nacl.BoxKeyPair | null = null;
  private sharedSecretCache = new Map<string, Uint8Array>();

  async initialize(): Promise<string> {
    const storedPrivateKey = await SecureStore.getItemAsync(PRIVATE_KEY_STORE_KEY);
    const storedPublicKey = await SecureStore.getItemAsync(PUBLIC_KEY_STORE_KEY);

    if (storedPrivateKey && storedPublicKey) {
      const privateKey = decodeBase64(storedPrivateKey);
      this.keyPair = {
        publicKey: decodeBase64(storedPublicKey),
        secretKey: privateKey,
      };
    } else {
      this.keyPair = nacl.box.keyPair();
      await SecureStore.setItemAsync(
        PRIVATE_KEY_STORE_KEY,
        encodeBase64(this.keyPair.secretKey)
      );
      await SecureStore.setItemAsync(
        PUBLIC_KEY_STORE_KEY,
        encodeBase64(this.keyPair.publicKey)
      );
    }

    return encodeBase64(this.keyPair.publicKey);
  }

  getPublicKey(): string | null {
    if (!this.keyPair) return null;
    return encodeBase64(this.keyPair.publicKey);
  }

  private deriveSharedSecret(theirPublicKeyBase64: string): Uint8Array {
    const cached = this.sharedSecretCache.get(theirPublicKeyBase64);
    if (cached) return cached;

    if (!this.keyPair) {
      throw new Error("Encryption not initialized");
    }

    const theirPublicKey = decodeBase64(theirPublicKeyBase64);
    const sharedSecret = nacl.box.before(theirPublicKey, this.keyPair.secretKey);
    this.sharedSecretCache.set(theirPublicKeyBase64, sharedSecret);
    return sharedSecret;
  }

  encrypt(plaintext: string, recipientPublicKeyBase64: string): string {
    const sharedSecret = this.deriveSharedSecret(recipientPublicKeyBase64);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageBytes = new TextEncoder().encode(plaintext);

    const encrypted = nacl.box.after(messageBytes, nonce, sharedSecret);
    if (!encrypted) {
      throw new Error("Encryption failed");
    }

    // Combine nonce + ciphertext and encode as base64
    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);

    return encodeBase64(combined);
  }

  decrypt(ciphertextBase64: string, senderPublicKeyBase64: string): string | null {
    try {
      const sharedSecret = this.deriveSharedSecret(senderPublicKeyBase64);
      const combined = decodeBase64(ciphertextBase64);

      const nonce = combined.slice(0, nacl.box.nonceLength);
      const ciphertext = combined.slice(nacl.box.nonceLength);

      const decrypted = nacl.box.open.after(ciphertext, nonce, sharedSecret);
      if (!decrypted) {
        return null;
      }

      return new TextDecoder().decode(decrypted);
    } catch {
      return null;
    }
  }

  clearCache(): void {
    this.sharedSecretCache.clear();
  }

  async clearKeys(): Promise<void> {
    await SecureStore.deleteItemAsync(PRIVATE_KEY_STORE_KEY);
    await SecureStore.deleteItemAsync(PUBLIC_KEY_STORE_KEY);
    this.keyPair = null;
    this.sharedSecretCache.clear();
  }
}

export const encryptionService = new EncryptionService();
