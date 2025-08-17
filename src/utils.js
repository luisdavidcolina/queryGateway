function customReplaceAll(str, find, replace) {
  // Si 'find' ya es una expresión regular, la usamos directamente.
  if (find instanceof RegExp) {
    // Si la expresión regular no tiene la bandera global 'g', la añadimos para asegurar el reemplazo de todas las coincidencias.
    if (!find.global) {
      const flags = 'g' + (find.ignoreCase ? 'i' : '') + (find.multiline ? 'm' : '');
      find = new RegExp(find.source, flags);
    }
    return str.replace(find, replace);
  }

  // Si 'find' es una cadena, la escapamos y creamos una expresión regular.
  const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedFind, 'g');
  return str.replace(regex, replace);
}

const limpiarTexto = (texto) => {
  // Convertir a minúsculas
  let result = texto.toLowerCase();

  // Eliminar acentos y caracteres especiales
  result = result
    .normalize("NFD"); 
    
  // Usamos customReplaceAll para eliminar marcas diacríticas
  result = customReplaceAll(result, /[\u0300-\u036f]/g, ""); 
  
  // Usamos customReplaceAll para eliminar caracteres no alfanuméricos (excepto espacios y puntos)
  result = customReplaceAll(result, /[^a-z0-9\s.]/g, ""); 

  // Reemplazar espacios por puntos
  result = customReplaceAll(result, /\s+/g, ".");

  // Eliminar cualquier carácter no alfanumérico (excepto punto)
  result = customReplaceAll(result, /[^a-z0-9.]/g, "");

  return result;
};

const formatDate = (date) => {
  // Convertir string a fecha y sumar un día para compensar posible desfase
  const d = new Date(date);
  if (isNaN(d)) {
    console.error(`Fecha inválida: ${date}`);
    return date; // Retornar original si no es válida
  }
  d.setDate(d.getDate() + 1); // Sumar un día
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

module.exports = {
  limpiarTexto,
  formatDate,
};