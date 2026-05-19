This personal fork disables repository-managed git hooks by pointing the local
`core.hooksPath` at this empty directory.

Why:
- avoid upstream Husky hooks in this fork
- keep the change repo-local instead of changing global git config

To keep hooks disabled for this clone:

```sh
git config --local core.hooksPath .githooks-disabled
```
