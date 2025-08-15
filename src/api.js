const { Pool } = require("pg");
const axios = require("axios");
const xml2js = require("xml2js");

function replaceAll(str, find, replace) {
  // Escapa los caracteres especiales de la cadena `find` para 
  // que puedan ser utilizados en la expresión regular.
  const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Crea una nueva expresión regular con la bandera global 'g' para 
  // reemplazar todas las ocurrencias.
  const regex = new RegExp(escapedFind, 'g');

  // Utiliza el método replace con la expresión regular.
  return str.replace(regex, replace);
}

// Conexión a la base de datos
const pool = new Pool({
  user: "diamond",
  host: "127.0.0.1",
  database: "hotel",
  password: "lksdfgj53fd",
  port: 5432,
});

const apiVerReservas = async (schema_id) => {
  try {
    // Consultar la tabla tbl_config para obtener data_api
    const query = `SELECT value FROM ${schema_id}.tbl_config WHERE name = $1`;
    const result = await pool.query(query, ["data_api"]);

    let datos;
    if (result.rows.length === 0) {
      datos = { validate: false, value: false };
    } else {
      datos = { validate: true, value: result.rows[0].value };
    }

    // Parsear el valor de data_api (JSON)
    const credentials = datos.validate ? JSON.parse(datos.value) : {};

    console.log(credentials)

    // Construir la solicitud XML
    const xmlRequest = `
      <ReservationsRequest>
        <Username>${credentials.user || ""}</Username>
        <Password>${credentials.pass || ""}</Password>
        <HotelCode>${credentials.code || ""}</HotelCode>
      </ReservationsRequest>
    `.trim();

    // Realizar la solicitud HTTP POST
    const url = "https://capi.orbebooking.com/OAF/BOOKRET/XML/";
    //const url = "https://webhook.site/4a9f16bb-f503-4d27-9fe2-2147c36951eb"
    const response = await axios.post(url, xmlRequest, {
      headers: { "Content-Type": "text/xml" },
    });

    let data = response.data.trim();
    console.log(data)
    //data = replaceAll(data, ' ', '')
    console.log(data)
    // Verificar si la respuesta no es vacía
    if (data !== "<RESULT><RESERVATIONS></RESERVATIONS></RESULT>") {
      // Guardar los datos en tbl_config
      const configName = `reserva${Date.now()}`;
      const insertQuery = `
        INSERT INTO ${schema_id}.tbl_config (name, value, created_at, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING name
      `;
      await pool.query(insertQuery, [configName, data]);
    }

    // Parsear la respuesta XML a objeto JavaScript
    const parser = new xml2js.Parser({ explicitArray: false });
    return new Promise((resolve, reject) => {
      parser.parseString(data, (err, result) => {
        if (err) {
          console.error(`Error al parsear XML para schema ${schema_id}:`, err.message);
          resolve({ data: {} });
        } else {
          resolve(result);
        }
      });
    });

  } catch (error) {
    console.error(`Error en apiVerReservas para schema ${schema_id}:`, error.message);
    return { data: {} }; // Retornar objeto vacío en caso de error
  }
};

module.exports = {
  apiVerReservas,
};

