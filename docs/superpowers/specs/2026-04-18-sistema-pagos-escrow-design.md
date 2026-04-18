# Sistema de Pagos con Escrow Suave — Diseño

**Fecha:** 2026-04-18  
**Estado:** Aprobado — listo para implementar  
**Proceso:** Brainstorming + Multi-Agent Review (Skeptic / Constraint Guardian / User Advocate / Arbiter)

---

## Resumen

Sistema de liberación de pagos para Luderis que protege al alumno (no paga por una clase que no se dio), al docente (cobra rápido sin burocracia) y a Luderis (respaldo fiscal y legal ante AFIP).

---

## Comprensión del problema

- **Qué:** Flujo completo desde que el alumno paga hasta que el docente recibe el dinero, incluyendo verificación de clase dictada y compliance fiscal
- **Por qué:** Proteger a todas las partes sin matar la UX
- **Para quién:** Docentes (monotributistas o responsables inscriptos), alumnos que pagan por adelantado, admin de Luderis
- **Constraints:** Ya existe `clase_finalizada` + confirmación dual; MP integrado con vinculación de cuentas de docentes; Argentina requiere compliance AFIP
- **Non-goals:** No hacer contaduría de los docentes; no bloquear cobro por burocracia; no split por clase en tiempo real (por ahora)

---

## Flujo de pagos (Opción A — Escrow Suave)

```
ALUMNO PAGA
    ↓
[pagos] estado: "retenido" — dinero en MP de Luderis
    ↓
DOCENTE marca clase finalizada (validado server-side por RLS)
    ↓
NOTIFICACIÓN al alumno: "Tenés 72hs para disputar si algo estuvo mal"
(push + email)
    ↓
    ├── Alumno disputa → [disputas] → Admin resuelve en ≤5 días hábiles
    │       ├── Falla a favor del alumno  → Reembolso via MP
    │       └── Falla a favor del docente → Split liberado
    │
    └── Sin disputa en 72hs → pg_cron dispara liberación automática
            ↓
        Verificar cuenta MP del docente conectada
            ├── Sí → Split 90/10 via MP Marketplace (application_fee + collector_id)
            └── No → Hold + email "Reconectá tu cuenta de MP para cobrar"
                ↓
        [pagos] estado: "liberado"
            ↓
        FIN DE MES → Edge Function genera liquidación PDF por docente
            ↓
        Email al docente con PDF adjunto + disponible en dashboard MiCuenta
            ↓
        Docente emite UNA factura mensual a Luderis cuando quiera
        (no bloquea el cobro — es su responsabilidad fiscal)
```

---

## Paquetes de clases

Para `tipo: "paquete_clase"`: el split se libera **clase por clase** dentro del paquete, no al finalizar todo el paquete. Cada clase del paquete genera su propia entrada en `[pagos]` prorrateada.

---

## Compliance fiscal (protección de Luderis ante AFIP)

| Acción | Responsable | Cuándo |
|--------|-------------|--------|
| CUIT del docente requerido | Luderis (onboarding) | Al registrarse como docente |
| T&C con cláusula fiscal | Luderis | Onboarding (ya existe) |
| Liquidación mensual PDF | Luderis (automático) | Fin de cada mes |
| Factura a Luderis | Docente | Cuando quiera (no bloqueante) |
| Régimen informativo AFIP (RG 4838) | Luderis (con contador) | Según volumen — consultar |

> **Nota legal importante:** Consultar contador especializado en e-commerce para determinar si Luderis aplica al régimen de agente informativo (RG 4838). La liquidación mensual + CUIT + T&C cubre el ~90% de la protección legal. El 10% restante depende de la categoría y volumen de operaciones.

---

## Estructura de datos nueva / modificada

### Tabla `verificaciones_usuario` — agregar columna
```sql
ALTER TABLE verificaciones_usuario ADD COLUMN IF NOT EXISTS cuit TEXT;
```

### Tabla `disputas` — nueva
```sql
CREATE TABLE disputas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id UUID REFERENCES pagos(id) NOT NULL,
  inscripcion_id UUID REFERENCES inscripciones(id),
  alumno_email TEXT NOT NULL,
  docente_email TEXT NOT NULL,
  motivo TEXT NOT NULL,          -- "clase_no_dada" | "problema_calidad" | "otro"
  descripcion TEXT,
  estado TEXT DEFAULT 'abierta', -- "abierta" | "resuelta_alumno" | "resuelta_docente"
  resolucion TEXT,
  admin_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resuelto_at TIMESTAMPTZ
);
```

