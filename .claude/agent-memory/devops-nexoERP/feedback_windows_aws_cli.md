---
name: feedback_windows_aws_cli
description: AWS CLI en Windows lanza charmap UnicodeEncodeError cuando la respuesta contiene caracteres fuera de CP1252
type: feedback
---

El comando `aws amplify get-app` falla con exit code 255 y mensaje `'charmap' codec can't encode characters` en Windows cuando el buildSpec de Amplify contiene caracteres Unicode (comillas tipograficas, guiones em, etc.) y la terminal usa codepage CP1252 (default en Windows).

**Why:** Python (que usa la AWS CLI internamente) intenta escribir a stdout usando el encoding del sistema, que en Windows es CP1252 por defecto. Cualquier caracter fuera de ese codepage provoca UnicodeEncodeError y la CLI aborta con exit 255.

**How to apply:**
1. Agregar al inicio de scripts PowerShell que usen AWS CLI:
   $env:PYTHONUTF8 = "1"
   $env:PYTHONIOENCODING = "utf-8"
   [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
2. Alternativa: usar --query para filtrar campos que contengan texto libre con posibles caracteres unicode (buildSpec, commitMessage, etc.).
3. Ya aplicado en scripts/validate-staging-infra.ps1: lineas 18-21 (env vars) + query filtrada en get-app (linea 329).
