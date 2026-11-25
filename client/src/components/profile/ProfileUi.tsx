import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { Link } from "wouter";
import { initialsOf } from "@/lib/profile";

export function Section({ id, eyebrow, title, description, action, children }: { id: string; eyebrow: string; title: string; description?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 rounded-[1.75rem] border-2 border-ink bg-white/60 p-5 shadow-hard-sm sm:rounded-[2rem] sm:p-8 lg:scroll-mt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange">{eyebrow}</p>
          <h2 id={`${id}-title`} className="mt-1 !text-[clamp(1.75rem,4vw,2.5rem)]">
            {title}
          </h2>
          {description ? <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-ink/60 sm:text-base">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-5 sm:mt-6">{children}</div>
    </section>
  );
}

type FieldProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  prefix?: ReactNode;
  counter?: { value: number; max: number };
  multiline?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "prefix">;

export function Field({ label, error, hint, prefix, counter, multiline = false, inputRef, value, onChange, id, ...input }: FieldProps) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\W+/g, "-")}`;
  const describedBy = [error ? `${fieldId}-error` : null, hint ? `${fieldId}-hint` : null].filter(Boolean).join(" ") || undefined;
  const base = "w-full min-w-0 bg-transparent text-[17px] font-bold outline-none placeholder:font-medium placeholder:text-ink/35";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-xs font-black uppercase tracking-wider">
          {label}
        </label>
        {counter ? (
          <span className={`text-xs font-bold tabular-nums ${counter.value > counter.max ? "text-[#b44728]" : "text-ink/45"}`} aria-live="polite">
            {counter.value}/{counter.max}
          </span>
        ) : null}
      </div>
      <div className={`mt-2 flex items-start gap-1 rounded-xl border-2 bg-white/80 px-4 py-3 focus-within:ring-4 focus-within:ring-orange/40 ${error ? "border-[#b44728]" : "border-ink"}`}>
        {prefix ? <span className="shrink-0 text-[17px] font-black text-ink/40">{prefix}</span> : null}
        {multiline ? (
          <textarea id={fieldId} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={describedBy} placeholder={input.placeholder} rows={3} className={`${base} min-h-20 resize-y font-medium`} />
        ) : (
          <input ref={inputRef} id={fieldId} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={describedBy} className={base} {...input} />
        )}
      </div>
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1.5 text-sm font-bold text-[#9a3a1f]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-sm font-medium text-ink/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Avatar({ name, url, size = 96, className = "" }: { name: string; url: string | null; size?: number; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-orange font-display text-ink ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" draggable={false} /> : <span aria-hidden>{initialsOf(name)}</span>}
    </span>
  );
}

/** Fila de acción (cuenta, legal…): icono, texto y flecha o control a la derecha. */
export function ActionRow({ icon, title, description, onClick, href, tone = "default", trailing, external = false }: { icon: ReactNode; title: string; description?: string; onClick?: () => void; href?: string; tone?: "default" | "danger"; trailing?: ReactNode; external?: boolean }) {
  const content = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink ${tone === "danger" ? "bg-[#f2c5a0]" : "bg-cream"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-base font-black leading-tight ${tone === "danger" ? "text-[#9a3a1f]" : ""}`}>{title}</span>
        {description ? <span className="mt-0.5 block text-sm font-medium leading-snug text-ink/55">{description}</span> : null}
      </span>
      {trailing}
    </>
  );
  const className = "flex w-full min-h-16 items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-cream/80 sm:px-3";
  if (href && external) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
