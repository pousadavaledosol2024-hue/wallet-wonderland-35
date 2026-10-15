import ICAL from "ical.js";
export function parseCalendar(text: string) {
  const root = new ICAL.Component(ICAL.parse(text));
  if (root.name !== "vcalendar") throw Error("Arquivo iCal inválido.");
  const events = root.getAllSubcomponents("vevent");
  if (events.length > 1000) throw Error("O calendário excede 1.000 eventos.");
  return events.filter((c) => c.getFirstPropertyValue("status") !== "CANCELLED").map((c) => {
    const event = new ICAL.Event(c);
    if (event.isRecurring() || event.isRecurrenceException()) throw Error("Eventos recorrentes não são compatíveis. Exporte um calendário de reservas com datas individuais.");
    if (!event.uid || !event.startDate || !event.endDate) throw Error("Evento sem identificação ou datas.");
    const start = event.startDate.toString().slice(0, 10), end = event.endDate.toString().slice(0, 10);
    if (end <= start) throw Error("A saída de um evento deve ser posterior à entrada.");
    return { uid: event.uid.slice(0, 500), start, end };
  });
}
export function exportCalendar(blocks: { id: string; check_in: string; check_out: string }[]) {
  const cal = new ICAL.Component(["vcalendar", [], []]);
  cal.updatePropertyWithValue("version", "2.0"); cal.updatePropertyWithValue("prodid", "-//Pousada Vale do Sol//Disponibilidade//PT-BR");
  for (const block of blocks) { const component = new ICAL.Component("vevent"); const event = new ICAL.Event(component); event.uid = `${block.id}@valedosol`; event.summary = "Indisponível"; event.startDate = ICAL.Time.fromDateString(block.check_in); event.endDate = ICAL.Time.fromDateString(block.check_out); component.updatePropertyWithValue("dtstamp", ICAL.Time.now()); cal.addSubcomponent(component); }
  return cal.toString();
}
export function allowedFeedUrl(value: string) {
  const u = new URL(value);
  const host = u.hostname.toLowerCase();
  const allowed = ["airbnb.com", "airbnb.com.br", "booking.com", "triplar.com", "triplar.com.br"];
  if (u.protocol !== "https:" || u.username || u.password || u.port && u.port !== "443" || !allowed.some((d) => host === d || host.endsWith(`.${d}`))) throw Error("Use um link HTTPS de Airbnb, Booking.com ou TripLar. Para outro provedor, importe o arquivo .ics.");
  return u.href;
}