import { describe, expect, it } from "vitest";
import { parseCalendar, exportCalendar, allowedFeedUrl } from "@/lib/ical";
describe("iCal availability", () => {
  it("round-trips exclusive checkout dates without guest information", () => {
    const text = exportCalendar([{ id: "safe-id", check_in: "2026-11-01", check_out: "2026-11-04" }]);
    expect(parseCalendar(text)).toEqual([{ uid: "safe-id@valedosol", start: "2026-11-01", end: "2026-11-04" }]);
    expect(text).toContain("SUMMARY:Indisponível");
  });
  it("rejects private addresses and deceptive provider hosts", () => {
    for (const url of ["http://airbnb.com/test", "https://127.0.0.1/test", "https://airbnb.com.evil.example/test", "https://user:password@airbnb.com/test"]) expect(() => allowedFeedUrl(url)).toThrow();
    expect(allowedFeedUrl("https://www.airbnb.com/calendar/ical/test.ics")).toContain("airbnb.com");
  });
  it("rejects malformed calendars rather than releasing existing blocks", () => { expect(() => parseCalendar("invalid")).toThrow(); });
});