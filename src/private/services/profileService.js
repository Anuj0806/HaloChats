import api from "./api";
import { API_BASE, API_BASE_PUBLIC } from "../constant/config";

/* ============================================================
   PROFILE + DIRECTORY API
============================================================ */

export async function fetchMyProfile() {
  const { data } = await api.get("/api/profile/me");
  return data?.data ?? null;
}

export async function updateMyProfile({ name, about, avatarId, city }) {
  const { data } = await api.put("/api/profile/me", { name, about, avatarId, city });
  return data?.data ?? null;
}

/**
 * Finds people by name or phone. Excludes the caller so nobody is
 * offered a chat with themselves.
 */
export async function searchDirectory(term, selfPhone) {
  const { data } = await api.get("/api/profile/search", {
    params: { q: term, self: selfPhone || "" },
  });

  return data?.data ?? [];
}

/**
 * Single-user lookup by exact phone. Uses fetch rather than the axios
 * instance because it's also called from inside WebSocket handlers
 * where a 404 is an expected, uninteresting outcome.
 */
export async function lookupByPhone(phone) {
  try {
    const response = await fetch(`${API_BASE_PUBLIC}/get/${encodeURIComponent(phone)}`);
    if (!response.ok) return null;

    const user = await response.json();
    return user?.phone ? user : null;
  } catch {
    return null;
  }
}

export async function isOnline(phone) {
  try {
    const response = await fetch(`${API_BASE}/isOnline/${encodeURIComponent(phone)}`);
    if (!response.ok) return false;
    return await response.json();
  } catch {
    return false;
  }
}
