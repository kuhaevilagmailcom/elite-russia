# Contributing

Thanks for taking time to improve the project.

## Before opening a pull request

Please check that:

- files are UTF-8 encoded;
- no secrets are committed;
- paths are stable and do not break CEF loading;
- interface callbacks are documented;
- public examples do not contain production-only logic.

## Branch names

Recommended format:

```text
docs/short-topic
feat/short-topic
fix/short-topic
```

## Commit examples

```text
docs: update CEF bridge contract
feat: add ATM interface example
fix: normalize skin model callback
```

## Pull request checklist

- Explain what changed.
- Mention affected interface or module.
- Add screenshots for UI changes when possible.
- Update docs when a public contract changes.
