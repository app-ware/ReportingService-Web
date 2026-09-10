# Bundled report fonts

Drop the project-approved, licence-cleared, Arabic-capable font files into this directory.
`ReportFontService` reads them at boot and inlines them into every rendered report as
base64 `@font-face` sources.

## Why they must be bundled

The renderer blocks all `http:`, `https:` and `file:` requests that Chromium makes while
rendering a report. A font referenced by URL — from a CDN or from local disk — is therefore
denied and silently falls back, which is how Arabic text turns into tofu boxes. Inlining a
file that ships with the service is the only path that works under those rules, and it also
means a report renders identically with no network at all.

## What to drop here

Any combination of `.woff2`, `.woff`, `.ttf` or `.otf` files. `.woff2` is preferred: it is
the smallest, and every face is embedded in every PDF request, so size matters.

Weight and style are inferred from the filename, following the convention font vendors
already use:

| Filename contains | Registers as |
| --- | --- |
| `Light` | `font-weight: 300` |
| (none of the below) | `font-weight: 400` |
| `Medium` | `font-weight: 500` |
| `SemiBold` / `DemiBold` | `font-weight: 600` |
| `Bold` | `font-weight: 700` |
| `Italic` / `Oblique` | `font-style: italic` |

Regular and bold are the two faces the report templates actually use.

All files are registered under the single family `iCareReport`, so the templates never name
a specific typeface and swapping the approved font is a file-drop with no code change.

## Until a font is bundled

The service starts normally and renders with the system stack (`Arial, Helvetica,
sans-serif`), logging a warning once at boot that Arabic coverage is unverified. Arabic
reports will render only as well as the host image's own fonts allow — which in a slim
container is usually not at all.

No specific typeface is required by the code. Noto Sans Arabic is a common choice, but it
is not assumed, not depended on and not fetched: whichever family the project approves goes
here.

## Deployment

`nest-cli.json` copies `assets/**/*` into `dist/`, and the Dockerfile copies `dist/`, so
files placed here reach the running container with no further wiring. Verify with:

```
node -e "console.log(require('fs').readdirSync('dist/assets/fonts'))"
```
