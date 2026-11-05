# Nyalur Hybrid Platform Architecture

Status: proposal / foundation document
Base: main (keep production branch unchanged)

## Product direction

Nyalur remains one cross-platform product:
- Web/PWA: iOS, iPadOS, Windows, macOS, Linux, and Android browsers.
- Android app: a Capacitor-hosted Android application that reuses the Svelte UI and PeerJS/WebRTC transfer layer, with a native Android storage bridge for media.
- Do not split the product into unrelated clients or rewrite the P2P engine without a measured need.

## User experience target

1. Sender selects files and starts sending.
2. Receiver sees the incoming transfer and presses **Terima** once.
3. Transfer runs and reports progress.
4. On Android native, completed images/videos are written to the appropriate public media collection using Android MediaStore. Other files go to Downloads or an app-selected destination.
5. On browser platforms, Nyalur uses browser-supported download/save behavior and explains any required browser confirmation. A web page cannot guarantee silent writes into the iOS Photos library or arbitrary desktop folders.

## Platform boundaries

### Shared web layer
- Svelte screens and styling.
- Room-code pairing and QR.
- PeerJS signaling and WebRTC data channel.
- Shared transfer protocol, metadata validation, progress, cancellation, and history model.

### Android native adapter
- Package the same web application with Capacitor.
- Add a small, explicit native plugin implemented in Kotlin for writing received media via MediaStore.
- Expose a narrow API: begin file, append byte chunk, finish file, cancel file, and return the saved URI/result.
- Ask only for permissions required by the Android versions actually targeted. Prefer MediaStore/scoped storage; do not request broad storage access as a shortcut.
- Handle duplicate names, MIME types, partial-write cleanup, and app lifecycle interruption.

### Browser adapter
- Keep normal browser behavior for file selection and downloads.
- Where supported, offer browser save APIs; feature-detect them and keep a standard download fallback.
- Do not claim that iOS Safari/PWA can silently save directly into Photos. The user may still need to confirm or move files depending on browser/OS behavior.

## Critical engineering findings in current transfer engine

The current `src/lib/transfer-engine.js`:
- sends 512 KiB chunks and yields after each chunk;
- does not implement receiver acknowledgements or sender-side bufferedAmount backpressure;
- resolves the sender as soon as it sends `transfer-complete`, not when the receiver confirms durable completion;
- accumulates each received file's chunks in memory, then creates a Blob;
- does not provide resumable transfer or a durable partial-file lifecycle.

These are important prerequisites for large-file reliability and native streaming storage. Do not simply bolt a native save call onto the existing final Blob path and assume it will scale.

## Recommended implementation sequence

### Phase 0 — Preserve and verify
- Keep `main` unchanged.
- Do not merge the earlier ZIP-download PR; that UI does not match the agreed one-tap receive experience.
- Build and test current baseline before structural changes.

### Phase 1 — Shared transfer reliability
- Define and version transfer messages.
- Add receiver ACKs and bounded sender backpressure.
- Add explicit per-file completion and final receiver confirmation.
- Validate metadata, chunk indexes, sizes, and connection state.
- Ensure listener cleanup on success, rejection, cancellation, and disconnect.
- Keep a browser Blob-based storage adapter as the compatibility baseline.

### Phase 2 — Storage abstraction
- Separate transfer protocol from destination storage.
- Define a storage adapter contract with begin/write-chunk/commit/abort operations.
- Browser adapter retains compatible download behavior.
- Android adapter streams chunks to a temporary native file and commits to MediaStore only after size/integrity checks succeed.

### Phase 3 — Android application shell
- Add Capacitor Android wrapper without changing the web deployment.
- Implement/test Kotlin MediaStore plugin on supported Android versions.
- Save images/videos into media collections so they appear in Gallery/Photos apps; route other files to Downloads or a suitable picker.
- Keep PWA deployment available independently.

### Phase 4 — Cross-platform verification
Test Android native ↔ Android native, Android ↔ iOS Safari/PWA, Android ↔ Windows/macOS browser, and desktop ↔ desktop. Include small files, many files, large files, duplicate filenames, interruption, retry, and low-memory devices.

## Acceptance criteria for the desired Android flow

- Receiver performs one explicit action: **Terima**.
- No post-transfer **Unduh** button is required on Android native.
- Files appear in the appropriate Gallery/Photos collection or Downloads location.
- A file is not reported as successfully received until it is committed and verified.
- Failed or interrupted files are not exposed as completed media.
- Existing PWA continues to work on iOS and desktop without requiring an Android installation.

## Out of scope for the first milestone

- Rewriting the entire app in Kotlin.
- Replacing PeerJS/WebRTC before performance and reliability measurements justify it.
- Promising silent direct-to-Photos saving on iOS or unrestricted silent file writes in desktop browsers.
- Merging the ZIP-download experiment into production.
