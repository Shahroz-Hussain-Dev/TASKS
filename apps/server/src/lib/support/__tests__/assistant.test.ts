import { describe, expect, it } from "vitest";
import { toGeminiHistory } from "@/lib/support/assistant";

describe("toGeminiHistory", () => {
  it("maps user/assistant/admin senders to alternating Gemini roles", () => {
    const history = toGeminiHistory([
      { sender: "user", body: "My driver cancelled" },
      { sender: "assistant", body: "Sorry to hear that." },
      { sender: "admin", body: "We've spoken to the driver." },
      { sender: "user", body: "Thanks" },
    ]);
    expect(history.map((m) => m.role)).toEqual(["user", "model", "user"]);
    expect(history[1]!.parts[0]!.text).toBe("Sorry to hear that.\n\n[Raahi support team] We've spoken to the driver.");
  });

  it("merges consecutive messages from the same side", () => {
    const history = toGeminiHistory([
      { sender: "user", body: "Hello" },
      { sender: "user", body: "Anyone there?" },
    ]);
    expect(history).toHaveLength(1);
    expect(history[0]!.parts[0]!.text).toBe("Hello\n\nAnyone there?");
  });

  it("drops leading model turns so the transcript starts with the user", () => {
    const history = toGeminiHistory([
      { sender: "assistant", body: "Welcome back" },
      { sender: "user", body: "How do fares work?" },
    ]);
    expect(history).toHaveLength(1);
    expect(history[0]!.role).toBe("user");
  });

  it("returns an empty transcript for no messages", () => {
    expect(toGeminiHistory([])).toEqual([]);
  });
});
