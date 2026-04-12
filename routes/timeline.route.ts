import express from "express";
import { createTimelineController } from "../controllers/timeline.controller";

const router = express.Router();

/** 타임라인 생성 */
router.post("/", createTimelineController);

export default router;

