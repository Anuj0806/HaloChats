import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2, Lock, MessageCircle, Search, UserRoundSearch } from "lucide-react";

import Avatar from "@/components/halo/Avatar";
import Alert from "@/components/halo/Alert";
import { searchDirectory } from "../../services/profileService";
import { readError } from "@/lib/format";

/* ============================================================
   CONTACTS

   Two lists in one pane. With an empty search box it shows the
   people already in your chat list, so the common case - message
   someone you messaged yesterday - needs no typing at all. Type two
   characters and it switches to a live directory lookup by name or
   phone.
============================================================ */

export default function ContactsPane({
  chats,
  myPhone,
  onStartChat,
  onStartSealedChat,
  sealedSupported = false,
  onBack,
  wide,
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const recents = useMemo(
    () =>
      chats
        // Group chats don't belong here: `member !== myPhone` would
        // pick one arbitrary member out of the roster and list the
        // whole group under that one person's name, which is both
        // wrong and looked like a "missing contact" bug from outside.
        .filter((chat) => !chat.archived && !chat.is_group)
        .map((chat) => {
          const phone = chat.members?.find((member) => member !== myPhone) || "";
          return { name: chat.name || phone, phone, chatId: chat.chat_id };
        })
        .filter((person) => person.phone),
    [chats, myPhone]
  );

  // Debounced so typing a ten-digit number doesn't fire ten requests.
  useEffect(() => {
    const query = term.trim();

    if (query.length < 2) {
      return undefined;
    }

    let cancelled = false;

    // The spinner and the "touched" flag are set by the change
    // handler, not here: setting state synchronously inside an effect
    // schedules an extra render pass on every keystroke.
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

  const showingResults = term.trim().length >= 2;
  const list = showingResults ? results : recents;

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
          <h1 className="display" style={{ fontSize: 30 }}>
            Contacts
          </h1>
        </div>

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
              const next = event.target.value;
              setTerm(next);

              if (next.trim().length < 2) {
                setResults([]);
                setError("");
                setSearching(false);
              } else {
                setSearching(true);
                setTouched(true);
              }
            }}
            placeholder="Search by name or phone number"
            aria-label="Search for people"
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
          {searching && (
            <Loader2
              size={16}
              strokeWidth={2}
              className="animate-spin-slow"
              style={{ color: "var(--text-faint)" }}
            />
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 14px 24px" }}>
        {error && (
          <div style={{ margin: "0 10px 14px" }}>
            <Alert>{error}</Alert>
          </div>
        )}

        <p className="eyebrow" style={{ margin: "0 12px 10px" }}>
          {showingResults ? "Search results" : "Recent"}
        </p>

        {list.length === 0 ? (
          <EmptyContacts
            searching={searching}
            showingResults={showingResults}
            touched={touched}
            term={term}
          />
        ) : (
          list.map((person) => (
            <div
              key={person.phone}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: 12,
                borderRadius: 16,
                transition: "background .14s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunk)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Avatar name={person.name} seed={person.phone} avatarId={person.avatarId} size={46} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="truncate-1"
                  style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}
                >
                  {person.name}
                </div>
                <div
                  className="mono truncate-1"
                  style={{ fontSize: 12.2, color: "var(--text-muted)", marginTop: 3 }}
                >
                  {person.phone}
                </div>
                {person.about && (
                  <div
                    className="truncate-1"
                    style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 2 }}
                  >
                    {person.about}
                  </div>
                )}
              </div>

              <div className="flex gap-2" style={{ flex: "0 0 auto" }}>
                {sealedSupported && (
                  <button
                    type="button"
                    onClick={() => onStartSealedChat(person)}
                    title="Sealed chat - encrypted, never saved"
                    aria-label={`Start a sealed chat with ${person.name}`}
                    className="halo-btn halo-btn-ink"
                    style={{ padding: "9px 12px", fontSize: 13 }}
                  >
                    <Lock size={14} strokeWidth={1.9} />
                    Sealed
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onStartChat(person)}
                  className="halo-btn halo-btn-quiet"
                  style={{ padding: "9px 15px", fontSize: 13 }}
                >
                  <MessageCircle size={15} strokeWidth={1.8} />
                  Message
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EmptyContacts({ searching, showingResults, touched, term }) {
  if (searching) {
    return (
      <p style={{ padding: "40px 24px", textAlign: "center", fontSize: 13.5, color: "var(--text-muted)" }}>
        Looking…
      </p>
    );
  }

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
        <UserRoundSearch size={24} strokeWidth={1.6} style={{ color: "var(--text-ghost)" }} />
      </div>

      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
        {showingResults ? "Nobody matched" : "No conversations yet"}
      </p>

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
        {showingResults ? (
          <>
            No verified account matches “{term.trim()}”. Check the spelling, or try their full phone
            number.
          </>
        ) : touched ? (
          "Search above to find someone by name or phone number."
        ) : (
          "Type a name or phone number above to find someone to message."
        )}
      </p>
    </div>
  );
}
