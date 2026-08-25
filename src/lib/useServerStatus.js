import { useCallback, useEffect, useRef, useState } from "react";
import { pingServer } from "@/lib/health";

/**
 * "checking" on mount, then "online" or "offline". Re-checks when the
 * tab regains focus or the browser comes back online, so a banner
 * shown during a brief network blip clears itself rather than
 * requiring a manual reload.
 */
export default function useServerStatus() {
  const [status, setStatus] = useState("checking");
  const mounted = useRef(true);

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const check = useCallback(async () => {
    if (mounted.current) setStatus("checking");

    const result = await pingServer();

    if (mounted.current) setStatus(result.reachable ? "online" : "offline");
  }, []);

  useEffect(() => {
    check();

    const onFocus = () => check();
    const onOnline = () => check();

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [check]);

  return { status, recheck: check };
}
