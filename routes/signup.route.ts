import express from "express";
import { signUpController } from "../controllers/user.controller";

const router = express.Router();

/** 회원가입 라우트 */
router.post("/", signUpController);

export default router;

