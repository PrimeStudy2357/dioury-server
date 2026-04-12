import { Request, Response } from "express";

export const createTimelineController = async (req: Request, res: Response) => {
  return res.status(501).json({ message: "Not Implemented" });
};

