import React from "react";
import { Plane } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_STAGES = [
  "Autenticando sua sessão...",
  "Carregando seu painel...",
  "Só mais um instante...",
];

interface AuthPreloaderProps {
  /** Mensagem fixa. Se omitida, alterna automaticamente entre etapas. */
  message?: string;
  subMessage?: string;
  /** Ocupa a tela toda (padrão) ou apenas o container pai. */
  fullScreen?: boolean;
  className?: string;
}

/**
 * AuthPreloader
 * pt-BR: Preloader visual com identidade usado nas transições de autenticação
 * (login → painel, validação de sessão, chunks lazy), para nunca exibir
 * tela em branco enquanto dados/rotas carregam.
 * en-US: Branded visual preloader for auth transitions (login → dashboard,
 * session validation, lazy chunks) so a blank screen is never shown.
 */
export function AuthPreloader({ message, subMessage, fullScreen = true, className }: AuthPreloaderProps) {
  const [stage, setStage] = React.useState(0);

  React.useEffect(() => {
    if (message) return;
    const t = setInterval(() => setStage((s) => (s + 1) % DEFAULT_STAGES.length), 2600);
    return () => clearInterval(t);
  }, [message]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-slate-50 to-white px-6 text-center dark:from-zinc-950 dark:to-zinc-900",
        fullScreen ? "min-h-screen w-full" : "min-h-[320px] w-full",
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 animate-ping rounded-3xl bg-primary/10" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <Plane className="h-8 w-8 animate-[spin_6s_linear_infinite]" />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white dark:border-zinc-950 dark:bg-zinc-950">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">
          {message ?? DEFAULT_STAGES[stage]}
        </p>
        <p className="text-xs font-medium text-slate-400 dark:text-zinc-500">
          {subMessage ?? "Não feche esta aba, já estamos quase lá."}
        </p>
      </div>

      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export default AuthPreloader;
