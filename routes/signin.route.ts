import express from "express";
import {
  sayMyName,
  signInController,
  signOutController,
} from "../controllers/user.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = express.Router();

/** 로그인 라우트 */
router.post("/", signInController);

/** 로그아웃 라우트 */
router.post("/signout", signOutController);

/** 로그인 후 사용자 정보 조회 */
router.get("/saymyname", isAuthenticated, sayMyName);

export default router;

