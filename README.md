# ReportingService

## Runtime configuration

ReportingService-Web is an internal, presentation-only PDF renderer. It accepts report
payloads from NurseryServices-Web, renders them with Handlebars and Chromium, and does not
connect to application databases.

| Variable | Default | Purpose |
| --- | ---: | --- |
| `INTERNAL_API_KEY` | none | Required key expected in `X-Internal-API-Key`; requests fail closed when it is missing. |
| `REPORT_RENDER_TIMEOUT_MS` | `20000` | Maximum time for one HTML-to-PDF render. |
| `REPORT_MAX_CONCURRENT_RENDERS` | `2` | Maximum simultaneous isolated Chromium contexts. |
| `REPORT_MAX_QUEUE_DEPTH` | `10` | Maximum queued renders before new work is rejected with 503. |
| `REPORT_QUEUE_TIMEOUT_MS` | `10000` | Maximum time a render may wait in the queue. |
| `REPORT_MAX_PAYLOAD_BYTES` | `5242880` | Maximum serialized report payload size. |
| `REPORT_MAX_IMAGE_BYTES` | `2097152` | Maximum decoded size of one logo, header, or footer image. |

These are conservative, configurable defaults rather than fixed product limits. Tune them
from bounded load tests in the deployment environment. NurseryServices-Web's downstream
timeout must remain slightly greater than `REPORT_RENDER_TIMEOUT_MS`.

Arabic-capable fonts must be approved, licence-cleared, and bundled under
`src/assets/fonts/`. They are copied into the build and inlined as data URIs; the renderer
does not retrieve fonts from the network.

## Structure:

```
├── src
│   ├── common
│   │   ├── decorators
│   │   │   ├── response-message.decorator.ts
│   │   │   └── user.decorator.ts
│   │   ├── dto
│   │   │   └── pagination.dto.ts
│   │   ├── guards
│   │   │   ├── center-access.guard.ts
│   │   │   └── internal-api-key.guard.ts
│   │   ├── interfaces
│   │   │   └── paginated-response.interface.ts
│   │   ├── json-respons-files
│   │   │   ├── api-response.dto.ts
│   │   │   ├── http-exception.filter.ts
│   │   │   └── transform.interceptor.ts
│   │   ├── logger
│   │   │   └── logger.module.ts
│   │   ├── middleware
│   │   │   └── correlation-id.middleware.ts
│   │   ├── pipes
│   │   │   └── validation.pipe.ts
│   │   ├── resolvers
│   │   │   └── UserAgentLangResolver.ts
│   │   ├── shared
│   │   │   └── shared.module.ts
│   │   └── utils
│   ├── config
│   │   ├── file system
│   │   │   ├── file.config.ts
│   │   │   └── upload.config.json
│   │   ├── mssql
│   │   │   ├── mssql-client.constants.ts
│   │   │   ├── mssql-client.module.ts
│   │   │   └── mssql-client.providers.ts
│   │   ├── tedious
│   │   │   ├── tedious.constants.ts
│   │   │   └── tedious.providers.ts
│   │   └── database.config.ts
│   ├── i18n
│   │   ├── ar
│   │   │   └── ar.json
│   │   ├── en
│   │   │   └── en.json
│   │   └── fr
│   │       └── fr.json
│   ├── modules
│   │   ├── auth
│   │   │   ├── dto
│   │   │   │   └── jwt-payload.ts
│   │   │   └── guards
│   │   │       └── jwt-auth.guard.ts
│   │   └── evaluation-report
│   │       ├── dto
│   │       │   ├── evaluation-report.dto.ts
│   │       │   ├── report-data.interface.ts
│   │       │   └── template-data.interface.ts
│   │       ├── .md
│   │       ├── evaluation-reports.controller.spec.ts
│   │       ├── evaluation-reports.controller.ts
│   │       ├── evaluation-reports.module.ts
│   │       ├── evaluation-reports.service.spec.ts
│   │       ├── evaluation-reports.service.ts
│   │       └── pdf.service.ts
│   ├── templates
│   │   └── evaluation-reports
│   │       ├── evaluation-report.hbs
│   │       └── node.hbs
│   ├── app.controller.spec.ts
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   └── main.ts
├── test
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── .gitignore
├── .prettierrc
├── README.md
├── eslint.config.mjs
├── nest-cli.json
├── package-lock.json
├── package.json
└── tsconfig.json
```

---
