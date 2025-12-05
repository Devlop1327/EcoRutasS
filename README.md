# EcoRutas
Eco Rutas es una aplicación web desarrollada durante el curso Desarrollo de Software II en la Universidad del Pacífico. El proyecto nace a partir de una necesidad real en Buenaventura: muchas personas no saben a qué hora pasa el camión de recolección de basura por su barrio. Esta falta de información convierte un proceso cotidiano en un problema que afecta el orden, la limpieza de las calles y la convivencia en los sectores residenciales.

El objetivo principal de EcoRutas es brindar un sistema claro y accesible que permita visualizar rutas, horarios, recorridos en tiempo real y seguimiento de vehículos. Al centralizar esta información, los ciudadanos pueden organizarse mejor y las entidades pueden optimizar la operación del servicio.

## Tecnologías utilizadas
⦁	Angular 20  
⦁	Typescript  
⦁	Leaflet para mapas  
⦁	Supabase como base de datos y autenticación  
⦁	API de recolección  

Documentación de la API:  
apirecoleccion.gonzaloandreslucio.com/api/documentation#/

## Prácticas DevOps implementadas
⦁	Control de versiones con GitHub  
⦁	Uso de ramas, pull requests y revisiones de código  
⦁	Integración continua para análisis de calidad y construcción  
⦁	Despliegue continuo utilizando GitHub Actions  
⦁	Entrega del proyecto en ambiente de producción  
⦁	Automatización de procesos en pipeline  

## Funcionalidades principales
⦁	Registro y autenticación de usuarios  
⦁	Visualización general del panel principal con información del sistema  
⦁	Mapa interactivo para visualizar rutas disponibles  
⦁	Listado de vehículos operativos  
⦁	Recorrido en tiempo real de conductores  
⦁	Panel de administración para gestión de rutas y vehículos  
⦁	Control de inicio y finalización de recorridos por parte de conductores y administradores  
⦁	Restricción de secciones según perfil del usuario  
⦁	Sección de configuración del usuario  
⦁	Simulación de recorrido para fines de prueba y verificación  

## Arquitectura general del sistema
⦁	Frontend en Angular bajo componentes standalone  
⦁	Servicios dedicados para comunicación con API  
⦁	Directivas para habilitar o restringir contenido según el rol  
⦁	Control del estado mediante signals  
⦁	Mapas con Leaflet y capas dinámicas  
⦁	Persistencia de rutas en Supabase cuando no existen en la API  
⦁	Estructura de carpetas orientada a mantenimiento y escalabilidad  

## Equipo de desarrollo
⦁	Scrum Master: Janer Mena  
⦁	Product Owner: Jhon Gomez  
⦁	Desarrollador: Lopez Hinojosa 

