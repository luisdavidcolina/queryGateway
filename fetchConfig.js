const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'diamond',
  password: 'lksdfgj53fd',
  database: 'hotel',
  connectionTimeoutMillis: 5000,
});

const fechaInicio = '2025-05-20 11:36:39'; // ISO format

(async () => {
  try {
    await client.connect();
    console.log('✅ Conectado correctamente');

    const res = await client.query(`
      SELECT COUNT(*) AS total
      FROM hotel_hotelelisa.tbl_config
      WHERE created_at >= $1
    `, [fechaInicio]);

    console.log(`🔢 Total de registros desde ${fechaInicio}: ${res.rows[0].total}`);

    await client.end();
    console.log('🚪 Conexión cerrada');
  } catch (err) {
    console.error('❌ Error:', err.message || err);
  }
})();
