---
name: CNPJ extraction anti-hallucination + PDF image handling
description: How the /extract-cnpj endpoint was fixed for both hallucination and image-based PDF support.
---

## Rule 1: Anti-hallucination prompt design
Never put descriptive placeholder values inside the JSON schema example in a prompt (e.g. `"razaoSocial": "razão social completa da empresa"`). GPT treats those as output examples and generates similarly-formatted fictional data.

**Why:** When a JSON schema example contains human-readable strings like "Nome da Empresa LTDA" as placeholders, the model pattern-matches and fills in equivalent-looking fake values.

**How to apply:**
- Use `<...>` angle-bracket descriptors (e.g. `"razaoSocial": <string exata do documento ou null>`)
- Add a system message: "NUNCA invente ou complete dados ausentes."
- Set `temperature: 0` and `response_format: { type: "json_object" }`
- For images: one vision call → JSON directly (avoid two-step OCR + extraction)

## Rule 2: Image-based PDFs in Replit
PDF rendering tools (pdftoppm, pdfimages, ghostscript) all hang/timeout when processing certain PDFs in the Replit sandbox environment. Do NOT rely on them.

**Why:** The Replit sandbox lacks proper display/font environment needed by PDF renderers. Calls hang indefinitely.

**How to apply:**
- Receita Federal cartão CNPJ PDFs are often image-based (JPEG embedded in PDF binary)
- Extract the embedded JPEG directly via binary scan: look for JPEG SOI marker `0xFF 0xD8 0xFF`, scan to EOI `0xFF 0xD9`
- This works with pure Node.js Buffer operations — no external tools needed
- The JPEG is typically at or very near offset 164 in these PDFs
- After extraction, pass the JPEG buffer as base64 data URL to the vision API
