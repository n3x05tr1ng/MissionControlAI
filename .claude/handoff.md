# Handoff — Hive (MissionControlAI) — 2026-05-24 (post MCP wiring)

## Done this session

Sesión corta y enfocada: **MCP wiring runtime** completo y verificado.

**Wave K (parche v0.5.1) — MCP runtime wiring**
- **Provider `claudeCli.ts`**: ahora cuando un Agent Profile tiene `mcpServers: ["claude_ai_Notion", ...]`, el spawn de `claude` recibe en `--allowed-tools` los patrones `mcp__<id>__*` por cada server. Helper nuevo `buildMcpToolPatterns()` en el mismo archivo.
- **Path resolver extraído**: `resolveClaudeCli()` y `buildEnvWithClaudeDir()` se movieron a `src/lib/providers/claudeCliPath.ts` (módulo nuevo) para reuso. `claudeCli.ts` y el endpoint nuevo lo importan desde ahí.
- **Endpoint nuevo `/api/system/mcp-servers`**: ejecuta `claude mcp list` (con timeout 15s + PATH enriquecido) y parsea la salida a `{ id, label, status, raw }[]`. Status es `connected | needs_auth | error | unknown`. Se puede usar desde la UI de profiles para mostrar qué MCPs están realmente disponibles, no sólo lo del catálogo estático.

**Hallazgos clave durante el wiring** (ahorran sesiones futuras):
- Los MCPs "claude.ai *" (Notion, Supabase, Gmail, Mercury, etc.) **NO viven en `~/.claude.json`** y NO necesitan `--mcp-config`. Están gestionados por OAuth a nivel cuenta del usuario y el CLI los auto-carga al spawnearse. Sólo `cli-microsoft365` aparece en `~/.claude.json mcpServers` (stdio local).
- **Solo necesitamos `--allowed-tools`** para autorizar; el CLI ya hereda toda la config MCP del scope user. Esto invalida la "opción 1" del handoff anterior (heredar `~/.claude.json` y construir mcp-config temp): innecesaria.
- El tool prefix es exactamente `mcp__<server-id>__<tool>`, donde `<server-id>` es el label colapsando dots y spaces a underscores (`claude.ai Notion` → `claude_ai_Notion`). Coincide con los IDs del catálogo (`src/lib/mcp/catalog.ts`). El endpoint nuevo deriva el id con esa misma regla.
- `--allowed-tools` soporta wildcard sufijo: `mcp__claude_ai_Notion__*` autoriza las 14 tools del MCP en una entrada.

**Verificación end-to-end**:
1. `GET /api/system/mcp-servers` devuelve 11 MCPs locales con sus IDs canónicos.
2. PATCH al profile `daily-summarizer` con `mcpServers: ["claude_ai_Notion"]` aceptado.
3. Run de automation "Daily Project Standup" completó status `done`.
4. **Test directo con flags exactos del provider** (`--allowed-tools "Read,Edit,Write,Glob,Grep,Bash,mcp__claude_ai_Notion__*"`) + prompt forzando `notion-search`: el agente devolvió "Projects" (resultado real del workspace Notion del usuario). Confirmado que el wildcard autoriza el MCP correctamente.
5. Profile revertido a `mcpServers: []` para no dejar estado de test.

## Next step

Wirear el **endpoint `/api/system/mcp-servers` en la UI de profiles** (`src/app/profiles/[id]/page.tsx`):
- Llamar al endpoint al cargar el editor.
- Cruzar con el catálogo: mostrar MCPs como "disponibles" (verde / clickeable) si aparecen en la lista local, "no configurado" (gris / disabled) si están en catálogo pero no detectados, "needs auth" si están detectados pero requieren login.
- Permitir abrir directamente la página de auth (para los OAuth) — quizá un botón "Connect in Claude" que abra `claude mcp` o el flow web.

