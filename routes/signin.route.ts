import express from "express";
import {
  signInController,
  signOutController,
} from "../controllers/user.controller";

const router = express.Router();

/** 로그인 라우트 */
router.post("/", signInController);

/** 로그아웃 라우트 */
router.post("/signout", signOutController);

export default router;

