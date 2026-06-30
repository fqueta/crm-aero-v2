import { usePageTracking } from "@/hooks/usePageTracking";

/**
 * PageTracker — invisible component that tracks page views in GA4.
 *
 * pt-BR: Deve ser colocado dentro do `<BrowserRouter>` para ter acesso ao
 *        hook `useLocation`. Envia `page_view` a cada mudança de rota.
 *
 * en-US: Must be placed inside `<BrowserRouter>` to access `useLocation`.
 *        Sends a `page_view` event on every route change.
 */
export function PageTracker() {
  usePageTracking();
  return null;
}
