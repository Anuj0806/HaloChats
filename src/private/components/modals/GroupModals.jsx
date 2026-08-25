import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, Users, X } from "lucide-react";

import Modal from "@/components/halo/Modal";
import Field from "@/components/halo/Field";
import Button from "@/components/halo/Button";
import Alert from "@/components/halo/Alert";
import Avatar from "@/components/halo/Avatar";
import { AVATAR_STYLES, avatarColors } from "@/lib/avatar";
import { readError } from "@/lib/format";
import { searchDirectory } from "../../services/profileService";
import { addGroupMembers, createGroup } from "../../services/groupService";

/* ============================================================
   NEW GROUP

   Two steps rather than one long form: choose people, then name it.
   Picking contacts is the part that needs room, and asking for a
   name before anyone knows who's in the group is backwards.

   AppPage only renders this while it's open, so closing it unmounts
   the component and every field resets on its own. An effect that
   cleared state on `open` changing would do the same job with an
   extra render pass and a list of fields to keep in sync.
============================================================ */

export default function NewGroupModal({ open, onClose, contacts, myPhone, onCreated, onToast }) {
  const [step, setStep] = useState(0);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState(AVATAR_STYLES[3].id);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) return undefined;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const found = await searchDirectory(query, myPhone);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, myPhone]);

  const candidates = useMemo(() => {
    if (term.trim().length >= 2) return results;
    return contacts;
  }, [term, results, contacts]);

  const toggle = (person) => {
    setError("");
    setSelected((current) =>
      current.some((p) => p.phone === person.phone)
        ? current.filter((p) => p.phone !== person.phone)
        : [...current, person]
    );
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Give the group a name");
      return;
    }

    setError("");

    try {
      setSaving(true);

      const group = await createGroup({
        name,
        avatarId,
        memberPhones: selected.map((person) => person.phone),
      });

      onCreated(group);
      onToast(`"${group.name}" created`);
      onClose();
    } catch (err) {
      setError(readError(err, "Couldn't create the group."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={480}
      title={step === 0 ? "New group" : "Name your group"}
      description={
        step === 0
          ? "Pick who's in it. You can add more people later."
          : `${selected.length + 1} ${selected.length === 0 ? "person" : "people"}, including you.`
      }
      footer={
        step === 0 ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => setStep(1)} disabled={selected.length === 0}>
              Next
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep(0)} disabled={saving}>
              Back
            </Button>
            <Button onClick={submit} loading={saving} loadingLabel="Creating…">
              Create group
            </Button>
          </>
        )
      }
    >
      {error && (
        <div style={{ marginBottom: 14 }}>
          <Alert>{error}</Alert>
        </div>
      )}

      {step === 0 ? (
        <>
          {selected.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {selected.map((person) => (
                <button
                  key={person.phone}
                  type="button"
                  onClick={() => toggle(person)}
                  aria-label={`Remove ${person.name}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 8px 5px 5px",
                    borderRadius: 999,
                    border: "1px solid var(--line-strong)",
                    background: "var(--surface-sunk)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "var(--text)",
                  }}
                >
                  <Avatar name={person.name} seed={person.phone} size={20} />
                  {person.name}
                  <X size={13} strokeWidth={2.2} style={{ color: "var(--text-faint)" }} />
                </button>
              ))}
            </div>
          )}

          <div
            className="flex items-center gap-2.5"
            style={{
              padding: "0 13px",
              borderRadius: "var(--r-field)",
              background: "var(--surface-sunk)",
              border: "1px solid var(--line)",
              marginBottom: 12,
            }}
          >
            <Search size={16} strokeWidth={1.8} style={{ color: "var(--text-faint)" }} />
            <input
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                if (event.target.value.trim().length >= 2) setSearching(true);
                else setSearching(false);
              }}
              placeholder="Search by name or phone"
              aria-label="Search for people to add"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                padding: "11px 0",
                fontSize: 14,
                color: "var(--text)",
              }}
            />
            {searching && (
              <Loader2 size={15} className="animate-spin-slow" style={{ color: "var(--text-faint)" }} />
            )}
          </div>

          <div style={{ maxHeight: 280, overflowY: "auto", margin: "0 -4px" }}>
            {candidates.length === 0 ? (
              <p
                style={{
                  padding: "28px 12px",
                  textAlign: "center",
                  fontSize: 13.5,
                  color: "var(--text-muted)",
                }}
              >
                {term.trim().length >= 2
                  ? "Nobody matched that."
                  : "Search above to find people to add."}
              </p>
            ) : (
              candidates.map((person) => {
                const chosen = selected.some((p) => p.phone === person.phone);

                return (
                  <button
                    key={person.phone}
                    type="button"
                    onClick={() => toggle(person)}
                    aria-pressed={chosen}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "none",
                      background: chosen ? "var(--accent-wash)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <Avatar name={person.name} seed={person.phone} avatarId={person.avatarId} size={38} />

                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        className="truncate-1"
                        style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)" }}
                      >
                        {person.name}
                      </span>
                      <span
                        className="mono truncate-1"
                        style={{ display: "block", fontSize: 11.5, color: "var(--text-faint)" }}
                      >
                        {person.phone}
                      </span>
                    </span>

                    <span
                      aria-hidden="true"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        flex: "0 0 auto",
                        border: chosen ? "none" : "1.5px solid var(--line-field)",
                        background: chosen ? "var(--accent)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {chosen && <Check size={13} strokeWidth={3} color="#FFF9F3" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <Avatar name={name || "Group"} seed="group" avatarId={avatarId} size={64} />

            <div style={{ flex: 1 }}>
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                Group colour
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {AVATAR_STYLES.map((style) => {
                  const colors = avatarColors("group", style.id);
                  const chosen = avatarId === style.id;

                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setAvatarId(style.id)}
                      aria-pressed={chosen}
                      aria-label={style.label}
                      title={style.label}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: colors.background,
                        border: chosen ? "2px solid var(--accent)" : "1px solid var(--line-field)",
                        cursor: "pointer",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <Field
            label="Group name"
            icon={Users}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            placeholder="Weekend plans"
            maxLength={80}
            autoFocus
          />
        </>
      )}
    </Modal>
  );
}

/* ============================================================
   ADD MEMBERS to an existing group
============================================================ */

export function AddMembersModal({ open, onClose, groupId, existingPhones, myPhone, onUpdated, onToast }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) return undefined;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const found = await searchDirectory(query, myPhone);
        // Already-members can't be added again; hiding them is clearer
        // than showing a row that does nothing.
        if (!cancelled) setResults(found.filter((p) => !existingPhones.includes(p.phone)));
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, myPhone, existingPhones]);

  const submit = async () => {
    if (selected.length === 0) return;

    try {
      setSaving(true);
      const group = await addGroupMembers(groupId, selected.map((p) => p.phone));

      onUpdated(group);
      onToast(selected.length === 1 ? "Member added" : `${selected.length} members added`);
      onClose();
    } catch (err) {
      setError(readError(err, "Couldn't add those people."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add people"
      description="They'll see messages from now on, not the history."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={selected.length === 0} loading={saving} loadingLabel="Adding…">
            Add
          </Button>
        </>
      }
    >
      {error && (
        <div style={{ marginBottom: 14 }}>
          <Alert>{error}</Alert>
        </div>
      )}

      <div
        className="flex items-center gap-2.5"
        style={{
          padding: "0 13px",
          borderRadius: "var(--r-field)",
          background: "var(--surface-sunk)",
          border: "1px solid var(--line)",
          marginBottom: 12,
        }}
      >
        <Search size={16} strokeWidth={1.8} style={{ color: "var(--text-faint)" }} />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search by name or phone"
          aria-label="Search for people to add"
          autoFocus
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            padding: "11px 0",
            fontSize: 14,
            color: "var(--text)",
          }}
        />
      </div>

      <div style={{ maxHeight: 260, overflowY: "auto", margin: "0 -4px" }}>
        {results.length === 0 ? (
          <p style={{ padding: "24px 12px", textAlign: "center", fontSize: 13.5, color: "var(--text-muted)" }}>
            {term.trim().length >= 2 ? "Nobody new matched that." : "Search to find people."}
          </p>
        ) : (
          results.map((person) => {
            const chosen = selected.some((p) => p.phone === person.phone);

            return (
              <button
                key={person.phone}
                type="button"
                onClick={() =>
                  setSelected((current) =>
                    chosen
                      ? current.filter((p) => p.phone !== person.phone)
                      : [...current, person]
                  )
                }
                aria-pressed={chosen}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "none",
                  background: chosen ? "var(--accent-wash)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Avatar name={person.name} seed={person.phone} avatarId={person.avatarId} size={38} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className="truncate-1"
                    style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)" }}
                  >
                    {person.name}
                  </span>
                  <span
                    className="mono truncate-1"
                    style={{ display: "block", fontSize: 11.5, color: "var(--text-faint)" }}
                  >
                    {person.phone}
                  </span>
                </span>
                {chosen && <Check size={16} strokeWidth={2.6} style={{ color: "var(--accent)" }} />}
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}
