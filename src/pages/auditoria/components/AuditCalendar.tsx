import React, { useState } from "react";
import Swal from "sweetalert2";
import type { Auditoria } from "../AuditoriaPage";
import "./AuditCalendar.css";

interface AuditCalendarProps {
  auditorias: Auditoria[];
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function getDaysBetween(start: Date, days: number): Date[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function fmt(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${d.getFullYear()}`;
}

function fechaFin(fechaInicio: string, duracionDias: number): string {
  const end = new Date(fechaInicio + "T00:00:00");
  end.setDate(end.getDate() + duracionDias - 1);
  return `${end.getDate().toString().padStart(2, "0")}/${(end.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${end.getFullYear()}`;
}

const STATUS_COLOR: Record<string, string> = {
  "Planificada":  "#64748b",
  "En Ejecución": "#e08a00",
  "Cerrada":      "#1a9c5b",
};

const STATUS_BG: Record<string, string> = {
  "Planificada":  "#f1f5f9",
  "En Ejecución": "#fef9ec",
  "Cerrada":      "#f0fdf6",
};

function showAuditDetail(aud: Auditoria) {
  const color      = STATUS_COLOR[aud.estado] ?? "#64748b";
  const bgColor    = STATUS_BG[aud.estado]   ?? "#f8fafc";
  const hallBadge  = aud.hallazgos > 0
    ? `<span style="background:#fee2e2;color:#d93025;padding:2px 10px;border-radius:999px;font-size:0.8rem;font-weight:700">${aud.hallazgos} hallazgo${aud.hallazgos !== 1 ? "s" : ""}</span>`
    : `<span style="background:#e2e8f0;color:#64748b;padding:2px 10px;border-radius:999px;font-size:0.8rem;">Sin hallazgos</span>`;

  Swal.fire({
    html: `
      <div style="text-align:left;font-family:inherit">
        <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1.1rem">
          <span style="background:${color};color:#fff;padding:3px 12px;border-radius:999px;font-size:0.78rem;font-weight:700;letter-spacing:0.04em">${aud.estado}</span>
          <span style="font-size:1rem;font-weight:800;color:#1a2b45">${aud.codigo}</span>
        </div>

        <div style="background:${bgColor};border:1px solid #e2e8f0;border-radius:0.5rem;padding:1rem;display:grid;grid-template-columns:1fr 1fr;gap:0.85rem">
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Proceso</div>
            <div style="font-size:0.88rem;font-weight:600;color:#1a2b45">${aud.proceso}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Auditor Líder</div>
            <div style="font-size:0.88rem;font-weight:600;color:#1a2b45">${aud.auditor}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Fecha Inicio</div>
            <div style="font-size:0.88rem;font-weight:600;color:#1a2b45">${fmt(aud.fechaInicio)}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Fecha Fin</div>
            <div style="font-size:0.88rem;font-weight:600;color:#1a2b45">${fechaFin(aud.fechaInicio, aud.duracionDias)}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Duración</div>
            <div style="font-size:0.88rem;font-weight:600;color:#1a2b45">${aud.duracionDias} día${aud.duracionDias !== 1 ? "s" : ""}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Hallazgos</div>
            <div style="margin-top:3px">${hallBadge}</div>
          </div>
        </div>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    width: 480,
    padding: "1.5rem",
    background: "#ffffff",
    customClass: {
      popup:    "swal-audit-popup",
      closeButton: "swal-audit-close",
    },
    showClass:  { popup: "swal2-show"  },
    hideClass:  { popup: "swal2-hide"  },
  });
}

const AuditCalendar: React.FC<AuditCalendarProps> = ({ auditorias }) => {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear,  setCurrentYear]  = useState(now.getFullYear());

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const startingDay     = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth     = new Date(currentYear, currentMonth + 1, 0).getDate();

  // day → list of audits active that day
  const auditsByDay = new Map<number, { audit: Auditoria; isStart: boolean; isEnd: boolean }[]>();
  auditorias.forEach(aud => {
    const start = new Date(aud.fechaInicio + "T00:00:00");
    getDaysBetween(start, aud.duracionDias).forEach((date, idx) => {
      if (date.getFullYear() === currentYear && date.getMonth() === currentMonth) {
        const d = date.getDate();
        if (!auditsByDay.has(d)) auditsByDay.set(d, []);
        auditsByDay.get(d)!.push({
          audit: aud,
          isStart: idx === 0,
          isEnd:   idx === aud.duracionDias - 1,
        });
      }
    });
  });

  const statusClass = (estado: string) =>
    estado === "Cerrada" ? "event--closed" :
    estado === "En Ejecución" ? "event--running" : "event--planned";

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const today = new Date();

  return (
    <div className="audit-calendar">
      {/* Navigation bar */}
      <div className="calendar-nav-bar">
        <div className="cal-nav-left">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <h4 className="cal-title">{MONTHS[currentMonth]} {currentYear}</h4>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
          <button className="cal-today-btn" onClick={() => {
            setCurrentMonth(today.getMonth());
            setCurrentYear(today.getFullYear());
          }}>Hoy</button>
        </div>
        <div className="cal-legend">
          <span className="legend-item legend-item--planned">Planificada</span>
          <span className="legend-item legend-item--running">En Ejecución</span>
          <span className="legend-item legend-item--closed">Cerrada</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="calendar-grid">
        {WEEKDAYS.map(d => (
          <div key={d} className="cal-weekday">{d}</div>
        ))}

        {Array.from({ length: startingDay }, (_, i) => (
          <div key={`e-${i}`} className="cal-day cal-day--empty" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day     = i + 1;
          const entries = auditsByDay.get(day) ?? [];
          const isToday =
            today.getDate() === day &&
            today.getMonth() === currentMonth &&
            today.getFullYear() === currentYear;

          return (
            <div
              key={day}
              className={`cal-day ${isToday ? "cal-day--today" : ""} ${entries.length ? "cal-day--has-events" : ""}`}
            >
              <span className={`cal-day__num ${isToday ? "cal-day__num--today" : ""}`}>{day}</span>
              <div className="cal-day__events">
                {entries.map(({ audit, isStart, isEnd }) => (
                  <button
                    key={audit.codigo + day}
                    className={`cal-event ${statusClass(audit.estado)} ${isStart ? "is-start" : ""} ${isEnd ? "is-end" : ""}`}
                    title={`${audit.codigo}: ${audit.proceso}`}
                    onClick={() => showAuditDetail(audit)}
                  >
                    {isStart ? audit.codigo : ""}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AuditCalendar;
