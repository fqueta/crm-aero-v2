import * as React from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * RouteChangeLoader
 * pt-BR: Barra de progresso no topo + preloader breve a cada troca de rota,
 * para dar feedback visual durante o carregamento das páginas.
 * en-US: Top progress bar + brief overlay on every route change,
 * giving visual feedback while pages load.
 */
export function RouteChangeLoader({ minDuration = 350 }: { minDuration?: number }) {
  const location = useLocation();
  const [loading, setLoading] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const firstRender = React.useRef(true);

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setLoading(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setLoading(false), minDuration);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [location.pathname, minDuration]);

  if (!loading) return null;

  return (
    <>
      {/* Barra de progresso no topo */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-primary/10">
        <div className="route-progress-bar h-full w-1/3 bg-primary" />
      </div>
      {/* Véu sutil sobre o conteúdo durante a transição */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-0 z-[99] bg-background/40 backdrop-blur-[1px]",
          "animate-in fade-in-50 duration-150"
        )}
      />
    </>
  );
}

export default RouteChangeLoader;
