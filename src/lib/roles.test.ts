import { describe, expect, it } from "vitest";
import { canInvite, canManageMembers, canSeeAudit, isManager, isValidCNPJ, isValidCPF, maskCPF } from "./roles";

describe("permissões", () => {
  it("gestores: admin, presidente, secretário e tesoureiro", () => {
    expect(isManager("admin")).toBe(true);
    expect(isManager("tesoureiro")).toBe(true);
    expect(isManager("morador")).toBe(false);
    expect(isManager("conselheiro")).toBe(false);
  });
  it("tesoureiro não envia convites", () => {
    expect(canInvite("tesoureiro")).toBe(false);
    expect(canInvite("secretario")).toBe(true);
  });
  it("apenas admin gerencia membros", () => {
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("presidente")).toBe(false);
  });
  it("auditoria só para admin e presidente", () => {
    expect(canSeeAudit("presidente")).toBe(true);
    expect(canSeeAudit("secretario")).toBe(false);
  });
});

describe("CPF", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("529.982.247-24")).toBe(false);
    expect(isValidCPF("111.111.111-11")).toBe(false);
  });
  it("mascara para exibição (LGPD)", () => {
    expect(maskCPF("52998224725")).toBe("***.982.247-**");
  });
});


describe("CNPJ numérico e alfanumérico", () => {
  it("valida CNPJ numérico e alfanumérico com dígitos verificadores", () => {
    expect(isValidCNPJ("00.000.000/0001-91")).toBe(true);
    expect(isValidCNPJ("00.000.000/E08G-12")).toBe(true);
    expect(isValidCNPJ("00.000.000/E08G-13")).toBe(false);
  });
  it("rejeita formatos inválidos e sequências repetidas", () => {
    expect(isValidCNPJ("00.000.000/E08G-1X")).toBe(false);
    expect(isValidCNPJ("11.111.111/1111-11")).toBe(false);
    expect(isValidCNPJ("")).toBe(false);
  });
});
