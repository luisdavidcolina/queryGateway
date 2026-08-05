const { Pool } = require("pg");
const { formatDate } = require("./utils");

const pool = new Pool({
  user: "diamond",
  host: "127.0.0.1",
  database: "hotel",
  password: "lksdfgj53fd",
  port: 5432,
});
async function CreaarReservaDetalle(ROOM_TYPE, reserva, precio, cliente, id_grupo, schema) {
  const poolClient = await pool.connect();

  try {
    const impuestoQuery = `SELECT valor FROM  ${schema}.tbl_impuestos WHERE principal = true LIMIT 1`;
    const impuestoResult = await poolClient.query(impuestoQuery);
    if (!impuestoResult.rows.length) throw new Error("Impuesto principal no encontrado");
    const impuestoPct = parseFloat(impuestoResult.rows[0].valor) || 0; // ej. 13 (%)
    const valor_impuesto = (impuestoPct / 100) + 1;

    const habitacionQuery = `SELECT id FROM ${schema}.tbl_habitaciones_tipo WHERE codigo = $1 LIMIT 1`;
    const habitacionResult = await poolClient.query(habitacionQuery, [ROOM_TYPE.Type_Code]);
    if (!habitacionResult.rows.length) throw new Error("Tipo de habitación no encontrado");
    const id = habitacionResult.rows[0].id;

    const reservaGrupoQuery = `SELECT id FROM ${schema}.tbl_reservas_grupo WHERE id_reservas = $1 LIMIT 1`;
    //const reservaGrupoResult = await poolClient.query(reservaGrupoQuery, [reserva.id]);
    //if (!reservaGrupoResult.rows.length) throw new Error("Grupo de reserva no encontrado");

    const ReservasDetalle = {
      id_reservas_grupo: id_grupo,
      id_habitacion_tipo: id,
      adultos_cantidad: parseInt(ROOM_TYPE.Adults || 0),
      ninos_cantidad: parseInt(ROOM_TYPE.Children || 0),
      infantes_cantidad: parseInt(ROOM_TYPE.Infants || 0),
      precio_total: precio,
      precio_neto: precio / valor_impuesto,
      check_in_fecha: reserva.check_in_fecha,
      check_out_fecha: reserva.check_out_fecha,
      id_reserva_detalle_estado_habitacion: 1,
      // La TASA del impuesto principal (ej. 13), igual que la UI (CreaarReservaDetalle2:
      // numero_impuesto = $iva). El reporte de ventas calcula neto*numero_impuesto/100, y así
      // cuadra con el de deudas (precio_total - precio_neto). Antes iba 0 -> ventas mostraba IVA 0.
      numero_impuesto: impuestoPct,
      numero_impuesto2: 0,
      servicio: 0,
    };

    const insertQuery = `
      INSERT INTO ${schema}.tbl_reservas_detalle (
        id_reservas_grupo, id_habitacion_tipo, adultos_cantidad, ninos_cantidad,
        infantes_cantidad, precio_total, precio_neto, check_in_fecha, check_out_fecha,
        id_reserva_detalle_estado_habitacion, numero_impuesto, numero_impuesto2, servicio, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    await poolClient.query(insertQuery, [
      ReservasDetalle.id_reservas_grupo,
      ReservasDetalle.id_habitacion_tipo,
      ReservasDetalle.adultos_cantidad,
      ReservasDetalle.ninos_cantidad,
      ReservasDetalle.infantes_cantidad,
      ReservasDetalle.precio_total,
      ReservasDetalle.precio_neto,
      ReservasDetalle.check_in_fecha,
      ReservasDetalle.check_out_fecha,
      ReservasDetalle.id_reserva_detalle_estado_habitacion,
      ReservasDetalle.numero_impuesto,
      ReservasDetalle.numero_impuesto2,
      ReservasDetalle.servicio,
    ]);
  } catch (error) {
    console.error("Error en CreaarReservaDetalle:", error.message);
    throw error;
  } finally {
    poolClient.release();
  }
}

async function newGrupo(id_reserva, data, schema) {
  const poolClient = await pool.connect();

  try {
    const reserva = {
      id_reservas: id_reserva,
      id_reservas_estado: 1,
      check_in_fecha: formatDate(data.Arrival),
      check_out_fecha: formatDate(data.Departure),
      huespedes_cantidad: (parseInt(data.Adults || 0) + parseInt(data.Children || 0) + parseInt(data.Infants || 0))
    };

    const insertQuery = `
      INSERT INTO ${schema}.tbl_reservas_grupo (id_reservas, id_reservas_estado, check_in_fecha, check_out_fecha, huespedes_cantidad, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    const result = await poolClient.query(insertQuery, [reserva.id_reservas, reserva.id_reservas_estado, reserva.check_in_fecha, reserva.check_out_fecha, reserva.huespedes_cantidad]);
    return result.rows[0].id;
  } catch (error) {
    console.error("Error en newGrupo:", error.message);
    throw error;
  } finally {
    poolClient.release();
  }
}

async function CrearReservaDetalles(id_grupos, ROOM_TYPE, id_reserva, cliente, schema) {
  const poolClient = await pool.connect();

  try {
    console.log(`Average_Rate: ${parseFloat(ROOM_TYPE.Average_Rate)}`);
    const reservaQuery = `SELECT check_in_fecha, check_out_fecha FROM ${schema}.tbl_reservas WHERE id = $1`;
    const reservaResult = await poolClient.query(reservaQuery, [ id_reserva]);
    const reserva = reservaResult.rows[0];
    let precio_total = parseFloat(ROOM_TYPE.Average_Rate) || 0;
    if  (schema==='hotel_hotelbramador')
      precio_total = precio_total*950;
    console.log(`Precio: ${precio_total}`);

    let currentDate = new Date(reserva.check_in_fecha);
    const endDate = new Date(reserva.check_out_fecha);

    while (currentDate < endDate) {
      await CreaarReservaDetalle(ROOM_TYPE, reserva, precio_total, cliente, id_grupos, schema);
      currentDate.setDate(currentDate.getDate() + 1);
      reserva.check_in_fecha = currentDate.toISOString().split('T')[0];
    }
  } catch (error) {
    console.error("Error en CrearReservaDetalles:", error.message);
    throw error;
  } finally {
    poolClient.release();
  }
}

async function nuevos_grupos(data, id_reserva, cliente, schema) {
  const id_grupo = await newGrupo(id_reserva, data, schema);
  await CrearReservaDetalles(id_grupo, data, id_reserva, cliente, schema);
}

module.exports = { nuevos_grupos };