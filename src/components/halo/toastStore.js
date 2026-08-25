import { createContext, useContext } from "react";

/** Split from the provider so that file exports only a component. */
export const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside a <ToastProvider>");
  }

  return context;
}
