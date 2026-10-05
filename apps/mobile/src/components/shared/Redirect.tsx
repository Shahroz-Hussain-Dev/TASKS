import { useEffect } from "react";
import { useNavigate, type To } from "react-router-dom";

/**
 * One-shot client redirect. React Router's own <Navigate> re-runs whenever the
 * location changes (its `navigate` dependency is rebuilt per location), which
 * is harmless when the element unmounts immediately but turns into a redirect
 * ping-pong when the outgoing page is kept alive for its exit animation by
 * AnimatePresence. This fires exactly once per target instead.
 */
export function Redirect({ to, replace = true, state }: { to: To; replace?: boolean; state?: unknown }) {
  const navigate = useNavigate();
  const key = typeof to === "string" ? to : JSON.stringify(to);
  useEffect(() => {
    navigate(to, { replace, state });
    // Intentionally keyed on the target only — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
