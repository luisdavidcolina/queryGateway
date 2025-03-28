const { Pool, types } = require("pg");

types.setTypeParser(1114, function(stringValue) {
  return stringValue; 
});


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

const detallesGrupos = async (id_reserva, schema = 'master') => {
  const query = `
    SELECT
      tbl_reservas_grupo.id_reservas_estado,
      tbl_reservas_grupo.id as id_grupo,
      tbl_reservas_detalle.adultos_cantidad as cantidad_adultos,
      tbl_reservas_detalle.ninos_cantidad as cantidad_ninos,
      tbl_reservas_detalle.infantes_cantidad as cantidad_infantes,
      (tbl_reservas_detalle.adultos_cantidad + tbl_reservas_detalle.ninos_cantidad + tbl_reservas_detalle.infantes_cantidad) AS cantidad_huespedes,
      tbl_reservas_detalle.id_habitacion,
      tbl_habitaciones_tipo.nombre as habitacion_tipo,
      tbl_reservas_detalle.id_habitacion_tipo,
      tbl_reservas_grupo.id_reservas,
      tbl_reservas_grupo.id as clave_grupo,
      tbl_habitaciones.numero as habitacion_numero,
      tbl_habitaciones.personas_minimo as habitacion_personas_minimo,
      tbl_habitaciones.personas_maximo as habitacion_personas_maximo
    FROM ${schema}.tbl_reservas_detalle
    JOIN ${schema}.tbl_habitaciones_tipo ON tbl_reservas_detalle.id_habitacion_tipo = tbl_habitaciones_tipo.id
    LEFT JOIN ${schema}.tbl_reservas_grupo ON tbl_reservas_detalle.id_reservas_grupo = tbl_reservas_grupo.id
    JOIN ${schema}.tbl_habitaciones ON tbl_reservas_detalle.id_habitacion = tbl_habitaciones.id
    WHERE tbl_reservas_grupo.id_reservas = $1
      AND tbl_reservas_grupo.deleted_at IS NULL
      AND tbl_reservas_detalle.deleted_at IS NULL
    GROUP BY
      tbl_reservas_grupo.id_reservas_estado,
      tbl_reservas_grupo.id,
      tbl_reservas_detalle.id_habitacion_tipo,
      tbl_reservas_detalle.adultos_cantidad,
      tbl_reservas_detalle.ninos_cantidad,
      tbl_reservas_detalle.infantes_cantidad,
      tbl_reservas_detalle.id_habitacion,
      tbl_habitaciones_tipo.nombre,
      tbl_reservas_grupo.id_reservas,
      tbl_reservas_grupo.id,
      tbl_habitaciones.numero,
      tbl_habitaciones.personas_minimo,
      tbl_habitaciones.personas_maximo
  `;
  const values = [id_reserva];

  try {
    const response = await pool.query(query, values);
    const data = response.rows.map(temp => ({
      ...temp,
      huespedes: huespedes_habitacion(temp.id_grupo),
      pagadores: pagadores_habitacion(temp.id_grupo),
      fecha_ingreso: fechaIngreso(temp.id_grupo),
      fecha_salida: fechaSalida(temp.id_grupo),
    }));

    return data;
  } catch (error) {
    console.error('Error executing query:', error);
    return [];
  }
};
const dia = (fecha) => {
  const dias = {
    Monday: "Lunes",
    Tuesday: "Martes",
    Wednesday: "Miércoles",
    Thursday: "Jueves",
    Friday: "Viernes",
    Saturday: "Sábado",
    Sunday: "Domingo",
  };
  const fechaDate = new Date(fecha);
  const nombreDia = fechaDate.toLocaleDateString('es-ES', { weekday: 'long' });
  return dias[nombreDia];
};


const detalles = (data, id, schema = 'master') => {
  const detalles = {
    regalo: "",
    cantidad_huespedes: data.cantidad_huespedes,
    nombre_tipo: data.nombre_tipo,
    nombre_fuente: data.nombre_fuente,
    numero: data.numero,
    id_cliente: data.id_cliente,
    cliente: data.nombre + " " + data.apellido,
    direccion: data.calle_residencia,
    zipcode: data.codigo_postal_residencia,
    ciudad: "-" + data.nombre_departamento,
    pais: data.nombre_pais,
    language: "Español",
    llegada_hora: data.check_in_hora,
    llegada_fecha: data.check_in_fecha,
    llegada_fecha_dia: dia(data.check_in_fecha),
    salida: data.check_out_fecha,
    salida_dia: dia(data.check_out_fecha),
    noches: data.dias,
    habitacion_tipo: data.habitacion_tipo,
  };
  return detalles;
};

const InfoPagos = async (reserva_id, numero, schema = 'master') => {
  const query = `
    SELECT * FROM ${schema}.pago_total
    WHERE numero = $1 AND reserva_id = $2
  `;
  const values = [numero, reserva_id];

  try {
    const response = await pool.query(query, values);
    if (response.rows.length === 0) {
      return 1;
    } else {
      let pago = 0;
      for (const temp of response.rows) {
        if (temp.valor_pagado < temp.total_a_pagar) {
          pago = 1;
          break;
        }
      }
      return pago;
    }
  } catch (error) {
    console.error('Error executing query:', error);
    return 0;
  }
};


