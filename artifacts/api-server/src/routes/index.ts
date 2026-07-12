import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import otpRouter from "./otp";
import eventsRouter from "./events";
import usersRouter from "./users";
import ordersRouter from "./orders";
import summaryRouter from "./summary";
import recipesRouter from "./recipes";
import adminUsersRouter from "./admin-users";
import settingsRouter from "./settings";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(otpRouter);
router.use(eventsRouter);
router.use(usersRouter);
router.use(ordersRouter);
router.use(summaryRouter);
router.use(recipesRouter);
router.use(adminUsersRouter);
router.use(settingsRouter);
router.use(storageRouter);

export default router;
