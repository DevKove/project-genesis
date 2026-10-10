import { useMemo, useState } from "react";
import { FileDown, FileText, Printer, Save, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TemplateField = { id: string; label: string; required?: boolean; multiline?: boolean; placeholder?: string };
type TemplateDefinition = { id: string; name: string; description: string; fields: TemplateField[]; category: string; build: (values: Record<string, string>, associationName: string, city: string) => string };

const commonFields: TemplateField[] = [
  { id: "date", label: "Data", required: true, placeholder: "DD/MM/AAAA" },
  { id: "responsible", label: "Responsável pela emissão", required: true },
];

const templates: TemplateDefinition[] = [
  {
    id: "meeting-minutes", name: "Ata de reunião", description: "Registro de reunião, decisões e encaminhamentos.", category: "atas",
    fields: [
      { id: "meeting_type", label: "Tipo de reunião", required: true, placeholder: "Assembleia ordinária" },
      { id: "date", label: "Data", required: true, placeholder: "DD/MM/AAAA" },
      { id: "time", label: "Horário", required: true, placeholder: "19h00" },
      { id: "place", label: "Local", required: true },
      { id: "chair", label: "Presidente da reunião", required: true },
      { id: "secretary", label: "Secretário(a)", required: true },
      { id: "participants", label: "Participantes", multiline: true, required: true },
      { id: "agenda", label: "Pauta", multiline: true, required: true },
      { id: "decisions", label: "Deliberações e encaminhamentos", multiline: true, required: true },
    ],
    build: (v, a, city) => `ATA DE ${v.meeting_type.toLocaleUpperCase("pt-BR")}\n\nAos ${v.date}, às ${v.time}, em ${v.place}, reuniu-se ${a}${city ? `, em ${city}` : ""}.\n\nPRESIDENTE DA REUNIÃO: ${v.chair}\nSECRETÁRIO(A): ${v.secretary}\n\nPARTICIPANTES\n${v.participants}\n\nPAUTA\n${v.agenda}\n\nDELIBERAÇÕES E ENCAMINHAMENTOS\n${v.decisions}\n\nNada mais havendo a tratar, lavrou-se a presente ata para leitura e assinatura dos responsáveis.\n\n________________________________\n${v.chair} — Presidente da reunião\n\n________________________________\n${v.secretary} — Secretário(a)`,
  },
  {
    id: "residence-statement", name: "Declaração de residência", description: "Declaração para conferência e assinatura da associação.", category: "geral",
    fields: [
      { id: "resident", label: "Nome completo do morador", required: true },
      { id: "document", label: "CPF ou documento de identificação", required: true },
      { id: "unit", label: "Unidade / lote / endereço", required: true },
      { id: "since", label: "Residente desde", placeholder: "DD/MM/AAAA" },
      ...commonFields,
    ],
    build: (v, a, city) => `DECLARAÇÃO DE RESIDÊNCIA\n\nA ${a}${city ? `, situada em ${city}` : ""}, para os devidos fins e conforme as informações constantes em seus registros, declara que ${v.resident}, identificado(a) pelo documento ${v.document}, está vinculado(a) à unidade/endereço ${v.unit}${v.since ? ` desde ${v.since}` : ""}.\n\nEsta declaração é emitida a pedido do(a) interessado(a), com base nos dados informados e sujeitos à conferência pela associação.\n\n${v.date}\n\n________________________________\n${v.responsible}\nRepresentante da associação`,
  },
  {
    id: "authorization", name: "Autorização de acesso", description: "Autorização para visitante, prestador ou entrada específica.", category: "geral",
    fields: [
      { id: "requester", label: "Solicitante / morador", required: true },
      { id: "unit", label: "Unidade / lote", required: true },
      { id: "authorized_person", label: "Pessoa ou empresa autorizada", required: true },
      { id: "document", label: "Documento de identificação" },
      { id: "purpose", label: "Finalidade", required: true },
      { id: "period", label: "Período de validade", required: true, placeholder: "Data e horário" },
      { id: "notes", label: "Observações", multiline: true },
      ...commonFields,
    ],
    build: (v, a) => `AUTORIZAÇÃO DE ACESSO\n\nA ${a} autoriza, mediante conferência de identidade e cumprimento das normas internas, o acesso abaixo descrito.\n\nSOLICITANTE: ${v.requester}\nUNIDADE / LOTE: ${v.unit}\nPESSOA / EMPRESA AUTORIZADA: ${v.authorized_person}\nDOCUMENTO: ${v.document || "Não informado"}\nFINALIDADE: ${v.purpose}\nPERÍODO: ${v.period}\nOBSERVAÇÕES: ${v.notes || "Nenhuma"}\n\nEsta autorização não dispensa os procedimentos de segurança e identificação adotados pela associação.\n\nEmitida em ${v.date}.\n\n________________________________\n${v.responsible}\nResponsável pela emissão`,
  },
  {
    id: "official-notice", name: "Comunicado oficial", description: "Comunicado institucional para os associados e moradores.", category: "geral",
    fields: [
      { id: "subject", label: "Assunto", required: true },
      { id: "audience", label: "Destinatários", required: true, placeholder: "Todos os moradores" },
      { id: "body", label: "Texto do comunicado", multiline: true, required: true },
      { id: "contact", label: "Contato para dúvidas" },
      ...commonFields,
    ],
    build: (v, a, city) => `COMUNICADO OFICIAL\n\n${a}${city ? ` — ${city}` : ""}\nData: ${v.date}\n\nASSUNTO: ${v.subject}\nDESTINATÁRIOS: ${v.audience}\n\n${v.body}\n\n${v.contact ? `Dúvidas ou informações: ${v.contact}\n\n` : ""}Atenciosamente,\n${v.responsible}\n${a}`,
  },
  {
    id: "warning", name: "Notificação / advertência", description: "Modelo administrativo para descrever fato e solicitar regularização.", category: "regulamentos",
    fields: [
      { id: "recipient", label: "Destinatário", required: true },
      { id: "unit", label: "Unidade / lote", required: true },
      { id: "occurrence_date", label: "Data do fato", required: true },
      { id: "facts", label: "Descrição objetiva dos fatos", multiline: true, required: true },
      { id: "rule", label: "Regra aplicável (indicar artigo/cláusula)", required: true },
      { id: "action", label: "Providência solicitada e prazo", multiline: true, required: true },
      ...commonFields,
    ],
    build: (v, a) => `NOTIFICAÇÃO ADMINISTRATIVA\n\nDESTINATÁRIO: ${v.recipient}\nUNIDADE / LOTE: ${v.unit}\nDATA DO FATO: ${v.occurrence_date}\nDATA DA EMISSÃO: ${v.date}\n\nA ${a} registra a presente notificação para ciência do(a) destinatário(a), nos termos abaixo.\n\nDESCRIÇÃO DOS FATOS\n${v.facts}\n\nREGRA INDICADA\n${v.rule}\n\nPROVIDÊNCIA SOLICITADA E PRAZO\n${v.action}\n\nO destinatário poderá apresentar esclarecimentos à administração pelos canais oficiais da associação. Este modelo deve ser conferido conforme o estatuto, o regulamento e os procedimentos aplicáveis antes da emissão.\n\n________________________________\n${v.responsible}\nRepresentante da associação`,
  },
  {
    id: "service-request", name: "Solicitação administrativa", description: "Registro formal de pedido dirigido à administração.", category: "geral",
    fields: [
      { id: "requester", label: "Solicitante", required: true },
      { id: "unit", label: "Unidade / lote" },
      { id: "subject", label: "Assunto", required: true },
      { id: "request", label: "Descrição da solicitação", multiline: true, required: true },
      { id: "attachments", label: "Documentos anexos" },
      ...commonFields,
    ],
    build: (v, a) => `SOLICITAÇÃO ADMINISTRATIVA\n\nÀ administração de ${a}\n\nSOLICITANTE: ${v.requester}\nUNIDADE / LOTE: ${v.unit || "Não informado"}\nDATA: ${v.date}\nASSUNTO: ${v.subject}\n\nDESCRIÇÃO DO PEDIDO\n${v.request}\n\nANEXOS: ${v.attachments || "Não informado"}\n\nSolicito análise e retorno pelos canais de contato cadastrados.\n\n________________________________\n${v.requester}`,
  },
  {
    id: "responsibility-term", name: "Termo de responsabilidade", description: "Termo para registrar compromisso e condições acordadas.", category: "contratos",
    fields: [
      { id: "person", label: "Responsável", required: true },
      { id: "document", label: "CPF ou documento", required: true },
      { id: "subject", label: "Objeto / atividade", required: true },
      { id: "conditions", label: "Condições e responsabilidades", multiline: true, required: true },
      { id: "period", label: "Prazo / vigência" },
      ...commonFields,
    ],
    build: (v, a) => `TERMO DE RESPONSABILIDADE\n\nPelo presente instrumento, ${v.person}, documento ${v.document}, declara ciência e assume responsabilidade quanto a: ${v.subject}.\n\nCONDIÇÕES E RESPONSABILIDADES\n${v.conditions}\n\nPRAZO / VIGÊNCIA: ${v.period || "Conforme acordado entre as partes"}\n\nO presente termo deverá ser lido e conferido pelas partes antes da assinatura.\n\nData: ${v.date}\n\n________________________________\n${v.person}\nResponsável\n\n________________________________\n${v.responsible}\nRepresentante da associação`,
  },
  {
    id: "meeting-invitation", name: "Convocação de assembleia", description: "Convocação com pauta, data, horário e local.", category: "atas",
    fields: [
      { id: "assembly_type", label: "Tipo de assembleia", required: true },
      { id: "date", label: "Data da assembleia", required: true },
      { id: "time_first", label: "Horário da primeira convocação", required: true },
      { id: "time_second", label: "Horário da segunda convocação" },
      { id: "place", label: "Local", required: true },
      { id: "agenda", label: "Ordem do dia", multiline: true, required: true },
      { id: "notice_date", label: "Data de emissão", required: true },
      { id: "responsible", label: "Responsável pela convocação", required: true },
    ],
    build: (v, a, city) => `EDITAL DE CONVOCAÇÃO — ${v.assembly_type.toLocaleUpperCase("pt-BR")}\n\nA administração de ${a}${city ? `, ${city}` : ""}, observadas as disposições estatutárias aplicáveis, convoca os associados para assembleia a realizar-se em ${v.date}, às ${v.time_first}${v.time_second ? `, em segunda convocação às ${v.time_second}` : ""}, no local ${v.place}.\n\nORDEM DO DIA\n${v.agenda}\n\nData de emissão: ${v.notice_date}\n\n________________________________\n${v.responsible}\nResponsável pela convocação\n\nVerifique os prazos, o quórum e as regras de convocação previstos no estatuto antes da publicação.`,
  },
];

function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "documento";
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildHtml(title: string, body: string, associationName: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>@page{size:A4;margin:22mm}body{font:12pt/1.65 Arial,sans-serif;color:#111;max-width:760px;margin:0 auto;padding:24px}header{border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:26px}header h2{font-size:13pt;margin:0 0 4px}h1{font-size:17pt;text-align:center;margin:0 0 28px}pre{font:12pt/1.65 Arial,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}footer{margin-top:36px;font-size:9pt;color:#555}@media print{body{padding:0}}</style></head><body><header><h2>${escapeHtml(associationName)}</h2><div>Documento emitido pelo Morada360</div></header><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(body)}</pre><footer>Modelo editável gerado no sistema. Confira os dados e as regras internas antes de assinar ou distribuir.</footer></body></html>`;
}

export function DocumentTemplateBuilder({
  associationId,
  associationName,
  city,
  userId,
  onSaved,
}: {
  associationId: string;
  associationName: string;
  city?: string | null;
  userId: string;
  onSaved: () => Promise<unknown> | void;
}) {
  const [templateId, setTemplateId] = useState(templates[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [documentTitle, setDocumentTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const template = templates.find((item) => item.id === templateId) ?? templates[0];
  const normalizedValues = useMemo(() => Object.fromEntries(template.fields.map((field) => [field.id, values[field.id]?.trim() || (field.required ? "________________" : "")])), [template, values]);
  const generatedBody = useMemo(() => template.build(normalizedValues, associationName, city ?? ""), [template, normalizedValues, associationName, city]);
  const ready = template.fields.filter((field) => field.required).every((field) => Boolean(values[field.id]?.trim()));

  function chooseTemplate(nextId: string) {
    setTemplateId(nextId);
    setValues({});
    setDocumentTitle("");
  }

  function downloadHtml() {
    const title = documentTitle.trim() || template.name;
    const blob = new Blob([buildHtml(title, generatedBody, associationName)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(title)}.html`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printPdf() {
    if (!ready) {
      toast.error("Preencha os campos obrigatórios antes de gerar o documento.");
      return;
    }
    const popup = window.open("", "_blank");
    if (!popup) {
      toast.error("O navegador bloqueou a janela. Permita pop-ups para imprimir ou salvar em PDF.");
      return;
    }
    popup.document.open();
    popup.document.write(buildHtml(documentTitle.trim() || template.name, generatedBody, associationName));
    popup.document.close();
    popup.focus();
    popup.setTimeout(() => popup.print(), 300);
  }

  async function saveDocument() {
    if (!ready || !associationId) {
      toast.error("Preencha os campos obrigatórios antes de salvar.");
      return;
    }
    const title = (documentTitle.trim() || template.name).slice(0, 160);
    const body = `${title.toLocaleUpperCase("pt-BR")}\n${associationName}\nGerado em ${new Date().toLocaleString("pt-BR")}\nModelo: ${template.name}\n\n${generatedBody}\n`;
    const file = new Blob([body], { type: "text/plain;charset=utf-8" });
    const documentId = crypto.randomUUID();
    const filePath = `${associationId}/${documentId}/${slugify(title)}.txt`;
    setSaving(true);
    try {
      const { error: metadataError } = await supabase.from("documents").insert({
        id: documentId,
        association_id: associationId,
        uploaded_by: userId,
        title,
        description: `Documento gerado pelo modelo: ${template.name}`,
        category: template.category,
        visibility: "associacao",
        file_path: filePath,
        mime_type: "text/plain",
        size_bytes: file.size,
      });
      if (metadataError) throw metadataError;
      const { error: uploadError } = await supabase.storage.from("association-documents").upload(filePath, file, {
        contentType: "text/plain;charset=utf-8",
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) {
        await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", documentId).eq("association_id", associationId);
        throw uploadError;
      }
      toast.success("Documento gerado e salvo na biblioteca da associação.");
      await onSaved();
    } catch {
      toast.error("Não foi possível salvar o documento. Verifique as permissões e a configuração do armazenamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 space-y-5 rounded-xl border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold"><WandSparkles className="h-5 w-5 text-primary" /> Criar documento a partir de modelo</h2><p className="mt-1 text-sm text-muted-foreground">Preencha os campos, confira o texto e gere uma versão para imprimir, salvar em PDF ou arquivar.</p></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <div><Label htmlFor="document-template">Modelo de documento</Label><select id="document-template" value={templateId} onChange={(event) => chooseTemplate(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">{template.description}</p></div>
          <div><Label htmlFor="generated-document-title">Título do documento</Label><Input id="generated-document-title" value={documentTitle} maxLength={160} onChange={(event) => setDocumentTitle(event.target.value)} placeholder={template.name} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {template.fields.map((field) => <div key={field.id} className={field.multiline ? "sm:col-span-2" : ""}><Label htmlFor={`template-${field.id}`}>{field.label}{field.required ? " *" : ""}</Label>{field.multiline ? <Textarea id={`template-${field.id}`} value={values[field.id] ?? ""} required={field.required} maxLength={8000} rows={4} placeholder={field.placeholder} onChange={(event) => setValues((old) => ({ ...old, [field.id]: event.target.value }))} /> : <Input id={`template-${field.id}`} value={values[field.id] ?? ""} required={field.required} maxLength={1000} placeholder={field.placeholder} onChange={(event) => setValues((old) => ({ ...old, [field.id]: event.target.value }))} />}</div>)}
          </div>
          <p className="text-xs text-muted-foreground">* Campos obrigatórios. Os modelos são pontos de partida: confira os dados e a conformidade com o estatuto e as regras da associação antes de usar.</p>
          <div className="flex flex-wrap gap-2"><Button onClick={printPdf} disabled={!ready}><Printer className="mr-2 h-4 w-4" /> Imprimir / salvar PDF</Button><Button variant="outline" onClick={downloadHtml} disabled={!ready}><FileDown className="mr-2 h-4 w-4" /> Exportar HTML</Button><Button variant="outline" onClick={saveDocument} disabled={!ready || saving}>{saving ? <><Save className="mr-2 h-4 w-4 animate-pulse" /> Salvando…</> : <><Save className="mr-2 h-4 w-4" /> Salvar no sistema</>}</Button></div>
        </div>
        <div className="min-w-0 rounded-lg border bg-muted/20 p-3 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Pré-visualização</div>
          <article className="min-h-80 bg-white p-5 text-gray-900 shadow-sm sm:p-8">
            <div className="border-b-2 border-gray-800 pb-3"><div className="font-semibold">{associationName}</div><div className="text-xs text-gray-500">Documento emitido pelo Morada360</div></div>
            <h3 className="my-6 text-center text-base font-bold">{documentTitle.trim() || template.name}</h3>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7">{generatedBody}</pre>
            <div className="mt-8 border-t pt-3 text-xs text-gray-500">Confira os dados e as regras internas antes de assinar ou distribuir.</div>
          </article>
        </div>
      </div>
    </section>
  );
}
