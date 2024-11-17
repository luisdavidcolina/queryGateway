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
	if (first == NULL)
	{
		Auxiliar->data = data;
		Auxiliar->next = NULL;
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
		Auxiliar->data = data;
		Auxiliar->next = NULL;
	}
}

void printword(char *string)
{
	printf("%s", string);
	return;
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


	char i[20];
	char string[100];
	char *frase = "Escriba su nombre:";

	printf("%s", frase);
	scanf("%99s", string);
	printword(string);
	printf("Ingrese su C.I: \n");

	scanf("%19s", i); 

    for (int j = 0; i[j] != '\0'; j++) {
        Agregar_elemento(i[j]);
    }

	Imprimir_cedula();
	return 1;
}
