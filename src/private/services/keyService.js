import api from "./api";
import { canonicalJwk, fingerprintOf, loadOrCreateIdentity } from "@/lib/e2ee";

/* ============================================================
   KEY DIRECTORY

   IMPORTANT: the canonical JWK string is what gets published, not
   the browser's raw export.

   The server fingerprints whatever string it receives. The client
   fingerprints the canonical form. If those differed - because the
   browser included `ext` and `key_ops`, or ordered fields
   differently - the two sides would display different safety
   numbers for the same key, and users comparing them would see a
   mismatch that means nothing. Publishing the canonical form keeps
   both computations over identical bytes.
============================================================ */

/**
 * Coalesces concurrent callers onto one in-flight request.
 *
 * React StrictMode deliberately double-invokes effects in
 * development, and this function is called from one. Without this
 * guard, two genuinely concurrent publish attempts could each
 * generate work and race each other over the network for no reason -
 * the server-side upsert (see KeyDirectoryServiceImpl) makes that
 * race safe to land, but there's still no reason to make two round
 * trips do the work of one.
 */
let inFlight = null;

export function ensureIdentityPublished() {
  if (inFlight) return inFlight;

  inFlight = doEnsureIdentityPublished().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function doEnsureIdentityPublished() {
  const identity = await loadOrCreateIdentity();
  const canonical = canonicalJwk(identity.publicJwk);

  try {
    const { data } = await api.get("/api/keys/me");
    const published = data?.data;

    // Already correct - don't rewrite the row on every startup.
    if (published?.publicKey === canonical) {
      return { ...identity, published };
    }
  } catch (error) {
    // Only "nothing published yet" is expected and safe to swallow.
    // Anything else - the session expired, the server errored, the
    // network dropped - has to propagate, or the code below would
    // mask it by silently attempting a POST that will just fail the
    // same way and hide what actually went wrong.
    if (error.response?.status !== 404) {
      throw error;
    }
  }

  const { data } = await api.post("/api/keys/me", { publicKey: canonical });

  return { ...identity, published: data?.data ?? null };
}

/**
 * Fetches the key needed to open a sealed chat with someone.
 * Returns null when they've never used sealed chat, which the UI
 * shows as an invitation rather than an error.
 */
export async function fetchPeerKey(phone) {
  try {
    const { data } = await api.get(`/api/keys/${encodeURIComponent(phone)}`);
    const record = data?.data;

    if (!record?.publicKey) return null;

    // Recompute rather than trusting the fingerprint the server sent.
    // A server that substitutes a key would also send a matching
    // fingerprint; deriving it locally means the number shown is the
    // number of the key actually being used.
    const verified = await fingerprintOf(record.publicKey);

    return {
      phone: record.phone,
      publicKey: record.publicKey,
      fingerprint: verified,
      serverFingerprint: record.fingerprint,
      // A mismatch means the server's copy and the key it served
      // disagree. Worth surfacing loudly.
      consistent: verified === record.fingerprint,
      updatedAt: record.updatedAt,
    };
  } catch {
    return null;
  }
}
