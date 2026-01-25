import { NextFunction, Request, Response } from "express";

/** 로그인 여부 확인 미들웨어 */
export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.session.email) {
    next();
  } else {
    res.status(401).json({ message: "로그인이 필요합니다." });
  }
};

