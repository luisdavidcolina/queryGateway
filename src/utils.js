const limpiarTexto = (texto) => {
  // Convertir a minúsculas
  let result = texto.toLowerCase();

  // Eliminar acentos y caracteres especiales (equivalente a iconv UTF-8 a ASCII)
  result = result
    .normalize("NFD") // Descomponer caracteres con acentos
    .replace(/[\u0300-\u036f]/g, "") // Eliminar marcas diacríticas
    .replace(/[^a-z0-9\s.]/g, ""); // Eliminar caracteres no alfanuméricos (excepto espacios y puntos)

  // Reemplazar espacios por puntos
  result = result.replace(/\s+/g, ".");

  // Eliminar cualquier carácter no alfanumérico (excepto punto)
  result = result.replace(/[^a-z0-9.]/g, "");

  return result;
};

const formatDate = (date) => {
  // Convertir string a fecha y formatear como Y-m-d
  const d = new Date(date);
  if (isNaN(d)) {
    console.error(`Fecha inválida: ${date}`);
    return date; // Retornar original si no es válida
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

module.exports = {
  limpiarTexto,
  formatDate,
};