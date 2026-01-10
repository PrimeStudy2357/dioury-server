import express from "express";
import { checkNickname } from "../controllers/user.controller";

const router = express.Router();

router.get("/", () => {
  console.log("test");
  return;
});

router.get("/checkNickname", checkNickname);

export default router;
