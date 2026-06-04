# Update flow checklist

## Startup

- Load local config.
- Check selected install path.
- Show current local version.
- Request remote manifest.
- Validate manifest format.

## Download

- Build list of missing or changed files.
- Show progress by file and total progress.
- Show speed and ETA.
- Save partial files to a temporary directory.

## Verify

- Compare SHA-256 hashes.
- Retry failed files.
- Stop update on repeated verification failure.

## Install

- Move verified files into place.
- Unpack archives if the manifest marks them as archives.
- Delete temporary files.
- Save installed version.

## Ready

- Enable the Play button.
- Start the client with nickname and server arguments.
