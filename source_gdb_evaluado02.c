#include <stdio.h>
#include <stdlib.h>

typedef struct Nodo
{
    char data;
    struct Nodo *next;
} Nodo;

Nodo *first, *last;

void Agregar_elemento(char data)
{
    Nodo *Auxiliar = malloc(sizeof(Nodo));
    if (Auxiliar == NULL)
    {
        printf("Error al asignar memoria.\n");
        exit(1);
    }

    Auxiliar->data = data;
    Auxiliar->next = NULL;

    if (first == NULL)
    {
        first = Auxiliar;
    }
    else
    {
        last = first;
        while (last->next != NULL)
        {
            last = last->next;
        }
        last->next = Auxiliar;
    }
}

void printword(char *string)
{
    printf("%s", string);
}

void Imprimir_cedula()
{
    last = first;
    while (last != NULL)
    {
        printf("%c", last->data);
        last = last->next;
    }
    printf("\n");
}

void liberar_lista()
{
    Nodo *temp;
    while (first != NULL)
    {
        temp = first;
        first = first->next;
        free(temp);
    }
}

int main()
{
    first = NULL;
    last = NULL;

    char i = '\0';
    char string[100];
    char *frase = "Escriba su nombre:";

    printf("%s ", frase);
    scanf("%s", string); // Lee el nombre
    printword(string);
    printf("\nIngrese su C.I (termina con Enter): \n");

    // Usar un espacio antes de %c en scanf para ignorar caracteres residuales
    while (1)
    {
        scanf(" %c", &i);
        if (i == '\n') // Finalizar cuando se presione Enter
        {
            break;
        }
        Agregar_elemento(i);
    }

    // Imprime los datos de la lista
    printf("C.I ingresada: ");
    Imprimir_cedula();

    // Libera la memoria utilizada
    liberar_lista();
    return 0;
}
