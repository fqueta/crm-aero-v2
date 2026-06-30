import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Google Analytics 4 — page-view tracker for SPAs.
 *
 * pt-BR: Envia um evento `page_view` ao GA4 sempre que a rota muda.
 *        Só opera se `window.gtag` estiver disponível (o script do GA é
 *        carregado condicionalmente pelo `index.html` quando
 *        `VITE_GA_MEASUREMENT_ID` estiver configurado).
 *
 * en-US: Sends a `page_view` event to GA4 on every route change.
 *        Only works when `window.gtag` is available (the GA script is
 *        conditionally loaded by `index.html` when
 *        `VITE_GA_MEASUREMENT_ID` is set).
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

    if (!measurementId || typeof window.gtag !== "function") {
      return;
    }

    window.gtag("config", measurementId, {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location]);
}
