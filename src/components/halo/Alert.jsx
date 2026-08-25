import { AlertCircle, Check } from "lucide-react";

/**
 * The inline banner that appears above a form when something goes
 * wrong, or confirms that something worked. Deliberately not a
 * toast - form errors must stay on screen while the person fixes
 * the field they refer to.
 */
export default function Alert({ tone = "error", children, className = "" }) {
  if (!children) return null;

  const isError = tone === "error";
  const Icon = isError ? AlertCircle : Check;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`halo-alert ${isError ? "halo-alert-error" : "halo-alert-ok"} animate-rise ${className}`}
    >
      <Icon
        size={16}
        strokeWidth={isError ? 1.8 : 2.2}
        aria-hidden="true"
        style={{ flex: "0 0 auto", marginTop: 1 }}
      />
      <span>{children}</span>
    </div>
  );
}
