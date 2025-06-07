const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const archivo = path.join(__dirname, 'resultado.json');
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  parseTagValue: true,
  trimValues: true,
});

// Función para limpiar texto como en PHP
function limpiarTexto(texto) {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD') // separa acentos
    .replace(/[\u0300-\u036f]/g, '') // elimina los acentos
    .replace(/\s+/g, '.') // reemplaza espacios por puntos
    .replace(/[^a-z0-9.]/g, ''); // elimina caracteres no alfanuméricos (excepto punto)
}

function extraerReservacionesDesdeXml(xmlStr) {
  try {
    const parsed = xmlParser.parse(xmlStr);
    const reservations = parsed.RESULT?.RESERVATIONS?.RESERVATION;
    if (!reservations) return [];

    return Array.isArray(reservations) ? reservations : [reservations];
  } catch (err) {
    console.error('❌ Error al parsear XML:', err.message);
    return [];
  }
}

(function procesar() {
  const raw = fs.readFileSync(archivo, 'utf-8');
  const registros = JSON.parse(raw);

  let todasLasReservaciones = registros.flatMap(registro => {
    return extraerReservacionesDesdeXml(registro.value);
  });

  todasLasReservaciones = todasLasReservaciones.filter(reserva =>
    reserva["Global_email"] === "no@email.com" || !reserva["Global_email"]
  );

  todasLasReservaciones = todasLasReservaciones.map(reserva => {
    const nombre = reserva["Global_Name"] || 'sin_nombre';
    const apellido = reserva["Global_Surname"] || 'sin_apellido';

    const nuevoEmail = `${limpiarTexto(nombre)}.${limpiarTexto(apellido)}@autogenerado.com`;

    return {
      "Action": reserva["Action"],
      "Res_DateCreated": reserva["Res_DateCreated"],
      "Booking_Code": reserva["Booking_Code"],
      "Global_Name": nombre,
      "Global_Surname": apellido,
      "Global_email": reserva["Global_email"],
      "nuevo_email": nuevoEmail,
      "Global_Country": reserva["Global_Country"],
      "ROOM_TYPES": reserva["ROOM_TYPES"]
    };
  });
  todasLasReservaciones=todasLasReservaciones.slice(0,todasLasReservaciones.length)

  console.log(`✅ Total de reservaciones encontradas: ${todasLasReservaciones.length}`);

  const output = path.join(__dirname, 'reservaciones.json');
  fs.writeFileSync(output, JSON.stringify(todasLasReservaciones, null, 2));
  console.log(`📝 Reservaciones exportadas a: ${output}`);
})();
