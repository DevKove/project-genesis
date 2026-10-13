import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"https://devkove.github.io","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info, x-supabase-api-version","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Max-Age":"86400","Vary":"Origin"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const clean=(v:unknown)=>typeof v==="string"?v.trim():"";
const digits=(v:string)=>v.replace(/\D/g,"");
function validCpf(v:string){const c=digits(v);if(!/^\d{11}$/.test(c)||/(\d)\1{10}/.test(c))return false;const calc=(s:string,f:number)=>{let n=0;for(const d of s)n+=Number(d)*f--;const m=n*10%11;return m===10?0:m;};return calc(c.slice(0,9),10)===Number(c[9])&&calc(c.slice(0,10),11)===Number(c[10]);}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return json({ok:false,error:"Método não permitido."},405);
 const origin=req.headers.get("origin");if(origin&&origin!=="https://devkove.github.io")return json({ok:false,error:"Origem não autorizada."},403);
 if(Deno.env.get("ASAAS_PRODUCTION_ENABLED")!=="true")return json({ok:false,error:"Teste de Produção desabilitado. Configure os segredos no Supabase antes de habilitar."},503);
 try{
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY"),key=Deno.env.get("ASAAS_PRODUCTION_API_KEY");
  if(!url||!anon||!service||!key)return json({ok:false,error:"Configuração segura incompleta no servidor."},500);
  const token=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];if(!token)return json({ok:false,error:"Autenticação obrigatória."},401);
  const userClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authErr}=await userClient.auth.getUser(token);if(authErr||!auth.user)return json({ok:false,error:"Sessão inválida ou expirada."},401);
  const uid=auth.user.id;
  const [{data:profile,error:pe},{data:roles,error:re}]=await Promise.all([admin.from("profiles").select("account_status").eq("id",uid).maybeSingle(),admin.from("user_roles").select("role").eq("user_id",uid)]);
  if(pe||re)return json({ok:false,error:"Não foi possível validar as permissões."},500);
  if(profile?.account_status!=="approved"||!roles?.some((r:{role:string})=>r.role==="platform_admin"))return json({ok:false,error:"Apenas administradores aprovados da plataforma podem executar este teste."},403);
  let input:Record<string,unknown>;try{input=await req.json();}catch{return json({ok:false,error:"JSON inválido."},400);}
  const name=clean(input.name),cpf=digits(clean(input.cpf)),email=clean(input.email).toLowerCase(),phone=digits(clean(input.phone));
  if(name.length<3||name.length>100)return json({ok:false,error:"Informe seu nome completo."},422);
  if(!validCpf(cpf))return json({ok:false,error:"CPF inválido."},422);
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({ok:false,error:"Informe um e-mail válido."},422);
  if(phone&&(phone.length<10||phone.length>13))return json({ok:false,error:"Telefone inválido."},422);
  const testKey="asaas-production-pix-smoke-v1:"+uid;
  const {data:prior,error:priorErr}=await admin.from("asaas_production_test_charges").select("*").eq("test_key",testKey).maybeSingle();
  if(priorErr)return json({ok:false,error:"Falha ao consultar o registro de idempotência."},500);
  if(prior?.provider_payment_id){
   let row=prior;
   if(!clean(row.pix_copy_paste)||!clean(row.pix_qr_code_image)){try{const r=await fetch("https://api.asaas.com/v3/payments/"+encodeURIComponent(row.provider_payment_id)+"/pixQrCode",{headers:{"access_token":key},signal:AbortSignal.timeout(20000)});const p=await r.json().catch(()=>({}));if(r.ok&&(clean(p.payload)||clean(p.encodedImage))){const {data:saved,error}=await admin.from("asaas_production_test_charges").update({pix_copy_paste:clean(p.payload)||null,pix_qr_code_image:clean(p.encodedImage)||null,updated_at:new Date().toISOString()}).eq("id",row.id).select("*").single();if(!error&&saved)row=saved;}}catch{}}
   return json({ok:true,reused:true,payment:{id:row.id,status:row.status,amount:2,invoice_url:row.invoice_url,pix_copy_paste:row.pix_copy_paste,pix_qr_code_image:row.pix_qr_code_image,provider_payment_id:row.provider_payment_id}});
  }
  if(prior)return json({ok:false,error:"Existe uma tentativa sem confirmação. Nova cobrança bloqueada; concilie no Asaas antes de continuar."},409);
  const {data:reservation,error:reserveErr}=await admin.from("asaas_production_test_charges").insert({created_by:uid,test_key:testKey,amount:2,status:"CREATING"}).select("*").single();
  if(reserveErr||!reservation)return json({ok:false,error:"Não foi possível reservar o teste com segurança."},409);
  const api=async(path:string,body?:unknown)=>{const r=await fetch("https://api.asaas.com/v3"+path,{method:body===undefined?"GET":"POST",headers:{"access_token":key,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});const raw=await r.text();let data:any={};try{data=raw?JSON.parse(raw):{};}catch{}if(!r.ok){const detail=Array.isArray(data.errors)?data.errors.map((e:any)=>clean(e.description)||clean(e.code)).filter(Boolean).join("; "):"";throw new Error(detail||"O Asaas recusou a operação.");}return data;};
  try{
   const lookup=await api("/customers?cpfCnpj="+encodeURIComponent(cpf)+"&limit=10");let customer=Array.isArray(lookup.data)?lookup.data.find((c:any)=>digits(clean(c.cpfCnpj))===cpf):null;
   if(!customer?.id)customer=await api("/customers",{name,cpfCnpj:cpf,email,...(phone?{mobilePhone:phone}:{})});
   if(!customer?.id)throw new Error("Asaas não retornou o cliente.");
   const payment=await api("/payments",{customer:customer.id,billingType:"PIX",value:2.00,dueDate:new Date(Date.now()+3*86400000).toISOString().slice(0,10),description:"Morada360 - teste autorizado de integração Pix (R$ 2,00)",externalReference:testKey});
   if(!payment?.id)throw new Error("Asaas não retornou o identificador da cobrança.");
   const {error:saveErr}=await admin.from("asaas_production_test_charges").update({provider_customer_id:clean(customer.id),provider_payment_id:clean(payment.id),invoice_url:clean(payment.invoiceUrl)||null,provider_status:clean(payment.status)||null,status:"PENDING",updated_at:new Date().toISOString()}).eq("id",reservation.id);
   if(saveErr){console.error("Failed saving provider payment id",{localId:reservation.id,providerPaymentId:payment.id});return json({ok:false,error:"Cobrança criada no Asaas, mas falhou o registro local. Não repita; concilie no painel Asaas."},502);}
   const pix=await api("/payments/"+encodeURIComponent(payment.id)+"/pixQrCode"),payload=clean(pix.payload)||null,image=clean(pix.encodedImage)||null;
   const {data:saved,error:pixErr}=await admin.from("asaas_production_test_charges").update({pix_copy_paste:payload,pix_qr_code_image:image,updated_at:new Date().toISOString()}).eq("id",reservation.id).select("*").single();
   if(pixErr)console.error("Failed saving Pix payload",{localId:reservation.id,providerPaymentId:payment.id});
   return json({ok:true,reused:false,payment:{id:reservation.id,status:"PENDING",amount:2,invoice_url:clean(payment.invoiceUrl)||null,pix_copy_paste:saved?.pix_copy_paste??payload,pix_qr_code_image:saved?.pix_qr_code_image??image,provider_payment_id:clean(payment.id)}});
  }catch(e){const message=e instanceof Error?e.message:"Falha de comunicação com Asaas.";await admin.from("asaas_production_test_charges").update({status:"FAILED",updated_at:new Date().toISOString()}).eq("id",reservation.id).is("provider_payment_id",null);return json({ok:false,error:message+" Se a falha ocorreu após criar a cobrança, não repita; concilie no painel Asaas."},502);}
 }catch(e){console.error("asaas-production-pix-test unexpected error",e instanceof Error?e.message:"unknown");return json({ok:false,error:"Erro interno no teste Pix de Produção."},500);}
});