Otras tareas pendientes ordenadas por prioridad:
1. **Output por step vacío en automation-runs**: el `finalOutput` se rellena bien, pero `events[].output` viene `""`. Bug independiente del MCP wiring — revisar `automations/orchestrator.ts` y cómo se persisten los eventos.
2. **Plugin MCPs no se listan**: el regex de `/api/system/mcp-servers` falla con labels que tienen `:` interno (ej. `plugin:claude-mem:mcp-search`). Mejorar parsing: separar por el último ` - ` para extraer status y por el primer `: ` (colon + espacio) para label vs URL. No crítico.
3. **Documentar `mcpServers` en UI de profile**: tooltip / link a `claude mcp list` para enseñar al user qué IDs usar.
4. **CLAUDE.md / README**: actualizar la sección de Agent Profiles para mencionar que los MCPs se auto-cargan y sólo hay que listarlos en el profile para autorizar.

## Blockers

Ninguno. La app arranca limpia, todas las rutas 200, automations corren end-to-end con MCPs habilitados cuando el profile los lista.

## Open questions

1. ¿Profiles deberían poder definir MCPs no presentes en el config global del usuario? Decisión actual (no cambió desde sesión anterior): **sólo activar los ya configurados**. Si un user lista en el profile `claude_ai_Slack` pero no tiene Slack conectado, el wildcard `mcp__claude_ai_Slack__*` simplemente no matchea nada — fallo silencioso, sin error de spawn. Tolerable; quizá la UI debería mostrar warning.
2. ¿`--strict-mcp-config` para sandbox? Hoy el agente hereda TODOS los MCPs configurados a nivel user. Si el profile quiere aislamiento real (sólo los listados), habría que usar `--strict-mcp-config` + un mcp-config temp con sólo los seleccionados — pero esto requiere replicar config + auth (complejo para OAuth). Por ahora no se hace; la lista del profile es de **autorización**, no de inyección.
3. ¿Cómo manejamos cuando el CLI agrega/cambia el formato de `claude mcp list`? El parser es regex-based y frágil. Opción: usar `claude mcp list --json` si existe (verificar) o pedir a Anthropic que estabilicen la salida.

## Files touched

- `src/lib/providers/claudeCli.ts` — añadido `buildMcpToolPatterns()` + lógica de merge en `--allowed-tools`. Removido el path resolver interno (movido a módulo nuevo).
- `src/lib/providers/claudeCliPath.ts` — **nuevo**. Exporta `resolveClaudeCli()` y `buildEnvWithClaudeDir()`.
- `src/app/api/system/mcp-servers/route.ts` — **nuevo**. GET → lista MCPs detectados localmente.
- `.claude/handoff.md` — actualizado (este archivo).
- `.claude/state.json` — status → done, próximo step actualizado.

## Context for next run

**Estado actual del repo:**
- Branch: `main`. Cambios unstaged (los del wiring + docs).
- `npm run dev` corre limpio. `npx tsc --noEmit` verde.
- DB sin cambios de schema (no se tocó `db.ts`).

**Decisiones tomadas / arquitectura locked-in:**
- MCPs configurados a nivel user (vía `claude mcp add` o OAuth en claude.ai) **se auto-cargan** al spawnear `claude`. No hay que pasarles config explícita en runtime.
- El profile sólo controla **autorización** (qué MCPs puede usar el agente vía `--allowed-tools`), no **inyección**.
- Path al CLI siempre via `resolveClaudeCli()` (nunca bare `claude` en código Next-side).
- API key sigue siendo sólo para Assistant; el Engine usa subscription via CLI.

**No hacer (lessons aprendidas, sin cambios):**
- No usar `node-pty` dentro de Next.
- No pasar el prompt como positional si hay `--allowed-tools` (va por stdin).
- No asumir PATH del shell.
- No correr `rm -rf .next` con dev server vivo.

**Cómo verificar tu trabajo si tocas MCP wiring:**
1. `curl http://localhost:3000/api/system/mcp-servers | jq` — debe listar tus MCPs locales.
2. PATCH un profile cualquiera con `mcpServers: ["claude_ai_<algo>"]`.
3. Crea una automation con ese profile y córrela.
4. Para test concluyente: `echo "<prompt que requiere ese MCP>" | claude --print --allowed-tools "...,mcp__claude_ai_<algo>__*"` y verifica que invoca el MCP.