function formatDate(date) {
  const year = date.getFullYear(); // Obtener el año de la fecha
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Obtener el mes de la fecha
  const day = String(date.getDate()).padStart(2, "0"); // Obtener el día del mes de la fecha
  const hours = String(date.getHours()).padStart(2, "0"); // Obtener las horas de la fecha
  const minutes = String(date.getMinutes()).padStart(2, "0"); // Obtener los minutos de la fecha
  const seconds = String(date.getSeconds()).padStart(2, "0"); // Obtener los segundos de la fecha
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0"); // Obtener los milisegundos de la fecha

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`; // Crear la fecha en formato 2024-02-26T05:00:00.000Z
}


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
    formatDate(new Date(fecha_referencia.getFullYear(), fecha_referencia.getMonth(), fecha_referencia.getDate() - 5)),
    formatDate(new Date(fecha_referencia.getFullYear(), fecha_referencia.getMonth(), fecha_referencia.getDate() + 70)),
  ];

  try {
    const response = await pool.query(query, values);
    const bookings = await Promise.all(response.rows.map(async temp => {
      const date1 = new Date(temp.check_in_fecha);
      const date2 = new Date(temp.check_out_fecha);
      const diffTime = Math.abs(date2 - date1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Query adicional a TblReservasDetalle con el esquema
      const fecha_chec_in_response = await pool.query(`SELECT check_in_fecha FROM ${schema}.tbl_reservas_detalle WHERE id_reservas_grupo = $1 ORDER BY check_in_fecha LIMIT 1`, [temp.id_grupo]);
      const fecha_chec_in = fecha_chec_in_response.rows[0].check_in_fecha;

      return {
        ...temp,
        id: temp.id_reservas,
        zipcode: "",
        ciudad: "",
        pais: "",
        dias: diffDays,
        calle_residencia: "",
        codigo_postal_residencia: "",
        nombre_departamento: "",
        habitacion_tipo: temp.id_habitacion_tipo,
        nombre_pais: "",
        check_in_fecha: fecha_chec_in,
        start: new Date(date1.getFullYear(), date1.getMonth(), date1.getDate()),
        grupos: await detallesGrupos(temp.id_reservas, schema),
        detalles:  detalles(temp, temp.id_reservas, schema),
        checkOut: await InfoPagos(temp.id_reservas, temp.numero, schema),
      };
    }));

    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};



const cloneSchemaWithEmptyTables = async (req, res) => {
  const { hotelName } = req.params;
  const newSchema = `hotel_${hotelName}`;

  // Tablas de las que se copiarán tanto la estructura como los datos
  const tablesToCopyData = [
    "model_has_roles",
    "tbl_camas",
    "tbl_clientes_tipo",
    "tbl_categorias",
    "tbl_config",
    "tbl_desayunos",
    "tbl_documento_tipo",
    "tbl_generos",
    "tbl_habitaciones",
    "tbl_habitaciones_detalle_estado",
    "tbl_habitaciones_estado",
    "tbl_habitaciones_tipo",
    "tbl_hoteles",
    "tbl_idiomas",
    "tbl_iframes",
    "tbl_impuestos",
    "tbl_impuestos_productos",
    "tbl_monedas",
    "tbl_paises",
    "tbl_puntos_ventas",
    "tbl_rate",
    "tbl_tipo_pagos"
  ];

  try {
    // Crear el nuevo esquema
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${newSchema}`);

    // Obtener todas las tablas del esquema original
    const { rows: allTables } = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'hotel_hotelkamana'
    `);

    // Clonar tablas con y sin datos
    for (const { table_name } of allTables) {
      const createTableQuery = `CREATE TABLE ${newSchema}."${table_name}" (LIKE hotel_hotelkamana."${table_name}" INCLUDING ALL)`;
      await pool.query(createTableQuery);

      // Solo copiar datos para las tablas especificadas
      if (tablesToCopyData.includes(table_name)) {
        await pool.query(`INSERT INTO ${newSchema}."${table_name}" SELECT * FROM hotel_hotelkamana."${table_name}"`);
      }
    }

    res.status(200).json({ message: `Schema ${newSchema} created successfully with specified tables copied.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const starbucksIntegration = async (req, res) => {
  try {
    let body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const headers = req.headers;
    let filename = headers.filename;

    // Procesamiento del filename para extraer locationName
    let locationName = filename.slice(0, filename.indexOf(' ')).trim().replace(/ /g, '').toLowerCase();
    locationName = locationName === 'rivertownplaza' ? 'rivertown' : locationName;
    
    // Lista de tiendas permitidas
    const allowedLocationNames = ['doradoexpress', 'caribehilton', 'starbucks'];
    if (!allowedLocationNames.includes(locationName)) {
      return res.json({ status: 'recibido pero no publicado' });
    }
    
    // Enviar datos a Workforce
    const dataPoints = body;
    const workforce_tools = require("./process_oracle.js");
    const status = await workforce_tools.sendDataToWorkforce(dataPoints, locationName);
    
    return res.json({ status });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error interno del servidor' });
  }
};


module.exports = {
  starbucksIntegration,
  getQuery,
  getInvoices,
  getBookings,
  cloneSchemaWithEmptyTables
};
