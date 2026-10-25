import { cn } from "./utils";
import { expect, test } from "vitest";

test("cn keeps the last conflicting Tailwind utility", () => {
  expect(cn("px-2", "px-4")).toBe("px-4");
});
