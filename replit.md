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

### Módulo de Licitações
- `processes` - Bidding processes (status, agency, modality, edital number, deadline)
- `uploaded_files` - Files uploaded per process (edital PDFs, company documents)
- `extracted_requirements` - Requirements/documents extracted from edital by AI
- `submitted_documents` - Company documents classified by AI
- `validation_items` - Checklist items linking requirements to submitted docs with status
- `final_reports` - Final conference reports with summary and counts

### Módulo de Chamamentos Públicos (OSC)
- `call_notices` - Public call notices (status, agency, reference number, category, deadline)
- `notice_files` - Files for chamamentos (edital, documento_osc, proposta, plano_trabalho, cronograma)
- `call_extracted_requirements` - Requirements extracted from chamamento edital by AI (with requirementType for OSC-specific types)
- `call_submitted_documents` - OSC documents matched to requirements
- `call_validation_items` - Checklist items with statuses: ok, pendente, divergente, vencido, incompleto, revisar_manualmente

## Process States (Licitações)

criado → edital_enviado → edital_processando → exigencias_extraidas → aguardando_documentos → documentos_enviados → em_conferencia → pendencias_encontradas | pronto_para_revisao → concluido

## Call Notice States (Chamamentos)

criado → edital_enviado → edital_processando → requisitos_extraidos → aguardando_documentos → documentos_enviados → em_conferencia → pendencias_encontradas | pronto_para_submissao → concluido

## Validation Statuses (Licitações)

- ok, faltando, vencido, divergente, revisar

## Call Validation Statuses (Chamamentos)

- ok, pendente, divergente, vencido, incompleto, revisar_manualmente

## Requirement Types (Chamamentos)

documento_institucional, certidao_regularidade, comprovacao_experiencia, declaracao, anexo_obrigatorio, proposta_tecnica, plano_trabalho, cronograma, requisito_elegibilidade, documento_parceria

## Frontend Pages

### Licitações
- `/` → ProcessesPage (list of processes, create new)
- `/processes/:id` → ProcessDetailPage (edital upload, doc upload, AI analysis)
- `/processes/:id/checklist` → ProcessChecklistPage (full checklist, manual overrides, report)

### Chamamentos Públicos
- `/chamamentos` → ChamamentosPage (list, filter by status, create new)
- `/chamamentos/:id` → ChamamentoDetailPage (edital upload, OSC docs, proposal section, AI analysis, next-step guidance)
- `/chamamentos/:id/checklist` → ChamamentoChecklistPage (checklist with filter by type/status, manual edit)

## API Routes (all under /api)

### Licitações
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

### Chamamentos Públicos
- GET/POST /chamamentos
- GET/PATCH/DELETE /chamamentos/:id
- POST /chamamentos/:id/upload-edital (multipart)
- POST /chamamentos/:id/upload-document (multipart, with fileType body field)
- DELETE /chamamentos/files/:id
- POST /chamamentos/ai/extract-meta (multipart, temp file)
- POST /chamamentos/ai/:id/analyze-edital (AI)
- POST /chamamentos/ai/:id/analyze-documents (AI)
- GET /chamamentos/:id/requirements
- GET /chamamentos/:id/validation
- PATCH /chamamentos/validation/:id
- GET /chamamentos/:id/files

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists composite lib packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client and Zod schemas

## Files and Uploads

Files are stored on disk at `artifacts/api-server/uploads/`. In production, consider object storage.
