import { useState } from "react";
import { LogOut, Pencil, Shield, UserMinus, UserPlus } from "lucide-react";

import Modal from "@/components/halo/Modal";
import Field from "@/components/halo/Field";
import Button from "@/components/halo/Button";
import Alert from "@/components/halo/Alert";
import Avatar from "@/components/halo/Avatar";
import { readError } from "@/lib/format";
import { removeGroupMember, updateGroup } from "../../services/groupService";

/* ============================================================
   GROUP INFO

   Roster, rename, add and remove. Admin-only actions are hidden
   rather than shown-and-rejected, so nobody clicks a button that
   was only ever going to return 403.
============================================================ */

export default function GroupInfoModal({
  open,
  group,
  myPhone,
  onClose,
  onUpdated,
  onLeft,
  onAddPeople,
  onToast,
  onConfirm,
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group?.name || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!group) return null;

  const isAdmin = group.myRole === "ADMIN";
  const members = group.members || [];

  const saveName = async () => {
    if (!name.trim()) {
      setError("The group needs a name");
      return;
    }

    try {
      setSaving(true);
      const updated = await updateGroup(group.groupId, { name, avatarId: group.avatarId });

      onUpdated(updated);
      setEditing(false);
      onToast("Group renamed");
    } catch (err) {
      setError(readError(err, "Couldn't rename the group."));
    } finally {
      setSaving(false);
    }
  };

  const remove = (member) => {
    onConfirm({
      title: `Remove ${member.name}?`,
      description: "They'll stop receiving messages from this group. They can be added again later.",
      confirmLabel: "Remove",
      action: async () => {
        try {
          const updated = await removeGroupMember(group.groupId, member.phone);
          onUpdated(updated);
          onToast(`${member.name} removed`);
        } catch (err) {
          onToast(readError(err, "Couldn't remove them."), "error");
        }
      },
    });
  };

  const leave = () => {
    onConfirm({
      title: `Leave "${group.name}"?`,
      description:
        "You'll stop receiving messages from this group. Your copy of the conversation stays on this device until you delete it.",
      confirmLabel: "Leave",
      action: async () => {
        try {
          await removeGroupMember(group.groupId, myPhone);
          onLeft(group.groupId);
          onToast("You left the group");
          onClose();
        } catch (err) {
          onToast(readError(err, "Couldn't leave the group."), "error");
        }
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Group info" width={460}>
      {error && (
        <div style={{ marginBottom: 14 }}>
          <Alert>{error}</Alert>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
        <Avatar name={group.name} seed={group.groupId} avatarId={group.avatarId} size={64} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Field
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError("");
                  }}
                  maxLength={80}
                  autoFocus
                />
              </div>
              <Button size="sm" onClick={saveName} loading={saving}>
                Save
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h3 className="display truncate-1" style={{ fontSize: 24 }}>
                  {group.name}
                </h3>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setName(group.name);
                      setEditing(true);
                    }}
                    aria-label="Rename group"
                    className="icon-btn"
                    style={{ width: 28, height: 28, flex: "0 0 auto" }}
                  >
                    <Pencil size={14} strokeWidth={1.9} />
                  </button>
                )}
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                {members.length} {members.length === 1 ? "member" : "members"}
                {group.createdAt && ` · since ${group.createdAt}`}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <p className="eyebrow">Members</p>
        {isAdmin && (
          <Button variant="quiet" size="sm" icon={UserPlus} onClick={onAddPeople}>
            Add
          </Button>
        )}
      </div>

      <div style={{ maxHeight: 260, overflowY: "auto", margin: "0 -4px" }}>
        {members.map((member) => {
          const isMe = member.phone === myPhone;

          return (
            <div
              key={member.phone}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 12px",
                borderRadius: 14,
              }}
            >
              <Avatar name={member.name} seed={member.phone} avatarId={member.avatarId} size={38} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-1.5">
                  <span
                    className="truncate-1"
                    style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}
                  >
                    {isMe ? "You" : member.name}
                  </span>
                  {member.role === "ADMIN" && (
                    <Shield size={12} strokeWidth={2.2} style={{ color: "var(--ok)" }} aria-label="Admin" />
                  )}
                </div>
                <span
                  className="mono truncate-1"
                  style={{ display: "block", fontSize: 11.5, color: "var(--text-faint)" }}
                >
                  {member.phone}
                </span>
              </div>

              {isAdmin && !isMe && (
                <button
                  type="button"
                  onClick={() => remove(member)}
                  aria-label={`Remove ${member.name}`}
                  className="icon-btn"
                  style={{ width: 32, height: 32, color: "var(--danger-text)" }}
                >
                  <UserMinus size={16} strokeWidth={1.8} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <Button variant="danger" icon={LogOut} onClick={leave} full>
          Leave group
        </Button>
      </div>
    </Modal>
  );
}
