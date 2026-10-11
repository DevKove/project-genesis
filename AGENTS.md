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

## Presentation architecture
- Keep administrative presentation in semantic global tokens, existing UI primitives and the shared app shell; preserve route-specific data/permission logic to avoid workflow regressions.
- Use the existing Radix Sheet/Dialog primitives for mobile navigation and modal editing so keyboard focus and Escape behavior stay accessible.
