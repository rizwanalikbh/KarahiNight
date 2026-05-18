import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import eventsRouter from "./events";
import usersRouter from "./users";
import ordersRouter from "./orders";
import summaryRouter from "./summary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(eventsRouter);
router.use(usersRouter);
router.use(ordersRouter);
router.use(summaryRouter);

export default router;
