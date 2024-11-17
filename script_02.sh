#!/bin/bash

if [ $# -eq 0 ]; then
  echo "Error: No se proporcionó ninguna opción."
  exit 1
fi

case $1 in
  1)
    echo "Ruta del directorio actual:"
    pwd
    ;;
  2)
    echo "Contenido del directorio actual:"
    ls -la
    ;;
  3)
    echo "Hora y fecha actual:"
    date
    ;;
  4)
    echo "Nombre del usuario actual:"
    whoami
    ;;
  *)
    echo "Error: Opción inválida. Seleccione una opción entre 1 y 4."
    ;;
esac
