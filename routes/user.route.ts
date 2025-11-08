import express from "express";

const router = express.Router();

router.get("/", () => {
  console.log("test");
  return;
});

export default router;

