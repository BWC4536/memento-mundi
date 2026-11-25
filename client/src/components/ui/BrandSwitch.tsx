import { useId, type ReactNode } from "react";

type BrandSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Muestra "Siempre activo" en lugar del interruptor. */
  locked?: boolean;
};

/** Fila de ajuste con interruptor accesible (role="switch"). Toda la fila es pulsable. */
export default function BrandSwitch({ checked, onChange, label, description, disabled = false, locked = false }: BrandSwitchProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p id={labelId} className="text-base font-black leading-tight">
          {label}
        </p>
        {description ? (
          <p id={descriptionId} className="mt-1 text-sm font-medium leading-snug text-ink/60">
            {description}
          </p>
        ) : null}
      </div>
      {locked ? (
        <span className="shrink-0 rounded-full border-2 border-ink/20 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-ink/55">Siempre activo</span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          aria-describedby={description ? descriptionId : undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative mt-0.5 h-8 w-14 shrink-0 rounded-full border-2 border-ink transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${checked ? "bg-orange" : "bg-white/70"}`}
        >
          <span className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-ink transition-[left] duration-200 ${checked ? "left-[calc(100%-1.5rem)] bg-ink" : "left-1 bg-cream"}`} />
        </button>
      )}
    </div>
  );
}
