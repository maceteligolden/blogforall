import { z } from "zod";

export const roomJoinSchema = z.object({
  siteId: z.string().min(1).max(64),
});

export const roomLeaveSchema = z.object({
  siteId: z.string().min(1).max(64),
});

export type RoomJoinPayload = z.infer<typeof roomJoinSchema>;
export type RoomLeavePayload = z.infer<typeof roomLeaveSchema>;
