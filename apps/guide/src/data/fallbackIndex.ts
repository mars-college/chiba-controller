import type { GuideIndex } from "../types/guide";

export const fallbackIndex: GuideIndex = {
  generatedAt: Date.now(),
  slotMinutes: 30,
  slotCount: 6,
  startTime: "16:00",
  timeSlots: ["4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM"],
  channels: [],
};
