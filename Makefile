.PHONY: help install clean build lint typecheck check test dev

help:
	@echo "Available targets:"
	@echo "  install       Install dependencies"
	@echo "  build         Build the entire monorepo"
	@echo "  lint          Run linting (oxlint)"
	@echo "  typecheck     Run TypeScript type checking"
	@echo "  check         Run lint and typecheck"
	@echo "  clean         Clean build artifacts"
	@echo "  dev           Start development server"
	@echo "  test          Run tests (root tests disabled)"
	@echo "  help          Show this help message"

install:
	bun install

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
