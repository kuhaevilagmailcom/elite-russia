# API usage

The team uses API tools for development support, not for storing player secrets or replacing production checks.

Typical usage:

- code review for CEF interfaces;
- finding duplicated bridge code;
- writing interface contract documentation;
- creating launcher update checklists;
- explaining crash logs and edge cases;
- generating test cases for public examples.

## Data rules

Do not send:

- passwords;
- real player personal data;
- private API keys;
- production database dumps;
- paid game assets;
- private CDN credentials.

When a bug requires logs, remove sensitive values before sharing them.
