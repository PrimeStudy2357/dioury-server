import express from "express";
import {
  authEmailCheckController,
  authEmailController,
  signUpController,
} from "../controllers/user.controller";

const router = express.Router();

/** 회원가입 라우트 */
router.post("/", signUpController);

/** 회원가입 시 이메일 인증 요청 API */
router.post("/authEmail", authEmailController);

/** 회원가입 시 이메일 인증 확인 요청 API */
router.post("/authEmailCheck", authEmailCheckController);

export default router;
