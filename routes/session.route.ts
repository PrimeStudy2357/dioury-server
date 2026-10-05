import express from "express";
import {
  createSessionController,
  getSessionController,
  getSessionListController,
} from "../controllers/session.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { isTimelineWriter } from "../middlewares/timeline.middleware";

const router = express.Router();

/** 세션 생성 (타임라인 FRIEND 이상만 가능) */
router.post("/", isAuthenticated, isTimelineWriter, createSessionController);

/** 세션 목록 조회 (타임라인별) */
router.get("/", isAuthenticated, getSessionListController);

/** 세션 상세 조회 */
router.get("/:id", isAuthenticated, getSessionController);

export default router;

