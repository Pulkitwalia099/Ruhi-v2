import { genSaltSync, hashSync } from "bcrypt-ts";

// ----------------------------------------------
// src/db/utils.ts
//
// export function generateHashedPassword()    L9
// ----------------------------------------------

export function generateHashedPassword(password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  return hash;
}
