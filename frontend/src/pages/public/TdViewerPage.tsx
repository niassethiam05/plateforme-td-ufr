import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FavoriteButton } from "../../components/FavoriteButton";
import { Modal } from "../../components/Modal";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { useCreateReport } from "../../services/reports";
import { requestTdFileDownloadUrl, requestTdFileViewUrl, useTdFile } from "../../services/td";
import { useAuthStore } from "../../store/useAuthStore";
import { toastError, toastSuccess } from "../../store/useToastStore";

const REPORT_REASONS = [
  "Fichier corrompu ou illisible",
  "Contenu incorrect ou hors-sujet",
  "Contenu inapproprié",
  "Problème de droits d'auteur",
  "Autre",
];

export function TdViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { data: td, isLoading, isError, error } = useTdFile(id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [viewError, setViewError] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDescription, setReportDescription] = useState("");
  const createReport = useCreateReport();

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    let cancelled = false;
    requestTdFileViewUrl(id)
      .then((url) => {
        if (!cancelled) setViewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setViewError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated]);

  async function handleDownload() {
    if (!id) return;
    try {
      const url = await requestTdFileDownloadUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toastError("Impossible de télécharger cette fiche.");
    }
  }

  async function handleReport() {
    if (!id) return;
    try {
      await createReport.mutateAsync({ tdFileId: id, reason: reportReason, description: reportDescription || undefined });
      toastSuccess("Signalement envoyé, merci. Un administrateur va l'examiner.");
      setReportOpen(false);
      setReportDescription("");
      setReportReason(REPORT_REASONS[0]);
    } catch (err) {
      // 409 : signalement deja en cours sur cette fiche. Le backend l'explique,
      // on affiche son message plutot qu'un echec generique.
      const alreadyReported =
        isAxiosError(err) && err.response?.status === 409
          ? (err.response.data as { message?: string } | undefined)?.message
          : undefined;
      toastError(alreadyReported ?? "Impossible d'envoyer ce signalement pour le moment.");
      if (alreadyReported) setReportOpen(false);
    }
  }

  if (isLoading) return <Spinner />;
  if (isError || !td) {
    // Un refus explicite (403, ex: fiche d'une autre filiere) porte un
    // message clair renvoye par le backend ; toute autre erreur (fiche
    // inexistante ou non publiee) garde un message generique pour ne pas
    // confirmer l'existence d'un brouillon.
    const explicitMessage =
      isAxiosError(error) && error.response?.status === 403
        ? (error.response.data as { message?: string } | undefined)?.message
        : undefined;

    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-slate-600 dark:text-slate-300">
          {explicitMessage ?? "Cette fiche est introuvable ou n'est pas publiée."}
        </p>
        <Link to="/catalogue" className="mt-4 inline-block text-brand-600 hover:underline">
          Retour au catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
      <div className="lg:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" style={{ height: "80vh" }}>
          {!isAuthenticated ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Connectez-vous pour visualiser cette fiche dans le navigateur.
              </p>
              <Link
                to="/connexion"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Se connecter
              </Link>
            </div>
          ) : viewError ? (
            <div className="flex h-full items-center justify-center text-sm text-red-500">
              Impossible de charger l'aperçu de cette fiche.
            </div>
          ) : !viewUrl ? (
            <Spinner label="Chargement du document..." />
          ) : (
            <iframe title={td.title} src={viewUrl} className="h-full w-full" />
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{td.title}</h1>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={td.status} />
              {id && <FavoriteButton tdFileId={id} isFavorite={!!td.isFavorite} />}
            </div>
          </div>
          {td.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{td.description}</p>}

          <dl className="mt-4 space-y-1 text-sm text-slate-500 dark:text-slate-400">
            <div>Matière : {td.subject?.name}</div>
            <div>
              Formation : {td.subject?.semester?.level?.formation.code} — {td.subject?.semester?.level?.name}
            </div>
            <div>Semestre : {td.subject?.semester?.name}</div>
            <div>
              Enseignant : {td.teacher ? `${td.teacher.user.firstName} ${td.teacher.user.lastName}` : "—"}
            </div>
            <div>{td.downloadCount} téléchargement(s)</div>
          </dl>

          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleDownload}
              className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Télécharger le PDF
            </button>
          ) : (
            <Link
              to="/connexion"
              className="mt-4 block w-full rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
            >
              Se connecter pour télécharger
            </Link>
          )}

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="mt-2 w-full text-center text-xs font-medium text-slate-400 hover:text-red-500"
            >
              Signaler un problème sur cette fiche
            </button>
          )}
        </div>
      </aside>

      <Modal
        open={reportOpen}
        title="Signaler cette fiche"
        onClose={() => setReportOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleReport}
              disabled={createReport.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Envoyer le signalement
            </button>
          </>
        }
      >
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Motif</label>
        <select
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          {REPORT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Détails (facultatif)
        </label>
        <textarea
          rows={3}
          value={reportDescription}
          onChange={(e) => setReportDescription(e.target.value)}
          placeholder="Précisez le problème rencontré..."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </Modal>
    </div>
  );
}
