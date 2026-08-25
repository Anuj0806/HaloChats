import api from "./api";

/* ============================================================
   GROUPS API

   The server owns group membership; the local database only
   mirrors it for offline display. Anything that changes who is in
   a group goes through here.
============================================================ */

export async function createGroup({ name, avatarId, memberPhones }) {
  const { data } = await api.post("/api/groups", {
    name: name.trim(),
    avatarId: avatarId || null,
    memberPhones,
  });

  return data?.data ?? null;
}

export async function listGroups() {
  const { data } = await api.get("/api/groups");
  return data?.data ?? [];
}

export async function getGroup(groupId) {
  const { data } = await api.get(`/api/groups/${encodeURIComponent(groupId)}`);
  return data?.data ?? null;
}

export async function updateGroup(groupId, { name, avatarId }) {
  const { data } = await api.put(`/api/groups/${encodeURIComponent(groupId)}`, {
    name: name.trim(),
    avatarId: avatarId || null,
  });

  return data?.data ?? null;
}

export async function addGroupMembers(groupId, memberPhones) {
  const { data } = await api.post(`/api/groups/${encodeURIComponent(groupId)}/members`, {
    memberPhones,
  });

  return data?.data ?? null;
}

/** Also how you leave: pass your own number. */
export async function removeGroupMember(groupId, memberPhone) {
  const { data } = await api.delete(
    `/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberPhone)}`
  );

  return data?.data ?? null;
}
