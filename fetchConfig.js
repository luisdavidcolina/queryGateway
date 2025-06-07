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

const fechaInicio = '2025-05-20 11:36:39';

(async () => {
  try {
    await client.connect();
    console.log('✅ Conectado correctamente');

    const res = await client.query(`
      SELECT COUNT(*) AS total
      FROM hotel_hotelelisa.tbl_config
      WHERE created_at >= $1
    `, [fechaInicio]);

    const result = {
      fecha_consulta: new Date().toISOString(),
      fecha_inicio: fechaInicio,
      total: parseInt(res.rows[0].total, 10),
    };

    const outputPath = path.join(__dirname, 'resultado.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`📝 Resultado guardado en: ${outputPath}`);

    await client.end();
    console.log('🚪 Conexión cerrada');
  } catch (err) {
    console.error('❌ Error:', err.message || err);
  }
})();
