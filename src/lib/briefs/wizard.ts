import type { BriefStep } from "@/lib/validation/brief";

/** 步驟指示器：可以點回任何到過的步驟（maxVisited），不能跳過還沒到的。 */
export function canJumpToStep(target: BriefStep, current: BriefStep, maxVisited: BriefStep): boolean {
  return target !== current && target <= maxVisited;
}

/** 「存成草稿」至少要有案名。 */
export function isBlankBrief(v: { title: string }): boolean {
  return v.title.trim() === "";
}
