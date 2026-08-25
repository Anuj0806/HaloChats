import api from "./api";

/* ============================================================
   PRIVATE ROOM PIN

   Purely an access-control gate in front of the Private Room tab -
   see the backend's PrivateRoomPin entity for why it is never used
   as key material for the sealed chat itself. This service only
   ever sends the 4-digit PIN over the already-authenticated,
   already-encrypted (in production, over https) connection to the
   backend, which hashes it before storage.
============================================================ */

export async function fetchPinStatus() {
  const { data } = await api.get("/api/private-room/pin/status");
  return data?.data ?? { hasPin: false, locked: false, lockedForSeconds: 0 };
}

export async function setPrivateRoomPin({ currentPin, newPin }) {
  const { data } = await api.post("/api/private-room/pin", { currentPin, newPin });
  return data;
}

export async function verifyPrivateRoomPin(pin) {
  const { data } = await api.post("/api/private-room/pin/verify", { pin });
  return data;
}

/**
 * Recovers a forgotten PIN using the account password - the
 * stronger credential the person already used to sign in with, and
 * the only reasonable way back in if the PIN itself is forgotten.
 * Clears any active lockout.
 */
export async function resetPrivateRoomPin({ accountPassword, newPin }) {
  const { data } = await api.post("/api/private-room/pin/reset", { accountPassword, newPin });
  return data;
}
