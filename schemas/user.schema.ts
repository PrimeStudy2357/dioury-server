import z from "zod";

export const passwordSchema = z
  .string()
  .min(8, { error: "비밀번호는 8자리 이상이어야 합니다." })
  .regex(/[a-zA-Z]/, {
    error: "비밀번호는 영문자를 최소 1개 이상 포함해야 합니다.",
  })
  .regex(/\d/, { error: "비밀번호는 숫자를 최소 1개 이상 포함해야 합니다." })
  .regex(/[!@#$%^&*(),.?":{}|<>]/, {
    error: "비밀번호는 특수문자를 최소 1개 이상 포함해야 합니다.",
  });

export const userSchema = z.object({
  email: z.email({ error: "유효하지 않은 이메일 형식입니다." }),
  password: passwordSchema,
  nickname: z
    .string()
    .min(2, { error: "닉네임은 최소 2자 이상이어야 합니다." })
    .max(8, { error: "닉네임은 8자를 초과할 수 없습니다." }),
  funnel: z.string().nonempty({ error: "유입 경로를 입력해주세요." }),
  purpose: z.string().nonempty({ error: "사용 목적을 입력해주세요." }),
});
