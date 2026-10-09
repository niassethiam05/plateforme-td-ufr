export type Role = "STUDENT" | "TEACHER" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  avatarUrl?: string | null;
  // Present uniquement pour un STUDENT : sa filiere et son niveau
  // d'inscription, utilises pour restreindre le catalogue.
  formation?: { id: string; name: string; code: string };
  level?: { id: string; name: string };
  // Present uniquement pour un TEACHER, via /profile.
  department?: string | null;
}

export interface Formation {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  _count?: { levels: number; students: number };
}

export interface Level {
  id: string;
  formationId: string;
  name: string;
  order: number;
  formation?: Formation;
  _count?: { semesters: number };
}

export interface AcademicYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface Semester {
  id: string;
  levelId: string;
  academicYearId: string;
  name: string;
  order: number;
  level?: Level & { formation: Formation };
  academicYear?: AcademicYear;
  _count?: { subjects: number };
}

export interface TeacherProfile {
  id: string;
  department?: string | null;
  bio?: string | null;
  user: AuthUser;
}

export interface Subject {
  id: string;
  semesterId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  mainTeacherId?: string | null;
  mainTeacher?: TeacherProfile | null;
  semester?: Semester;
  _count?: { tdFiles: number };
}

export type TdFileStatus = "DRAFT" | "PENDING" | "VALIDATED" | "REJECTED" | "PUBLISHED";

export interface TdFile {
  id: string;
  title: string;
  description?: string | null;
  tdNumber?: number | null;
  status: TdFileStatus;
  adminComment?: string | null;
  fileSize: number;
  fileType: string;
  downloadCount: number;
  viewCount: number;
  publishedAt?: string | null;
  createdAt: string;
  subjectId: string;
  teacherId: string;
  academicYearId: string;
  subject?: Subject;
  teacher?: TeacherProfile;
  academicYear?: AcademicYear;
  isFavorite?: boolean;
}

export type ReportStatus = "PENDING" | "RESOLVED" | "DISMISSED";

export interface Report {
  id: string;
  userId: string;
  tdFileId: string;
  reason: string;
  description?: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string | null;
  tdFile?: TdFile;
  user?: { id: string; firstName: string; lastName: string; email: string };
}

export type NotificationType =
  | "TD_PUBLISHED"
  | "TD_VALIDATED"
  | "TD_REJECTED"
  | "TD_NEEDS_CHANGES"
  | "REPORT_UPDATE"
  | "GENERAL";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface DownloadHistoryItem {
  id: string;
  downloadedAt: string;
  tdFile: TdFile;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  // Renseigne par l'administration quand elle valide un compte enseignant.
  // isActive=false + teacherApprovedAt=null = demande en attente de validation.
  // isActive=false + teacherApprovedAt*renseigne = compte valide puis desactive.
  teacherApprovedAt?: string | null;
  createdAt: string;
  student?: { formation: Formation; level: Level } | null;
  teacher?: { department?: string | null } | null;
}

export interface AdminStats {
  students: number;
  teachers: number;
  subjects: number;
  tdFiles: number;
  published: number;
  pending: number;
  downloads: number;
  pendingReports: number;
  mostDownloaded: { id: string; title: string; downloadCount: number }[];
}

export interface TeacherStats {
  total: number;
  published: number;
  pending: number;
  rejected: number;
  totalDownloads: number;
  mostPopular: { id: string; title: string; downloadCount: number }[];
}
