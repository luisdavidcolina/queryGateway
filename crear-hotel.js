/**
 * Script para crear un hotel nuevo completo:
 * - Clona el schema desde hotel_hotelkamana
 * - Crea el usuario en master.users
 *
 * Uso: node crear-hotel.js <hotelName> <adminNombres> <adminEmail> <adminPassword>
 * Ejemplo: node crear-hotel.js selvacolor "Hotel Selva Color" selvacolor@gmail.com admin
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: 'diamond',
  host: '127.0.0.1',
  database: 'hotel',
  password: 'lksdfgj53fd',
  port: 5432,
});

const tablesToCopyData = [
  "model_has_roles",
  "permissions",
  "roles",
  "role_has_permissions",
  "tbl_camas",
  "tbl_categorias",
  "tbl_clientes_tipo",
  "tbl_config",
  "tbl_desayunos",
  "tbl_documento_tipo",
  "tbl_fuentes_reservas",
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
  "tbl_reservas_estado",
  "tbl_tipo_pagos",
];

async function crearHotel(hotelName, adminNombres, adminEmail, adminPassword) {
  const newSchema = `hotel_${hotelName}`;
  const adminUsuario = hotelName;

  console.log(`\nCreando hotel: ${newSchema}`);
  console.log(`Usuario: ${adminUsuario} / ${adminEmail}\n`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${newSchema}`);
    console.log(`✓ Schema ${newSchema} creado`);

    // 2. Obtener tablas del schema plantilla
    const { rows: allTables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'hotel_hotelkamana'
      ORDER BY table_name
    `);

    // 3. Clonar tablas
    for (const { table_name } of allTables) {
      await client.query(
        `CREATE TABLE ${newSchema}."${table_name}" (LIKE hotel_hotelkamana."${table_name}" INCLUDING ALL)`
      );
      if (tablesToCopyData.includes(table_name)) {
        await client.query(
          `INSERT INTO ${newSchema}."${table_name}" SELECT * FROM hotel_hotelkamana."${table_name}"`
        );
        process.stdout.write(`  ✓ ${table_name} (con datos)\n`);
      } else {
        process.stdout.write(`  · ${table_name} (vacía)\n`);
      }
    }

    // 4. Crear usuario en master.users
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const result = await client.query(
      `INSERT INTO master.users (nombres, email, usuario, schema, password, activo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING id`,
      [adminNombres, adminEmail, adminUsuario, newSchema, passwordHash]
    );
    console.log(`\n✓ Usuario creado en master.users (id: ${result.rows[0].id})`);
    console.log(`  nombres:  ${adminNombres}`);
    console.log(`  email:    ${adminEmail}`);
    console.log(`  usuario:  ${adminUsuario}`);
    console.log(`  schema:   ${newSchema}`);

    await client.query('COMMIT');
    console.log(`\n✅ Hotel ${newSchema} creado exitosamente.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Argumentos por línea de comando
const [,, hotelName, adminNombres, adminEmail, adminPassword] = process.argv;

if (!hotelName || !adminNombres || !adminEmail || !adminPassword) {
  console.error('Uso: node crear-hotel.js <hotelName> "<adminNombres>" <adminEmail> <adminPassword>');
  console.error('Ejemplo: node crear-hotel.js selvacolor "Hotel Selva Color" selvacolor@gmail.com admin');
  process.exit(1);
}

crearHotel(hotelName, adminNombres, adminEmail, adminPassword);
