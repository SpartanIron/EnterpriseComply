# shell.nix — Nix shell that provides all system libraries required by the
# Playwright Chromium headless shell in the Replit/NixOS environment.
#
# Usage:
#   nix-shell tests/e2e/shell.nix --run "APP_URL=http://localhost:19222 npx playwright test --config tests/e2e/playwright.config.ts"
{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = with pkgs; [
    glib
    nspr
    nss
    atk
    at-spi2-atk
    at-spi2-core
    dbus
    xorg.libX11
    xorg.libXcomposite
    xorg.libXdamage
    xorg.libXext
    xorg.libXfixes
    xorg.libXrandr
    mesa
    xorg.libxcb
    libxkbcommon
    alsa-lib
    libgbm
    cups
    pango
    cairo
  ];
}
