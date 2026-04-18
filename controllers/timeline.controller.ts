import { Request, Response } from "express";
import { timelineSchema } from "../schemas/timeline.schema";

export const createTimelineController = async (req: Request, res: Response) => {
  try {
    const validatedData = timelineSchema.parse(req.body);
    const { description, isOn, isPublic, keywords, name, period, category } =
      validatedData;

    console.log(
      "data",
      description,
      isOn,
      isPublic,
      keywords,
      name,
      period,
      category,
    );
  } catch (error) {
    console.error(error);
  }

  return res.status(501).json({ message: "Not Implemented" });
};
