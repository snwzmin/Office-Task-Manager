import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tasksRouter from "./tasks";
import commentsRouter from "./comments";
import attachmentsRouter from "./attachments";
import activityRouter from "./activity";
import categoriesRouter from "./categories";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import uploadRouter from "./upload";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tasksRouter);
router.use(commentsRouter);
router.use(attachmentsRouter);
router.use(activityRouter);
router.use(categoriesRouter);
router.use(usersRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(uploadRouter);
router.use(storageRouter);

export default router;
