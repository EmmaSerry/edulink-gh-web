#!/usr/bin/env bash
# Amenfi Central Terminal Report System (ACTRS) - one-click launcher
# for macOS/Linux. Double-click this file (after making it executable
# once: `chmod +x start-actrs.sh`), or run `./start-actrs.sh` in a
# terminal, from inside the ACTRS project folder.
cd "$(dirname "$0")"

echo "============================================================"
echo " Amenfi Central Terminal Report System (ACTRS)"
echo "============================================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found on this computer."
  echo
  echo "ACTRS needs Node.js installed once before it can run. Please:"
  echo "  1. Go to https://nodejs.org"
  echo "  2. Download and install the \"LTS\" version"
  echo "  3. Run this script again"
  echo
  exit 1
fi

case "$(pwd)" in
  *"CloudStorage"*|*"iCloud Drive"*|*"Dropbox"*|*"OneDrive"*|*"Google Drive"*)
    echo "NOTE: This folder is inside a cloud-synced location (iCloud"
    echo "Drive, Dropbox, OneDrive, or Google Drive). That can lock"
    echo "files while it syncs, which occasionally interrupts the"
    echo "one-time setup below. If setup keeps failing, try moving"
    echo "this whole ACTRS folder to a plain local folder instead."
    echo
    ;;
esac

need_install() {
  [ ! -x "node_modules/.bin/tsc" ] || [ ! -x "node_modules/.bin/vite" ]
}

if need_install; then
  echo "First-time setup: installing ACTRS's components..."
  echo "(this needs an internet connection the first time only,"
  echo " and can take a few minutes)"
  echo

  tries=0
  until ! need_install; do
    tries=$((tries + 1))
    npm install || true
    if need_install; then
      if [ "$tries" -ge 2 ]; then
        echo
        echo "Setup could not complete after two attempts. This almost"
        echo "always means the internet connection dropped partway"
        echo "through downloading ACTRS's components. Please check your"
        echo "internet connection is stable and run this script again."
        echo
        exit 1
      fi
      echo
      echo "Setup did not finish correctly - this is usually a brief"
      echo "internet interruption. Trying again..."
      echo
    fi
  done
  echo
fi

# Decide whether ACTRS needs (re)building. Previously this only
# checked "does dist/index.html exist", which meant that extracting an
# updated ACTRS package over an existing installation kept silently
# serving the OLD build forever - dist/ is generated locally and isn't
# part of what's delivered, so it survived untouched across every
# update and none of the fixes in a newer copy ever actually took
# effect. Comparing VERSION (bumped every release) against a stamp left
# in dist/ the last time it was built fixes that, while same-version
# restarts stay fast (no rebuild).
CURRENT_VERSION="unknown"
[ -f "VERSION" ] && CURRENT_VERSION="$(cat VERSION)"
BUILT_VERSION=""
[ -f "dist/.build-version" ] && BUILT_VERSION="$(cat dist/.build-version)"

if [ ! -f "dist/index.html" ] || [ "$BUILT_VERSION" != "$CURRENT_VERSION" ]; then
  echo "Building ACTRS..."
  echo
  rm -rf dist
  # Also clear tsc's own incremental-build cache - otherwise tsc can
  # decide nothing changed based on file timestamps alone, which after
  # extracting a fresh copy don't reliably reflect what actually changed.
  rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo
  npm run build || true
  if [ ! -f "dist/index.html" ]; then
    echo
    echo "Something went wrong while building ACTRS. See the messages"
    echo "above. This is usually fixed by checking your internet"
    echo "connection and running this script again."
    echo
    exit 1
  fi
  echo "$CURRENT_VERSION" > dist/.build-version
  echo
fi

echo "Starting ACTRS..."
echo
echo "Your browser will open automatically in a moment."
echo "To stop ACTRS, come back to this window and press Ctrl+C."
echo

npx serve -s dist -l 5000 &
SERVER_PID=$!

sleep 3

if command -v open >/dev/null 2>&1; then
  open "http://localhost:5000"        # macOS
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:5000"    # Linux
fi

wait "$SERVER_PID"
