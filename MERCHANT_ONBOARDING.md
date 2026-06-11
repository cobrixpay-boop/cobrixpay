# Alta de Comercios - Cobrix Pay

## Qué datos pedir a cada comercio

Para dar de alta un comercio de forma sencilla y confiable, recolectá estos campos:

- `name`: Nombre del comercio.
- `slug`: Identificador corto y único para la URL pública. Ejemplo: `panaderia-la-estrella`.
- `email`: Correo principal del comercio.
- `notificationEmails`: Correos adicionales que deben recibir notificaciones de pagos. Si no se envía, se usa `email`.
- `stripeAccountId`: Stripe Connect Account ID (debe comenzar con `acct_...`).
- `applicationFeePercent`: Porcentaje de comisión Cobrix para ese comercio. Se convierte a `application_fee_amount` en cada pago.

## Método recomendado para replicarlo

La forma más sencilla es usar el script `scripts/add-merchant.js` desde la raíz del proyecto.

### Uso

```bash
node scripts/add-merchant.js \
  --name "Mi Comercio" \
  --slug mi-comercio \
  --email contacto@micomercio.com \
  --notificationEmails "ventas@micomercio.com, contabilidad@micomercio.com" \
  --stripeAccountId acct_1Example \
  --applicationFeePercent 5
```

### Ejemplo mínimo

```bash
node scripts/add-merchant.js \
  --name "Estudio Ontivero" \
  --slug estudio-ontivero \
  --email contador.ontivero@gmail.com \
  --stripeAccountId acct_1234567890abcdef \
  --applicationFeePercent 5
```

El script crea o actualiza la entrada en `data/merchants.json`.

## Cómo verificar

1. Abrí `/merchants/admin` en tu app.
2. Confirmá que el comercio aparece en la lista.
3. Usá el botón `Editar` para cambiar la comisión si necesitás modificarla luego.
4. Probá una sesión de pago con `/pay/<slug>`.
5. Verificá que los emails lleguen al cliente y a los correos del comercio.

## Nota sobre despliegue en Vercel y almacenamiento

- El actual método de guardado usa `data/merchants.json`.
- En Vercel, la carpeta de la aplicación se monta como solo lectura en ejecución y no se pueden escribir archivos en `/var/task`.
- Por eso, el formulario de alta de comercio solo funciona en desarrollo local a menos que haya almacenamiento persistente.
- Para producción necesitas:
  - Upstash Redis, o
  - otro backend persistente (base de datos, Supabase, PlanetScale, etc.)
- Lo recomendado para este proyecto es usar Upstash Redis, disponible como integración en Vercel.

### Variables para Upstash Redis

Si elegís Upstash, agrega estas variables en Vercel:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ADMIN_TOKEN`

Luego la app usará Upstash para persistir los comercios en producción. El formulario `/merchants/admin` pedirá `ADMIN_TOKEN` antes de listar o crear comercios.

## Nota sobre Stripe Connect

- `stripeAccountId` es obligatorio para enviar los pagos al comercio conectado.
- `applicationFeePercent` define la comisión de la plataforma. Por ejemplo, `5` en un pago de USD 100 genera `application_fee_amount` de USD 5.
- Si el comercio no tiene cuenta conectada, debe crearla en Stripe Connect y luego te pasa el `acct_...`.
- Sin `stripeAccountId`, el pago se procesa en tu cuenta de plataforma, pero no se transfiere automáticamente al comercio.
