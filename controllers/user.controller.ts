import { Request, Response } from "express";
import { userSchema } from "../schemas/user.schema";
import z from "zod";
import { ErrorResponse } from "../types/response";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export const signUpController = async (req: Request, res: Response) => {
  try {
    // 1. 요청 검증
    const validatedData = userSchema.parse(req.body);
    const { email, password, nickname, funnel, purpose } = validatedData;

    // 2. 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({ where: { email } });
    // 이미 사용 중인 이메일 있음
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "이미 가입된 이메일입니다." } as ErrorResponse);
    }

    // 3. 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. 새 사용자 생성
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname,
        funnel,
        purpose,
      },
    });

    const { password: _, ...userWithoutPassword } = newUser;

    return res.status(201).json(userWithoutPassword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(error);
      return res.status(400).json({
        message: "입력 데이터가 유효하지 않습니다.",
      } as ErrorResponse);
    }

    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error" } as ErrorResponse);
  }
};

