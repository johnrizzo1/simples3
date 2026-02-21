{ pkgs, lib, config, inputs, ... }:

{
  packages = with pkgs; [
    git
    cargo-tauri
    pkg-config
    # Tauri Linux dependencies (GTK/WebKitGTK)
    gtk3
    glib
    cairo
    pango
    atk
    gdk-pixbuf
    webkitgtk_4_1
    libsoup_3
    openssl
  ];
  languages.rust.enable = true;
  languages.javascript.enable = true;
  languages.javascript.bun.enable = true;
  languages.typescript.enable = true;

  # Work around Wayland protocol errors with WebKitGTK on NixOS.
  # Falls back to X11 (via XWayland) which is stable.
  env.GDK_BACKEND = "x11";

  # https://devenv.sh/scripts/

  # On NixOS, the tauri CLI is installed as cargo-tauri.
  # This wrapper makes `tauri` available on PATH so that
  # `bun run tauri dev/build` (via package.json) works seamlessly.
  # On macOS, the npm @tauri-apps/cli package provides `tauri` directly.
  scripts.tauri.exec = ''
    cargo-tauri "$@"
  '';

  scripts.dev.exec = ''
    echo "Starting SimpleS3 in development mode..."
    bun install
    bun run tauri dev
  '';

  scripts.build.exec = ''
    echo "Building SimpleS3 for production..."
    bun install
    bun run tauri build
  '';

  scripts.lint.exec = ''
    echo "Running linters..."
    echo "→ Linting Rust code..."
    cd src-tauri && cargo clippy -- -D warnings
    echo "→ Linting TypeScript/React code..."
    cd .. && bun run lint
  '';

  scripts.format.exec = ''
    echo "Formatting code..."
    echo "→ Formatting Rust code..."
    cd src-tauri && cargo fmt
    echo "→ Formatting TypeScript/React code..."
    cd .. && bun run format
  '';

  scripts.format-check.exec = ''
    echo "Checking code formatting..."
    echo "→ Checking Rust formatting..."
    cd src-tauri && cargo fmt -- --check
    echo "→ Checking TypeScript/React formatting..."
    cd .. && bun run prettier --check "src/**/*.{ts,tsx,css}"
  '';

  scripts.test.exec = ''
    echo "Running tests..."
    echo "→ Running Rust tests..."
    cd src-tauri && cargo test
    echo "→ Running frontend tests..."
    cd .. && bun test
  '';

  scripts.test-rust.exec = ''
    echo "Running Rust tests only..."
    cd src-tauri && cargo test
  '';

  scripts.test-frontend.exec = ''
    echo "Running frontend tests only..."
    bun test
  '';

  scripts.clean.exec = ''
    echo "Cleaning build artifacts..."
    rm -rf src-tauri/target
    rm -rf dist
    rm -rf node_modules/.vite
    echo "Clean complete!"
  '';

  scripts.setup.exec = ''
    echo "Setting up SimpleS3 development environment..."
    echo "→ Installing frontend dependencies..."
    bun install
    echo "→ Checking Rust installation..."
    rustc --version
    cargo --version
    echo "Setup complete! Run 'dev' to start the application."
  '';

  scripts.check.exec = ''
    echo "Running all checks..."
    format-check
    lint
    test
    echo "All checks passed!"
  '';

  # https://devenv.sh/git-hooks/
  # git-hooks.hooks.shellcheck.enable = true;

  # See full reference at https://devenv.sh/reference/options/
}
