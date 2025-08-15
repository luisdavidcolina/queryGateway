const { Pool } = require("pg");
const axios = require("axios");
const xml2js = require("xml2js");

function replaceAll(str, find, replace) {
  const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedFind, 'g');
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
    const query = `SELECT value FROM ${schema_id}.tbl_config WHERE name = $1`;
    const result = await pool.query(query, ["data_api"]);

    let datos;
    if (result.rows.length === 0) {
      datos = { validate: false, value: false };
      console.log(`No se encontraron credenciales en ${schema_id}.tbl_config para data_api`);
    } else {
      datos = { validate: true, value: result.rows[0].value };
    }

    // Parsear el valor de data_api (JSON)
    const credentials = datos.validate ? JSON.parse(datos.value) : {};
    console.log("Credenciales usadas:", credentials);

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
    const response = await axios.post(url, xmlRequest, {
      headers: { "Content-Type": "text/xml" },
      timeout: 10000, // Timeout de 10 segundos
    });

    let data = response.data.trim();
    console.log("Respuesta cruda de la API:", data);

    // Preprocesar el XML para corregir problemas específicos (ej. <DAILY_RATE>)
    data = data.replace(
      /<DAILY_RATE>(.*?)RateAdult_Rate="([^"]*)"Child_Rate="([^"]*)"Date_Rate="([^"]*)"(.*?)<\/DAILY_RATE>/g,
      '<DAILY_RATE RateAdult="$2" Child_Rate="$3" Date_Rate="$4">$1$5</DAILY_RATE>'
    );

    // Validar si el XML contiene datos significativos
    const parser = new xml2js.Parser({ explicitArray: false });
    const isEmpty = await new Promise((resolve) => {
      parser.parseString(data, (err, result) => {
        if (err) {
          console.error(`Error preliminar al validar XML para schema ${schema_id}:`, err.message);
          resolve(true); // Considerar como vacío si falla el parseo
        } else {
          resolve(!result.RESULT || !result.RESULT.RESERVATIONS || !result.RESULT.RESERVATIONS.RESERVATION);
        }
      });
    });

    // Guardar solo si hay datos significativos
    if (!isEmpty) {
      const configName = `reserva${Date.now()}`;
      const insertQuery = `
        INSERT INTO ${schema_id}.tbl_config (name, value, created_at, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING name
      `;
      await pool.query(insertQuery, [configName, data]);
    } else {
      console.log(`Datos vacíos detectados para schema ${schema_id}, no se guarda.`);
    }

    // Parsear la respuesta XML final
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
    if (error.response) {
      console.error(`Error de API para schema ${schema_id}:`, error.response.status, error.response.statusText, error.response.data);
    } else if (error.request) {
      console.error(`No se recibió respuesta de la API para schema ${schema_id}:`, error.message);
    } else {
      console.error(`Error en apiVerReservas para schema ${schema_id}:`, error.message);
    }
    return { data: {} }; // Retornar objeto vacío en caso de error
  }
};

module.exports = {
  apiVerReservas,
};