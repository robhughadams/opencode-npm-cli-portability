.PHONY: help install test-gate build install-binary install-skip-tests install-copy clean bun-check channel-check

# v2 requires the bun pinned by root package.json (bun@1.4.2); the default
# ~/.bun/bin/bun (1.3.14) is v1-only and the build scripts hard-throw on mismatch.
BUN ?= /home/rob/.bun-1.4.2/bin/bun
# Compile-time channel is mandatory: it bakes the opencode-v2trial.db filename that
# isolates the trial from the v1 live install. Never latest.
CHANNEL ?= v2trial
# env override because script/src/index.ts returns OPENCODE_VERSION verbatim (no npm fetch, no 2.0.0 floor); +date suffix keeps builds distinguishable.
V ?= 666.0.0+$(shell date -u +%Y%m%d%H%M)
INSTALL_DIR ?= /home/rob/.opencode-v2/bin
OUTDIR ?= $(CURDIR)/packages/cli/dist-v2trial

OS := $(shell uname -s | tr '[:upper:]' '[:lower:]')
ARCH := $(shell uname -m | sed 's/x86_64/x64/; s/aarch64/arm64/')
# script/build.ts resolves --outdir relative to packages/cli, so always pass an absolute path.
ABS_OUTDIR := $(abspath $(OUTDIR))
BUILD_BIN := $(ABS_OUTDIR)/cli-$(OS)-$(ARCH)/bin/opencode

help:
	@echo "Available targets:"
	@echo "  install             Install dependencies"
	@echo "  install-binary      Install deps, run the test gate, build and install the v2 trial binary"
	@echo "  install-skip-tests  Same as install-binary, skipping the test gate"
	@echo "  build               Build the v2 trial binary only (channel $(CHANNEL))"
	@echo "  clean               Remove build artifacts"
	@echo "  help                Show this help message"
	@echo "Variables: BUN=$(BUN) CHANNEL=$(CHANNEL) V=$(V) INSTALL_DIR=$(INSTALL_DIR) OUTDIR=$(OUTDIR)"

bun-check:
	@test -x "$(BUN)" || { echo "error: pinned bun not found at $(BUN) (v2 requires the packageManager-pinned bun; the default ~/.bun/bin/bun is v1-only)" >&2; exit 1; }

channel-check:
	@test "$(CHANNEL)" != "latest" || { echo "error: CHANNEL=latest is the v1 live channel and must never be used here" >&2; exit 1; }

install: bun-check
	$(BUN) install

test-gate: bun-check
	$(BUN) test --cwd packages/cli --timeout 30000

build: bun-check channel-check
	@PATH="$(dir $(BUN)):$$PATH" OPENCODE_CHANNEL=$(CHANNEL) OPENCODE_VERSION=$(V) $(BUN) run --cwd packages/cli script/build.ts --single --outdir=$(ABS_OUTDIR)

install-binary: install test-gate install-copy

install-skip-tests: install install-copy

# mv-replace instead of cp-over: the opencode-v2 serve process may hold the
# destination open, and overwriting a running binary fails with ETXTBSY.
install-copy: build
	mkdir -p $(INSTALL_DIR)
	cp $(BUILD_BIN) $(INSTALL_DIR)/opencode.tmp
	chmod 755 $(INSTALL_DIR)/opencode.tmp
	mv -f $(INSTALL_DIR)/opencode.tmp $(INSTALL_DIR)/opencode
	@echo "installed $(INSTALL_DIR)/opencode"

clean:
	rm -rf $(OUTDIR) ./packages/*/dist ./packages/*/dist-node