### Tabla `pagos` — nuevos estados
```
"retenido"   → pago aprobado, esperando confirmación de clase
"en_disputa" → alumno disputó, admin interviniendo
"liberado"   → split ejecutado, docente cobró
"reembolsado"→ disputa resuelta a favor del alumno
```

### Tabla `liquidaciones` — nueva
```sql
CREATE TABLE liquidaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docente_email TEXT NOT NULL,
  periodo TEXT NOT NULL,           -- "2026-04" (año-mes)
  monto_bruto NUMERIC NOT NULL,
  monto_neto NUMERIC NOT NULL,     -- bruto - comisión Luderis
  comision_luderis NUMERIC NOT NULL,
  cantidad_clases INTEGER NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Infraestructura requerida

| Componente | Qué hacer |
|------------|-----------|
| `pg_cron` en Supabase | Job diario que busca pagos "retenido" con > 72hs desde `clase_finalizada_at` y los libera |
| MP Marketplace | Modificar `mp-checkout` para incluir `application_fee` + `collector_id` del docente |
| Edge Function `generar-liquidacion` | Corre el 1° de cada mes, genera PDF con `pdf-lib` y lo sube a Storage |
| Notificaciones | Email + push al alumno cuando docente marca clase finalizada |
| RLS Supabase | Solo el docente de la inscripción puede marcar `clase_finalizada = true` |

---

## Seguridad

- Marcar clase finalizada: validado server-side vía RLS — solo el `docente_email` de la publicación correspondiente puede actualizar ese campo
- Split MP: nunca expuesto al cliente, solo ejecutado desde Edge Function con service role
- CUIT: almacenado en `verificaciones_usuario`, solo accesible por admin y el propio usuario

---

## Decision Log

| # | Decisión | Alternativas consideradas | Motivo |
|---|----------|--------------------------|--------|
| 1 | 72hs de ventana de disputa (no 24hs) | 24hs, 48hs, 7 días | 24hs muy corto para usuarios que no abren la app a diario; 7 días penaliza al docente |
| 2 | Factura no bloquea el cobro | Bloquear hasta factura subida | Mata la UX; docentes se van a otra plataforma |
| 3 | CUIT en onboarding de docente | Al primer cobro, nunca | Necesario para liquidaciones y potencial RG 4838; onboarding es el momento correcto |
| 4 | Split clase por clase en paquetes | Al finalizar todo el paquete | Más justo para el docente; reduce riesgo si hay disputa en una clase suelta |
| 5 | Liquidación mensual automática (PDF) | Manual, semanal, trimestral | Mensual es el período fiscal natural; automático no requiere acción del docente |
| 6 | Admin arbitra disputas (≤5 días hábiles) | Automático por reseñas, sin árbitro | Casos edge requieren criterio humano; 5 días es razonable sin perjudicar al docente |

---

## Plan de implementación (fases)

### Fase 1 — Base (esta semana)
- [x] Spec documentado
- [ ] Migración: `cuit` en `verificaciones_usuario`
- [ ] CUIT en OnboardingModal (paso `kyc_fiscal`)
- [ ] Nuevos estados en tabla `pagos`
- [ ] Tabla `disputas`

### Fase 2 — Liberación automática
- [ ] RLS: validar que solo el docente correcto puede finalizar clase
- [ ] `pg_cron`: job de liberación a las 72hs
- [ ] Notificación al alumno cuando docente marca finalizada
- [ ] Dashboard de cobros en MiCuenta (docente)

### Fase 3 — MP Marketplace
- [ ] Modificar `mp-checkout` con `application_fee` + `collector_id`
- [ ] Verificación de MP conectado antes de liberar
- [ ] Flujo de reconexión de cuenta MP

### Fase 4 — Liquidaciones
- [ ] Edge Function `generar-liquidacion`
- [ ] Tabla `liquidaciones`
- [ ] PDF con `pdf-lib`
- [ ] Email mensual al docente
- [ ] Vista en MiCuenta para descargar liquidaciones
