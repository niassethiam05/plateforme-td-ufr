import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import formationRoutes from "./formation.routes";
import levelRoutes from "./level.routes";
import semesterRoutes from "./semester.routes";
import subjectRoutes from "./subject.routes";
import academicYearRoutes from "./academicYear.routes";
import tdRoutes from "./td.routes";
import userRoutes from "./user.routes";
import statsRoutes from "./stats.routes";
import favoriteRoutes from "./favorite.routes";
import downloadRoutes from "./download.routes";
import notificationRoutes from "./notification.routes";
import reportRoutes from "./report.routes";
import profileRoutes from "./profile.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/formations", formationRoutes);
router.use("/levels", levelRoutes);
router.use("/semesters", semesterRoutes);
router.use("/subjects", subjectRoutes);
router.use("/academic-years", academicYearRoutes);
router.use("/td", tdRoutes);
router.use("/users", userRoutes);
router.use("/stats", statsRoutes);
router.use("/favorites", favoriteRoutes);
router.use("/downloads", downloadRoutes);
router.use("/notifications", notificationRoutes);
router.use("/reports", reportRoutes);
router.use("/profile", profileRoutes);

export default router;
