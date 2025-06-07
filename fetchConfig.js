const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'diamond',
  password: 'lksdfgj53fd',
  database: 'hotel',
  connectionTimeoutMillis: 5000,
});

const fechaInicio = '2024-06-20';

(async () => {
  try {
    await client.connect();
    console.log('✅ Conectado correctamente');

    const res = await client.query(`
      SELECT * FROM hotel_hotelelisa.tbl_config 
      WHERE "created_at" >= $1
      ORDER BY "id" DESC
      LIMIT 100
    `, [fechaInicio]);

    console.log('🔎 Resultados:', res.rows);

    await client.end();
    console.log('🚪 Conexión cerrada');
  } catch (err) {
    console.error('❌ Error:', err.message || err);
  }
})();
