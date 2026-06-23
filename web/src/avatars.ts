/** Selectable group avatars — plain emoji so they render everywhere, no assets. */
export const AVATARS = [
  // Tiere – Land
  "🦊", "🐻", "🐺", "🦝", "🐯", "🦁", "🐮", "🐷", "🐗", "🐹",
  "🐰", "🐱", "🐶", "🦓", "🦒", "🐘", "🦏", "🦬", "🐲", "🦌",
  "🐴", "🦄", "🐭", "🐨", "🐼", "🦘", "🦔", "🦇",
  // Tiere – Vögel & Wasser
  "🦅", "🦉", "🐧", "🦆", "🦢", "🦩", "🐔", "🐓", "🦜", "🕊️",
  "🐬", "🐳", "🦈", "🐙", "🦑", "🦀", "🐠", "🐢", "🐊", "🐝",
  // Fabel & Natur
  "🐉", "🔥", "⚡", "🌪️", "🌊", "⭐", "🌈", "🍀", "🌲", "🏔️",
  // Einsatz & Fahrzeuge
  "🚒", "🚓", "🚑", "🚁", "⛑️", "🧯", "🚤", "🛻", "🚜", "🛰️",
  // Technik & Funk
  "📡", "🔦", "🧭", "📻", "🔋", "🛠️", "🗺️", "🎯",
  // Gesichter & Figuren
  "🤖", "👽", "🦸", "🥷", "🤠", "😎", "🦾", "👾",
] as const;

/** fallback shown when a group has no avatar yet */
export const NO_AVATAR = "👥";
