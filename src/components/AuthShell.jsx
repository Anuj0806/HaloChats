import AppFrame, { Grain } from "@/components/halo/AppFrame";
import Logo from "@/components/halo/Logo";
import Avatar from "@/components/halo/Avatar";
import ServerStatusBanner from "@/components/halo/ServerStatusBanner";
import useServerStatus from "@/lib/useServerStatus";

/* ============================================================
   AUTH SHELL

   Left: a dark espresso panel carrying the product's argument.
   Right: the form. Below 900px the panel is dropped entirely
   rather than stacked - on a phone it would just be a wall of
   marketing standing between someone and the sign-in button.
============================================================ */

const VOUCHERS = [
  { name: "Mira Okonkwo", seed: "+441700900110" },
  { name: "Jonah Tal", seed: "+441700900222" },
  { name: "Sana Bhatt", seed: "+441700900333" },
];

export default function AuthShell({ children }) {
  const { status, recheck } = useServerStatus();

  return (
    <AppFrame>
      {/* --- Editorial panel (desktop only) --- */}
      <div
        className="hidden lg:flex"
        style={{
          width: "42%",
          position: "relative",
          background: "var(--ink)",
          color: "var(--on-ink)",
          padding: 48,
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
        }}
      >
        <Grain opacity={0.35} blend="overlay" frequency="0.9" />

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: "50%",
            right: -160,
            top: -140,
            background: "radial-gradient(circle, rgba(196,106,70,.55), transparent 62%)",
            filter: "blur(10px)",
          }}
        />

        <div style={{ position: "relative" }}>
          <Logo />
        </div>

        <div style={{ position: "relative" }}>
          <h1
            className="display"
            style={{ fontSize: "clamp(34px, 3.4vw, 44px)", color: "var(--on-ink)", lineHeight: 1.08 }}
          >
            Conversations that
            <br />
            stay{" "}
            <em style={{ fontStyle: "italic", color: "var(--accent-light)" }}>yours</em>.
          </h1>

          <p
            style={{
              marginTop: 18,
              fontSize: 14.5,
              lineHeight: 1.7,
              color: "rgba(246,242,234,.62)",
              maxWidth: "34ch",
              textWrap: "pretty",
            }}
          >
            Messages live on your device, not on a server waiting to be
            mined. For the handful of people who actually matter.
          </p>

          <div className="flex items-center gap-3" style={{ marginTop: 30 }}>
            <div className="flex" style={{ paddingLeft: 6 }}>
              {VOUCHERS.map((person, index) => (
                <div key={person.seed} style={{ marginLeft: -10, zIndex: VOUCHERS.length - index }}>
                  <Avatar name={person.name} seed={person.seed} size={30} ring />
                </div>
              ))}
            </div>

            <span
              className="mono"
              style={{ fontSize: 11, letterSpacing: ".08em", color: "rgba(246,242,234,.45)" }}
            >
              2.4M private threads
            </span>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 11,
            letterSpacing: ".22em",
            textTransform: "uppercase",
            fontFamily: "var(--font-mono)",
            color: "rgba(246,242,234,.4)",
          }}
        >
          <span style={{ width: 22, height: 1, background: "var(--on-ink-faint)" }} />
          private messaging
        </div>
      </div>

      {/* --- Form column --- */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(24px, 5vw, 56px)",
          background: "var(--shell)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }} className="animate-rise">
          {/* On phones the panel is gone, so the wordmark comes here
              instead - otherwise the screen has no branding at all. */}
          <div className="lg:hidden" style={{ marginBottom: 30 }}>
            <Logo tone="dark" />
          </div>

          <ServerStatusBanner status={status} onRetry={recheck} />

          {children}
        </div>
      </div>
    </AppFrame>
  );
}
