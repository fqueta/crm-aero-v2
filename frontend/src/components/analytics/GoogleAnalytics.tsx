import { useEffect } from "react";

/**
 * GoogleAnalytics — Dynamically loads the GA4 gtag.js script.
 *
 * pt-BR: Injeta o script `gtag.js` do Google Analytics 4 no `<head>` usando
 *        o Measurement ID definido em `VITE_GA_MEASUREMENT_ID`. Se o ID não
 *        estiver configurado, nenhum script é carregado.
 *
 * en-US: Injects the GA4 `gtag.js` script into `<head>` using the
 *        Measurement ID from `VITE_GA_MEASUREMENT_ID`. If the ID is not set,
 *        no script is loaded.
 *
 * Usage: Place `<GoogleAnalytics />` once at the top of your component tree
 *        (e.g., inside `App`).
 */
export function GoogleAnalytics() {
  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

    if (!measurementId) {
      return;
    }

    // Avoid loading the script twice (e.g. HMR in dev)
    const existingScript = document.querySelector(
      `script[src*="googletagmanager.com/gtag/js"]`
    );
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.async = true;
    document.head.appendChild(script);

    // Configure default stream after script element is in the DOM
    // (gtag + dataLayer were already bootstrapped in index.html)
    if (typeof window.gtag === "function") {
      window.gtag("config", measurementId, {
        send_page_view: true,
      });
    }
  }, []);

  return null;
}
