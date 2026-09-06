import { NextFunction, Request, Response } from "express";
import { TIMELINE_ADMIN_ROLES } from "../constants/role";
import prismaService from "../services/connectors/prisma.service";
import { ErrorResponse } from "../types/response";

type TimelineIdBody = {
  timelineId: number;
};

/**
 * 요청 body의 timelineId 기준으로 ADMIN 이상(OWNER, ADMIN) 권한을 확인하는 미들웨어
 */
export const isTimelineAdmin = async (
  req: Request<any, any, TimelineIdBody>,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.session.userId;
  const timelineId = Number(req.body.timelineId);

  if (!userId) {
    return res
      .status(401)
      .json({ message: "로그인이 필요합니다." } as ErrorResponse);
  }

  if (!Number.isInteger(timelineId) || timelineId <= 0) {
    return res
      .status(400)
      .json({ message: "잘못된 요청입니다." } as ErrorResponse);
  }

  try {
    const member = await prismaService.timelineMember.findUnique({
      where: { userId_timelineId: { userId, timelineId } },
    });

    if (!member || !TIMELINE_ADMIN_ROLES.includes(member.role)) {
      return res
        .status(403)
        .json({ message: "권한이 없습니다." } as ErrorResponse);
    }

    next();
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error" } as ErrorResponse);
  }
};

