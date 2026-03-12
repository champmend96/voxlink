import nacl from "tweetnacl";
import { encode as encodeBase64, decode as decodeBase64 } from "tweetnacl-util";

// Test encryption primitives directly since the service depends on SecureStore
describe("Encryption Service", () => {
  describe("Key pair generation", () => {
    it("should generate a valid key pair", () => {
      const keyPair = nacl.box.keyPair();
      expect(keyPair.publicKey).toHaveLength(32);
      expect(keyPair.secretKey).toHaveLength(32);
    });

    it("should generate different key pairs each time", () => {
      const kp1 = nacl.box.keyPair();
      const kp2 = nacl.box.keyPair();
      expect(encodeBase64(kp1.publicKey)).not.toBe(encodeBase64(kp2.publicKey));
      expect(encodeBase64(kp1.secretKey)).not.toBe(encodeBase64(kp2.secretKey));
    });
  });

  describe("Encrypt/Decrypt roundtrip", () => {
    it("should encrypt and decrypt a message successfully", () => {
      const sender = nacl.box.keyPair();
      const receiver = nacl.box.keyPair();

      const plaintext = "Hello, this is a secret message!";
      const messageBytes = new TextEncoder().encode(plaintext);
      const nonce = nacl.randomBytes(nacl.box.nonceLength);

      // Encrypt
      const sharedSecretSender = nacl.box.before(receiver.publicKey, sender.secretKey);
      const encrypted = nacl.box.after(messageBytes, nonce, sharedSecretSender);
      expect(encrypted).not.toBeNull();

      // Decrypt
      const sharedSecretReceiver = nacl.box.before(sender.publicKey, receiver.secretKey);
      const decrypted = nacl.box.open.after(encrypted!, nonce, sharedSecretReceiver);
      expect(decrypted).not.toBeNull();

      const decryptedText = new TextDecoder().decode(decrypted!);
      expect(decryptedText).toBe(plaintext);
    });

    it("should produce different ciphertext with different keys", () => {
      const sender = nacl.box.keyPair();
      const receiver1 = nacl.box.keyPair();
      const receiver2 = nacl.box.keyPair();

      const message = new TextEncoder().encode("Same message");
      const nonce = nacl.randomBytes(nacl.box.nonceLength);

      const shared1 = nacl.box.before(receiver1.publicKey, sender.secretKey);
      const shared2 = nacl.box.before(receiver2.publicKey, sender.secretKey);

      const enc1 = nacl.box.after(message, nonce, shared1);
      const enc2 = nacl.box.after(message, nonce, shared2);

      expect(encodeBase64(enc1!)).not.toBe(encodeBase64(enc2!));
    });

    it("should fail to decrypt with wrong key", () => {
      const sender = nacl.box.keyPair();
      const receiver = nacl.box.keyPair();
      const wrongKey = nacl.box.keyPair();

      const message = new TextEncoder().encode("Secret message");
      const nonce = nacl.randomBytes(nacl.box.nonceLength);

      const sharedSecret = nacl.box.before(receiver.publicKey, sender.secretKey);
      const encrypted = nacl.box.after(message, nonce, sharedSecret);

      // Try to decrypt with wrong shared secret
      const wrongShared = nacl.box.before(sender.publicKey, wrongKey.secretKey);
      const decrypted = nacl.box.open.after(encrypted!, nonce, wrongShared);

      expect(decrypted).toBeNull();
    });
  });

  describe("Key derivation from shared secret", () => {
    it("should derive identical shared secrets from both sides", () => {
      const alice = nacl.box.keyPair();
      const bob = nacl.box.keyPair();

      const sharedAlice = nacl.box.before(bob.publicKey, alice.secretKey);
      const sharedBob = nacl.box.before(alice.publicKey, bob.secretKey);

      expect(encodeBase64(sharedAlice)).toBe(encodeBase64(sharedBob));
    });
  });

  describe("Combined nonce + ciphertext encoding", () => {
    it("should correctly combine and split nonce + ciphertext", () => {
      const sender = nacl.box.keyPair();
      const receiver = nacl.box.keyPair();

      const plaintext = "Test message for encoding";
      const messageBytes = new TextEncoder().encode(plaintext);
      const nonce = nacl.randomBytes(nacl.box.nonceLength);

      const sharedSecret = nacl.box.before(receiver.publicKey, sender.secretKey);
      const encrypted = nacl.box.after(messageBytes, nonce, sharedSecret);

      // Combine nonce + ciphertext
      const combined = new Uint8Array(nonce.length + encrypted!.length);
      combined.set(nonce);
      combined.set(encrypted!, nonce.length);

      const encoded = encodeBase64(combined);

      // Split back
      const decoded = decodeBase64(encoded);
      const extractedNonce = decoded.slice(0, nacl.box.nonceLength);
      const extractedCiphertext = decoded.slice(nacl.box.nonceLength);

      const receiverShared = nacl.box.before(sender.publicKey, receiver.secretKey);
      const decrypted = nacl.box.open.after(extractedCiphertext, extractedNonce, receiverShared);

      expect(new TextDecoder().decode(decrypted!)).toBe(plaintext);
    });
  });
});
