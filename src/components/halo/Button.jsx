import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary: "halo-btn-primary",
  ink: "halo-btn-ink",
  quiet: "halo-btn-quiet",
  ghost: "halo-btn-ghost",
  danger: "halo-btn-danger",
};

const SIZES = {
  sm: { padding: "10px 16px", fontSize: 13 },
  md: { padding: "13px 20px", fontSize: 14 },
  lg: { padding: "16px 20px", fontSize: 14.5 },
};

/**
 * While `loading` is true the button disables itself and swaps its
 * label, so a slow network can't be double-submitted and the person
 * can see why nothing has happened yet.
 */
export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  disabled = false,
  icon: Icon,
  full = false,
  type = "button",
  onClick,
  className = "",
  style = {},
}) {
  const sizing = SIZES[size] || SIZES.md;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`halo-btn ${VARIANTS[variant] || VARIANTS.primary} ${className}`}
      style={{ ...sizing, width: full ? "100%" : undefined, ...style }}
    >
      {loading ? (
        <Loader2 size={16} strokeWidth={2} className="animate-spin-slow" aria-hidden="true" />
      ) : (
        Icon && <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
      )}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
