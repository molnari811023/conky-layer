#!/usr/bin/env bash
set -euo pipefail

# Conky NextGen Layer GNOME Extension Debian Package Builder
# Maintainer: István Molnár <molnari811023@gmail.com>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(readlink -f "$SCRIPT_DIR/..")"
STAGE_DIR="$SCRIPT_DIR/stage-conky-layer"
PKGNAME="gnome-shell-extension-conky-layer"
UUID="conky-layer@molnar.github.com"

echo "==> [1/5] Determining version number..."
REV_COUNT=$(git -C "$PROJECT_DIR" rev-list --count HEAD 2>/dev/null || echo "10")
SHORT_SHA=$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "custom")
VERSION="1.0.0.r${REV_COUNT}.g${SHORT_SHA}-1"
DEB_FILE="$SCRIPT_DIR/${PKGNAME}_${VERSION}_all.deb"
DEST_EXT_DIR="$STAGE_DIR/usr/share/gnome-shell/extensions/$UUID"
DOTFILES_DIR="/home/molnar/Projektek/dotfiles_ubuntu"

echo "    Package: $PKGNAME"
echo "    Version: $VERSION"

echo "==> [2/5] Creating staging directory..."
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/DEBIAN"
mkdir -p "$DEST_EXT_DIR"
mkdir -p "$STAGE_DIR/usr/share/doc/$PKGNAME"

echo "==> [3/5] Copying extension files..."
install -m 644 "$PROJECT_DIR/metadata.json" "$DEST_EXT_DIR/metadata.json"
install -m 644 "$PROJECT_DIR/extension.js" "$DEST_EXT_DIR/extension.js"
[ -f "$PROJECT_DIR/README.md" ] && install -m 644 "$PROJECT_DIR/README.md" "$STAGE_DIR/usr/share/doc/$PKGNAME/README.md"

find "$DEST_EXT_DIR" -type d -exec chmod 755 {} +
find "$DEST_EXT_DIR" -type f -exec chmod 644 {} +

echo "==> [4/5] Creating DEBIAN/control..."
cat << EOF > "$STAGE_DIR/DEBIAN/control"
Package: $PKGNAME
Version: $VERSION
Section: gnome
Priority: optional
Architecture: all
Maintainer: István Molnár <molnari811023@gmail.com>
Depends: gnome-shell (>= 45)
Recommends: conky-nextgen | conky-mng | conky-all
Homepage: https://github.com/molnari811023/conky-layer
Description: Desktop layer pinning and positioning for Conky under GNOME Wayland
 Conky NextGen Layer is a lightweight GNOME Shell extension that pins
 Conky windows to the desktop layer under Wayland and ensures pixel-perfect
 positioning, workspace stickiness, and exclusion from Alt+Tab and Overview.
EOF

echo "==> [5/5] Building .deb package..."
dpkg-deb -Zzstd --root-owner-group --build "$STAGE_DIR" "$DEB_FILE"
rm -rf "$STAGE_DIR"

if [ -d "$DOTFILES_DIR" ]; then
    cp -vf "$DEB_FILE" "$DOTFILES_DIR/"
fi

echo "=========================================================="
echo " BUILD SUCCESSFUL!"
echo " Package: $DEB_FILE"
echo " Copied to dotfiles: $DOTFILES_DIR/$(basename "$DEB_FILE")"
echo " Install with: sudo dpkg -i $DEB_FILE"
echo "=========================================================="
