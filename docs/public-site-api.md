# Pousada Vale do Sol — API do site público

Base após publicar: `https://admin.pousadavaledosol2024.com.br/api/public`.
As rotas não dependem do login administrativo. O site externo **ainda precisa ser adaptado e implantado**; criar estas rotas não altera o código do GitHub nem o MongoDB legado.

## Consultas

- `GET /rooms?check_in=2026-11-01&check_out=2026-11-03`: `{ rooms, currency: "BRL" }`. Projeção pública: identificador, nome, tipo, capacidade, diária, descrição pública, comodidades, camas, posição, disponibilidade. Não retorna notas, fotos privadas, URLs iCal nem conta proprietária. `available` vale para todo o intervalo solicitado; sem datas, o intervalo padrão é hoje até 366 dias depois (não é uma indicação de disponibilidade hoje).
- `GET /settings`: `{ settings, currency }`. Identidade, contatos comerciais, localização, redes e tarifas/políticas permitidas; nunca webhook, PIX, templates ou configurações arbitrárias. URLs de mídia não são publicadas nesta primeira API: arquivos existentes continuam privados e exigem uma estratégia explícita de publicação.
- `GET /availability?check_in=...&check_out=...`: `{ blocks: [{ room_id, check_in, check_out }], check_in, check_out }`. Check-out exclusivo; não expõe hóspedes, pagamentos, IDs de reservas ou origem.

As datas são `AAAA-MM-DD`. Máximo de 366 noites por consulta. Consulte novamente após cada envio e quando o usuário mudar datas/voltar à página. Respostas usam `no-store`; estas APIs são consultas HTTP, não uma assinatura Realtime ou sincronização bidirecional automática.

## Cotação e envio

```js
const base = 'https://admin.pousadavaledosol2024.com.br/api/public';
const response = await fetch(`${base}/pricing`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    room_id: quarto.id, check_in: entrada, check_out: saida,
    guests: { adults: 2, children: 0, petSmall: 0, petMedium: 0, petLarge: 0 }
  })
});
const quote = await response.json();
if (!response.ok) throw new Error(quote.error);
// Exiba quote.total e quote.days. O token não contém contatos e expira em 15 minutos.
const saved = await fetch(`${base}/reservations`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quote_token: quote.quote_token,
    guest_name: nome, guest_phone: telefoneComDDIDDD, guest_email: email || '', notes: observacoes || ''
  })
});
const result = await saved.json();
if (!saved.ok) throw new Error(result.error);
// { accepted: true, status: 'pre_reserva' }
```

Cada criança informada é tarifada pelo percentual cadastrado; a API recebe contagens, não idades. O site não deve pressupor regras por idade não presentes neste contrato. Valores recalculados no servidor com as tarifas da conta e do quarto, incluindo pets e acréscimos. Nenhum total, status, pagamento ou conta enviado pelo visitante é aceito. A pré-reserva bloqueia as datas imediatamente e fica pendente de gestão no painel; não é confirmação de pagamento ou hospedagem. Não há expiração automática do bloqueio nem notificação WhatsApp neste pedido.

A cotação assinada autoriza somente sua estadia/preço. Reenvie **a mesma cotação** após falha de rede: o banco retorna sucesso sem duplicar a reserva. Não emita outra cotação para repetir um pedido já aceito. Uma nova cotação para datas já bloqueadas retorna conflito. Mudanças de tarifa entre cotação e envio exigem nova consulta. O bloqueio transacional do quarto e o gatilho existente impedem sobreposição, inclusive em solicitações simultâneas ou alterações administrativas.

## Segurança e erros

- Origens de navegador: domínio público raiz, `www` e novo admin. `OPTIONS` aceita apenas essas origens. Requisições sem Origin (servidor a servidor) são permitidas. CORS não autentica pessoas e não impede robôs.
- Envio exige JSON com limite de 16 KB, dados validados e token HMAC válido. A chave assinante e o acesso privilegiado nunca são enviados ao site. Nenhuma rota lista ou retorna contatos de hóspedes.
- 400 dados inválidos; 401 cotação inválida/expirada; 403 origem não permitida; 409 datas indisponíveis/tarifas alteradas; 413 pedido grande; 415 formato incorreto; 503 falha temporária.
- A API pública não verifica identidade do visitante nem implementa proteção anti-robô. Para exposição com tráfego alto, planeje proteção antiabuso adicional antes de divulgar o formulário.
- O banco permanece protegido: leituras públicas passam por função com projeção estrita e conta fixa; a função de gravação só é executável pelo serviço interno, depois da verificação da cotação. Não use chaves privadas no código do GitHub.
- A prévia local intercepta OPTIONS antes dos handlers; os handlers CORS foram testados diretamente, mas a pré-verificação cross-origin na hospedagem publicada precisa ser validada após publicação.
