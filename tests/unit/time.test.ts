import { describe, expect, it } from "vitest";
import { calendarDaysBetween, timeAgo } from "@/lib/utils";

describe("timeAgo", () => {
  it("counts calendar days, matching the activity feed's day groups", () => {
    const now = new Date(2026, 9, 12, 9, 0).getTime(); // Mon Oct 12, 09:00 local
    const twoDaysAgoLate = new Date(2026, 9, 10, 21, 0).toISOString(); // Sat Oct 10, 21:00 (60 h earlier)
    expect(timeAgo(twoDaysAgoLate, now)).toBe("2d ago"); // rounding hours would say "3d ago"
    expect(calendarDaysBetween(Date.parse(twoDaysAgoLate), now)).toBe(2);
  });

  it("keeps minutes and hours for recent changes", () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 10_000).toISOString(), now)).toBe("just now");
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5m ago");
    expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3h ago");
  });
});
