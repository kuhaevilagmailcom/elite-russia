# Launcher architecture

The launcher is responsible for installing, checking and updating the game client.

This repository does not include production credentials, private download links or full client archives.

## Main flow

1. Read local installation state.
2. Download a public manifest.
3. Compare local version and remote version.
4. Download missing or changed files.
5. Verify file hashes.
6. Unpack archives when needed.
7. Remove temporary files.
8. Start the client with the selected nickname and server arguments.

## Manifest

A safe manifest example is available in:

```text
launcher/manifest.example.json
```

The real production manifest may use private CDN links and must not be committed.

## Update stages

The launcher UI should show a clear stage:

- checking;
- downloading;
- unpacking;
- verifying;
- ready;
- failed.

## Important details

- Download progress should include total size, current size, speed and ETA.
- The launcher should be able to resume after failed downloads.
- Files should be checked by hash, not only by file size.
- Temporary archives should be deleted after successful unpack.
- Production config values should be loaded from a local file or environment, not from public source code.
