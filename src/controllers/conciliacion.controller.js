const { Pool } = require("pg");

/**
 * Registro de las corridas de conciliacion PMS <-> Orbe.
 *
 * QUE PROBLEMA RESUELVE
 * ---------------------
 * La extension de Chrome lee el inventario del panel de Orbe —la unica forma que
 * hay, porque no existe API de lectura— lo compara contra el PMS y puede
 * corregirlo. Hasta ahora eso no dejaba ningun rastro del lado del PMS: al
 * peritar la bitacora, sus correcciones aparecian como diferencias inexplicables
 * y no habia forma de saber cuando se corrio ni que se toco.
 *
 * Ahora cada corrida y cada correccion quedan en `tbl_bitacoras`, junto a los
 * movimientos del PMS y ordenables por `id`. Un solo historial.
 *
 * POR QUE UN ENDPOINT Y NO EL PUENTE SQL
 * --------------------------------------
 * La extension consulta el PMS por `GET /query/<SQL>`, que ejecuta SQL arbitrario
 * sin autenticacion. Para LEER ya es un riesgo conocido; escribir por ahi lo
 * empeoraria. Ademas ese endpoint convierte todo `-` en espacio, asi que un
 * INSERT con fechas o numeros negativos se rompe.
 *
 * SEGURIDAD
 * ---------
 * - Token compartido en la cabecera `X-Orbe-Token`. No es gran cosa —viaja en
 *   claro, igual que todo lo demas de este puerto— pero evita que cualquiera que
 *   descubra el puerto pueda ensuciar la bitacora de los 17 hoteles.
 * - El nombre del schema se INTERPOLA en el SQL, asi que se valida contra una
 *   lista blanca leida de `information_schema`. Sin eso seria inyeccion directa.
 * - Todo se escribe con parametros ($1, $2...), nunca concatenando valores.
 */

const pool = new Pool({
  user: "diamond",
  host: "127.0.0.1",
  database: "hotel",
  password: "lksdfgj53fd",
  port: 5432,
});

// Compartido con la extension (content.js, CONFIG.pms.token). Cambiarlo en los
// dos lados a la vez.
const TOKEN = "orbe-conc-9f4c21ba7e0d4a83";

/** Schemas reales, cacheados: la lista no cambia mientras corre el proceso. */
let schemasValidos = null;

async function cargarSchemas() {
  if (schemasValidos) return schemasValidos;
  const r = await pool.query(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'master' OR schema_name LIKE 'hotel%'"
  );
  schemasValidos = new Set(r.rows.map((x) => x.schema_name));
  return schemasValidos;
}

/** Fecha 'YYYY-MM-DD' o null. Las 4 columnas de fecha de la bitacora son NOT NULL. */
function dia(v, porDefecto) {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : porDefecto;
}

async function insertarBitacora(schema, fila) {
  // `schema` ya viene validado contra la lista blanca por el llamador.
  await pool.query(
    `INSERT INTO ${schema}.tbl_bitacoras (
       user_id, reserva_id, grupo_id, habitacion_id,
       fecha_llegada_anterior, fecha_salida_anterior,
       fecha_llegada_actual, fecha_salida_actual,
       xml, respuesta, tipo_movimiento, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      0, null, null, null,
      fila.desde, fila.hasta, fila.desde, fila.hasta,
      fila.detalle,
      String(fila.respuesta || "").substring(0, 191),
      fila.tipo_movimiento,
    ]
  );
}

const registrarConciliacion = async (req, res) => {
  if (req.get("X-Orbe-Token") !== TOKEN) {
    return res.status(401).json({ ok: false, error: "token invalido" });
  }

  const cuerpo = req.body || {};
  const corridas = Array.isArray(cuerpo.hoteles) ? cuerpo.hoteles : [];
  const correcciones = Array.isArray(cuerpo.correcciones) ? cuerpo.correcciones : [];

  try {
    const validos = await cargarSchemas();
    const hoy = new Date().toISOString().slice(0, 10);
    const rechazados = [];
    let escritas = 0;

    // 1) Una fila por hotel recorrido: el resumen de la corrida.
    for (const h of corridas) {
      if (!validos.has(h.schema)) {
        rechazados.push(h.schema);
        continue;
      }

      await insertarBitacora(h.schema, {
        tipo_movimiento: "Conciliacion Orbe",
        desde: dia(h.desde, hoy),
        hasta: dia(h.hasta, hoy),
        respuesta:
          `discrepancias: ${h.discrepancias || 0}` +
          ` · corregidas: ${h.corregidas || 0}` +
          ` · fechas: ${h.fechas || 0}`,
        detalle: JSON.stringify(
          {
            corrida: cuerpo.corrida_id || null,
            hotel: h.hotel,
            inicio: cuerpo.inicio || null,
            fin: cuerpo.fin || null,
            fechas_analizadas: h.fechas || 0,
            discrepancias: h.discrepancias || 0,
            corregidas: h.corregidas || 0,
            detalle: h.detalle || [],
          },
          null,
          1
        ),
      });
      escritas++;
    }

    // 2) Una fila por correccion aplicada, con el antes y el despues.
    for (const c of correcciones) {
      if (!validos.has(c.schema)) {
        rechazados.push(c.schema);
        continue;
      }

      await insertarBitacora(c.schema, {
        tipo_movimiento: "Correccion Orbe (extension)",
        desde: dia(c.fecha, hoy),
        hasta: dia(c.fecha, hoy),
        respuesta:
          `${c.estado || "aplicada"}` +
          ` · ${c.tipo_orbe || c.tipo || "?"}` +
          ` · PMS ${c.pms} Orbe ${c.orbe} -> ${c.escrito}`,
        detalle: JSON.stringify(
          {
            corrida: cuerpo.corrida_id || null,
            hotel: c.hotel,
            tipo_orbe: c.tipo_orbe || null,
            tipo_pms: c.tipo_pms || null,
            fecha: c.fecha,
            pms_disponible: c.pms,
            orbe_disponible: c.orbe,
            valor_escrito: c.escrito,
            estado: c.estado || "aplicada",
            // La direccion es lo que interesa al peritar: negativo = Orbe tenia
            // de mas (riesgo de sobreventa); positivo = tenia de menos (cupo perdido).
            diferencia: (Number(c.pms) - Number(c.orbe)) || 0,
          },
          null,
          1
        ),
      });
      escritas++;
    }

    return res.json({
      ok: true,
      escritas,
      schemas_rechazados: [...new Set(rechazados)],
    });
  } catch (error) {
    console.error("[CONCILIACION] error:", error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
};

module.exports = { registrarConciliacion };
