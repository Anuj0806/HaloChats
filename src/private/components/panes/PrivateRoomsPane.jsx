import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Lock, MessageSquareLock, Search, ShieldCheck, X } from "lucide-react";

import Avatar from "@/components/halo/Avatar";
import Alert from "@/components/halo/Alert";
import { searchDirectory } from "../../services/profileService";
import { readError } from "@/lib/format";

/* ============================================================
   PRIVATE ROOM

   The end-to-end encrypted counterpart to the Chats tab, and
   deliberately its own destination rather than a button tucked
   inside Contacts - a feature nobody can find is indistinguishable
   from a feature that doesn't exist.

   A private room is not a chat: nothing here is written to SQLite
   or to the server. Every room in "Active rooms" lives only in this
   tab's memory and disappears the moment the page reloads. The
   empty and populated states both say this in plain words rather
   than letting the UI imply it works like an ordinary chat.
============================================================ */

export default function PrivateRoomsPane({
  sealed,
  myPhone,
  onOpenRoom,
  onBack,
  wide,
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [startingPhone, setStartingPhone] = useState("");

  useEffect(() => {
    const query = term.trim();

    if (query.length < 2) {
      return undefined;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const found = await searchDirectory(query, myPhone);
        if (!cancelled) {
          setResults(found);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setError(readError(err, "Couldn't reach the directory. Check your connection."));
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, myPhone]);

  const start = async (person) => {
    setError("");
    setStartingPhone(person.phone);

    const result = await sealed.openSealedChat(person);

    setStartingPhone("");

    if (result.ok) {
      onOpenRoom(person.phone);
    } else {
      setError(result.reason);
    }
  };

  const showingResults = term.trim().length >= 2;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--shell)",
      }}
    >
      <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid var(--line)", flex: "0 0 auto" }}>
        <div className="flex items-center gap-3">
          {!wide && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="icon-btn"
              style={{ width: 36, height: 36, color: "var(--text)" }}
            >
              <ChevronLeft size={20} strokeWidth={1.8} />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="display" style={{ fontSize: 30 }}>
                Private Room
              </h1>
              <Lock size={18} strokeWidth={2} style={{ color: "var(--ok)" }} />
            </div>
            <p className="eyebrow" style={{ marginTop: 4 }}>
              End-to-end encrypted · never saved
            </p>
          </div>
        </div>

        {!sealed.supported && (
          <div style={{ marginTop: 14 }}>
            <Alert>
              Private Room needs a secure connection (https, or localhost) to generate encryption
              keys. It isn't available on this address.
            </Alert>
          </div>
        )}

        {sealed.identityError && (
          <div style={{ marginTop: 14 }}>
            <Alert>{sealed.identityError}</Alert>
            <button
              type="button"
              onClick={() => sealed.retryIdentity()}
              style={{
                marginTop: 8,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--accent)",
              }}
            >
              Try again
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14 }}>
            <Alert>{error}</Alert>
          </div>
        )}

        {sealed.supported && (
          <div
            className="flex items-center gap-2.5"
            style={{
              marginTop: 16,
              padding: "0 13px",
              borderRadius: "var(--r-field)",
              background: "var(--surface-sunk)",
              border: "1px solid var(--line)",
              maxWidth: 460,
            }}
          >
            <Search size={17} strokeWidth={1.8} style={{ color: "var(--text-faint)", flex: "0 0 auto" }} />
            <input
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setSearching(event.target.value.trim().length >= 2);
              }}
              placeholder="Search by name or phone to start a room"
              aria-label="Search for someone to start a private room with"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                padding: "12px 0",
                fontSize: 14,
                color: "var(--text)",
              }}
            />
            {(searching || startingPhone) && (
              <Loader2
                size={16}
                strokeWidth={2}
                className="animate-spin-slow"
                style={{ color: "var(--text-faint)" }}
              />
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 14px 24px" }}>
        {showingResults ? (
          <>
            <p className="eyebrow" style={{ margin: "0 12px 10px" }}>
              Search results
            </p>

            {results.length === 0 && !searching ? (
              <p
                style={{
                  padding: "28px 12px",
                  textAlign: "center",
                  fontSize: 13.5,
                  color: "var(--text-muted)",
                }}
              >
                Nobody matched that.
              </p>
            ) : (
              results.map((person) => (
                <RoomCandidateRow
                  key={person.phone}
                  person={person}
                  starting={startingPhone === person.phone}
                  onStart={() => start(person)}
                />
              ))
            )}
          </>
        ) : (
          <>
            <p className="eyebrow" style={{ margin: "0 12px 10px" }}>
              Active rooms on this device
            </p>

            {sealed.sessions.length === 0 ? (
              <EmptyRooms />
            ) : (
              sealed.sessions.map((session) => (
                <button
                  key={session.phone}
                  type="button"
                  onClick={() => onOpenRoom(session.phone)}
                  className="halo-row"
                  style={{ borderRadius: 16, marginBottom: 2, border: "none" }}
                >
                  <Avatar name={session.name} seed={session.phone} size={44} />

                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="truncate-1"
                        style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}
                      >
                        {session.name}
                      </span>
                      {session.verified && (
                        <ShieldCheck
                          size={14}
                          strokeWidth={2.1}
                          style={{ color: "var(--ok)" }}
                          aria-label="Safety number verified"
                        />
                      )}
                    </span>
                    <span
                      className="truncate-1"
                      style={{ display: "block", fontSize: 12.5, color: "var(--text-subtle)", marginTop: 2 }}
                    >
                      {session.messages.length === 0
                        ? "Room open · no messages yet"
                        : `${session.messages.length} message${session.messages.length === 1 ? "" : "s"} this session`}
                    </span>
                  </span>

                  <X
                    size={16}
                    strokeWidth={2}
                    role="button"
                    aria-label={`End the private room with ${session.name}`}
                    style={{ color: "var(--text-faint)", flex: "0 0 auto" }}
                    onClick={(event) => {
                      event.stopPropagation();
                      sealed.closeSealedChat(session.phone);
                    }}
                  />
                </button>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RoomCandidateRow({ person, starting, onStart }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 12,
        borderRadius: 16,
      }}
    >
      <Avatar name={person.name} seed={person.phone} avatarId={person.avatarId} size={44} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="truncate-1" style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>
          {person.name}
        </div>
        <div className="mono truncate-1" style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {person.phone}
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="halo-btn halo-btn-ink"
        style={{ padding: "9px 15px", fontSize: 13, flex: "0 0 auto" }}
      >
        {starting ? (
          <Loader2 size={14} strokeWidth={2.2} className="animate-spin-slow" />
        ) : (
          <Lock size={14} strokeWidth={1.9} />
        )}
        {starting ? "Starting…" : "Start room"}
      </button>
    </div>
  );
}

function EmptyRooms() {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
          background: "var(--surface-sunk)",
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
      >
        <MessageSquareLock size={24} strokeWidth={1.6} style={{ color: "var(--text-ghost)" }} />
      </div>

      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>No private rooms open</p>

      <p
        style={{
          marginTop: 6,
          fontSize: 13.5,
          lineHeight: 1.6,
          color: "var(--text-muted)",
          maxWidth: "36ch",
          margin: "6px auto 0",
          textWrap: "pretty",
        }}
      >
        Search above to start one. Rooms live only in this browser tab — closing it or refreshing
        the page ends every room here.
      </p>
    </div>
  );
}
