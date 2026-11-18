import type { ReactNode } from "react";
import Mascot, { type MascotName, type MascotSize } from "./Mascot";

type Action = { label: string; onClick: () => void; icon?: ReactNode };

type EmptyStateProps = {
  mascot: MascotName;
  title: string;
  description?: ReactNode;
  action?: Action;
  secondaryAction?: Action;
  mascotSize?: MascotSize;
  /** Texto alternativo si la mascota comunica el estado (errores, sin conexión…). Sin él es decorativa. */
  mascotAlt?: string;
  className?: string;
};

/** Estado vacío / de error reutilizable: mascota + título + texto + CTA. */
export default function EmptyState({ mascot, title, description, action, secondaryAction, mascotSize = "md", mascotAlt, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center rounded-[1.75rem] border-2 border-dashed border-ink bg-white/45 px-5 py-8 text-center sm:px-10 sm:py-10 ${className}`}>
      {mascotAlt ? <Mascot name={mascot} size={mascotSize} mobileSize="sm" decorative={false} alt={mascotAlt} /> : <Mascot name={mascot} size={mascotSize} mobileSize="sm" />}
      <p className="mt-4 font-display text-3xl font-black">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm font-medium text-ink/60">{description}</p> : null}
      {action || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action ? (
            <button type="button" onClick={action.onClick} className="sticker-button flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-5 text-sm font-black shadow-hard-sm transition-transform hover:-translate-y-0.5 active:translate-y-0">
              {action.icon}
              {action.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button type="button" onClick={secondaryAction.onClick} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-white/70 px-5 text-sm font-black">
              {secondaryAction.icon}
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
