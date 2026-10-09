import { Route, Routes } from "react-router-dom";
import { PublicLayout } from "../layouts/PublicLayout";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";

import { HomePage } from "../pages/public/HomePage";
import { CataloguePage } from "../pages/public/CataloguePage";
import { LoginPage } from "../pages/public/LoginPage";
import { RegisterPage } from "../pages/public/RegisterPage";
import { ForgotPasswordPage } from "../pages/public/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/public/ResetPasswordPage";
import { AboutPage } from "../pages/public/AboutPage";
import { TdViewerPage } from "../pages/public/TdViewerPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { NotificationsPage } from "../pages/NotificationsPage";
import { ProfilePage } from "../pages/ProfilePage";

import { StudentDashboard } from "../pages/student/StudentDashboard";
import { FavoritesPage } from "../pages/student/FavoritesPage";
import { DownloadHistoryPage } from "../pages/student/DownloadHistoryPage";

import { TeacherDashboard } from "../pages/teacher/TeacherDashboard";
import { MyTdFilesPage } from "../pages/teacher/MyTdFilesPage";
import { AddTdFilePage } from "../pages/teacher/AddTdFilePage";
import { TeacherStatsPage } from "../pages/teacher/TeacherStatsPage";

import { AdminDashboard } from "../pages/admin/AdminDashboard";
import { UsersPage } from "../pages/admin/UsersPage";
import { FormationsPage } from "../pages/admin/FormationsPage";
import { LevelsPage } from "../pages/admin/LevelsPage";
import { SemestersPage } from "../pages/admin/SemestersPage";
import { SubjectsPage } from "../pages/admin/SubjectsPage";
import { AcademicYearsPage } from "../pages/admin/AcademicYearsPage";
import { AdminTdFilesPage } from "../pages/admin/AdminTdFilesPage";
import { ValidationPage } from "../pages/admin/ValidationPage";
import { ReportsPage } from "../pages/admin/ReportsPage";

const studentLinks = [
  { to: "/student", label: "Tableau de bord" },
  { to: "/student/favoris", label: "Mes favoris" },
  { to: "/student/historique", label: "Historique" },
  { to: "/student/profil", label: "Mon profil" },
];

const teacherLinks = [
  { to: "/teacher", label: "Tableau de bord" },
  { to: "/teacher/fiches", label: "Mes fiches" },
  { to: "/teacher/fiches/ajouter", label: "Ajouter une fiche" },
  { to: "/teacher/statistiques", label: "Statistiques" },
  { to: "/teacher/profil", label: "Mon profil" },
];

const adminLinks = [
  { to: "/admin", label: "Tableau de bord" },
  { to: "/admin/utilisateurs", label: "Utilisateurs" },
  { to: "/admin/formations", label: "Formations" },
  { to: "/admin/niveaux", label: "Niveaux" },
  { to: "/admin/annees", label: "Années universitaires" },
  { to: "/admin/semestres", label: "Semestres" },
  { to: "/admin/matieres", label: "Matières" },
  { to: "/admin/fiches", label: "Fiches" },
  { to: "/admin/validation", label: "Validation" },
  { to: "/admin/signalements", label: "Signalements" },
  { to: "/admin/statistiques", label: "Statistiques" },
];

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/catalogue" element={<CataloguePage />} />
        <Route path="/fiches/:id" element={<TdViewerPage />} />
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<RegisterPage />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
        <Route path="/reinitialiser-mot-de-passe" element={<ResetPasswordPage />} />
        <Route path="/a-propos" element={<AboutPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<PublicLayout />}>
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["STUDENT"]} />}>
        <Route element={<DashboardLayout title="Espace étudiant" links={studentLinks} />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/favoris" element={<FavoritesPage />} />
          <Route path="/student/historique" element={<DownloadHistoryPage />} />
          <Route path="/student/profil" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["TEACHER"]} />}>
        <Route element={<DashboardLayout title="Espace enseignant" links={teacherLinks} />}>
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/fiches" element={<MyTdFilesPage />} />
          <Route path="/teacher/fiches/ajouter" element={<AddTdFilePage />} />
          <Route path="/teacher/statistiques" element={<TeacherStatsPage />} />
          <Route path="/teacher/profil" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
        <Route element={<DashboardLayout title="Administration" links={adminLinks} />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/utilisateurs" element={<UsersPage />} />
          <Route path="/admin/formations" element={<FormationsPage />} />
          <Route path="/admin/niveaux" element={<LevelsPage />} />
          <Route path="/admin/annees" element={<AcademicYearsPage />} />
          <Route path="/admin/semestres" element={<SemestersPage />} />
          <Route path="/admin/matieres" element={<SubjectsPage />} />
          <Route path="/admin/fiches" element={<AdminTdFilesPage />} />
          <Route path="/admin/validation" element={<ValidationPage />} />
          <Route path="/admin/signalements" element={<ReportsPage />} />
          <Route path="/admin/statistiques" element={<AdminDashboard />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
