import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Spinner } from "../components/Spinner";
import { useChangePassword, useProfile, useUpdateProfile } from "../services/profile";
import { toastError, toastSuccess } from "../store/useToastStore";

export function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setDepartment(profile.department ?? "");
  }, [profile]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync({
        firstName,
        lastName,
        department: profile?.role === "TEACHER" ? department : undefined,
      });
      toastSuccess("Profil mis à jour.");
    } catch {
      toastError("Impossible de mettre à jour le profil.");
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toastError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      toastSuccess("Mot de passe modifié.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        toastError("Mot de passe actuel incorrect.");
      } else if (isAxiosError(err) && err.response?.status === 422) {
        toastError((err.response.data as { message?: string })?.message ?? "Requête invalide.");
      } else {
        toastError("Impossible de modifier le mot de passe.");
      }
    }
  }

  if (isLoading || !profile) return <Spinner />;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Mon profil</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Gérez vos informations personnelles et votre mot de passe.
      </p>

      <form
        onSubmit={handleSaveProfile}
        className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Informations</h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
          <input
            value={profile.email}
            disabled
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Prénom</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Nom</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        {profile.role === "TEACHER" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Département</label>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Ex : Informatique de gestion"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
        )}

        {profile.formation && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Filière :{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">{profile.formation.name}</span>
            {profile.level && ` — ${profile.level.name}`}
          </p>
        )}

        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Enregistrer
        </button>
      </form>

      <form
        onSubmit={handleChangePassword}
        className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Changer le mot de passe</h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Mot de passe actuel
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Confirmer</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={changePassword.isPending}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Changer le mot de passe
        </button>
      </form>
    </div>
  );
}
