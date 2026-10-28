// Fechas de operación como texto "YYYY-MM-DD" en la zona horaria de la terminal.

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function fechaValida(texto) {
  if (typeof texto !== 'string' || !FECHA_RE.test(texto)) return false;
  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

function horaValida(texto) {
  return typeof texto === 'string' && HORA_RE.test(texto);
}

// "08:30" -> 510 (minutos desde la medianoche)
function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// ¿Se cruzan los intervalos [inicioA, finA) y [inicioB, finB)?
function seSolapan(inicioA, finA, inicioB, finB) {
  return aMinutos(inicioA) < aMinutos(finB) && aMinutos(inicioB) < aMinutos(finA);
}

// Fecha de hoy ("YYYY-MM-DD") en la zona horaria indicada.
function hoy(zonaHoraria, ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

module.exports = { fechaValida, horaValida, aMinutos, seSolapan, hoy };
