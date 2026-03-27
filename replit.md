# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Product: LicitaIA

LicitaIA é um sistema de conferência documental guiado por edital para processos licitatórios. Permite que empresas:
1. Criem processos licitatórios
2. Façam upload do edital em PDF
3. Extraiam exigências documentais via IA
4. Enviem documentos da empresa
5. Façam conferência automática via IA (ok / faltando / vencido / divergente / revisar)
6. Gerem relatório final com próximos passos

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (artifacts/licitaia)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)
- **File upload**: multer + disk storage
- **PDF parsing**: pdf-parse

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (all backend routes)
│   └── licitaia/           # React + Vite frontend (LicitaIA app)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-openai-ai-server/  # OpenAI integration client
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

Tables:
- `processes` - Bidding processes (status, agency, modality, edital number, deadline)
- `uploaded_files` - Files uploaded per process (edital PDFs, company documents)
- `extracted_requirements` - Requirements/documents extracted from edital by AI
- `submitted_documents` - Company documents classified by AI
- `validation_items` - Checklist items linking requirements to submitted docs with status
- `final_reports` - Final conference reports with summary and counts

## Process States

criado → edital_enviado → edital_processando → exigencias_extraidas → aguardando_documentos → documentos_enviados → em_conferencia → pendencias_encontradas | pronto_para_revisao → concluido

## Validation Statuses

- ok: document found and correct
- faltando: document missing
- vencido: document expired
- divergente: document inconsistent
- revisar: needs human review

## Frontend Pages

- `/` → ProcessesPage (list of processes, create new)
- `/processes/:id` → ProcessDetailPage (edital upload, doc upload, AI analysis)
- `/processes/:id/checklist` → ProcessChecklistPage (full checklist, manual overrides, report)

## API Routes (all under /api)

- GET/POST /processes
- GET/PATCH/DELETE /processes/:id
- POST /processes/:id/upload-edital (multipart)
- POST /processes/:id/upload-document (multipart)
- DELETE /files/:id
- POST /processes/:id/analyze-edital (AI)
- POST /processes/:id/analyze-documents (AI)
- GET /processes/:id/requirements
- GET /processes/:id/validation
- PATCH /validation/:id
- GET /processes/:id/report
- GET /processes/:id/files

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists composite lib packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client and Zod schemas

## Files and Uploads

Files are stored on disk at `artifacts/api-server/uploads/`. In production, consider object storage.
