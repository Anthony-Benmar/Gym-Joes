# Joe's Gym Calca

Portal de socios y panel de gestión construido con React, TypeScript y Vite.

## Desarrollo local

```bash
npm install
npm run dev
```

Vite muestra la dirección local en la terminal, normalmente `http://localhost:5173`.

## Validar y compilar

```bash
npm run build
npm run preview
```

## Datos y siguiente etapa

La aplicación conserva la integración de demostración con las claves `gym_*` de `localStorage` para facilitar la transición desde las páginas HTML. Los navegadores aíslan los datos por origen, así que los datos guardados bajo `file://` no se trasladan automáticamente a `http://localhost`.

Al abrir **Gestión del gimnasio** por primera vez, selecciona **Mariano CEO** en el menú **Acceso personal** e ingresa el usuario `mariano`; se te pedirá crear su contraseña. Después, un administrador puede dar de alta al equipo desde **Equipo** y asignarle un usuario y una contraseña inicial.

Los precios, descripciones y beneficios de los planes se administran desde **Gestión del gimnasio → Planes y precios**. Los cambios se guardan en el navegador y aparecen en el portal de socios.

Esta autenticación es solo una demostración local: los hashes se guardan en el navegador, y el panel, los permisos y los datos pueden ser manipulados desde el cliente. No uses contraseñas reutilizadas ni información real. Para producción, conecta una API con autenticación, autorización y almacenamiento seguros en el servidor.
