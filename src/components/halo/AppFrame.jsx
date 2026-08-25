/* ============================================================
   APP FRAME

   The warm page backdrop and the floating rounded shell that every
   screen sits inside. The grain layer is a tiny inline SVG noise
   texture rather than a bitmap - it costs nothing to download and
   it's what stops the large flat cream areas looking like plastic.
============================================================ */

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function Grain({ opacity = "var(--grain)", blend = "multiply", frequency = "0.85" }) {
  const texture =
    frequency === "0.85"
      ? GRAIN_SVG
      : GRAIN_SVG.replace("baseFrequency='0.85'", `baseFrequency='${frequency}'`);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundImage: texture,
        mixBlendMode: blend,
        opacity,
      }}
    />
  );
}

export default function AppFrame({ children }) {
  return (
    <div
      className="app-frame"
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(0px, 2.4vw, 28px)",
        background:
          "radial-gradient(120% 90% at 12% 0%, #FAF7F1 0%, #EFEAE2 45%, #E4DED4 100%)",
      }}
    >
      <Grain />

      {/* Two very soft colour washes - terracotta top-right, sea
          bottom-left - so the backdrop isn't a single flat tint. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(60% 45% at 82% 8%, rgba(169,88,58,.10), transparent 70%), radial-gradient(50% 40% at 8% 95%, rgba(46,124,106,.09), transparent 70%)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "min(1180px, 100%)",
          height: "min(820px, calc(100dvh - 2 * clamp(0px, 2.4vw, 28px)))",
          display: "flex",
          overflow: "hidden",
          borderRadius: "var(--r-shell)",
          background: "var(--shell)",
          border: "1px solid rgba(30,27,24,.09)",
          boxShadow: "var(--shadow-shell)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
