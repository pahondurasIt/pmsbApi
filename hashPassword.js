const bcrypt = require('bcrypt');

const plainPassword = 'david0511'; // <-- Cambia 'hola511' por la contraseña que necesites hashear
const saltRounds = 10; // Un número de rondas de sal entre 10 y 12 es común y seguro.
                       // Deberías usar el mismo número de saltRounds que usarías si estuvieras registrando un nuevo usuario.

bcrypt.hash(plainPassword, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error al hashear la contraseña:', err);
  } else {
    console.log('Hash bcrypt generado para:', plainPassword);
    console.log('Hash:', hash);
    console.log('\n¡IMPORTANTE! Copia este hash y actualiza manualmente la columna `passwordHash` en tu tabla `users_us` para el usuario correspondiente.');
  }
});