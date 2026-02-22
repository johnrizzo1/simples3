{
  description = "SimpleS3 – A simple S3 client desktop application";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" ] (system:
      let
        pkgs = import nixpkgs { inherit system; };

        version = "0.1.0";

        # -- Native build tools (compilers, pkg-config, cmake, etc.) ----------
        nativeBuildDeps = with pkgs; [
          pkg-config
          cmake        # needed by aws-lc-sys
          perl         # needed by aws-lc-sys build scripts
          rustPlatform.bindgenHook
        ];

        # -- Libraries needed at build time (linked via pkg-config) -----------
        buildLibs = with pkgs; [
          gtk3
          glib
          cairo
          pango
          atk
          gdk-pixbuf
          webkitgtk_4_1
          libsoup_3
          openssl
          dbus  # for keyring crate (async-secret-service)
        ];

        # -- Runtime libraries for the wrapped binary -------------------------
        runtimeLibs = with pkgs; [
          gtk3
          glib
          cairo
          pango
          atk
          gdk-pixbuf
          webkitgtk_4_1
          libsoup_3
          dbus
          mesa
          libGL
        ];

        # =====================================================================
        # Phase A: Build the frontend (React + Webpack → dist/)
        # =====================================================================
        frontend = pkgs.stdenv.mkDerivation {
          pname = "simples3-frontend";
          inherit version;

          src = pkgs.lib.fileset.toSource {
            root = ./.;
            fileset = pkgs.lib.fileset.unions [
              ./package.json
              ./package-lock.json
              ./tsconfig.json
              ./webpack.config.cjs
              ./postcss.config.js
              ./tailwind.config.js
              ./index.html
              ./src
            ];
          };

          npmDeps = pkgs.fetchNpmDeps {
            src = pkgs.lib.fileset.toSource {
              root = ./.;
              fileset = pkgs.lib.fileset.unions [
                ./package.json
                ./package-lock.json
              ];
            };
            hash = "sha256-OWVs+L+8keoMaZgOk4SXwpsvBu6S3EQ31kG9Mi0wYEc=";
          };

          nativeBuildInputs = with pkgs; [
            nodejs
            npmHooks.npmConfigHook
          ];

          buildPhase = ''
            runHook preBuild
            npx webpack --mode production
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            cp -r dist $out
            runHook postInstall
          '';
        };

        # =====================================================================
        # Phase B: Build the Rust/Tauri binary
        # =====================================================================
        simples3 = pkgs.rustPlatform.buildRustPackage {
          pname = "simples3";
          inherit version;

          # Include the whole project root so that ../dist resolves correctly
          # when tauri_build::build() reads tauri.conf.json's frontendDist.
          src = pkgs.lib.fileset.toSource {
            root = ./.;
            fileset = pkgs.lib.fileset.unions [
              ./src-tauri/Cargo.toml
              ./src-tauri/Cargo.lock
              ./src-tauri/src
              ./src-tauri/build.rs
              ./src-tauri/capabilities
              ./src-tauri/gen
              ./src-tauri/icons
              ./src-tauri/tauri.conf.json
              ./src-tauri/Info.plist
              ./src-tauri/entitlements.plist
            ];
          };

          sourceRoot = "source/src-tauri";

          cargoHash = "sha256-gvROZ4JtGo3kZ4PNP/r1pxs9hooPAMmsNsX2WoMmjpE=";

          # Enable embedded asset serving (the Tauri CLI passes this
          # automatically during `tauri build`, but we use plain cargo).
          buildFeatures = [ "custom-protocol" ];

          # Place the pre-built frontend where tauri expects it (../dist).
          # The source directory may be read-only after unpack, so ensure
          # it is writable before creating the symlink.
          postUnpack = ''
            chmod u+w source
            ln -s ${frontend} source/dist
          '';

          nativeBuildInputs = nativeBuildDeps ++ [ pkgs.wrapGAppsHook3 ];
          buildInputs = buildLibs;

          # Set NixOS-specific env vars on the wrapper
          preFixup = ''
            gappsWrapperArgs+=(
              --set GDK_BACKEND x11
              --set WEBKIT_DISABLE_DMABUF_RENDERER 1
              --prefix LD_LIBRARY_PATH : "${pkgs.lib.makeLibraryPath runtimeLibs}"
            )
          '';

          postInstall = ''
            # Desktop entry
            mkdir -p $out/share/applications
            cat > $out/share/applications/simples3.desktop << DESKTOP
[Desktop Entry]
Name=SimpleS3
Comment=A simple S3 client desktop application
Exec=$out/bin/simples3
Icon=simples3
Terminal=false
Type=Application
Categories=Network;FileTransfer;Utility;
DESKTOP

            # Icons
            for size in 32x32 64x64 128x128; do
              if [ -f icons/''${size}.png ]; then
                install -Dm644 icons/''${size}.png \
                  $out/share/icons/hicolor/''${size}/apps/simples3.png
              fi
            done
            if [ -f icons/128x128@2x.png ]; then
              install -Dm644 icons/128x128@2x.png \
                $out/share/icons/hicolor/256x256/apps/simples3.png
            fi
            if [ -f icons/icon.png ]; then
              install -Dm644 icons/icon.png \
                $out/share/icons/hicolor/512x512/apps/simples3.png
            fi
            if [ -f icons/icon.svg ]; then
              install -Dm644 icons/icon.svg \
                $out/share/icons/hicolor/scalable/apps/simples3.svg
            fi
          '';

          meta = with pkgs.lib; {
            description = "A simple S3 client desktop application";
            license = licenses.gpl3Only;
            platforms = platforms.linux;
            mainProgram = "simples3";
          };
        };

      in {
        packages = {
          inherit simples3 frontend;
          default = simples3;
        };

        devShells.default = pkgs.mkShell {
          inputsFrom = [ simples3 ];
          packages = with pkgs; [
            cargo-tauri
            bun
            nodejs
            rustc
            cargo
            clippy
            rustfmt
          ];
          shellHook = ''
            export GDK_BACKEND=x11
            export WEBKIT_DISABLE_DMABUF_RENDERER=1
          '';
        };
      }
    );
}
