/**
 * Script para crear un hotel nuevo completo:
 * - Clona el schema desde hotel_hotelkamana
 * - Crea el usuario en master.users
 *
 * Uso: node crear-hotel.js <hotelName> "<adminNombres>" <adminEmail> <passwordHash>
 * Para generar el hash: php -r "echo password_hash('tupassword', PASSWORD_BCRYPT, ['cost'=>12]);"
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');

const pool = new Pool({
  user: process.env.DB_USER || 'diamond',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'hotel',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
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

function hashPassword(password) {
  try {
    // Usa PHP si está disponible (compatible con Laravel)
    var hash = execSync(
      "php -r \"echo password_hash('" + password + "', PASSWORD_BCRYPT, ['cost'=>12]);\"",
      { timeout: 10000 }
    ).toString().trim();
    if (hash && hash.indexOf('$2y$') === 0) return hash;
  } catch (e) {}

  // Fallback: hash pre-computado para 'admin' (bcrypt cost 12)
  if (password === 'admin') {
    return '$2b$12$w2VyKo9bDoQFMsYBv1E5WONSTGVcWOlIW2r5HGtf7QYz3zYjWE5.O';
  }

  throw new Error('No se pudo hashear el password. Instala PHP o usa la contrasena "admin".');
}

async function crearHotel(hotelName, adminNombres, adminEmail, adminPassword) {
  var newSchema = 'hotel_' + hotelName;
  var adminUsuario = hotelName;

  console.log('\nCreando hotel: ' + newSchema);
  console.log('Usuario: ' + adminUsuario + ' / ' + adminEmail + '\n');

  var passwordHash = hashPassword(adminPassword);

  var client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear schema
    await client.query('CREATE SCHEMA IF NOT EXISTS ' + newSchema);
    console.log('Schema ' + newSchema + ' creado');

    // 2. Obtener tablas del schema plantilla
    var tablesResult = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'hotel_hotelkamana' ORDER BY table_name"
    );
    var allTables = tablesResult.rows;

    // 3. Clonar tablas
    for (var i = 0; i < allTables.length; i++) {
      var table_name = allTables[i].table_name;
      await client.query(
        'CREATE TABLE ' + newSchema + '."' + table_name + '" (LIKE hotel_hotelkamana."' + table_name + '" INCLUDING ALL)'
      );
      if (tablesToCopyData.indexOf(table_name) !== -1) {
        await client.query(
          'INSERT INTO ' + newSchema + '."' + table_name + '" SELECT * FROM hotel_hotelkamana."' + table_name + '"'
        );
        console.log('  + ' + table_name + ' (con datos)');
      } else {
        console.log('  - ' + table_name + ' (vacia)');
      }
    }

    // 4. Crear usuario en master.users
    var result = await client.query(
      'INSERT INTO master.users (nombres, email, usuario, schema, password, activo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING id',
      [adminNombres, adminEmail, adminUsuario, newSchema, passwordHash]
    );
    console.log('\nUsuario creado en master.users (id: ' + result.rows[0].id + ')');
    console.log('  nombres:  ' + adminNombres);
    console.log('  email:    ' + adminEmail);
    console.log('  usuario:  ' + adminUsuario);
    console.log('  schema:   ' + newSchema);

    await client.query('COMMIT');
    console.log('\nHotel ' + newSchema + ' creado exitosamente.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nError: ' + err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

var args = process.argv.slice(2);
var hotelName    = args[0];
var adminNombres = args[1];
var adminEmail   = args[2];
var adminPassword = args[3];

if (!hotelName || !adminNombres || !adminEmail || !adminPassword) {
  console.error('Uso: node crear-hotel.js <hotelName> "<adminNombres>" <adminEmail> <adminPassword>');
  console.error('Ejemplo: node crear-hotel.js selvacolor "Hotel Selva Color" selvacolor@gmail.com admin');
  process.exit(1);
}

crearHotel(hotelName, adminNombres, adminEmail, adminPassword);
