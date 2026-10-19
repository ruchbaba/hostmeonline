export const STATIC_PAGES = [
  { key: "how-it-works", path: "/how-it-works", title: "How it works" },
  { key: "manifesto", path: "/manifesto", title: "Manifesto" },
  { key: "use-cases", path: "/use-cases", title: "Use cases" },
  { key: "submit-story", path: "/submit-story", title: "Submit your story" },
  { key: "invite", path: "/invite", title: "Invite" },
  { key: "faq", path: "/faq", title: "FAQ" },
  { key: "history", path: "/history", title: "History" },
  { key: "our-story", path: "/our-story", title: "Our story" },
] as const;

export type StaticKey = (typeof STATIC_PAGES)[number]["key"];
