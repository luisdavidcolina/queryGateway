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

async function ActualizarOrbeBloqueoAgregar(room_type, fecha_inicio, fecha_fin, id_grupo = null, id_habitacion = null, id_reserva = null, schema) {
  const poolClient = await pool.connect();

  try {
    const configQuery = `SELECT value FROM ${schema}.tbl_config WHERE name = $1 LIMIT 1`;
    const configResult = await poolClient.query(configQuery, ["data_api"]);
    const datos = configResult.rows.length ? { validate: true, value: configResult.rows[0].value } : { validate: false, value: false };
    const user = datos.validate ? JSON.parse(datos.value) : {};

    const url = "https://capi.orbebooking.com/OAF/AOBA-XML/";
    let xmlRequest = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <soap:Header>
        <HTNGHeader xmlns="http://htng.org/1.1/Header/"></HTNGHeader>
        <soap:Username>${user.user || ""}</soap:Username>
        <soap:Password>${user.pass || ""}</soap:Password>
      </soap:Header>
      <soap:Body>
      <InventoryUpdateRequest TimeStamp="2017-8-22T18:12:16" Version="1.00">
      <INVENTORY HotelCode="${user.code || ""}" HotelName="DIAMOND DEMO">
    `;

    let currentDate = new Date(fecha_inicio);
    const endDate = new Date(fecha_fin);
    while (currentDate < endDate) {
      xmlRequest += `
        <Update Inv_Date="${currentDate.toISOString().split('T')[0]}" Quantity="1" Room_Type="${room_type}" Task="Add"/>
      `;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    xmlRequest += `
      </INVENTORY></InventoryUpdateRequest></soap:Body></soap:Envelope>
    `;

    const response = await axios.post(url, xmlRequest, {
      headers: { "Content-Type": "text/xml" },
    });

    // Registro en bitácora
    const bitacora = {
      user_id: 1, // Reemplazar con lógica de autenticación si aplica
      reserva_id: id_reserva ? parseInt(id_reserva) : null,
      grupo_id: id_grupo ? parseInt(id_grupo) : null,
      habitacion_id: id_habitacion ? parseInt(id_habitacion) : null,
      fecha_llegada_anterior: formatDate(fecha_inicio),
      fecha_salida_anterior: formatDate(fecha_fin),
      fecha_llegada_actual: formatDate(fecha_inicio),
      fecha_salida_actual: formatDate(fecha_fin),
      xml: xmlRequest,
      respuesta: `resp: ${response.status}`,
      tipo_movimiento: "Anular reserva",
    };

    const insertBitacoraQuery = `
      INSERT INTO ${schema}.tbl_bitacoras (
        user_id, reserva_id, grupo_id, habitacion_id, fecha_llegada_anterior, fecha_salida_anterior,
        fecha_llegada_actual, fecha_salida_actual, xml, respuesta, tipo_movimiento, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    await poolClient.query(insertBitacoraQuery, [
      bitacora.user_id,
      bitacora.reserva_id,
      bitacora.grupo_id,
      bitacora.habitacion_id,
      bitacora.fecha_llegada_anterior,
      bitacora.fecha_salida_anterior,
      bitacora.fecha_llegada_actual,
      bitacora.fecha_salida_actual,
      bitacora.xml,
      bitacora.respuesta,
      bitacora.tipo_movimiento,
    ]);

    return { validate: true };
  } catch (error) {
    console.error("Error en ActualizarOrbeBloqueoAgregar:", error.message);
    throw error;
  } finally {
    poolClient.release();
  }
}

module.exports = { saveReservaDetail, ActualizarOrbeBloqueoAgregar };