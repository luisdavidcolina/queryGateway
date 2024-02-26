const { Pool } = require("pg");

const pool = new Pool({
  user: "diamond",
  host: "127.0.0.1",
  database: "hotel",
  password: "lksdfgj53fd",
  port: 5432,
});

const getQuery = async (req, res) => {
  const { id } = req.params;
  const str = String(id);
  const result = str.split("-").join(" ");
  const query = result;
  try {
    const response = await pool.query(query);
    res.status(200).json(response);
  } catch (error) {
    res.json(error);
  }
};

const getInvoices = async (req, res) => {
  try {
    const response = await pool.query("SELECT * FROM master.tbl_consumos");
    const invoices = response.rows.map((invoice) => {
      return {
        ...invoice,
        price: [invoice.price],
      };
    });
    res.status(200).json(invoices);
  } catch (error) {
    res.json(error);
  }
};

const getBookings = async (req, res) => {
  const { filtro_calendario, schema = 'master' } = req.params;
  const fecha_referencia = filtro_calendario || new Date();

  const query = `
    SELECT
      tbl_reservas.id as id_reservas,
      tbl_habitaciones.numero as numero,
      tbl_habitaciones_tipo.nombre as nombre_tipo,
      tbl_reservas.id_cliente,
      tbl_clientes.nombre,
      tbl_clientes.apellido,
      tbl_reservas.check_in_fecha,
      tbl_reservas_detalle.check_out_fecha,
      tbl_reservas_detalle.adultos_cantidad,
      tbl_reservas_detalle.ninos_cantidad,
      tbl_reservas_detalle.infantes_cantidad,
      tbl_fuentes_reservas.nombre as nombre_fuente,
      (tbl_reservas_detalle.adultos_cantidad + tbl_reservas_detalle.ninos_cantidad + tbl_reservas_detalle.infantes_cantidad) AS huespedes_cantidad,
      tbl_reservas.check_in_hora,
      tbl_reservas.check_out_hora,
      tbl_reservas_detalle.id_habitacion_tipo,
      tbl_reservas_detalle.id_habitacion as resource,
      TO_CHAR(date(tbl_reservas_detalle.check_out_fecha), 'yyyy-mm-dd') as end,
      concat_ws(' ', tbl_clientes.nombre, tbl_clientes.apellido) as text,
      sum(tbl_reservas_detalle.adultos_cantidad + tbl_reservas_detalle.ninos_cantidad + tbl_reservas_detalle.infantes_cantidad) as cantidad_huespedes,
      tbl_reservas_estado.descripcion as estado_reserva_descripcion,
      tbl_reservas_estado.id as id_estado_reserva,
      tbl_reservas_detalle.id_reservas_grupo as id_grupo,
      COALESCE(tbl_reservas_estado.color, '#000') as barColor,
      tbl_reservas_grupo.facturado
    FROM ${schema}.tbl_reservas
    JOIN ${schema}.tbl_clientes ON tbl_reservas.id_cliente = tbl_clientes.id
    LEFT JOIN ${schema}.tbl_reservas_grupo ON tbl_reservas.id = tbl_reservas_grupo.id_reservas
    LEFT JOIN ${schema}.tbl_reservas_detalle ON tbl_reservas_grupo.id = tbl_reservas_detalle.id_reservas_grupo
    JOIN ${schema}.tbl_reservas_estado ON tbl_reservas_grupo.id_reservas_estado = tbl_reservas_estado.id
    JOIN ${schema}.tbl_habitaciones ON tbl_reservas_detalle.id_habitacion = tbl_habitaciones.id
    JOIN ${schema}.tbl_habitaciones_tipo ON tbl_habitaciones.id_habitacion_tipo = tbl_habitaciones_tipo.id
    JOIN ${schema}.tbl_fuentes_reservas ON tbl_reservas.fuente_reserva_id = tbl_fuentes_reservas.id
    WHERE tbl_reservas_detalle.id_habitacion IS NOT NULL
      AND tbl_reservas_detalle.deleted_at IS NULL
      AND tbl_reservas.check_in_fecha BETWEEN $1 AND $2
    GROUP BY
      tbl_reservas.id,
      tbl_habitaciones.numero,
      tbl_habitaciones_tipo.nombre,
      tbl_reservas_estado.descripcion,
      tbl_reservas.check_in_hora,
      tbl_reservas.check_out_hora,
      tbl_reservas_detalle.id_habitacion_tipo,
      tbl_reservas_detalle.id_habitacion,
      tbl_reservas_detalle.adultos_cantidad,
      tbl_reservas_detalle.ninos_cantidad,
      tbl_reservas_detalle.infantes_cantidad,
      tbl_fuentes_reservas.nombre,
      tbl_reservas_detalle.id_reservas_grupo,
      tbl_reservas_estado.id,
      tbl_reservas.id_cliente,
      tbl_clientes.nombre,
      tbl_clientes.apellido,
      tbl_reservas.check_in_fecha,
      tbl_reservas.check_out_fecha,
      tbl_reservas_grupo.id,
      tbl_reservas_detalle.check_out_fecha,
      tbl_reservas_grupo.facturado
    ORDER BY check_in_fecha DESC
  `;
  const values = [
    new Date(fecha_referencia.getFullYear(), fecha_referencia.getMonth(), fecha_referencia.getDate() - 5),
    new Date(fecha_referencia.getFullYear(), fecha_referencia.getMonth(), fecha_referencia.getDate() + 70),
  ];

  try {
    const response = await pool.query(query, values);
    res.status(200).json(response.rows);
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


module.exports = {
  getQuery,
  getInvoices,
  getBookings
};
