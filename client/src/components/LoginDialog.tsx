import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { closeLoginDialog, openLoginDialog, useLoginDialogOpen } from "@/hooks/useAppAuth";
import { authStore, consumeAuthLinkError, friendlyAuthError, useSupabaseSession } from "@/lib/supabase/auth";

const RESEND_SECONDS = 60;

/** Inicio de sesión con Supabase: email → código de 6 dígitos (o enlace mágico del email). */
export default function LoginDialog() {
  const open = useLoginDialogOpen();
  const { session, ready } = useSupabaseSession();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Si el enlace mágico trae un error, abrimos el diálogo para explicarlo.
  useEffect(() => {
    if (!ready) return;
    const linkError = consumeAuthLinkError();
    if (linkError) {
      setError(linkError);
      openLoginDialog();
    }
  }, [ready]);

  useEffect(() => {
    if (open && session) {
      closeLoginDialog();
      toast.success("Sesión iniciada. ¡Bienvenido a tu atlas!");
    }
  }, [open, session]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, step]);

  const store = authStore;
  if (!store) return null;

  const sendCode = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Escribe un email válido.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await store.requestEmailCode(email, window.location.origin + window.location.pathname);
      setStep("code");
      setCode("");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.replace(/\D/g, "").length < 6) {
      setError("El código tiene 6 dígitos.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await store.verifyEmailCode(email, code.replace(/\D/g, ""));
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    closeLoginDialog();
    setError(null);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            exit={{ y: 12 }}
            className="relative w-full max-w-md rounded-[2rem] border-2 border-ink bg-cream p-6 text-ink shadow-hard sm:p-7"
          >
            <button type="button" onClick={close} aria-label="Cerrar" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-white/70 transition-transform hover:rotate-90">
              <X size={18} />
            </button>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink bg-orange shadow-hard-sm">
              {step === "email" ? <Mail size={24} /> : <Sparkles size={24} />}
            </div>
            <h2 id="login-title" className="mt-5 !text-4xl">
              {step === "email" ? "Entra en tu atlas." : "Revisa tu correo."}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ink/65">
              {step === "email" ? (
                "Te enviaremos un código para entrar sin contraseña. Si es tu primera vez, crearemos tu cuenta."
              ) : (
                <>
                  Hemos enviado un código a <strong className="text-ink">{email.trim()}</strong>. Escríbelo aquí o abre el enlace del email en este dispositivo.
                </>
              )}
            </p>

            <form
              className="mt-6 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void (step === "email" ? sendCode() : verify());
              }}
            >
              {step === "email" ? (
                <label className="block text-xs font-black uppercase tracking-wider">
                  Email
                  <input
                    ref={inputRef}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tu@email.com"
                    className="mt-2 w-full rounded-xl border-2 border-ink bg-white/80 px-4 py-3 text-[17px] font-bold normal-case tracking-normal outline-none focus:ring-4 focus:ring-orange/40"
                  />
                </label>
              ) : (
                <label className="block text-xs font-black uppercase tracking-wider">
                  Código
                  <input
                    ref={inputRef}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    maxLength={10}
                    onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, ""))}
                    placeholder="123456"
                    className="mt-2 w-full rounded-xl border-2 border-ink bg-white/80 px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.4em] outline-none focus:ring-4 focus:ring-orange/40"
                  />
                </label>
              )}
              {error ? (
                <p role="alert" className="rounded-xl border-2 border-[#b44728] bg-[#f2c5a0]/60 px-3 py-2 text-sm font-bold text-[#7a2c16]">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-orange text-sm font-black shadow-hard-sm transition-transform active:translate-y-0.5 disabled:opacity-60">
                {busy ? <Loader2 size={17} className="animate-spin" /> : null}
                {step === "email" ? "Enviar código" : "Entrar"}
              </button>
            </form>

            {step === "code" ? (
              <div className="mt-4 flex items-center justify-between text-sm font-black">
                <button type="button" onClick={() => { setStep("email"); setError(null); }} className="flex min-h-11 items-center gap-1 underline">
                  <ArrowLeft size={15} /> Cambiar email
                </button>
                <button type="button" disabled={cooldown > 0 || busy} onClick={() => void sendCode()} className="min-h-11 underline disabled:no-underline disabled:opacity-50">
                  {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
                </button>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
