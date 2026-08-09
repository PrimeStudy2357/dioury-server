import express from "express";
import {
  checkTimelineTitle,
  createTimelineController,
  getJoinedTimelinesController,
  getRecommendedTimelinesController,
  getTimelineController,
} from "../controllers/timeline.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = express.Router();

/** 타임라인 생성 */
router.post("/", isAuthenticated, createTimelineController);

/** 타임라인 조회 (추천) */
router.get("/", getRecommendedTimelinesController);

/** 타임라인 조회 (내가 가입한 타임라인) */
router.get("/my", isAuthenticated, getJoinedTimelinesController);

/** 타임라인 이름 중복 조회 */
router.get("/checkname", isAuthenticated, checkTimelineTitle);

/** 타임라인 상세 조회 */
router.get("/:id", getTimelineController);

export default router;
