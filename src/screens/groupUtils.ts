export type GroupType = "friends" | "family" | "coworkers" | "other";

export const GROUP_TYPES: GroupType[] = ["friends", "family", "coworkers", "other"];

export function label(t: GroupType) {
  if (t === "coworkers") return "Co-workers";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function makeInviteCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
