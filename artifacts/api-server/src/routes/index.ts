import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reinoRouter from "./reino";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reinoRouter);

export default router;
