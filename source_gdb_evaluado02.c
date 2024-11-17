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
        exit(1); // Finaliza si falla la asignación de memoria
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

int main()
{
    first = NULL;
    last = NULL;

    char i = '\0';
    char string[100];
    char *frase = "Escriba su nombre:";

    printf("%s", frase);
    scanf("%s", string);
    printword(string);
    printf("Ingrese su C.I: \n");

    while (1)
    {
        scanf(" %c", &i);
        if (i == '\n')
        {
            break;
        }
        Agregar_elemento(i);
    }

    Imprimir_cedula();

    return 1;
}
