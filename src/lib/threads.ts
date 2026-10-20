// Pure grouping of Hostme messages into conversations. Framework-free for unit tests.

export interface MessageLike {
  id: string;
  from_host_id: string | null;
  from_messenger_id: string | null;
  to_host_id: string | null;
  to_messenger_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
}

export type Counterpart = { kind: "host"; id: string } | { kind: "messenger"; id: string };

export interface Thread<M extends MessageLike> {
  key: string;
  myHostId: string;
  other: Counterpart;
  messages: M[]; // oldest first
  lastAt: string;
  unread: number;
}

/** Groups messages by (my host page, other party). Replies go back to the other party from the same page. */
export function groupThreads<M extends MessageLike>(messages: M[], myHostIds: string[]): Thread<M>[] {
  const mine = new Set(myHostIds);
  const map = new Map<string, Thread<M>>();
  for (const m of messages) {
    const sentByMe = !!m.from_host_id && mine.has(m.from_host_id);
    const myHostId = sentByMe ? m.from_host_id! : m.to_host_id;
    if (!myHostId || !mine.has(myHostId)) continue;
    const other: Counterpart | null = sentByMe
      ? m.to_host_id
        ? { kind: "host", id: m.to_host_id }
        : m.to_messenger_id
          ? { kind: "messenger", id: m.to_messenger_id }
          : null
      : m.from_host_id
        ? { kind: "host", id: m.from_host_id }
        : m.from_messenger_id
          ? { kind: "messenger", id: m.from_messenger_id }
          : null;
    if (!other) continue;
    const key = `${myHostId}|${other.kind}:${other.id}`;
    let t = map.get(key);
    if (!t) {
      t = { key, myHostId, other, messages: [], lastAt: m.created_at, unread: 0 };
      map.set(key, t);
    }
    t.messages.push(m);
    if (m.created_at > t.lastAt) t.lastAt = m.created_at;
    if (!sentByMe && m.read_at === null) t.unread++;
  }
  const list = [...map.values()];
  list.forEach((t) => t.messages.sort((a, b) => a.created_at.localeCompare(b.created_at)));
  return list.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Arguments for the send_message call when replying in a thread. */
export function replyTarget(t: Pick<Thread<MessageLike>, "myHostId" | "other">) {
  return {
    p_from: t.myHostId,
    p_to_host: t.other.kind === "host" ? t.other.id : null,
    p_to_messenger: t.other.kind === "messenger" ? t.other.id : null,
  };
}
