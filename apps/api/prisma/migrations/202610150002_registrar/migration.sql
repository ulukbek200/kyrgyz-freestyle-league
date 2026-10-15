-- Additive only: existing users, roles and league data are preserved.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'REGISTRAR';
