---
name: CNPJ extraction anti-hallucination
description: How the /extract-cnpj endpoint was fixed to stop GPT from inventing fictional company data.
---

## The rule
Never put descriptive placeholder values inside the JSON schema example in a prompt (e.g. `"razaoSocial": "razão social completa da empresa"`). GPT treats those as output examples and generates similarly-formatted fictional data.

**Why:** When a JSON schema example contains human-readable strings like "Nome da Empresa LTDA" or "João da Silva" as placeholders, the model pattern-matches and fills in equivalent-looking fake values instead of extracting from the document.

**How to apply:**
- Use `<...>` angle-bracket descriptors in the schema (e.g. `"razaoSocial": <string exata do documento ou null>`) so the model clearly sees them as instructions, not values to emulate.
- Add a system message that explicitly forbids invention: "NUNCA invente ou complete dados ausentes."
- Set `temperature: 0` and `response_format: { type: "json_object" }`.
- For images: do ONE vision call that returns JSON directly — avoid extracting text first and then calling again (two-step process doubles hallucination risk).
