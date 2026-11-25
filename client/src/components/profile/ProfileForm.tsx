import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ProfileController } from "@/hooks/useProfile";
import { IMAGE_INPUT_ACCEPT } from "@/lib/image-upload";
import { draftFromProfile, isDraftDirty, LIMITS, validateDraft, type DraftErrors, type Profile, type ProfileDraft } from "@/lib/profile";
import { Avatar, Field, Section } from "./ProfileUi";

export type ProfileFormHandle = { focus: () => void };

/** Edición de datos de perfil y redes sociales. */
const ProfileForm = forwardRef<ProfileFormHandle, { profile: Profile; controller: ProfileController }>(function ProfileForm({ profile, controller }, ref) {
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => nameRef.current?.focus({ preventScroll: true }) }), []);

  // Si el perfil cambia desde fuera (p. ej. al recargar) y no hay cambios sin guardar, lo reflejamos.
  const dirty = isDraftDirty(draft, profile);
  useEffect(() => {
    if (!dirty) setDraft(draftFromProfile(profile));
  }, [profile]);

  const update = (key: keyof ProfileDraft) => (value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = async () => {
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      toast.error("Revisa los campos marcados.");
      return;
    }
    setSaving(true);
    const saved = await controller.saveProfile(result.update);
    setSaving(false);
    if (saved.ok) {
      setDraft(draftFromProfile(saved.value));
      setErrors({});
      toast.success("Perfil guardado.");
    } else if (/usuario/i.test(saved.message)) {
      setErrors({ username: saved.message });
    } else toast.error(saved.message);
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setAvatarBusy(true);
    const result = await controller.uploadAvatar(file);
    setAvatarBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (result.ok) toast.success("Foto actualizada.");
    else toast.error(result.message);
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    const result = await controller.removeAvatar();
    setAvatarBusy(false);
    if (!result.ok) toast.error(result.message);
  };

  return (
    <Section id="perfil" eyebrow="Datos de perfil" title="Cómo te ven." description="Tu nombre, tu foto y tus redes aparecen en los scrapbooks que compartes. Tu email nunca se muestra.">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-5"
      >
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-dashed border-ink/30 p-4 min-[420px]:flex-row min-[420px]:items-center">
          <div className="relative w-fit">
            <Avatar name={draft.displayName || profile.displayName} url={profile.avatarUrl} size={72} />
            {avatarBusy ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/50 text-cream">
                <Loader2 size={20} className="animate-spin" aria-label="Subiendo foto" />
              </span>
            ) : null}
          </div>
          <div className="flex flex-1 flex-wrap gap-2">
            <input ref={fileRef} type="file" accept={IMAGE_INPUT_ACCEPT} className="sr-only" id="avatar-input" onChange={(event) => void pickAvatar(event.target.files?.[0])} />
            <button type="button" disabled={avatarBusy} onClick={() => fileRef.current?.click()} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-cream px-4 text-sm font-black disabled:opacity-60">
              <Camera size={16} /> {profile.avatarUrl ? "Cambiar foto" : "Subir foto"}
            </button>
            {profile.avatarUrl ? (
              <button type="button" disabled={avatarBusy} onClick={() => void removeAvatar()} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-[#9a3a1f] underline-offset-2 hover:underline disabled:opacity-60">
                <Trash2 size={15} /> Quitar
              </button>
            ) : null}
            <p className="w-full text-xs font-medium text-ink/50">JPG, PNG, WEBP o HEIC. La recortamos a 512 px.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field inputRef={nameRef} id="profile-name" label="Nombre" value={draft.displayName} onChange={update("displayName")} error={errors.displayName} autoComplete="name" maxLength={LIMITS.displayName + 10} placeholder="Cómo quieres que te llamen" counter={{ value: draft.displayName.trim().length, max: LIMITS.displayName }} />
          <Field id="profile-username" label="Usuario" prefix="@" value={draft.username} onChange={(value) => update("username")(value.toLowerCase())} error={errors.username} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={LIMITS.username + 1} placeholder="tu.usuario" hint="Minúsculas, números, punto y guion bajo." />
        </div>

        <Field id="profile-bio" label="Biografía" multiline value={draft.bio} onChange={update("bio")} error={errors.bio} placeholder="Viajes lentos, cuadernos llenos y mapas doblados." counter={{ value: draft.bio.trim().length, max: LIMITS.bio }} />

        <fieldset>
          <legend className="text-[10px] font-black uppercase tracking-[0.2em] text-orange">Redes sociales</legend>
          <div className="mt-3 grid gap-5 md:grid-cols-3">
            <Field id="profile-instagram" label="Instagram" prefix="@" value={draft.instagram} onChange={update("instagram")} error={errors.instagram} autoCapitalize="none" spellCheck={false} placeholder="usuario" />
            <Field id="profile-tiktok" label="TikTok" prefix="@" value={draft.tiktok} onChange={update("tiktok")} error={errors.tiktok} autoCapitalize="none" spellCheck={false} placeholder="usuario" />
            <Field id="profile-website" label="Web" type="url" inputMode="url" value={draft.website} onChange={update("website")} error={errors.website} autoCapitalize="none" spellCheck={false} placeholder="tudominio.com" />
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t-2 border-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-end">
          {dirty ? <p className="text-sm font-bold text-ink/55 sm:mr-auto" role="status">Tienes cambios sin guardar.</p> : null}
          <button type="button" disabled={!dirty || saving} onClick={() => { setDraft(draftFromProfile(profile)); setErrors({}); }} className="min-h-12 rounded-xl border-2 border-ink bg-white/70 px-5 text-sm font-black disabled:opacity-40">
            Descartar
          </button>
          <button type="submit" disabled={!dirty || saving} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-orange px-6 text-sm font-black shadow-hard-sm disabled:opacity-50 disabled:shadow-none">
            {saving ? <Loader2 size={16} className="animate-spin" /> : null} Guardar cambios
          </button>
        </div>
      </form>
    </Section>
  );
});

export default ProfileForm;
