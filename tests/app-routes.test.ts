import { describe, expect, it } from "vitest";
import { isAppPath, isRootRoute, parentRoute, rootSection, routeLabel } from "@/lib/app-routes";

describe("app route hierarchy", () => {
  it("treats only the five bottom-nav pages as roots", () => {
    for (const r of ["/home", "/market", "/play", "/collections", "/wallet", "/market/"]) expect(isRootRoute(r)).toBe(true);
    for (const r of ["/daily", "/account", "/play/map", "/account/profile", "/progress"]) expect(isRootRoute(r)).toBe(false);
  });

  it("maps inner pages to their logical parent", () => {
    expect(parentRoute("/daily")).toBe("/home");
    expect(parentRoute("/play/mystery-box")).toBe("/play");
    expect(parentRoute("/play/mystery-box/history")).toBe("/play/mystery-box");
    expect(parentRoute("/play/map")).toBe("/play");
    expect(parentRoute("/play/prizes")).toBe("/play");
    expect(parentRoute("/progress")).toBe("/collections");
    expect(parentRoute("/collections/relics")).toBe("/collections");
    expect(parentRoute("/wallet/convert")).toBe("/wallet");
    expect(parentRoute("/wallet/withdraw")).toBe("/wallet");
    expect(parentRoute("/invite")).toBe("/account");
    expect(parentRoute("/notifications")).toBe("/home");
    expect(parentRoute("/account")).toBe("/home");
    expect(parentRoute("/account/withdrawal-accounts")).toBe("/wallet");
    expect(parentRoute("/account/security")).toBe("/account");
    expect(parentRoute("/account/support/abc")).toBe("/account/support");
  });

  it("falls back to the nearest ancestor for unknown routes and never leaves the app", () => {
    expect(parentRoute("/daily/spin")).toBe("/daily");
    expect(parentRoute("/collections/achievements")).toBe("/collections");
    expect(parentRoute("/something")).toBe("/home");
  });

  it("assigns every page to the bottom-nav section of its logical parent", () => {
    expect(rootSection("/home")).toBe("/home");
    expect(rootSection("/daily")).toBe("/home");
    expect(rootSection("/daily/spin")).toBe("/home");
    expect(rootSection("/play/mystery-box/history")).toBe("/play");
    expect(rootSection("/play/map")).toBe("/play");
    expect(rootSection("/play/prizes")).toBe("/play");
    expect(rootSection("/progress")).toBe("/collections");
    expect(rootSection("/collections/relics")).toBe("/collections");
    expect(rootSection("/wallet/deposit")).toBe("/wallet");
    expect(rootSection("/wallet/transactions")).toBe("/wallet");
    expect(rootSection("/account/withdrawal-accounts")).toBe("/wallet");
    expect(rootSection("/invite")).toBe("/home");
    expect(rootSection("/notifications")).toBe("/home");
    expect(rootSection("/account/support/abc")).toBe("/home");
    expect(rootSection("/something")).toBe("/home");
  });

  it("knows which paths belong to the signed-in app", () => {
    for (const p of ["/home", "/market", "/play/map", "/wallet/deposit", "/account/support/abc", "/invite", "/notifications", "/daily", "/collections"]) expect(isAppPath(p)).toBe(true);
    for (const p of ["/", "/login", "/register", "/referrals", "/how-it-works", "/games", "/faq", "/homepage", "/marketing", "/admin"]) expect(isAppPath(p)).toBe(false);
  });

  it("labels parents for the back button", () => {
    expect(routeLabel("/wallet")).toBe("Wallet");
    expect(routeLabel("/play")).toBe("Play");
    expect(routeLabel("/market")).toBe("Market");
    expect(routeLabel("/home")).toBe("Home");
    expect(routeLabel("/collections")).toBe("Collections");
  });
});
