# Visual QA

- Admin: exercise the changed flow in the browser (click, type, submit,
  navigate). One screenshot is not verification.
- Check the other routes that share the state you touched (tenant switcher,
  session, query cache).
- Empty, error, and loading states — not only the happy path.
- Desktop and a narrow viewport if layout changed.
- Mobile: light and dark; iOS and Android back. If a simulator is not
  available, say what you could not verify.
- Confirm no hardcoded hex landed on the screen.
