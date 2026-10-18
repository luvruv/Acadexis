import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}