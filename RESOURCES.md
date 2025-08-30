# Directorio de Recursos

El directorio de recursos contiene scripts de utilidad y herramientas para configurar, probar y gestionar el sistema de API de Productos.

## Scripts de Inicio Rápido

### 🚀 `quick-start.sh`
Verificación completa de configuración e instalación de dependencias.
```bash
chmod +x /resources/quick-start.sh
./resources/quick-start.sh
```
- Verifica todos los requisitos previos (Node.js, MongoDB, Elasticsearch, RabbitMQ)
- Instala dependencias de npm para ambas APIs
- Configura archivos de entorno
- Proporciona los siguientes pasos para iniciar los servicios

### 🌱 `seed.sh`
Pobla el sistema con datos de prueba.
```bash
chmod +x /resources/seed.sh
./resources/seed.sh
```
- Limpia los datos existentes
- Crea productos de ejemplo con diferentes roles
- Prueba la paginación de GraphQL y la funcionalidad de búsqueda
- Verifica el flujo de mensajes de RabbitMQ

## Scripts de Gestión de Servicios Linux

### ⏹️ `stop_services.sh`
Detiene todos los servicios del sistema.
```bash
chmod +x /resources/stop_services.sh
./resources/stop_services.sh
```
- Detiene los servicios de MongoDB, Elasticsearch y RabbitMQ

## Flujo de Uso

### Ejecutar el proyecto manualmente (Linux)
```bash
# 1. Inicio rápido
./resources/quick-start.sh

# 2. En terminales separadas, inicia las APIs:
# Terminal 1:
cd api-a-core && npm run dev

# Terminal 2:
cd api-b-search && npm run dev

# 3. Agrega datos de prueba
./resources/seed.sh
```

### Ejecutar el proyecto (Docker)
```bash
# 1. Iniciar todos los servicios con docker
docker-compose up --build -d

# 2. Agrega datos de prueba
./resources/seed.sh
```

### Cargar datos de prueba
```bash
# Agregar datos de prueba nuevamente
./resources/seed.sh
```

## Solución de Problemas

Si encuentras problemas:

1. **Verifica que los servicios estén en ejecución**
2. **Revisa:**
   - API GraphQL: Revisa la terminal que ejecuta `npm run dev` en `api-a-core`
   - API de Búsqueda: Revisa la terminal que ejecuta `npm run dev` en `api-b-search`
   - Servicios del sistema: `sudo journalctl -u mongod -f` (y similar para elasticsearch, rabbitmq-server)

## Variables de Entorno

Todos los scripts respetan las siguientes variables de entorno:

- `PROJECT_DIR`: Directorio raíz del proyecto (predeterminado: directorio actual)
- `NODE_MAJOR_DEFAULT`: Versión principal de Node.js a instalar (predeterminado: 20)
- `MONGODB_MAJOR`: Versión de MongoDB (predeterminado: 7.0)
- `ES_MAJOR`: Versión principal de Elasticsearch (predeterminado: 8)

## Notas

- Todos los scripts incluyen salida con colores y manejo de errores
- Los scripts de Linux están diseñados para Ubuntu/Debian/Linux Mint
- Los scripts verifican los requisitos previos antes de continuar
- La mayoría de las operaciones se pueden ejecutar varias veces de forma segura
- Los servicios están configurados para uso en desarrollo (seguridad deshabilitada donde corresponda)
```