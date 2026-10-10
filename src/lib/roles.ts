import type { Database } from "@/integrations/supabase/types";

export type AssocRole = Database["public"]["Enums"]["assoc_role"];
export type ResidentRelation = Database["public"]["Enums"]["resident_relation"];

export const ROLE_LABELS: Record<AssocRole, string> = {
  admin: "Administrador",
  presidente: "Presidente",
  tesoureiro: "Tesoureiro",
  secretario: "Secretário",
  conselheiro: "Conselheiro",
  funcionario: "Funcionário",
  morador: "Morador",
};

export const RELATION_LABELS: Record<ResidentRelation, string> = {
  proprietario: "Proprietário",
  inquilino: "Inquilino",
  dependente: "Dependente",
  ocupante: "Ocupante",
};

/** Mirrors public.is_assoc_manager in the database. */
export function isManager(role: AssocRole | null | undefined): boolean {
  return role === "admin" || role === "presidente" || role === "secretario" || role === "tesoureiro";
}

/** Who may invite people (mirrors invitations RLS). */
export function canInvite(role: AssocRole | null | undefined): boolean {
  return role === "admin" || role === "presidente" || role === "secretario";
}

/** Who may change members' roles or remove members. */
export function canManageMembers(role: AssocRole | null | undefined): boolean {
  return role === "admin";
}

/** Who may see the audit trail and edit institutional data. */
export function canSeeAudit(role: AssocRole | null | undefined): boolean {
  return role === "admin" || role === "presidente";
}

export function isValidCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

/** Validates numeric and alphanumeric CNPJ, including the two check digits. */
export function isValidCNPJ(raw: string): boolean {
  const input = raw.trim().toUpperCase();
  if (!input || !/^[A-Z0-9./ -]+$/.test(input)) return false;
  const cnpj = input.replace(/[^A-Z0-9]/g, "");
  if (cnpj.length !== 14 || !/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj) || cnpj === cnpj[0].repeat(14)) return false;

  const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const value = (character: string) => character.charCodeAt(0) - 48;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += value(cnpj[i]) * weightsFirst[i];
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== Number(cnpj[12])) return false;

  sum = firstDigit * weightsSecond[12];
  for (let i = 0; i < 12; i++) sum += value(cnpj[i]) * weightsSecond[i];
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  return secondDigit === Number(cnpj[13]);
}

export function maskCPF(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 11) return raw ?? "";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
