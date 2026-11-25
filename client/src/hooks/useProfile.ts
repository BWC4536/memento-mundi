import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppUser } from "@/hooks/useAppAuth";
import { getBrowserStorage } from "@/lib/composition-storage";
import { prepareImageForCanvas } from "@/lib/image-upload";
import type { Profile, ProfileUpdate, UgcPlatform, UserSettings } from "@/lib/profile";
import { authStore, supabaseClient } from "@/lib/supabase/auth";
import { createCloudProfileRepository, createLocalProfileRepository, describeProfileError, type ProfileBundle } from "@/lib/supabase/profile-repository";

export const AVATAR_SIZE = 512;

/** Perfil del usuario con sesión: carga, edición, avatar, ajustes, recompensas y borrado de cuenta. */
export function useProfile(user: AppUser | null, provider: "supabase" | "manus") {
  const userId = user?.id ?? null;
  const email = user?.email ?? null;
  const name = user?.name ?? "Viajero";

  const repository = useMemo(() => {
    if (!userId) return null;
    const sessionUser = { id: userId, email, name };
    if (provider === "supabase" && supabaseClient && authStore) {
      return createCloudProfileRepository({ client: supabaseClient, getAccessToken: () => authStore!.getAccessToken(), user: sessionUser });
    }
    return createLocalProfileRepository(sessionUser, getBrowserStorage());
  }, [email, name, provider, userId]);

  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [loading, setLoading] = useState(!!repository);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!repository) {
      setBundle(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBundle(await repository.load());
    } catch (err) {
      setError(describeProfileError(err));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setProfile = (profile: Profile) => setBundle((current) => (current ? { ...current, profile } : current));

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; message: string }> => {
      try {
        return { ok: true, value: await action() };
      } catch (err) {
        return { ok: false, message: describeProfileError(err) };
      }
    },
    [],
  );

  const saveProfile = useCallback(
    (update: ProfileUpdate) =>
      run(async () => {
        if (!repository) throw new Error("Inicia sesión para editar tu perfil.");
        const profile = await repository.updateProfile(update);
        setProfile(profile);
        return profile;
      }),
    [repository, run],
  );

  const uploadAvatar = useCallback(
    (file: File) =>
      run(async () => {
        if (!repository || !bundle) throw new Error("Inicia sesión para cambiar tu foto.");
        const prepared = await prepareImageForCanvas(file, { maxSide: AVATAR_SIZE, quality: 0.86 });
        const blob = await (await fetch(prepared.src)).blob();
        const profile = await repository.uploadAvatar(blob, bundle.profile.avatarUrl);
        setProfile(profile);
        return profile;
      }),
    [bundle, repository, run],
  );

  const removeAvatar = useCallback(
    () =>
      run(async () => {
        if (!repository || !bundle) throw new Error("Inicia sesión para cambiar tu foto.");
        const profile = await repository.removeAvatar(bundle.profile.avatarUrl);
        setProfile(profile);
        return profile;
      }),
    [bundle, repository, run],
  );

  const saveSettings = useCallback(
    (settings: UserSettings) =>
      run(async () => {
        if (!repository) throw new Error("Inicia sesión para cambiar tus ajustes.");
        const saved = await repository.updateSettings(settings);
        setBundle((current) => (current ? { ...current, settings: saved } : current));
        return saved;
      }),
    [repository, run],
  );

  const submitClaim = useCallback(
    (platform: UgcPlatform, proofUrl: string) =>
      run(async () => {
        if (!repository) throw new Error("Inicia sesión para pedir tu recompensa.");
        const claim = await repository.submitClaim(platform, proofUrl);
        setBundle((current) => (current ? { ...current, claims: [claim, ...current.claims] } : current));
        return claim;
      }),
    [repository, run],
  );

  const deleteAccount = useCallback(
    () =>
      run(async () => {
        if (!repository) throw new Error("Inicia sesión para eliminar tu cuenta.");
        await repository.deleteAccount();
      }),
    [repository, run],
  );

  return { bundle, loading, error, reload, saveProfile, uploadAvatar, removeAvatar, saveSettings, submitClaim, deleteAccount };
}

export type ProfileController = ReturnType<typeof useProfile>;
