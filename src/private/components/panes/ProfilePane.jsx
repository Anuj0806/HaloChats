import { useEffect, useState } from "react";
import { BadgeCheck, ChevronLeft, Loader2, Pencil, X } from "lucide-react";

import Avatar from "@/components/halo/Avatar";
import Button from "@/components/halo/Button";
import Field from "@/components/halo/Field";
import Alert from "@/components/halo/Alert";
import { AVATAR_STYLES, avatarColors } from "@/lib/avatar";
import { fetchMyProfile, updateMyProfile } from "../../services/profileService";
import { readError } from "@/lib/format";

/* ============================================================
   PROFILE

   Read view by default, edit in place. The avatar picker offers the
   eight generated styles rather than an upload - there is no file
   storage behind this app, and a broken "upload photo" button would
   be worse than none.
============================================================ */

export default function ProfilePane({ session, onSessionChange, chats, onBack, onToast, wide }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ name: "", about: "", city: "", avatarId: null });

  useEffect(() => {
    let cancelled = false;

    fetchMyProfile()
      .then((data) => {
        if (cancelled || !data) return;

        setProfile(data);
        setForm({
          name: data.name || "",
          about: data.about || "",
          city: data.city || "",
          avatarId: data.avatarId || null,
        });

        onSessionChange({ name: data.name, email: data.email, avatarId: data.avatarId, about: data.about });
      })
      .catch((err) => {
        if (cancelled) return;

        // Fall back to what the session already knows so the screen
        // still renders something true rather than an error page.
        setError(readError(err, "Couldn't load your profile from the server."));
        setProfile({
          name: session.name,
          phone: session.phone,
          email: session.email,
          about: session.about,
          avatarId: session.avatarId,
          verified: true,
        });
        setForm({
          name: session.name || "",
          about: session.about || "",
          city: "",
          avatarId: session.avatarId || null,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Load once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Your name can't be empty.");
      return;
    }

    setError("");

    try {
      setSaving(true);
      const saved = await updateMyProfile(form);

      setProfile(saved);
      onSessionChange({
        name: saved.name,
        about: saved.about,
        avatarId: saved.avatarId,
        email: saved.email,
      });

      setEditing(false);
      onToast("Profile saved");
    } catch (err) {
      setError(readError(err, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setForm({
      name: profile?.name || "",
      about: profile?.about || "",
      city: profile?.city || "",
      avatarId: profile?.avatarId || null,
    });
    setError("");
    setEditing(false);
  };

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--shell)",
        }}
      >
        <Loader2 size={22} className="animate-spin-slow" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const phone = profile?.phone || session.phone;
  const threadCount = chats.filter((chat) => !chat.archived).length;
  const unreadCount = chats.reduce((total, chat) => total + (chat.unread_count || 0), 0);

  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "var(--shell)" }}>
      {/* ---------- Cover ---------- */}
      <div
        style={{
          position: "relative",
          height: 168,
          background: "linear-gradient(135deg, var(--ink-raised), var(--ink))",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: 340,
            height: 340,
            borderRadius: "50%",
            right: -80,
            top: -120,
            background: "radial-gradient(circle, rgba(196,106,70,.5), transparent 62%)",
          }}
        />

        {!wide && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{
              position: "absolute",
              left: 16,
              top: 16,
              width: 36,
              height: 36,
              borderRadius: 12,
              border: "none",
              background: "rgba(246,242,234,.12)",
              color: "var(--on-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
        )}
      </div>

      <div style={{ padding: "0 26px 40px", maxWidth: 620, margin: "0 auto" }}>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "flex-end",
            gap: 18,
            marginTop: -44,
          }}
        >
          <div style={{ border: "4px solid var(--shell)", borderRadius: 36, lineHeight: 0 }}>
            <Avatar
              name={form.name || profile?.name}
              seed={phone}
              avatarId={form.avatarId}
              size={92}
            />
          </div>

          {!editing && (
            <Button
              variant="quiet"
              size="sm"
              icon={Pencil}
              onClick={() => setEditing(true)}
              style={{ marginBottom: 10, whiteSpace: "nowrap" }}
            >
              Edit profile
            </Button>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 18 }}>
            <Alert>{error}</Alert>
          </div>
        )}

        {editing ? (
          /* ---------- Edit mode ---------- */
          <div style={{ marginTop: 22 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>
              Avatar
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
              {AVATAR_STYLES.map((style) => {
                const colors = avatarColors(phone, style.id);
                const chosen = form.avatarId === style.id;

                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, avatarId: style.id }))}
                    aria-pressed={chosen}
                    aria-label={style.label}
                    title={style.label}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: colors.background,
                      border: chosen ? "2px solid var(--accent)" : "2px solid transparent",
                      outline: chosen ? "none" : "1px solid var(--line-field)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: colors.foreground,
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {chosen ? "✓" : ""}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field
                label="Name"
                value={form.name}
                onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
                placeholder="Your name"
                maxLength={60}
              />

              <Field
                label="Status"
                value={form.about}
                onChange={(event) => setForm((c) => ({ ...c, about: event.target.value }))}
                placeholder="A line about you"
                maxLength={140}
                hint={`${form.about.length}/140`}
              />

              <Field
                label="City"
                value={form.city}
                onChange={(event) => setForm((c) => ({ ...c, city: event.target.value }))}
                placeholder="Where you are"
                maxLength={80}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <Button onClick={handleSave} loading={saving} loadingLabel="Saving…">
                Save changes
              </Button>
              <Button variant="ghost" icon={X} onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* ---------- Read mode ---------- */
          <>
            <div className="flex items-center gap-2" style={{ marginTop: 18 }}>
              <h1 className="display" style={{ fontSize: 32 }}>
                {profile?.name || session.name}
              </h1>
              {profile?.verified && (
                <BadgeCheck size={19} strokeWidth={1.9} style={{ color: "var(--ok)" }} aria-label="Verified" />
              )}
            </div>

            <p className="mono" style={{ marginTop: 4, fontSize: 12.5, color: "var(--text-faint)" }}>
              {phone}
            </p>

            <p
              style={{
                marginTop: 14,
                fontSize: 14.5,
                lineHeight: 1.65,
                color: profile?.about ? "var(--text-muted)" : "var(--text-ghost)",
                maxWidth: "46ch",
                textWrap: "pretty",
              }}
            >
              {profile?.about || "No status yet. Edit your profile to add one."}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                marginTop: 26,
              }}
            >
              <Stat value={threadCount} label={threadCount === 1 ? "Thread" : "Threads"} />
              <Stat value={unreadCount} label="Unread" />
              <Stat value={profile?.joinedAt || "—"} label="Joined" small />
            </div>

            <div className="halo-card" style={{ marginTop: 26 }}>
              <Row label="Email" value={profile?.email || session.email || "—"} />
              <Row label="Phone" value={phone} mono />
              <Row label="City" value={profile?.city || "—"} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, small = false }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        background: "var(--surface-sunk)",
        border: "1px solid var(--line)",
      }}
    >
      <div className="display" style={{ fontSize: small ? 16 : 26, lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: small ? 6 : 2 }}>{label}</div>
    </div>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "15px 18px",
        borderBottom: "1px solid var(--line-soft)",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--text-subtle)", flex: "0 0 auto" }}>{label}</span>
      <span
        className={`truncate-1 ${mono ? "mono" : ""}`}
        style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 500, textAlign: "right" }}
      >
        {value}
      </span>
    </div>
  );
}
