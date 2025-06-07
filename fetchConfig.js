const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'diamond',
  password: 'lksdfgj53fd',
  database: 'hotel',
  connectionTimeoutMillis: 5000,
});

const fechaInicio = '2025-05-20 00:00:00';

(async () => {
  try {
    await client.connect();
    console.log('✅ Conectado correctamente');

    const res = await client.query(`
      SELECT * 
      FROM hotel_hotelelisa.tbl_config
      WHERE created_at >= $1
      ORDER BY id DESC
      LIMIT 100
    `, [fechaInicio]);

    const registros = res.rows;
    console.log(`📊 Total de registros encontrados: ${registros.length}`);

    const outputPath = path.join(__dirname, 'resultado.json');
    fs.writeFileSync(outputPath, JSON.stringify(registros, null, 2));
    console.log(`📝 Registros guardados en: ${outputPath}`);

    await client.end();
    console.log('🚪 Conexión cerrada');
  } catch (err) {
    console.error('❌ Error:', err.message || err);
  }
})();
