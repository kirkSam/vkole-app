## 2026-10-26 (note from Sam, via Claude)
**Decision:** Store/App Store/Google Play publish is paused indefinitely. Do not work on
the Capacitor/mobile shell, store listing assets, or store-submission checklist items
unless Sam explicitly asks for that again.
**Why:** The app and the website are not ready yet. Known gaps from the last audit:
the app and website run two separate copies of the learning engine with no shown
sync, and the store-ready branch (`cursor/store-ready-capacitor-2858`) predates ~70
commits of engine work and was never updated.
**Shipped (merged):** Nothing new today
**Blocked / on hold:** Apple Developer account, Google Play Console account, Mac for
iOS archive — not being pursued right now
**Next:** Focus on app/website stability and engine parity. Revisit store publish only
when Sam restarts that track.
