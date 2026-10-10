import { describe, expect, it } from "vitest";
import { isRootRoute, parentRoute, rootSection, routeLabel } from "@/lib/app-routes";

describe("app route hierarchy", () => {
  it("treats only the five bottom-nav pages as roots", () => {
    for (const r of ["/app", "/app/market", "/app/play", "/app/progress", "/app/wallet", "/app/market/"]) expect(isRootRoute(r)).toBe(true);
    for (const r of ["/app/daily", "/app/account", "/app/play/map", "/app/account/profile", "/app/collections"]) expect(isRootRoute(r)).toBe(false);
  });

  it("maps inner pages to their logical parent", () => {
    expect(parentRoute("/app/daily")).toBe("/app");
    expect(parentRoute("/app/play/mystery-box")).toBe("/app/play");
    expect(parentRoute("/app/play/mystery-box/history")).toBe("/app/play/mystery-box");
    expect(parentRoute("/app/play/map")).toBe("/app/play");
    expect(parentRoute("/app/play/prizes")).toBe("/app/play");
    expect(parentRoute("/app/collections")).toBe("/app/progress");
    expect(parentRoute("/app/wallet/convert")).toBe("/app/wallet");
    expect(parentRoute("/app/wallet/withdraw")).toBe("/app/wallet");
    expect(parentRoute("/app/referrals")).toBe("/app/account");
    expect(parentRoute("/app/notifications")).toBe("/app");
    expect(parentRoute("/app/account")).toBe("/app");
    expect(parentRoute("/app/account/withdrawal-accounts")).toBe("/app/wallet");
    expect(parentRoute("/app/account/security")).toBe("/app/account");
    expect(parentRoute("/app/account/support/abc")).toBe("/app/account/support");
  });

  it("falls back to the nearest ancestor for unknown routes and never leaves the app", () => {
    expect(parentRoute("/app/daily/spin")).toBe("/app/daily");
    expect(parentRoute("/app/progress/achievements")).toBe("/app/progress");
    expect(parentRoute("/app/something")).toBe("/app");
  });

  it("assigns every page to the bottom-nav section of its logical parent", () => {
    expect(rootSection("/app")).toBe("/app");
    expect(rootSection("/app/daily")).toBe("/app");
    expect(rootSection("/app/daily/spin")).toBe("/app");
    expect(rootSection("/app/play/mystery-box/history")).toBe("/app/play");
    expect(rootSection("/app/play/map")).toBe("/app/play");
    expect(rootSection("/app/play/prizes")).toBe("/app/play");
    expect(rootSection("/app/collections")).toBe("/app/progress");
    expect(rootSection("/app/progress/achievements")).toBe("/app/progress");
    expect(rootSection("/app/wallet/deposit")).toBe("/app/wallet");
    expect(rootSection("/app/wallet/transactions")).toBe("/app/wallet");
    expect(rootSection("/app/account/withdrawal-accounts")).toBe("/app/wallet");
    expect(rootSection("/app/referrals")).toBe("/app");
    expect(rootSection("/app/notifications")).toBe("/app");
    expect(rootSection("/app/account/support/abc")).toBe("/app");
    expect(rootSection("/app/something")).toBe("/app");
  });

  it("labels parents for the back button", () => {
    expect(routeLabel("/app/wallet")).toBe("Wallet");
    expect(routeLabel("/app/play")).toBe("Play");
    expect(routeLabel("/app/market")).toBe("Market");
    expect(routeLabel("/app")).toBe("Home");
  });
});
