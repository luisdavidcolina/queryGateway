const { Pool } = require("pg");
const { apiVerReservas } = require("./api"); // Placeholder para la función que se implementará después
const { crearReservaciones } = require("./reservations-controller"); // Placeholder para la función que se implementará después

// Conexión a la base de datos
const pool = new Pool({
  user: "diamond",
  host: "127.0.0.1",
  database: "hotel",
  password: "lksdfgj53fd",
  port: 5432,
});


const schema_ids = ['master']

const cargarReservas = async () => {
  for (const schema_id of schema_ids) {
    try {
      console.log(`Procesando schema: ${schema_id}`);
      
      // Obtener datos de la API
      const data = await apiVerReservas(schema_id);
      
      if (!data) {
        console.log(`No se recibieron datos para el schema ${schema_id}`);
        continue;
      }

      // Verificar si existen reservas
      if (data.RESERVATIONS && data.RESERVATIONS.RESERVATION) {
        const reservations = data.RESERVATIONS.RESERVATION;

        // Verificar si es un objeto o un array
        if (Array.isArray(reservations)) {
          // Procesar array de reservas
          for (const [index, reservation] of reservations.entries()) {
            try {
              await crearReservaciones(reservation, schema_id);
            } catch (error) {
              console.error(`Error al procesar reserva en índice ${index} para schema ${schema_id}:`, error.message);
            }
          }
        } else if (typeof reservations === "object" && reservations !== null) {
          // Procesar una sola reserva
          try {
            await crearReservaciones(reservations, schema_id);
          } catch (error) {
            console.error(`Error al procesar reserva única para schema ${schema_id}:`, error.message);
          }
        } else {
          console.log(`No se encontraron reservas válidas en schema ${schema_id}`);
        }
      } else {
        console.log(`No se encontró la propiedad RESERVATIONS en schema ${schema_id}`);
      }
    } catch (error) {
      console.error(`Error al procesar schema ${schema_id}:`, error.message);
    }
  }
};

module.exports = {
  cargarReservas,
};