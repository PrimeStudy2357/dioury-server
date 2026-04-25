import { Request, Response } from "express";
import { timelineSchema } from "../schemas/timeline.schema";
import prismaService from "../services/connectors/prisma.service";
import { ErrorResponse } from "../types/response";

export const createTimelineController = async (req: Request, res: Response) => {
  try {
    const validatedData = timelineSchema.parse(req.body);
    const {
      description,
      isOn,
      isPublic,
      keywords,
      name,
      period = "",
      category,
    } = validatedData;
    const [keyword1, keyword2, keyword3] = keywords;

    const userNickname = req.session.nickname;

    const newTimeline = await prismaService.timeline.create({
      data: {
        name,
        description,
        isOn,
        isPublic,
        keyword1,
        keyword2,
        keyword3,
        category,
        period,
        creator: {
          connect: { nickname: userNickname },
        },
      },
    });

    return res.status(201).json(newTimeline);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error" } as ErrorResponse);
  }
};
