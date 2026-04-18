import express from "express";
import { createTimelineController } from "../controllers/timeline.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = express.Router();

/** 타임라인 생성 */
router.post("/", createTimelineController);

export default router;
