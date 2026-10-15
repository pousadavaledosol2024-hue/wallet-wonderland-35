<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Dashboard and calendar share React Query options and effect-scoped Realtime subscriptions; one data model keeps occupancy consistent across views.
- Public availability exposes only room identifiers and blocked dates, never guest or payment data; booking conflict prevention runs in the database for every writer.
- External website integration must be verified against its actual deployed code before being reported as connected.
- Configuration and templates are account-scoped; user_roles stores protected roles and account ownership, and privileged account operations verify roles using the authenticated client before importing the admin client.
- External iCal imports use a pure-JavaScript parser, HTTPS provider allowlists, bounded fetches, and atomic database reconciliation; exports omit guest information and source-feed echoes.
- Website media uses native private storage with owner-folder write policies; do not present temporary signed preview URLs as public site assets.
