# ReportingService

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
