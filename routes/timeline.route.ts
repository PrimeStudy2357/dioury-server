import express from "express";
import {
  createTimelineController,
  getJoinedTimelinesController,
  getRecommendedTimelinesController,
} from "../controllers/timeline.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = express.Router();

/** 타임라인 생성 */
router.post("/", isAuthenticated, createTimelineController);

/** 타임라인 조회 (추천) */
router.get("/", getRecommendedTimelinesController);

/** 타임라인 조회 (내가 가입한 타임라인) */
router.get("/my", isAuthenticated, getJoinedTimelinesController);

export default router;

