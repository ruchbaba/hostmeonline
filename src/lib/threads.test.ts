import { describe, expect, it } from "vitest";
import { groupThreads, replyTarget, type MessageLike } from "./threads";

const msg = (p: Partial<MessageLike> & { id: string; created_at: string }): MessageLike => ({
  from_host_id: null,
  from_messenger_id: null,
  to_host_id: null,
  to_messenger_id: null,
  body: "hi",
  read_at: null,
  ...p,
});

describe("message threads", () => {
  const msgs = [
    msg({ id: "1", from_host_id: "B", to_host_id: "A", created_at: "2026-01-01" }),
    msg({ id: "2", from_host_id: "A", to_host_id: "B", created_at: "2026-01-02", read_at: "x" }),
    msg({ id: "3", from_messenger_id: "V", to_host_id: "A", created_at: "2026-01-03" }),
  ];

  it("puts both directions with the same host in one conversation", () => {
    const t = groupThreads(msgs, ["A"]);
    expect(t.find((x) => x.other.id === "B")?.messages.map((m) => m.id)).toEqual(["1", "2"]);
  });

  it("keeps a visitor's messages in their own conversation", () => {
    expect(groupThreads(msgs, ["A"]).map((t) => t.other)).toEqual([
      { kind: "messenger", id: "V" },
      { kind: "host", id: "B" },
    ]);
  });

  it("counts only incoming unread messages", () => {
    expect(groupThreads(msgs, ["A"]).find((x) => x.other.id === "B")?.unread).toBe(1);
  });

  it("replies to a host go from my page to that host", () => {
    const t = groupThreads(msgs, ["A"]).find((x) => x.other.id === "B")!;
    expect(replyTarget(t)).toEqual({ p_from: "A", p_to_host: "B", p_to_messenger: null });
  });

  it("replies to a visitor go to the visitor", () => {
    const t = groupThreads(msgs, ["A"]).find((x) => x.other.id === "V")!;
    expect(replyTarget(t)).toEqual({ p_from: "A", p_to_host: null, p_to_messenger: "V" });
  });
});
