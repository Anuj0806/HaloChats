/* ============================================================
   SEALED CHAT - END TO END ENCRYPTION

   ECDH P-256 for key agreement, HKDF-SHA256 to turn the shared
   secret into a key, AES-GCM to encrypt. All via the browser's
   built-in Web Crypto - no crypto library, and nothing here rolls
   its own primitive.

   What this replaces: the previous "private chat" used AES-ECB with
   a single key hardcoded into both the server and the shipped
   frontend bundle, and the server decrypted every message. That is
   not end-to-end encryption in any sense; anyone with the repo
   could read everything.

   What this does and doesn't protect:

     - The server relays ciphertext it has no key for. It cannot
       read message contents.
     - It CAN see who is talking to whom and when. Sealed chat hides
       content, not metadata.
     - The server distributes public keys, so it could hand each
       side a key it controls and read everything. Nothing in code
       can prevent that. The only defence is the two people
       comparing fingerprints out of band, which is why
       fingerprintOf() exists and the UI surfaces it.
     - One key per account. Signing in on another browser generates
       a new key, and older sealed conversations can't be read
       there. Real messengers solve this with per-device keys and a
       ratchet; this deliberately does not pretend to.
============================================================ */

const KEY_STORE = "halo.sealed.keypair";

const ECDH_PARAMS = { name: "ECDH", namedCurve: "P-256" };
const AES_PARAMS = { name: "AES-GCM", length: 256 };

/** 96 bits is the nonce size AES-GCM is designed around. */
const IV_BYTES = 12;

function subtle() {
  const crypto = globalThis.crypto;

  if (!crypto?.subtle) {
    // Web Crypto is unavailable on insecure origins. Better to say so
    // than to silently fall back to something weaker.
    throw new Error(
      "Sealed chat needs a secure context (https, or localhost). Your browser hasn't provided one."
    );
  }

  return crypto.subtle;
}

export function isSealedChatSupported() {
  return Boolean(globalThis.crypto?.subtle);
}

/* ---------- base64 helpers ---------- */

export function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  // Chunked: spreading a large array into String.fromCharCode blows
  // the argument limit on messages of any real size.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }

  return btoa(binary);
}

export function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/* ---------- identity keys ---------- */

/**
 * Loads this device's keypair, generating one on first use.
 *
 * The private key is stored as a JWK in localStorage. That is a real
 * weakness - anything running in the page can read it - and it is the
 * honest trade for a browser app with no native keystore. It is
 * documented rather than dressed up.
 */
export async function loadOrCreateIdentity() {
  const stored = readStoredIdentity();

  if (stored) {
    try {
      const privateKey = await subtle().importKey(
        "jwk",
        stored.privateJwk,
        ECDH_PARAMS,
        true,
        ["deriveKey", "deriveBits"]
      );

      const publicKey = await subtle().importKey("jwk", stored.publicJwk, ECDH_PARAMS, true, []);

      return {
        privateKey,
        publicKey,
        publicJwk: stored.publicJwk,
        fingerprint: await fingerprintOf(stored.publicJwk),
      };
    } catch (error) {
      // A corrupt or outdated stored key shouldn't lock someone out
      // of sealed chat forever; regenerate and re-publish.
      console.warn("Stored sealed-chat key was unusable, generating a new one:", error.message);
    }
  }

  const pair = await subtle().generateKey(ECDH_PARAMS, true, ["deriveKey", "deriveBits"]);

  const publicJwk = await subtle().exportKey("jwk", pair.publicKey);
  const privateJwk = await subtle().exportKey("jwk", pair.privateKey);

  localStorage.setItem(KEY_STORE, JSON.stringify({ publicJwk, privateJwk }));

  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicJwk,
    fingerprint: await fingerprintOf(publicJwk),
  };
}

function readStoredIdentity() {
  try {
    const raw = localStorage.getItem(KEY_STORE);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.publicJwk || !parsed?.privateJwk) return null;

    return parsed;
  } catch {
    return null;
  }
}

/** Wipes this device's identity. Every past sealed chat becomes unreadable. */
export function forgetIdentity() {
  localStorage.removeItem(KEY_STORE);
}

/* ---------- fingerprints ---------- */

/**
 * The safety number two people compare out of band.
 *
 * Must match the server's format exactly, or the UI would show two
 * different strings for the same key and the comparison would be
 * meaningless. Server side is KeyDirectoryServiceImpl.fingerprint():
 * SHA-256 of the canonical JWK JSON, uppercase hex, first 40
 * characters in groups of five.
 */
export async function fingerprintOf(publicJwk) {
  const canonical = canonicalJwk(publicJwk);

  const digest = await subtle().digest("SHA-256", new TextEncoder().encode(canonical));

  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  const groups = [];
  for (let i = 0; i < 40; i += 5) {
    groups.push(hex.slice(i, i + 5));
  }

  return groups.join(" ");
}

/**
 * JSON.stringify key order follows insertion order, which differs
 * between the browser that exported the key and any code that parsed
 * and re-serialised it. Sorting makes the bytes - and therefore the
 * fingerprint - stable on both sides.
 */
export function canonicalJwk(jwk) {
  const source = typeof jwk === "string" ? JSON.parse(jwk) : jwk;

  // Only the fields that define the key. Browsers add extras like
  // key_ops and ext that vary and would change the digest.
  const fields = ["crv", "kty", "x", "y"];

  const ordered = {};
  fields.forEach((field) => {
    if (source[field] !== undefined) ordered[field] = source[field];
  });

  return JSON.stringify(ordered);
}

/* ---------- shared secret ---------- */

/**
 * Derives the conversation key from our private key and their public
 * key. Both sides compute the same value without it ever crossing the
 * network - that is the point of ECDH.
 *
 * The raw ECDH output is not used directly as an AES key: it isn't
 * uniformly random. HKDF turns it into something that is.
 */
export async function deriveConversationKey(privateKey, peerPublicJwk, salt = "halo-sealed-v1") {
  const peerKey = await subtle().importKey(
    "jwk",
    typeof peerPublicJwk === "string" ? JSON.parse(peerPublicJwk) : peerPublicJwk,
    ECDH_PARAMS,
    true,
    []
  );

  const sharedBits = await subtle().deriveBits(
    { name: "ECDH", public: peerKey },
    privateKey,
    256
  );

  const hkdfKey = await subtle().importKey("raw", sharedBits, "HKDF", false, ["deriveKey"]);

  return subtle().deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      info: new TextEncoder().encode("halo sealed conversation"),
    },
    hkdfKey,
    AES_PARAMS,
    false,
    ["encrypt", "decrypt"]
  );
}

/* ---------- messages ---------- */

export async function sealMessage(conversationKey, plaintext) {
  // A fresh random nonce per message. Reusing one under the same key
  // is catastrophic for GCM - it leaks the plaintext XOR and breaks
  // authentication entirely.
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const ciphertext = await subtle().encrypt(
    { name: "AES-GCM", iv },
    conversationKey,
    new TextEncoder().encode(plaintext)
  );

  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) };
}

export async function openMessage(conversationKey, ciphertextBase64, ivBase64) {
  try {
    const plaintext = await subtle().decrypt(
      { name: "AES-GCM", iv: fromBase64(ivBase64) },
      conversationKey,
      fromBase64(ciphertextBase64)
    );

    return new TextDecoder().decode(plaintext);
  } catch {
    // GCM authentication failed. The message was corrupted, replayed
    // from another conversation, or encrypted to a different key.
    // There is no partial result to salvage and no detail worth
    // leaking, so all failures look the same.
    throw new Error("This message couldn't be decrypted. It may have been tampered with.");
  }
}
