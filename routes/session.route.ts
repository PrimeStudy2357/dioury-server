import express from "express";
import {
  createSessionController,
  getSessionController,
  getSessionListController,
} from "../controllers/session.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { isTimelineAdmin } from "../middlewares/timeline.middleware";

const router = express.Router();

/** 세션 생성 (타임라인 ADMIN 이상만 가능) */
router.post("/", isAuthenticated, isTimelineAdmin, createSessionController);

/** 세션 목록 조회 (타임라인별) */
router.get("/", getSessionListController);

/** 세션 상세 조회 */
router.get("/:id", getSessionController);

export default router;

