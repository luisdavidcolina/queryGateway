const { Pool } = require("pg");
const { limpiarTexto } = require("./utils");
const { saveReservaDetail, ActualizarOrbeBloqueoAgregar } = require("./orbe");

// Conexión a la base de datos
const pool = new Pool({
  user: "diamond",
  host: "127.0.0.1",
  database: "hotel",
  password: "lksdfgj53fd",
  port: 5432,
});

const crearReservaciones = async (data, schema) => {
  try {
    // Procesar email
    const emailOriginal = (data.Global_email || "").trim();
    let email;
    if (emailOriginal === "" || emailOriginal.toLowerCase() === "no@email.com") {
      const nombreLimpio = limpiarTexto(data.Global_Name || "sin_nombre");
      const apellidoLimpio = limpiarTexto(data.Global_Surname || "sin_apellido");
      email = `${nombreLimpio}.${apellidoLimpio}@autogenerado.com`;
    } else {
      email = emailOriginal;
    }

    // Comprobar tipo de acción
    if (data.Action === "Create" || data.Action === "Modify") {
      console.log(data.Action === "Modify" ? "Modificación de reserva" : "Creación de reserva");

      // Eliminar reserva existente en caso de Modify
      if (data.Action === "Modify") {
        try {
          // Buscar cliente por email
          const clienteQuery = `SELECT id FROM ${schema}.tbl_clientes WHERE email = $1 ORDER BY id DESC LIMIT 1`;
          const clienteResult = await pool.query(clienteQuery, [email]);
          if (!clienteResult.rows.length) {
            console.error("No se encontró cliente con email", email);
            return;
          }
          const clienteId = clienteResult.rows[0].id;

          // Buscar reserva asociada
          const reservaQuery = `SELECT id FROM ${schema}.tbl_reservas WHERE id_cliente = $1 ORDER BY id DESC LIMIT 1`;
          const reservaResult = await pool.query(reservaQuery, [clienteId]);
          if (!reservaResult.rows.length) {
            console.error("No se encontró reserva para cliente", clienteId);
            return;
          }
          const reservaId = reservaResult.rows[0].id;

          // Buscar grupos
          const gruposQuery = `SELECT id, check_in_fecha, check_out_fecha FROM ${schema}.tbl_reservas_grupo WHERE id_reservas = $1`;
          const gruposResult = await pool.query(gruposQuery, [reservaId]);
          console.log("Grupos encontrados:", gruposResult.rows);

          for (const grupo of gruposResult.rows) {
            console.log("Procesando grupo:", grupo);

            // Eliminar detalles de reserva
            const detallesQuery = `SELECT id FROM ${schema}.tbl_reservas_detalle WHERE id_reservas_grupo = $1`;
            const detallesResult = await pool.query(detallesQuery, [grupo.id]);
            for (const detalle of detallesResult.rows) {
              try {
                await pool.query(`
                  UPDATE ${schema}.tbl_reservas_detalle
                  SET deleted_at = CURRENT_TIMESTAMP
                  WHERE id = $1
                `, [detalle.id]);
              } catch (error) {
                console.error("Error al eliminar detalle de reserva:", error.message);
              }
            }

            // Eliminar grupo
            try {
              await pool.query(`
                UPDATE ${schema}.tbl_reservas_grupo
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE id = $1
              `, [grupo.id]);
            } catch (error) {
              console.error("Error al eliminar grupo de reserva:", error.message);
            }
          }

          // Sincronizar con Orbe para habitaciones canceladas
          const roomTypes = Array.isArray(data.ROOM_TYPES.ROOM_TYPE)
            ? data.ROOM_TYPES.ROOM_TYPE
            : [data.ROOM_TYPES.ROOM_TYPE];
          for (const roomType of roomTypes) {
            if (roomType.Status === "Cancelled") {
              const habitacionQuery = `
                SELECT tbl_habitaciones_tipo.room_type
                FROM ${schema}.tbl_habitaciones
                JOIN ${schema}.tbl_habitaciones_tipo
                ON tbl_habitaciones.id_habitacion_tipo = tbl_habitaciones_tipo.id
                WHERE tbl_habitaciones_tipo.codigo = $1
              `;
              const habitacionResult = await pool.query(habitacionQuery, [roomType.Type_Code]);
              if (habitacionResult.rows.length) {
                const room_type = habitacionResult.rows[0].room_type;
                try {
                  await ActualizarOrbeBloqueoAgregar(room_type, grupo.check_in_fecha, grupo.check_out_fecha, grupo.id, null, null, schema);
                  console.log("Sincronizado con Orbe");
                } catch (error) {
                  console.error("Imposible sincronizar con Orbe:", error.message);
                }
              }
            }
          }
        } catch (error) {
          console.error("Error al eliminar reserva:", error.message);
        }
      }

      // Crear o buscar cliente
      const clienteQuery = `SELECT * FROM ${schema}.tbl_clientes WHERE email = $1`;
      let clienteResult = await pool.query(clienteQuery, [email]);
      let cliente = clienteResult.rows[0] || {};
      cliente.nombre = data.Global_Name || cliente.nombre;
      cliente.apellido = data.Global_Surname || cliente.apellido;
      cliente.id_clientes_tipo = 1;

      try {
        const nombrePais = data.Global_Country || null;
        if (nombrePais) {
          const paisQuery = `SELECT id FROM ${schema}.tbl_paises WHERE iso = $1`;
          const paisResult = await pool.query(paisQuery, [nombrePais]);
          if (paisResult.rows.length) {
            cliente.id_nacionalidad = paisResult.rows[0].id;
          }
        }
      } catch (error) {
        console.error("Error al buscar país:", error.message);
      }

      // Guardar cliente
      if (cliente.id) {
        const updateQuery = `
          UPDATE ${schema}.tbl_clientes
          SET nombre = $1, apellido = $2, id_clientes_tipo = $3, id_nacionalidad = $4, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `;
        await pool.query(updateQuery, [
          cliente.nombre,
          cliente.apellido,
          cliente.id_clientes_tipo,
          cliente.id_nacionalidad || null,
          cliente.id,
        ]);
      } else {
        const insertQuery = `
          INSERT INTO ${schema}.tbl_clientes (email, nombre, apellido, id_clientes_tipo, id_nacionalidad, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `;
        clienteResult = await pool.query(insertQuery, [
          email,
          cliente.nombre,
          cliente.apellido,
          cliente.id_clientes_tipo,
          cliente.id_nacionalidad || null,
        ]);
        cliente.id = clienteResult.rows[0].id;
      }
      console.log("Cliente procesado:", cliente);

      // Crear reserva
      const roomTypes = Array.isArray(data.ROOM_TYPES.ROOM_TYPE)
        ? data.ROOM_TYPES.ROOM_TYPE
        : [data.ROOM_TYPES.ROOM_TYPE];
      let id_reserva = null;
      for (const [index, roomType] of roomTypes.entries()) {
        try {
          if (roomType.Status !== "Cancelled") {
            id_reserva = await saveReservaDetail(
              roomType,
              cliente.id,
              data,
              id_reserva,
              data.SOURCE.BookingChannel,
              data.SOURCE.RequestorID,
              schema
            );
          }
        } catch (error) {
          console.error(`Error al crear reserva en iteración ${index}:`, error.message);
        }
      }
    }

    if (data.Action === "Cancelled") {
      console.log("Cancelación de reserva");

      // Eliminar reserva existente
      try {
        const clienteQuery = `SELECT id FROM ${schema}.tbl_clientes WHERE email = $1 ORDER BY id DESC LIMIT 1`;
        const clienteResult = await pool.query(clienteQuery, [email]);
        if (!clienteResult.rows.length) {
          console.error("No se encontró cliente con email", email);
          return;
        }
        const clienteId = clienteResult.rows[0].id;

        const reservaQuery = `SELECT id FROM ${schema}.tbl_reservas WHERE id_cliente = $1 ORDER BY id DESC LIMIT 1`;
        const reservaResult = await pool.query(reservaQuery, [clienteId]);
        if (!reservaResult.rows.length) {
          console.error("No se encontró reserva para cliente", clienteId);
          return;
        }
        const reservaId = reservaResult.rows[0].id;

        const gruposQuery = `SELECT id, check_in_fecha, check_out_fecha FROM ${schema}.tbl_reservas_grupo WHERE id_reservas = $1`;
        const gruposResult = await pool.query(gruposQuery, [reservaId]);
        console.log("Grupos encontrados:", gruposResult.rows);

        for (const grupo of gruposResult.rows) {
          console.log("Procesando grupo:", grupo);

          const detallesQuery = `SELECT id FROM ${schema}.tbl_reservas_detalle WHERE id_reservas_grupo = $1`;
          const detallesResult = await pool.query(detallesQuery, [grupo.id]);
          for (const detalle of detallesResult.rows) {
            try {
              await pool.query(`
                UPDATE ${schema}.tbl_reservas_detalle
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE id = $1
              `, [detalle.id]);
            } catch (error) {
              console.error("Error al eliminar detalle de reserva:", error.message);
            }
          }

          try {
            await pool.query(`
              UPDATE ${schema}.tbl_reservas_grupo
              SET deleted_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [grupo.id]);
          } catch (error) {
            console.error("Error al eliminar grupo de reserva:", error.message);
          }

          // Sincronizar con Orbe para habitaciones canceladas dentro del bucle
          const roomTypes = Array.isArray(data.ROOM_TYPES.ROOM_TYPE)
            ? data.ROOM_TYPES.ROOM_TYPE
            : [data.ROOM_TYPES.ROOM_TYPE];
          for (const roomType of roomTypes) {
            if (roomType.Status === "Cancelled") {
              const habitacionQuery = `
                SELECT tbl_habitaciones_tipo.room_type
                FROM ${schema}.tbl_habitaciones
                JOIN ${schema}.tbl_habitaciones_tipo
                ON tbl_habitaciones.id_habitacion_tipo = tbl_habitaciones_tipo.id
                WHERE tbl_habitaciones_tipo.codigo = $1
              `;
              const habitacionResult = await pool.query(habitacionQuery, [roomType.Type_Code]);
              if (habitacionResult.rows.length) {
                const room_type = habitacionResult.rows[0].room_type;
                try {
                  await ActualizarOrbeBloqueoAgregar(room_type, grupo.check_in_fecha, grupo.check_out_fecha, grupo.id, null, null, schema);
                  console.log("Sincronizado con Orbe");
                } catch (error) {
                  console.error("Imposible sincronizar con Orbe:", error.message);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error al eliminar reserva:", error.message);
      }
    }
  } catch (error) {
    console.error("Error en crearReservaciones:", error.message);
  }
};

module.exports = {
  crearReservaciones,
};