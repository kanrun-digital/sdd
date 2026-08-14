# Command detection (step 3)

Resolve four commands: **unit test**, **integration test**, **lint**, **vet/typecheck**. Do not hard-code any language. Run the cascade per command. The first hit wins. Print the resolved set. The user then sees what the engine will run and can override it via settings.

## Cascade (first match wins)

1. **Settings override.** A non-empty `cmd_test_unit` / `cmd_test_integration` / `cmd_lint` / `cmd_vet` in `.claude/sdd.local.md` short-circuits all later steps. This route is the escape hatch for unusual repos.
2. **Architecture-map frontmatter.** If `docs/architecture-map.md` exists, read its frontmatter. A non-empty `test_cmd` / `lint_cmd` wins. `survey` recorded these values from the tools the repo actually uses. An empty string `""` means unknown. Continue with the next step for that command.
3. **Makefile targets.** If a `Makefile` exists, grep its targets. Map by convention: `test` / `test-unit` → unit. `test-integration` / `integration` / `test-e2e` → integration. `lint` → lint. `vet` / `typecheck` / `check` → vet. A `Makefile` target wins over a raw tool. The target encodes the repo's own wiring (flags, build tags, env).
4. **`package.json` scripts.** If present, read `scripts`: `test` / `test:unit` → unit. `test:integration` / `test:e2e` → integration. `lint` → lint. `typecheck` / `tsc` → vet. Invoke via the repo's package manager (detect `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`).
5. **Language manifests** (the broad fallback — pick the toolchain the manifest implies):
   - `go.mod` → unit `go test ./...`. Integration `go test -tags=integration ./...`. Vet `go vet ./...`. Lint `golangci-lint run` (if installed).
   - `Cargo.toml` → `cargo test` / `cargo test -- --ignored` / `cargo clippy` / `cargo check`.
   - `pyproject.toml` / `setup.cfg` → `pytest` / `pytest -m integration` / `ruff check` (or `flake8`) / `mypy`.
   - `pom.xml` / `build.gradle` → `mvn test` / `mvn verify` / (checkstyle/spotless) / `mvn -q compile`.
   - `composer.json` → `vendor/bin/phpunit` (or the `scripts.test` entry) / the repo's tagged integration suite / `vendor/bin/phpcs` or `php-cs-fixer` / `vendor/bin/phpstan` or `psalm` (whichever is configured).
   - `Gemfile` → `bundle exec rspec` / `bundle exec rspec --tag integration` / `rubocop` / (no conventional typecheck — skip).
   - `*.csproj` / `*.sln` → `dotnet test` / `dotnet test --filter <integration category>` / `dotnet format --verify-no-changes` / `dotnet build`.
   - any other manifest → there is no convention to trust. **Ask the user for the commands.** Offer to save them to `.claude/sdd.local.md`. Never guess.
6. **Integration tier — Docker probe.** Whatever produced the integration command, confirm a Docker daemon is reachable (`docker info` succeeds) before you trust it. Most integration suites start an ephemeral dependency (testcontainers-style). Feed the probe result to `require_integration` (see [`settings.md`](./settings.md)): `auto` → run if reachable, else NON-red. `always` → BLOCK if unreachable. `never` → skip.

## Reporting

After detection, print a block like:

```
detected commands:
  unit         = make test
  integration  = make test-integration   (docker: reachable)
  lint         = golangci-lint run        (binary: present)
  vet          = make vet
```

If a command cannot be resolved, apply these rules. Lint or vet missing → skip that gate with a one-line warning. Do not fail the run. Unit missing → **stop** (TDD needs a unit runner). Integration missing → `require_integration` governs it.

## Notes

- Detection is read-only. Never install tools. If `golangci-lint` (or any linter) is not on PATH, note it and skip lint locally. CI can enforce it.
- Cache the resolved set for the whole run. Do not re-detect per task.
