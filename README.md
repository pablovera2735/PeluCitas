# ✂️ PeluCitas — Aplicación de Reservas para Peluquerías

Aplicación móvil desarrollada con **React Native, Expo, TypeScript y Supabase**, diseñada para facilitar la gestión de citas en peluquerías y barberías.

Permite a los clientes registrarse, seleccionar servicios, consultar horarios disponibles y reservar citas directamente desde su dispositivo Android.

## 📱 Funcionalidades

- 🔐 Registro e inicio de sesión de usuarios.
- 📅 Calendario interactivo para seleccionar fechas.
- ✂️ Selección de servicios de peluquería y barbería.
- 🕒 Consulta de horarios disponibles.
- ✅ Reserva de citas mediante Supabase.
- 🚫 Prevención de reservas duplicadas.
- 📋 Apartado «Mis citas».
- ❌ Cancelación de reservas.
- 💾 Almacenamiento de datos en PostgreSQL.
- 📱 Interfaz adaptada a dispositivos móviles.

## 🛠️ Tecnologías utilizadas

| Tecnología | Uso |
|---|---|
| React Native | Desarrollo móvil |
| Expo | Desarrollo y compilación Android |
| TypeScript | Lenguaje de programación |
| Supabase | Backend y autenticación |
| PostgreSQL | Base de datos |
| Git y GitHub | Control de versiones |

## ✂️ Servicios disponibles

| Servicio | Precio |
|---|---:|
| Corte de pelo | 12 € |
| Arreglo de barba | 8 € |
| Corte + barba | 18 € |

*Precios de ejemplo configurables.*

## 🚀 Instalación

**1. Clonar el repositorio**

```bash
git clone https://github.com/pablovera2735/PeluCitas.git
cd PeluCitas
```

**2. Instalar dependencias**

```bash
npm install
```

**3. Configurar Supabase**

Crear un archivo `.env` en la raíz del proyecto:

```env
EXPO_PUBLIC_SUPABASE_URL=TU_URL_SUPABASE
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
```

Crear las tablas y funciones necesarias en Supabase y configurar las políticas de seguridad RLS.

**4. Ejecutar la aplicación**

```bash
npx expo start
```

Escanear el código QR con Expo Go para probarla en Android.

## 📲 Compilación APK

La aplicación puede compilarse para Android mediante Expo Application Services (EAS Build), configurando un perfil de compilación APK.

## 🔒 Seguridad

- Autenticación gestionada por Supabase.
- Contraseñas gestionadas de forma segura por el proveedor de autenticación.
- Políticas Row Level Security (RLS) para controlar el acceso a las reservas.
- Variables de configuración mediante `.env`.

El archivo `.env` no debe publicarse en GitHub.

## 🔮 Próximas mejoras

- Panel de administración para el peluquero.
- Gestión de horarios y días festivos.
- Notificaciones de recordatorio de citas.
- Selección de peluquero.
- Personalización de servicios y precios.
- Publicación de la aplicación para Android.

## 👨‍💻 Desarrollador

**Pablo Vera García**

Desarrollador de aplicaciones web y móviles.

- GitHub: https://github.com/pablovera2735
- Portfolio: https://pabloveragarciadev.netlify.app

---

Proyecto desarrollado para practicar y ampliar conocimientos en desarrollo de aplicaciones móviles, autenticación de usuarios y gestión de bases de datos.
