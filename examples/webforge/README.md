# WebForge

The Shippin web instance of DevForge — the custom split that lowers the barrier of
entry to the IDE. Full VS Code extension support (Open VSX router), the Theia AI suite
(Clyffy's home in `@theia/ai-chat`), and in-app browsing (mini-browser today; the
bundled headless engine and skeleton-render experiences to come).

```bash
npm run build:webforge   # bundle
npm run start:webforge   # serve (theia start --plugins=local-dir:../../plugins --ovsx-router-config=../ovsx-router-config.json)
```

`examples/browser` remains at upstream parity — brand lives only in this package so
Theia merges never conflict with identity.
