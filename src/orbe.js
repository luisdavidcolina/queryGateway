const { Pool } = require("pg");
const axios = require("axios");
const { formatDate } = require("./utils");
const { nuevos_grupos } = require("./nuevos-grupos");

const pool = new Pool({
  user: "diamond",
  host: "127.0.0.1",
  database: "hotel",
  password: "lksdfgj53fd",
  port: 5432,
});

async function saveReservaDetail(data_detail, cliente_id, data, id_reserva, BookingChannel, RequestorID, schema) {
  const poolClient = await pool.connect();

  try {
    let roomTypeData;
    if (typeof data.ROOM_TYPES.ROOM_TYPE === "object" && data.ROOM_TYPES.ROOM_TYPE !== null) {
      roomTypeData = data.ROOM_TYPES.ROOM_TYPE;
    } else if (Array.isArray(data.ROOM_TYPES.ROOM_TYPE)) {
      roomTypeData = data.ROOM_TYPES.ROOM_TYPE;
    } else {
      return id_reserva; // No hay datos válidos, retorna el id_reserva actual
    }

    // Consulta segura para obtener la fuente
    const fuenteQuery = `
      SELECT id FROM ${schema}.tbl_fuentes_reservas WHERE id_ota = $1 LIMIT 1
    `;
    const fuenteResult = await poolClient.query(fuenteQuery, [RequestorID]);
    const fuente = fuenteResult.rows[0] || { id: null };

    if (!id_reserva) {
      const reserva = {
        id_cliente: cliente_id,
        check_in_fecha: formatDate(data_detail.Arrival),
        check_out_fecha: formatDate(data_detail.Departure),
        fuente_reserva_id: fuente.id,
        huespedes_cantidad: (parseInt(data.Adults || 0) + parseInt(data.Children || 0) + parseInt(data.Infants || 0))
      };
      const insertQuery = `
        INSERT INTO ${schema}.tbl_reservas (id_cliente, check_in_fecha, check_out_fecha, fuente_reserva_id, huespedes_cantidad, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      const reservaResult = await poolClient.query(insertQuery, [reserva.id_cliente, reserva.check_in_fecha, reserva.check_out_fecha, reserva.fuente_reserva_id, reserva.huespedes_cantidad]);
      id_reserva = reservaResult.rows[0].id;
    }

    // Llamada a nuevos_grupos (a implementar en otro archivo)
    await nuevos_grupos(data_detail, id_reserva, cliente_id, schema);

    return id_reserva;
  } catch (error) {
    console.error("Error en saveReservaDetail:", error.message);
    throw error;
  } finally {
    poolClient.release();
  }
}

/** Las noches de una estadia, en 'YYYY-MM-DD'. La de salida NO se duerme. */
function nochesDe(desde, hasta) {
  const noches = [];
  let d = new Date(desde);
  const fin = new Date(hasta);
  while (d < fin) {
    noches.push(d.toISOString().split('T')[0]);
    d = new Date(d.getTime());
    d.setDate(d.getDate() + 1);
  }
  return noches;
}

/**
 * Escribe la bitacora. SIEMPRE, incluso cuando no se mando nada: sin eso, un
 * neteo de la bitacora puede dar cero y aun asi haber descuadre.
 * Ver docs/orbe-api.md §8.quater (B1).
 */
async function registrarBitacora(poolClient, schema, b) {
  const { formatDate: fd } = require("./utils");
  await poolClient.query(
    `INSERT INTO ${schema}.tbl_bitacoras (
       user_id, reserva_id, grupo_id, habitacion_id, fecha_llegada_anterior, fecha_salida_anterior,
       fecha_llegada_actual, fecha_salida_actual, xml, respuesta, tipo_movimiento, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      0,
      b.id_reserva ? parseInt(b.id_reserva) : null,
      b.id_grupo ? parseInt(b.id_grupo) : null,
      b.id_habitacion ? parseInt(b.id_habitacion) : null,
      fd(b.fecha_inicio), fd(b.fecha_fin), fd(b.fecha_inicio), fd(b.fecha_fin),
      b.xml,
      (b.respuesta || '').substring(0, 191),
      b.tipo_movimiento,
    ]
  );
}

/**
 * Le manda un delta de inventario a Orbe.
 *
 * @param {string[]} excluir  noches 'YYYY-MM-DD' que NO hay que tocar (las que la
 *                            estadia nueva sigue ocupando).
 * @param {string} tipo_movimiento  el rotulo real. Antes iba "Anular reserva" FIJO,
 *                            tambien en los Modify, asi que la bitacora mentia.
 */
async function ActualizarOrbeBloqueoAgregar(room_type, fecha_inicio, fecha_fin, id_grupo = null, id_habitacion = null, id_reserva = null, schema, quantity = 1, excluir = [], tipo_movimiento = "Anular reserva") {
  const poolClient = await pool.connect();

  try {
    const configQuery = `SELECT value FROM ${schema}.tbl_config WHERE name = $1 LIMIT 1`;
    const configResult = await poolClient.query(configQuery, ["data_api"]);
    const datos = configResult.rows.length ? { validate: true, value: configResult.rows[0].value } : { validate: false, value: false };
    const user = datos.validate ? JSON.parse(datos.value) : {};

    const url = "https://capi.orbebooking.com/OAF/AOBA-XML/";
    let xmlRequest = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <soap:Header>
        <HTNGHeader xmlns="http://htng.org/1.1/Header/"></HTNGHeader>
        <soap:Username>${user.user || ""}</soap:Username>
        <soap:Password>${user.pass || ""}</soap:Password>
      </soap:Header>
      <soap:Body>
      <InventoryUpdateRequest TimeStamp="${new Date().toISOString().slice(0,19)}" Version="1.00">
      <INVENTORY HotelCode="${user.code || ""}" HotelName="DIAMOND DEMO">
    `;

    // `excluir` son las noches que NO hay que tocar porque la estadia nueva las
    // sigue ocupando. Sin esto se devolvia el rango viejo COMPLETO: en un Modify
    // que corre la estadia un dia —el caso normal— se liberaban noches en las que
    // el huesped se queda, y Orbe pasaba a ofrecer una habitacion ocupada.
    //
    // Caso real (Yemaya, 6-ago-2026, bitacora 18756): OTA-6061332159-03 paso del
    // 18->20 al 17->20; lo unico que cambio fue que se agrego el 17, y se mandaron
    // +1 en el 18 y +1 en el 19. Ver docs/orbe-api.md (G5).
    const saltar = new Set(excluir || []);
    // Orbe rechaza las noches ya pasadas ("Past Dates Not Registered") y nadie
    // compra una habitacion para ayer, asi que no se mandan.
    const hoy = new Date().toISOString().split('T')[0];
    let enviados = 0;

    let currentDate = new Date(fecha_inicio);
    const endDate = new Date(fecha_fin);
    while (currentDate < endDate) {
      const dia = currentDate.toISOString().split('T')[0];
      if (!saltar.has(dia) && dia >= hoy) {
        xmlRequest += `
        <Update Inv_Date="${dia}" Quantity="${quantity}" Room_Type="${room_type}" Task="Add"/>
      `;
        enviados++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Nada que decir: no se manda una peticion vacia, pero SI queda en la bitacora
    // para que la auditoria vea que el movimiento existio y no genero trafico.
    if (enviados === 0) {
      await registrarBitacora(poolClient, schema, {
        id_reserva, id_grupo, id_habitacion,
        fecha_inicio, fecha_fin,
        xml: null,
        respuesta: 'sin cambios de inventario',
        tipo_movimiento,
      });
      return { validate: true, enviados: 0 };
    }

    xmlRequest += `
      </INVENTORY></InventoryUpdateRequest></soap:Body></soap:Envelope>
    `;

    const response = await axios.post(url, xmlRequest, {
      headers: { "Content-Type": "text/xml" },
    });

    // El cuerpo se guarda junto al XML: en SOAP el fallo viaja DENTRO de un 200, y
    // `respuesta` es un varchar(191) donde no entra. Ver docs/orbe-api.md (B2).
    const cuerpo = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    // Orbe RECHAZA con HTTP 200: lo unico que distingue aplicado de descartado es
    // el <success> del cuerpo. success=1 aceptado, cualquier otro es rechazo, con
    // el motivo en los <warning>. Ver App\Orbe\Respuesta en el repo del PMS.
    const m = /<success>\s*(\d+)\s*<\/success>/i.exec(cuerpo || '');
    const avisos = [...String(cuerpo || '').matchAll(/<warning>(.*?)<\/warning>/gis)]
      .map(x => x[1].replace(/\s+/g, ' ').trim());
    const rechazado = (m && m[1] !== '1') || /soap:Fault/i.test(cuerpo || '');
    const motivo = rechazado
      ? ([...new Set(avisos)].join(' · ') || `Orbe no aplico el cambio (success ${m ? m[1] : '?'})`)
      : null;

    if (rechazado) {
      console.error(`[ORBE] ${tipo_movimiento} RECHAZADO:`, motivo);
    }

    await registrarBitacora(poolClient, schema, {
      id_reserva, id_grupo, id_habitacion,
      fecha_inicio, fecha_fin,
      xml: `${xmlRequest}\n<!-- RESPUESTA ${response.status} -->\n${cuerpo}`,
      respuesta: rechazado ? `RECHAZADO ${motivo}` : `resp: ${response.status}`,
      tipo_movimiento,
    });

    return { validate: !rechazado, enviados, motivo };
  } catch (error) {
    console.error("Error en ActualizarOrbeBloqueoAgregar:", error.message);
    throw error;
  } finally {
    poolClient.release();
  }
}

module.exports = { saveReservaDetail, ActualizarOrbeBloqueoAgregar, nochesDe };