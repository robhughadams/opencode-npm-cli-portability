.PHONY: help install install-binary install-skip-tests install-binary-skip-tests clean build lint typecheck check test dev

help:
	@echo "Available targets:"
	@echo "  install        Install dependencies"
	@echo "  install-binary Build and install the opencode binary locally"
	@echo "  install-skip-tests        Install without running tests"
	@echo "  install-binary-skip-tests Build and install the opencode binary locally, skipping tests"
	@echo "  build          Build the entire monorepo"
	@echo "  lint           Run linting (oxlint)"
	@echo "  typecheck      Run TypeScript type checking"
	@echo "  check          Run lint and typecheck"
	@echo "  clean          Clean build artifacts"
	@echo "  dev            Start development server"
	@echo "  test           Run tests (root tests disabled)"
	@echo "  help           Show this help message"

install: install-binary

install-binary:
	bun install
	bun test --cwd packages/opencode --timeout 30000
	cd packages/opencode && OPENCODE_CHANNEL=latest bun run build --single
	./install --binary packages/opencode/dist/opencode-linux-x64/bin/opencode --no-modify-path

install-skip-tests: install-binary-skip-tests

install-binary-skip-tests:
	bun install
	cd packages/opencode && OPENCODE_CHANNEL=latest bun run build --single
	./install --binary packages/opencode/dist/opencode-linux-x64/bin/opencode --no-modify-path

clean:
	rm -rf ./packages/*/dist
	bun clean

build: install
	bun turbo build

lint:
	oxlint

typecheck:
	bun turbo typecheck

check: lint typecheck

dev:
	bun run dev

test:
	@echo "Tests should be run from individual packages, not the root"
	@exit 1
