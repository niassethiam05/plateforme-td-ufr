import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import type { AuthUser } from "../../types";
import { useFormations, useLevels } from "../../services/academic";

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "STUDENT" as "STUDENT" | "TEACHER",
    formationId: "",
    levelId: "",
  });
  const [error, setError] = useState<string | null>(null);
  // Message de confirmation pour un compte enseignant : aucune session n'est
  // ouverte dans ce cas, donc pas de redirection vers l'application.
  const [pendingApproval, setPendingApproval] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: formations } = useFormations();
  const { data: levels } = useLevels(form.formationId || undefined);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // role "ADMIN" n'est pas proposé et le backend le refuse : un visiteur
      // ne peut pas s'auto-attribuer un rôle d'administration.
      // Un compte TEACHER est créé inactif, en attente de validation par
      // l'administration : le backend ne renvoie alors aucun token.
      //
      // formationId/levelId ne sont envoyés que pour un étudiant. Les champs
      // restent dans l'état du formulaire ("" quand l'utilisateur n'a pas
      // choisi), or une chaîne vide n'est pas un UUID valide : le backend la
      // rejetait en 422 même pour un compte enseignant. Le `.optional()` du
      // schéma ne couvre pas ce cas, car "" est une valeur présente.
      const isStudent = form.role === "STUDENT";

      const { data } = await api.post<{
        user: AuthUser;
        accessToken?: string;
        pendingApproval?: boolean;
      }>("/auth/register", {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(isStudent ? { formationId: form.formationId, levelId: form.levelId } : {}),
      });

      if (data.pendingApproval) {
        setPendingApproval(true);
        return;
      }

      if (!data.accessToken) {
        setError("Réponse inattendue du serveur. Veuillez réessayer.");
        return;
      }

      setAuth(data.user, data.accessToken);
      navigate(`/${data.user.role.toLowerCase()}`);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Une erreur est survenue. Veuillez réessayer.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const isStudent = form.role === "STUDENT";

  if (pendingApproval) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Demande enregistrée
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Votre compte enseignant a bien été créé. Il devient actif après validation par
          l'administration de l'UFR ; vous pourrez alors vous connecter avec cette adresse email.
        </p>
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Vous ne pouvez pas encore vous connecter tant que votre compte n'a pas été validé.
        </p>
        <Link
          to="/connexion"
          className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Créer un compte</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Rejoignez la plateforme de fiches de TD de votre UFR. Un compte enseignant doit être validé
        par l'administration avant sa première connexion.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Type de compte
          </label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => update("role", "STUDENT")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                isStudent
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              Étudiant
            </button>
            <button
              type="button"
              onClick={() => update("role", "TEACHER")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                !isStudent
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              Enseignant
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Prénom</label>
            <input
              required
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Nom</label>
            <input
              required
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Mot de passe</label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <p className="mt-1 text-xs text-slate-400">Au moins 8 caractères.</p>
        </div>

{isStudent && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Formation
              </label>
              <select
                required
                value={form.formationId}
                onChange={(e) => {
                  update("formationId", e.target.value);
                  update("levelId", "");
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="" disabled>
                  Choisir...
                </option>
                {formations?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Niveau
              </label>
              <select
                required
                disabled={!form.formationId}
                value={form.levelId}
                onChange={(e) => update("levelId", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="" disabled>
                  Choisir...
                </option>
                {levels?.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Création en cours..."
            : isStudent
              ? "Créer mon compte"
              : "Envoyer ma demande"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Déjà un compte ?{" "}
        <Link to="/connexion" className="font-medium text-brand-600 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
