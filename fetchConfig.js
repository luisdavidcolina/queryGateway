const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'diamond',
  password: 'lksdfgj53fd',
  database: 'hotel',
  connectionTimeoutMillis: 5000, // por si cuelga
});

client.connect()
  .then(() => {
    console.log('✅ Conectado correctamente');
    return client.end();
  })
  .catch(err => {
    console.error('❌ Error de conexión:', err.message || err);
  });
