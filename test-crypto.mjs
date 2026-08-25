/*
 * Tests for the sealed-chat crypto.
 *
 * Crypto fails silently: wrong-but-consistent code round-trips fine
 * and looks correct. These tests therefore check the properties that
 * actually matter - that two parties agree, that a third party
 * doesn't, that tampering is detected, and that nonces never repeat.
 *
 *   npm run test:crypto
 */
import {
  canonicalJwk,
  deriveConversationKey,
  fingerprintOf,
  fromBase64,
  isSealedChatSupported,
  openMessage,
  sealMessage,
  toBase64,
} from "./src/lib/e2ee.js";

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function checkThat(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

async function checkThrows(name, fn) {
  try {
    await fn();
    failed += 1;
    console.log(`  FAIL  ${name}\n        expected it to throw, but it resolved`);
  } catch {
    passed += 1;
    console.log(`  PASS  ${name}`);
  }
}

const subtle = globalThis.crypto.subtle;
const ECDH = { name: "ECDH", namedCurve: "P-256" };

async function makeIdentity() {
  const pair = await subtle.generateKey(ECDH, true, ["deriveKey", "deriveBits"]);
  return {
    privateKey: pair.privateKey,
    publicJwk: await subtle.exportKey("jwk", pair.publicKey),
  };
}

console.log("\nenvironment");
checkThat("Web Crypto is available", isSealedChatSupported());

console.log("\nbase64");
const bytes = new Uint8Array([0, 1, 250, 255, 128, 64]);
check("round-trips bytes", Array.from(fromBase64(toBase64(bytes))), Array.from(bytes));

// The chunked encoder exists because spreading a big array into
// String.fromCharCode overflows the argument limit.
// getRandomValues refuses more than 65,536 bytes per call, so fill
// the buffer in chunks.
const big = new Uint8Array(200000);
for (let offset = 0; offset < big.length; offset += 65536) {
  globalThis.crypto.getRandomValues(big.subarray(offset, Math.min(offset + 65536, big.length)));
}
checkThat(
  "handles a payload larger than the argument limit",
  fromBase64(toBase64(big)).length === big.length
);

console.log("\nkey agreement");

const alice = await makeIdentity();
const bob = await makeIdentity();
const eve = await makeIdentity();

const aliceKey = await deriveConversationKey(alice.privateKey, bob.publicJwk);
const bobKey = await deriveConversationKey(bob.privateKey, alice.publicJwk);

// The whole premise: both sides reach the same key over a channel
// that never carried it.
const probe = "meet at the usual place";
const sealed = await sealMessage(aliceKey, probe);
check("both sides derive the same key", await openMessage(bobKey, sealed.ciphertext, sealed.iv), probe);

const eveKey = await deriveConversationKey(eve.privateKey, alice.publicJwk);
await checkThrows("an outsider's key can't open it", () =>
  openMessage(eveKey, sealed.ciphertext, sealed.iv)
);

console.log("\nmessages");

check("round-trips plain text", await (async () => {
  const m = await sealMessage(aliceKey, "hello");
  return openMessage(bobKey, m.ciphertext, m.iv);
})(), "hello");

const unicode = "emoji 🔐 and ünïcødé and 中文";
check("round-trips unicode", await (async () => {
  const m = await sealMessage(aliceKey, unicode);
  return openMessage(bobKey, m.ciphertext, m.iv);
})(), unicode);

check("round-trips an empty message", await (async () => {
  const m = await sealMessage(aliceKey, "");
  return openMessage(bobKey, m.ciphertext, m.iv);
})(), "");

const long = "x".repeat(50000);
checkThat("round-trips a long message", await (async () => {
  const m = await sealMessage(aliceKey, long);
  return (await openMessage(bobKey, m.ciphertext, m.iv)) === long;
})());

console.log("\nnonces");

// Reusing a nonce under one key breaks GCM completely. This is the
// single most important property to hold.
const nonces = new Set();
for (let i = 0; i < 300; i += 1) {
  const m = await sealMessage(aliceKey, "same text every time");
  nonces.add(m.iv);
}
check("300 messages produce 300 distinct nonces", nonces.size, 300);

const a = await sealMessage(aliceKey, "identical");
const b = await sealMessage(aliceKey, "identical");
checkThat(
  "identical plaintext gives different ciphertext",
  a.ciphertext !== b.ciphertext,
  "ciphertext is deterministic - the nonce isn't being applied"
);

console.log("\ntampering");

const target = await sealMessage(aliceKey, "transfer 100");

const flipped = fromBase64(target.ciphertext);
flipped[2] ^= 0x01;
await checkThrows("a flipped ciphertext bit is rejected", () =>
  openMessage(bobKey, toBase64(flipped), target.iv)
);

const wrongIv = toBase64(globalThis.crypto.getRandomValues(new Uint8Array(12)));
await checkThrows("a substituted nonce is rejected", () =>
  openMessage(bobKey, target.ciphertext, wrongIv)
);

await checkThrows("garbage input is rejected", () => openMessage(bobKey, "not-base64!!", target.iv));

console.log("\nfingerprints");

const printA = await fingerprintOf(alice.publicJwk);
check("is stable for the same key", await fingerprintOf(alice.publicJwk), printA);
checkThat("differs between keys", (await fingerprintOf(bob.publicJwk)) !== printA);
check("is 8 groups of 5", printA.split(" ").length, 8);
checkThat("is uppercase hex", /^[0-9A-F ]+$/.test(printA), printA);

// Field order varies between the browser that exported a key and any
// code that parsed and re-serialised it. If canonicalisation didn't
// sort, the two sides would show different safety numbers for the
// same key and the comparison would be worthless.
const shuffled = {
  y: alice.publicJwk.y,
  kty: alice.publicJwk.kty,
  crv: alice.publicJwk.crv,
  x: alice.publicJwk.x,
  ext: true,
  key_ops: [],
};
check("ignores JWK field order and extras", await fingerprintOf(shuffled), printA);
check("accepts a JWK as a JSON string", await fingerprintOf(JSON.stringify(alice.publicJwk)), printA);

check(
  "canonical form contains only the defining fields",
  Object.keys(JSON.parse(canonicalJwk(shuffled))),
  ["crv", "kty", "x", "y"]
);

console.log("\nkey separation");

// A different salt must yield a different key, or every conversation
// between the same pair would share one.
const otherContext = await deriveConversationKey(alice.privateKey, bob.publicJwk, "different-salt");
const sealedOther = await sealMessage(otherContext, "context bound");
await checkThrows("a different salt yields a different key", () =>
  openMessage(bobKey, sealedOther.ciphertext, sealedOther.iv)
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
