// ========================================
// Usuarios registrados
//
// Arranca vacío a propósito. No hay ningún
// usuario de ejemplo con contraseña escrita
// en el código. El primero se crea por el
// endpoint de registro.
//
// Al ser memoria, se pierde en cada
// reinicio del servidor. Más adelante esto
// será la tabla usuarios en
// PostgreSQL/Supabase.
// ========================================

const usuarios = [];


module.exports = usuarios;
