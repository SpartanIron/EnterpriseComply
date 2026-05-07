import { Router, type IRouter } from "express";
import healthRouter from "./health";
import orgsRouter from "./orgs";
import frameworksRouter from "./frameworks";
import controlsRouter from "./controls";
import integrationsRouter from "./integrations";
import evidenceRouter from "./evidence";
import poamRouter from "./poam";
import peopleRouter from "./people";
import vendorsRouter from "./vendors";
import policiesRouter from "./policies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(orgsRouter);
router.use(frameworksRouter);
router.use(controlsRouter);
router.use(integrationsRouter);
router.use(evidenceRouter);
router.use(poamRouter);
router.use(peopleRouter);
router.use(vendorsRouter);
router.use(policiesRouter);

export default router;
