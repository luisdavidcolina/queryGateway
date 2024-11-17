#include <stdio.h>
#include <stdlib.h>

typedef struct Nodo{
	char data;
	struct Nodo *next;
}Nodo;
Nodo *first,*last;

void Agregar_elemento(char data) {
	struct Nodo *Auxiliar=malloc(sizeof(struct Nodo));
	if ( first == NULL ) {
		Auxiliar->data=data;
		Auxiliar->next=NULL;
	}else{
		last=first;
		while( last->next != NULL ){
			last=last->next;
		}
		last->next=Auxiliar;
		Auxiliar->data=data;
		Auxiliar->next=NULL;			
	}
	return;
}

void printword( char *string ) {
	printf("%s",string);
	return;
}

void Imprimir_cedula() {
	last=first;
	while(1){
		printf("%c",last->data);
		last=last->next;
	}

}

int main () {
	char i;
	char *string;
	char *frase="Escriba su nombre:";

	printf("%s",frase);
	scanf("%s",&string);
	printword(string);
	printf("Ingrese su C.I: \n");

	while ( i != '\n'){
		scanf("%c",i);
		Agregar_elemento(i);
	}
	Imprimir_cedula();
	return 1;
}
