# Chat v29.3

Correcciones funcionales:
- Los botones de usuarios guardan el UUID real mediante `data-user-id`.
- Abrir chat privado maneja correctamente respuestas RPC escalares o tabulares.
- La creación de grupo funciona con cero o más miembros seleccionados.
- Los errores y confirmaciones se muestran dentro del modal y también mediante alerta.
- La lista de usuarios muestra estados de carga, vacío y error.

No requiere SQL adicional si `arc_create_group(text,text,uuid[])` ya existe.
