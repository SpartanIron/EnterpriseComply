import { Router, type IRouter } from "express";
import healthRouter from "./health";
import postureRouter from "./posture";
import controlsRouter from "./controls";
import frameworksRouter from "./frameworks";
import assetsRouter from "./assets";
import risksRouter from "./risks";
import findingsRouter from "./findings";
import telemetryRouter from "./telemetry";
import graphRouter from "./graph";
import evidenceRouter from "./evidence";

const router: IRouter = Router();

router.use(healthRouter);
router.use(postureRouter);
router.use(controlsRouter);
router.use(frameworksRouter);
router.use(assetsRouter);
router.use(risksRouter);
router.use(findingsRouter);
router.use(telemetryRouter);
router.use(graphRouter);
router.use(evidenceRouter);

export default router;
