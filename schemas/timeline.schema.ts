import z from "zod";

export const timelineSchema = z.object({
  name: z
    .string()
    .min(1, { error: "제목은 최소 1자 이상이어야 합니다." })
    .max(64, { error: "제목은 64자를 초과할 수 없습니다." }),
  isPublic: z.boolean(),
  isOn: z.boolean(),
  category: z.string(),
  keywords: z.array(z.string().min(1).max(16)).min(1).max(3),
  description: z.string().min(1).max(256),
  period: z.string().optional(),
});
