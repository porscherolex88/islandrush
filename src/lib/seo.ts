import type { Metadata } from "next";

/** Absolute path under /public used for Open Graph and Twitter cards. */
export const SHARE_IMAGE = {
  url: "/og-share.jpg",
  width: 1280,
  height: 720,
  alt: "LootBox: open Mystery Boxes, explore islands and complete puzzles",
} as const;

type SocialPage = {
  title: string;
  description: string;
  path?: string;
};

/**
 * Free-game-only social metadata. Descriptions must not mention cash, deposits,
 * odds or winnings; real-money features stay gated until a verified licence.
 */
export function freeGameSocialMetadata({ title, description, path = "/" }: SocialPage): Metadata {
  const image = {
    url: SHARE_IMAGE.url,
    width: SHARE_IMAGE.width,
    height: SHARE_IMAGE.height,
    alt: SHARE_IMAGE.alt,
  };
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: path,
      siteName: "LootBox",
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SHARE_IMAGE.url],
    },
  };
}

/** Homepage / How it works / Rewards copy: free adventure only. */
export const FREE_GAME_SOCIAL = {
  home: {
    title: "LootBox: Play, discover, collect",
    description:
      "Open Mystery Boxes, explore island maps, collect Loot and complete puzzles on a free daily adventure.",
    path: "/",
  },
  howItWorks: {
    title: "How it works",
    description:
      "Sign up free, claim your daily spin, open Mystery Boxes, explore islands and finish puzzles to unlock each level's prize.",
    path: "/how-it-works",
  },
  rewards: {
    title: "Rewards",
    description:
      "Earn Credits, Loot and puzzle pieces as you explore. Complete each map's puzzle to reach that level's prize unlock.",
    path: "/rewards",
  },
} as const;
