import React, { useState, useMemo, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Dumbbell, Plus, X, Flame, ChevronUp, ChevronDown, Pencil, Check, Trash2, Settings, Play, SkipForward } from "lucide-react";

// =====================================================================
// Constantes y datos iniciales
// =====================================================================

// Temas de color disponibles para el acento de la app
const TEMAS = {
  rojo: "#E85D3D",
  azul: "#3D8BE8",
  verde: "#3DE87E",
};

// Paleta para elegir el color de un ejercicio
const PALETA_COLORES = ["#E85D3D", "#3D8BE8", "#3DE87E", "#E8D33D", "#B23DE8", "#3DBFE8", "#FF6B9D"];

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function slug(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Categorías musculares precargadas (se pueden crear, renombrar y eliminar)
const CATEGORIAS_INICIALES = [
  "Estiramientos", "Cuádriceps", "Isquiotibial", "Pantorrilla", "Glúteo", "Dorsal", "Lumbar",
  "Trapecio", "Hombro", "Tríceps", "Pectoral", "Bíceps", "Antebrazo", "Abdomen", "Cardio",
].map((nombre) => ({ id: `cat-${slug(nombre)}`, nombre }));

// Todo lo configurable vive en un solo objeto, para poder actualizar varias
// cosas relacionadas a la vez (por ejemplo, borrar un ejercicio y quitarlo de los grupos).
const DATOS_INICIALES = {
  categorias: CATEGORIAS_INICIALES,
  ejercicios: [],
  grupos: [],
  calendario: [null, null, null, null, null, null, null], // lunes..domingo: null | "descanso" | idDeGrupo
};

const CONFIG_INICIAL = {
  sonido: true,
  sonidoPropio: null, // archivo de audio del usuario, guardado como data URL (solo en este dispositivo)
  nombreSonido: "",
  vibracion: true,
  tema: "rojo",
};

// Versión nueva de la app: empieza de cero. Se borran los datos de la versión anterior
// (claves "gymtracker:..."), conservando solo el tema de color elegido.
function limpiarDatosAnteriores() {
  try {
    const ls = window.localStorage;
    const viejas = [];
    for (let i = 0; i < ls.length; i++) {
      const clave = ls.key(i);
      if (clave && clave.startsWith("gymtracker:")) viejas.push(clave);
    }
    if (viejas.length === 0) return;
    if (ls.getItem("gymtracker2:config") === null) {
      const temaViejo = JSON.parse(ls.getItem("gymtracker:tema") || "null");
      if (temaViejo && TEMAS[temaViejo]) {
        ls.setItem("gymtracker2:config", JSON.stringify({ ...CONFIG_INICIAL, tema: temaViejo }));
      }
    }
    viejas.forEach((clave) => ls.removeItem(clave));
  } catch (error) {
    // Si localStorage no está disponible, simplemente seguimos.
  }
}
limpiarDatosAnteriores();

// Colores y estilos base (los mismos de siempre, centralizados para no repetirlos)
const C = {
  fondo: "#1C1B19",
  tarjeta: "#26241F",
  borde: "#33312D",
  texto: "#F2EFE9",
  suave: "#9A968C",
  tenue: "#6B675F",
  activo: "#3A3833",
  peligro: "#E85D3D",
  peligroBorde: "#99392F",
  peligroFondo: "#2A1D1A",
  ok: "#3DE87E",
  aviso: "#E8D33D",
};

const estiloInput = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.borde}`,
  background: C.tarjeta, color: C.texto, fontSize: 14, colorScheme: "dark",
};
const estiloEtiqueta = { fontSize: 11, color: C.suave, fontWeight: 600, display: "block", marginBottom: 6 };
const estiloTitulo = { margin: "0 0 10px", fontSize: 11, color: C.suave, fontWeight: 700, letterSpacing: "0.02em" };
const estiloTarjeta = { background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 14 };

function estiloBoton(color, deshabilitado) {
  return {
    width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
    cursor: deshabilitado ? "not-allowed" : "pointer",
    background: deshabilitado ? C.activo : color, color: deshabilitado ? C.tenue : "#1C1B19",
    fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  };
}
function estiloBotonContorno(deshabilitado) {
  return {
    width: "100%", padding: "12px 0", borderRadius: 10, border: `1.5px solid ${C.borde}`, background: "transparent",
    color: deshabilitado ? C.tenue : C.texto, fontSize: 14, fontWeight: 700,
    cursor: deshabilitado ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  };
}
function estiloIcono(color = C.tenue, deshabilitado = false) {
  return { background: "none", border: "none", cursor: deshabilitado ? "default" : "pointer", color: deshabilitado ? C.activo : color, padding: 4, display: "flex" };
}
function estiloChip(activo, color) {
  return {
    flexShrink: 0, padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    border: activo ? `1.5px solid ${color}` : `1.5px solid ${C.borde}`,
    background: activo ? `${color}22` : "transparent", color: activo ? C.texto : C.suave,
  };
}

// =====================================================================
// Utilidades
// =====================================================================

function uid(prefijo) {
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Fecha local en formato AAAA-MM-DD (no UTC, para que "hoy" sea el día real del usuario)
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatearFecha(iso, corta = false) {
  try {
    const [a, m, d] = iso.split("-").map(Number);
    const fecha = new Date(a, m - 1, d);
    return fecha.toLocaleDateString("es-CO", corta ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "short", year: "numeric" });
  } catch (error) {
    return iso;
  }
}

// Lunes = 0 ... Domingo = 6
function indiceDiaHoy() {
  return (new Date().getDay() + 6) % 7;
}

function formatearTiempo(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatearDuracionLarga(segundos) {
  if (segundos === null || segundos === undefined) return "—";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min ${String(s).padStart(2, "0")} s`;
  return `${s} s`;
}

function formatearPeso(peso) {
  if (peso === null || peso === undefined) return "Sin peso";
  return `${Number(Number(peso).toFixed(2))} kg`;
}

// Devuelve el tiempo configurado si es razonable (mínimo 5 s); si no, el valor por defecto
function tiempoValido(valor, porDefecto) {
  return typeof valor === "number" && valor >= 5 ? valor : porDefecto;
}

// =====================================================================
// Hooks
// =====================================================================

// Igual que useState, pero guarda el valor en localStorage y lo recupera al arrancar.
function useEstadoPersistente(clave, valorInicial) {
  const [valor, setValor] = useState(() => {
    try {
      const guardado = window.localStorage.getItem(clave);
      return guardado !== null ? JSON.parse(guardado) : valorInicial;
    } catch (error) {
      return valorInicial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(clave, JSON.stringify(valor));
    } catch (error) {
      // Si no se puede guardar (almacenamiento lleno o bloqueado), la app sigue funcionando.
    }
  }, [clave, valor]);

  return [valor, setValor];
}

// Scroll horizontal arrastrando con el mouse (en el celular ya funciona con el dedo)
function useDragScroll() {
  const ref = useRef(null);
  const estado = useRef({ arrastrando: false, movido: false, inicioX: 0, scrollInicio: 0 });

  const onMouseDown = (e) => {
    if (!ref.current) return;
    estado.current = { arrastrando: true, movido: false, inicioX: e.pageX, scrollInicio: ref.current.scrollLeft };
  };
  const onMouseMove = (e) => {
    if (!estado.current.arrastrando || !ref.current) return;
    const delta = e.pageX - estado.current.inicioX;
    if (Math.abs(delta) > 4) estado.current.movido = true;
    ref.current.scrollLeft = estado.current.scrollInicio - delta;
  };
  const detener = () => { estado.current.arrastrando = false; };
  const onClickCapture = (e) => {
    if (estado.current.movido) { e.preventDefault(); e.stopPropagation(); estado.current.movido = false; }
  };

  return { ref, onMouseDown, onMouseMove, onMouseUp: detener, onMouseLeave: detener, onClickCapture, style: { cursor: "grab", userSelect: "none" } };
}

// Reloj que se actualiza mientras hay un temporizador corriendo. Los temporizadores
// guardan la hora real en la que terminan, así que si la pantalla se bloquea o la app
// se pausa, al volver se recalculan correctamente.
function useAhora(activo) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return undefined;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 250);
    const alVolver = () => setAhora(Date.now());
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", alVolver); };
  }, [activo]);
  return ahora;
}

// Mantiene la pantalla encendida mientras hay una rutina en curso (si el navegador lo permite)
function useWakeLock(activo) {
  useEffect(() => {
    if (!activo || typeof navigator === "undefined" || !navigator.wakeLock) return undefined;
    let bloqueo = null;
    let cancelado = false;
    const pedir = async () => {
      try {
        bloqueo = await navigator.wakeLock.request("screen");
        if (cancelado && bloqueo) bloqueo.release().catch(() => {});
      } catch (error) {
        // El navegador puede negarlo (por ejemplo, con ahorro de batería): no pasa nada.
      }
    };
    const alVolver = () => { if (document.visibilityState === "visible") pedir(); };
    pedir();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", alVolver);
      if (bloqueo) bloqueo.release().catch(() => {});
    };
  }, [activo]);
}

// =====================================================================
// Avisos: sonido y vibración
// =====================================================================

let contextoAudio = null;
function obtenerContextoAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!contextoAudio) contextoAudio = new AC();
    if (contextoAudio.state === "suspended") contextoAudio.resume();
    return contextoAudio;
  } catch (error) {
    return null;
  }
}

function sonidoPredeterminado() {
  const ctx = obtenerContextoAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [[880, 0], [1175, 0.22]].forEach(([frecuencia, retraso]) => {
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frecuencia;
    ganancia.gain.setValueAtTime(0.0001, t0 + retraso);
    ganancia.gain.exponentialRampToValueAtTime(0.35, t0 + retraso + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t0 + retraso + 0.35);
    osc.connect(ganancia);
    ganancia.connect(ctx.destination);
    osc.start(t0 + retraso);
    osc.stop(t0 + retraso + 0.4);
  });
}

// Un solo sonido para todos los avisos (el predeterminado o el que cargó el usuario)
function alertar(config) {
  if (config.sonido) {
    if (config.sonidoPropio) {
      try {
        const audio = new Audio(config.sonidoPropio);
        audio.play().catch(() => sonidoPredeterminado());
      } catch (error) {
        sonidoPredeterminado();
      }
    } else {
      sonidoPredeterminado();
    }
  }
  if (config.vibracion && typeof navigator !== "undefined" && navigator.vibrate) {
    try { navigator.vibrate(300); } catch (error) { /* sin vibración disponible */ }
  }
}

// =====================================================================
// Componentes pequeños reutilizables
// =====================================================================

function Interruptor({ activo, onChange, color, etiqueta }) {
  return (
    <button role="switch" aria-checked={activo} aria-label={etiqueta} onClick={() => onChange(!activo)}
      style={{ width: 46, height: 26, borderRadius: 999, border: "none", background: activo ? color : C.activo, position: "relative", cursor: "pointer", padding: 0, flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: activo ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: C.texto, transition: "left 0.15s" }} />
    </button>
  );
}

// Campo numérico que acepta borrar y reescribir sin saltos raros. Solo avisa al padre
// cuando lo escrito es un número válido; al salir del campo, vuelve al último valor válido.
function CampoNumero({ valor, onCambio, min = 0, max, decimales = false, permitirVacio = false, estilo, placeholder, ariaLabel }) {
  const aTexto = (v) => (v === null || v === undefined ? "" : String(v));
  const [borrador, setBorrador] = useState(aTexto(valor));
  const enfocado = useRef(false);

  useEffect(() => {
    if (!enfocado.current) setBorrador(aTexto(valor));
  }, [valor]);

  const interpretar = (texto) => {
    const limpio = texto.trim().replace(",", ".");
    if (limpio === "") return undefined;
    const n = Number(limpio);
    if (!Number.isFinite(n)) return undefined;
    if (!decimales && !Number.isInteger(n)) return undefined;
    if (n < min) return undefined;
    if (max !== undefined && n > max) return undefined;
    return n;
  };

  return (
    <input
      type="text" inputMode={decimales ? "decimal" : "numeric"} value={borrador} placeholder={placeholder} aria-label={ariaLabel}
      onFocus={() => { enfocado.current = true; }}
      onChange={(e) => {
        setBorrador(e.target.value);
        const n = interpretar(e.target.value);
        if (n !== undefined) onCambio(n);
        else if (permitirVacio && e.target.value.trim() === "") onCambio(null);
      }}
      onBlur={() => { enfocado.current = false; setBorrador(aTexto(valor)); }}
      style={{ ...estiloInput, padding: "8px 8px", ...estilo }}
    />
  );
}

// Duración en minutos y segundos
function CampoDuracion({ segundos, onCambio, minimo = 1 }) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  const cambiar = (nuevosMin, nuevosSeg) => {
    const total = nuevosMin * 60 + nuevosSeg;
    if (total >= minimo) onCambio(total);
  };
  const estilo = { width: 52, textAlign: "center" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <CampoNumero valor={m} min={0} max={599} onCambio={(v) => cambiar(v, s)} estilo={estilo} ariaLabel="Minutos" />
      <span style={{ fontSize: 12, color: C.tenue }}>min</span>
      <CampoNumero valor={s} min={0} max={59} onCambio={(v) => cambiar(m, v)} estilo={estilo} ariaLabel="Segundos" />
      <span style={{ fontSize: 12, color: C.tenue }}>s</span>
    </div>
  );
}

// Campo de texto que guarda al salir del campo o con Enter. Rechaza vacíos y nombres repetidos.
function NombreEditable({ valor, onGuardar, existentes = [], estilo, ariaLabel }) {
  const [borrador, setBorrador] = useState(valor);
  const [error, setError] = useState("");

  useEffect(() => { setBorrador(valor); setError(""); }, [valor]);

  const confirmar = () => {
    const limpio = borrador.trim();
    if (limpio === valor) { setBorrador(valor); return; }
    if (!limpio) { setBorrador(valor); return; }
    if (existentes.some((n) => n.toLowerCase() === limpio.toLowerCase())) {
      setError("Ya existe uno con ese nombre.");
      setBorrador(valor);
      return;
    }
    onGuardar(limpio);
  };

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <input value={borrador} aria-label={ariaLabel}
        onChange={(e) => { setBorrador(e.target.value); setError(""); }}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        style={{ ...estiloInput, ...estilo }} />
      {error && <p style={{ margin: "4px 0 0", fontSize: 11, color: C.peligro }}>{error}</p>}
    </div>
  );
}

// Confirmación dentro de la propia app (los window.confirm los bloquean algunos navegadores)
function ConfirmarInline({ mensaje, textoConfirmar, onConfirmar, onCancelar }) {
  return (
    <div style={{ background: C.peligroFondo, border: `1px solid ${C.peligroBorde}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: C.texto, lineHeight: 1.45 }}>{mensaje}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onConfirmar} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: C.peligro, color: "#1C1B19", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {textoConfirmar}
        </button>
        <button onClick={onCancelar} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.borde}`, background: "transparent", color: C.suave, fontSize: 12, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function SelectorColor({ valor, onCambio }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {PALETA_COLORES.map((c) => (
        <button key={c} type="button" onClick={() => onCambio(c)} aria-label={`Color ${c}`}
          style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", padding: 0, border: valor === c ? `2px solid ${C.texto}` : "2px solid transparent" }} />
      ))}
    </div>
  );
}

// Imagen o GIF del ejercicio; si no hay o no carga (por ejemplo sin internet), muestra un recuadro de respaldo.
// "contain" escala la imagen para que se vea COMPLETA sin importar sus dimensiones (en vez de recortarla);
// el fondo blanco hace que las franjas laterales se mezclen con el fondo blanco de las ilustraciones.
function ImagenEjercicio({ src, nombre, color, alto = 200 }) {
  const [fallo, setFallo] = useState(false);
  useEffect(() => { setFallo(false); }, [src]);
  if (src && !fallo) {
    return (
      <img src={src} alt={nombre} loading="lazy" onError={() => setFallo(true)}
        style={{ width: "100%", height: alto, borderRadius: 12, objectFit: "contain", background: "#FFFFFF", border: `1px solid ${color}55`, display: "block" }} />
    );
  }
  return (
    <div style={{ width: "100%", height: alto, borderRadius: 12, background: `linear-gradient(135deg, ${color}33, ${C.tarjeta})`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${color}55` }}>
      <Flame size={30} color={color} />
      <span style={{ marginLeft: 8, fontSize: 12, color: C.suave }}>Sin imagen</span>
    </div>
  );
}

// =====================================================================
// Lógica (sin interfaz): objetivos, pesos y ejecución de la rutina
// =====================================================================

// --- Objetivos por categoría de un grupo ---
// Cada entrada cuenta UNA vez, para la categoría que se eligió al agregarla.
function contarObjetivos(grupo, categorias) {
  const cuentas = {};
  grupo.entradas.forEach((en) => {
    const clave = en.categoriaId || "__sin";
    cuentas[clave] = (cuentas[clave] || 0) + 1;
  });
  const objetivos = grupo.objetivos || {};

  const describir = (objetivo, cuenta) => {
    if (objetivo === undefined) return { estado: "Sin objetivo", tono: "neutro" };
    const dif = objetivo - cuenta;
    if (dif > 0) return { estado: `Falta ${dif}`, tono: "falta" };
    if (dif === 0) return { estado: "Completo", tono: "ok" };
    return { estado: `Te excediste en ${-dif}`, tono: "exceso" };
  };

  const filas = categorias
    .filter((c) => objetivos[c.id] !== undefined || cuentas[c.id] > 0)
    .map((c) => {
      const cuenta = cuentas[c.id] || 0;
      return { categoriaId: c.id, nombre: c.nombre, objetivo: objetivos[c.id], cuenta, ...describir(objetivos[c.id], cuenta) };
    });
  if (cuentas.__sin > 0) {
    filas.push({ categoriaId: "__sin", nombre: "Sin categoría", objetivo: undefined, cuenta: cuentas.__sin, ...describir(undefined, 0) });
  }
  return filas;
}

// --- Historial de pesos de un ejercicio ---
function ordenarPesos(pesos) {
  return [...(pesos || [])].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

// El peso actual es la entrada más reciente del historial
function pesoActual(ejercicio) {
  const pesos = ordenarPesos(ejercicio.pesos);
  return pesos.length ? pesos[pesos.length - 1].peso : null;
}

// Un cambio de peso agrega una entrada con su fecha; si ya había una ese día, la reemplaza
function registrarPeso(pesos, peso, fecha) {
  return ordenarPesos([...(pesos || []).filter((p) => p.fecha !== fecha), { id: uid("peso"), fecha, peso }]);
}

// Corregir una entrada (peso y/o fecha). Si la nueva fecha coincide con otra entrada, esa otra se reemplaza.
function editarEntradaPeso(pesos, id, peso, fecha) {
  return ordenarPesos(
    (pesos || []).filter((p) => p.id === id || p.fecha !== fecha).map((p) => (p.id === id ? { ...p, peso, fecha } : p))
  );
}

// --- Ejecución de la rutina ---
// Fases: "espera" | "descanso_series" | "descanso_ejercicios" | "tiempo" | "fin_listo" | "terminada"

function marcarResultado(resultados, indice, estado) {
  return resultados.map((r, i) => (i === indice ? estado : r));
}

// Toma una "foto" del grupo y de los pesos en el momento de comenzar: si luego editas
// el grupo o cambias un peso, la rutina en curso no se altera.
function crearRutina(grupo, ejercicios, ahora, hoy) {
  const pasos = grupo.entradas
    .map((en) => {
      const ej = ejercicios.find((e) => e.id === en.ejercicioId);
      if (!ej) return null;
      return {
        entradaId: en.id, ejercicioId: ej.id, nombre: ej.nombre, tipo: ej.tipo, imagen: ej.imagen || null, color: ej.color,
        peso: ej.tipo === "fuerza" ? pesoActual(ej) : null,
        series: Math.max(1, en.series || 3), repeticiones: Math.max(1, en.repeticiones || 10),
        duracion: Math.max(1, en.duracion || 60), detalle: en.detalle || "",
      };
    })
    .filter(Boolean);
  return {
    grupoId: grupo.id, grupoNombre: grupo.nombre, fechaInicio: hoy, inicioMs: ahora, otroDia: false,
    pasos,
    descansoSeries: tiempoValido(grupo.descansoSeries, 60),
    descansoEjercicios: tiempoValido(grupo.descansoEjercicios, 90),
    indice: 0, serie: 1, fase: "espera", finMs: null, duracionFase: 0,
    resultados: pasos.map(() => null),
  };
}

function esUltimoPaso(r) {
  return r.indice === r.pasos.length - 1;
}

// ¿El botón principal debe decir "Finalizar"? (última serie del último ejercicio de fuerza, o último ejercicio por tiempo ya terminado)
function esAccionFinalizar(r) {
  if (r.fase === "fin_listo") return true;
  const p = r.pasos[r.indice];
  return r.fase === "espera" && p.tipo === "fuerza" && esUltimoPaso(r) && r.serie >= p.series;
}

function segundosRestantes(r, ahora) {
  return r.finMs ? Math.max(0, Math.ceil((r.finMs - ahora) / 1000)) : 0;
}

function completados(r) {
  return r.resultados.filter((x) => x === "completado").length;
}

function iniciarDescanso(r, fase, segundos, ahora, resultados) {
  return { ...r, resultados: resultados || r.resultados, fase, finMs: ahora + segundos * 1000, duracionFase: segundos };
}

// Botón principal: "Iniciar" (o "Finalizar")
function accionPrincipal(r, ahora) {
  if (r.fase === "fin_listo") return { ...r, fase: "terminada", finMs: null };
  if (r.fase !== "espera") return r;
  const p = r.pasos[r.indice];

  // Ejercicio por tiempo: Iniciar arranca el conteo de su duración
  if (p.tipo === "tiempo") return iniciarDescanso(r, "tiempo", p.duracion, ahora);

  // Fuerza: Iniciar significa "terminé esta serie"
  if (r.serie < p.series) return iniciarDescanso(r, "descanso_series", r.descansoSeries, ahora);

  // Última serie del ejercicio: queda completado
  const resultados = marcarResultado(r.resultados, r.indice, "completado");
  if (esUltimoPaso(r)) return { ...r, resultados, fase: "terminada", finMs: null };
  return iniciarDescanso(r, "descanso_ejercicios", r.descansoEjercicios, ahora, resultados);
}

// Se llama cuando el temporizador en curso llega a 0
function alTerminarTemporizador(r, ahora) {
  if (r.fase === "descanso_series") return { ...r, serie: r.serie + 1, fase: "espera", finMs: null };
  if (r.fase === "descanso_ejercicios") return { ...r, indice: r.indice + 1, serie: 1, fase: "espera", finMs: null };
  if (r.fase === "tiempo") {
    const resultados = marcarResultado(r.resultados, r.indice, "completado");
    if (esUltimoPaso(r)) return { ...r, resultados, fase: "fin_listo", finMs: null };
    return iniciarDescanso(r, "descanso_ejercicios", r.descansoEjercicios, ahora, resultados);
  }
  return r;
}

// "Siguiente ejercicio": si el ejercicio ya está completado (estás en el descanso entre ejercicios), salta el descanso sin preguntar
function necesitaConfirmarSiguiente(r) {
  return r.fase !== "descanso_ejercicios";
}

function accionSiguiente(r) {
  if (esUltimoPaso(r)) return r;
  const resultados = r.fase === "descanso_ejercicios" ? r.resultados : marcarResultado(r.resultados, r.indice, "omitido");
  return { ...r, resultados, indice: r.indice + 1, serie: 1, fase: "espera", finMs: null };
}

// Sesión que se guarda: una línea por entrada del grupo; lo que no se completó queda "omitido"
function construirSesion(r, ahora) {
  return {
    id: uid("ses"),
    fecha: r.fechaInicio,
    grupoNombre: r.grupoNombre,
    duracion: r.otroDia ? null : Math.max(0, Math.round((ahora - r.inicioMs) / 1000)),
    items: r.pasos.map((p, i) => ({
      nombre: p.nombre, tipo: p.tipo, peso: p.tipo === "fuerza" ? p.peso : null,
      estado: r.resultados[i] === "completado" ? "completado" : "omitido",
    })),
  };
}

// --- Copia de seguridad (exportar / importar) ---
// La copia incluye ejercicios, categorías, grupos, calendario, pesos y sesiones.
// No incluye sonido, vibración ni tema (son del dispositivo) ni la rutina en curso.
const VERSION_COPIA = 1;

function construirCopia(datos, sesiones) {
  return {
    app: "gymtracker",
    version: VERSION_COPIA,
    exportadoEn: new Date().toISOString(),
    datos: { categorias: datos.categorias, ejercicios: datos.ejercicios, grupos: datos.grupos, calendario: datos.calendario },
    sesiones,
  };
}

// Lee el texto de un archivo de copia. Si es válido, devuelve los datos ya "limpios":
// se descartan referencias rotas (una entrada de grupo cuyo ejercicio no existe, un día del
// calendario que apunta a un grupo inexistente, etc.) para que la app nunca quede en un estado inconsistente.
function validarCopia(texto) {
  let obj;
  try {
    obj = JSON.parse(texto);
  } catch (error) {
    return { ok: false, error: "El archivo no se pudo leer como una copia de esta app." };
  }
  if (!obj || obj.app !== "gymtracker" || typeof obj.version !== "number") {
    return { ok: false, error: "Este archivo no es una copia de esta app." };
  }
  if (obj.version > VERSION_COPIA) {
    return { ok: false, error: "La copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo." };
  }
  const d = obj.datos;
  if (!d || !Array.isArray(d.categorias) || !Array.isArray(d.ejercicios) || !Array.isArray(d.grupos) || !Array.isArray(d.calendario) || !Array.isArray(obj.sesiones)) {
    return { ok: false, error: "La copia está incompleta o dañada." };
  }

  const esTexto = (v) => typeof v === "string" && v.trim() !== "";
  const categorias = d.categorias.filter((c) => c && esTexto(c.id) && esTexto(c.nombre)).map((c) => ({ id: c.id, nombre: c.nombre }));
  const idsCategorias = new Set(categorias.map((c) => c.id));

  const ejercicios = d.ejercicios.filter((e) => e && esTexto(e.id) && esTexto(e.nombre)).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    tipo: e.tipo === "tiempo" ? "tiempo" : "fuerza",
    categoriaId: idsCategorias.has(e.categoriaId) ? e.categoriaId : null,
    imagen: esTexto(e.imagen) ? e.imagen : null,
    color: esTexto(e.color) ? e.color : PALETA_COLORES[0],
    pesos: (Array.isArray(e.pesos) ? e.pesos : [])
      .filter((p) => p && esTexto(p.fecha) && Number.isFinite(p.peso))
      .map((p) => ({ id: esTexto(p.id) ? p.id : uid("peso"), fecha: p.fecha, peso: p.peso })),
  }));
  const idsEjercicios = new Set(ejercicios.map((e) => e.id));

  const entero = (v, minimo, porDefecto) => (Number.isInteger(v) && v >= minimo ? v : porDefecto);
  const grupos = d.grupos.filter((g) => g && esTexto(g.id) && esTexto(g.nombre)).map((g) => ({
    id: g.id,
    nombre: g.nombre,
    descansoSeries: tiempoValido(g.descansoSeries, 60),
    descansoEjercicios: tiempoValido(g.descansoEjercicios, 90),
    objetivos: Object.fromEntries(
      Object.entries(g.objetivos && typeof g.objetivos === "object" ? g.objetivos : {}).filter(([k, v]) => idsCategorias.has(k) && Number.isInteger(v) && v >= 0)
    ),
    entradas: (Array.isArray(g.entradas) ? g.entradas : []).filter((en) => en && idsEjercicios.has(en.ejercicioId)).map((en) => ({
      id: esTexto(en.id) ? en.id : uid("ent"),
      ejercicioId: en.ejercicioId,
      categoriaId: idsCategorias.has(en.categoriaId) ? en.categoriaId : null,
      series: entero(en.series, 1, 3),
      repeticiones: entero(en.repeticiones, 1, 10),
      duracion: entero(en.duracion, 1, 60),
      detalle: typeof en.detalle === "string" ? en.detalle : "",
    })),
  }));
  const idsGrupos = new Set(grupos.map((g) => g.id));

  const calendario = Array.from({ length: 7 }, (_, i) => {
    const v = d.calendario[i];
    return v === "descanso" ? "descanso" : idsGrupos.has(v) ? v : null;
  });

  const sesiones = obj.sesiones.filter((s) => s && esTexto(s.id) && esTexto(s.fecha) && Array.isArray(s.items)).map((s) => ({
    id: s.id,
    fecha: s.fecha,
    grupoNombre: typeof s.grupoNombre === "string" ? s.grupoNombre : "",
    duracion: Number.isFinite(s.duracion) ? s.duracion : null,
    items: s.items.filter((it) => it && esTexto(it.nombre)).map((it) => ({
      nombre: it.nombre,
      tipo: it.tipo === "tiempo" ? "tiempo" : "fuerza",
      peso: Number.isFinite(it.peso) ? it.peso : null,
      estado: it.estado === "completado" ? "completado" : "omitido",
    })),
  }));

  return { ok: true, datos: { categorias, ejercicios, grupos, calendario }, sesiones, exportadoEn: typeof obj.exportadoEn === "string" ? obj.exportadoEn : "" };
}

function fechaDeCopia(iso) {
  try {
    const f = new Date(iso);
    if (Number.isNaN(f.getTime())) return "";
    return f.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  } catch (error) {
    return "";
  }
}

// =====================================================================
// Pestaña Rutina: elegir un grupo y ejecutar el entrenamiento
// =====================================================================

function Dato({ etiqueta, valor }) {
  return (
    <div style={{ flex: 1, background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "10px 6px", textAlign: "center", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: C.suave, fontWeight: 600 }}>{etiqueta}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, overflowWrap: "anywhere" }}>{valor}</div>
    </div>
  );
}

function ResumenSesion({ sesion }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sesion.items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "9px 12px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: it.estado === "completado" ? C.ok : C.tenue }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: it.estado === "completado" ? C.texto : C.suave }}>{it.nombre}</span>
          {it.tipo === "fuerza" && <span style={{ fontSize: 12, color: C.tenue }}>{formatearPeso(it.peso)}</span>}
          <span style={{ fontSize: 11, fontWeight: 600, color: it.estado === "completado" ? C.ok : C.tenue }}>
            {it.estado === "completado" ? "Completado" : "Omitido"}
          </span>
        </div>
      ))}
    </div>
  );
}

// La rutina en curso vive en GymTracker (y se guarda en el dispositivo), así que sobrevive
// a cambiar de pestaña y a cerrar la app. Este componente nunca se desmonta: solo se oculta,
// para que los temporizadores y avisos sigan funcionando mientras estás en otra pestaña.
function Rutina({ datos, rutina, setRutina, config, setSesiones, visible }) {
  const { grupos, ejercicios } = datos;
  const [grupoId, setGrupoId] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // null | "siguiente" | "terminar" | "salir"
  const [resumen, setResumen] = useState(null);
  const [decisionPendiente, setDecisionPendiente] = useState(
    () => !!rutina && rutina.fechaInicio !== hoyISO() && !rutina.otroDia
  );
  const scrollGrupos = useDragScroll();
  const procesadoRef = useRef("");
  const ahora = useAhora(!!(rutina && rutina.finMs));
  useWakeLock(!!rutina);

  const grupoSel = grupos.find((g) => g.id === grupoId) || grupos[0] || null;

  // Cierra la rutina: guarda la sesión (si se completó algo) y muestra el resumen
  const finalizar = (r) => {
    const ahoraMs = Date.now();
    if (completados(r) > 0) {
      const sesion = construirSesion(r, ahoraMs);
      setSesiones((prev) => [sesion, ...prev]);
      setResumen(sesion);
    } else {
      setResumen(null);
    }
    setRutina(null);
    setConfirmar(null);
  };

  const aplicar = (nueva) => {
    if (nueva.fase === "terminada") finalizar(nueva);
    else setRutina(nueva);
  };

  // Cuando un temporizador llega a 0: avisa (si acaba de ocurrir) y avanza.
  // Si terminó mientras la app estaba cerrada, avanza en silencio y los siguientes
  // temporizadores arrancan desde este momento.
  useEffect(() => {
    if (!rutina || !rutina.finMs || decisionPendiente) return;
    if (ahora < rutina.finMs) return;
    const clave = `${rutina.indice}|${rutina.serie}|${rutina.fase}|${rutina.finMs}`;
    if (procesadoRef.current === clave) return;
    procesadoRef.current = clave;
    if (ahora - rutina.finMs < 3000) alertar(config);
    setRutina(alTerminarTemporizador(rutina, ahora));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahora, rutina, decisionPendiente]);

  // Al cambiar de ejercicio, serie o fase se cierra cualquier confirmación abierta
  const indiceActual = rutina ? rutina.indice : -1;
  const serieActual = rutina ? rutina.serie : -1;
  const faseActual = rutina ? rutina.fase : "";
  useEffect(() => { setConfirmar(null); }, [indiceActual, serieActual, faseActual]);

  const comenzar = () => {
    if (!grupoSel) return;
    obtenerContextoAudio(); // desbloquea el sonido con este toque del usuario
    setResumen(null);
    setRutina(crearRutina(grupoSel, ejercicios, Date.now(), hoyISO()));
  };

  const pulsarPrincipal = () => {
    obtenerContextoAudio();
    aplicar(accionPrincipal(rutina, Date.now()));
  };

  const pulsarSiguiente = () => {
    if (necesitaConfirmarSiguiente(rutina)) setConfirmar("siguiente");
    else aplicar(accionSiguiente(rutina));
  };

  const contenedor = (hijos) => <div style={{ display: visible ? "block" : "none" }}>{hijos}</div>;

  // ---- 1. Resumen final: "Rutina completada" ----
  if (resumen) {
    return contenedor(
      <div>
        <div style={{ textAlign: "center", margin: "8px 0 20px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${C.ok}22`, border: `1.5px solid ${C.ok}`, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={28} color={C.ok} />
          </div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Rutina completada</h2>
          <p style={{ margin: 0, fontSize: 13, color: C.suave }}>
            {resumen.grupoNombre} · {formatearFecha(resumen.fecha)} · Duración {formatearDuracionLarga(resumen.duracion)}
          </p>
        </div>
        <ResumenSesion sesion={resumen} />
        <div style={{ marginTop: 20 }}>
          <button onClick={() => setResumen(null)} style={estiloBoton(TEMAS[config.tema] || TEMAS.rojo, false)}>Volver</button>
        </div>
      </div>
    );
  }

  // ---- 2. Rutina de otro día sin terminar: ¿continuar o descartar? ----
  if (rutina && decisionPendiente) {
    return contenedor(
      <div style={estiloTarjeta}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700 }}>Tienes una rutina sin terminar</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: C.suave, lineHeight: 1.45 }}>
          "{rutina.grupoNombre}", empezada el {formatearFecha(rutina.fechaInicio)}. Si continúas, la sesión se guardará sin duración total.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setRutina({ ...rutina, otroDia: true }); setDecisionPendiente(false); }} style={estiloBoton(TEMAS[config.tema] || TEMAS.rojo, false)}>Continuar</button>
          <button onClick={() => { setRutina(null); setDecisionPendiente(false); }} style={estiloBotonContorno(false)}>Descartar</button>
        </div>
      </div>
    );
  }

  // ---- 3. Rutina en curso ----
  if (rutina) {
    const p = rutina.pasos[rutina.indice];
    const esUltimo = esUltimoPaso(rutina);
    const corriendo = !!rutina.finMs;
    const restante = segundosRestantes(rutina, ahora);
    const finalizarAhora = esAccionFinalizar(rutina);
    const puedePrincipal = rutina.fase === "espera" || rutina.fase === "fin_listo";
    const mostrarAnillo = corriendo || rutina.fase === "fin_listo" || (rutina.fase === "espera" && p.tipo === "tiempo");

    let tiempoAnillo = p.duracion;
    let progreso = 0;
    let etiquetaAnillo = "Listo para empezar";
    if (corriendo) {
      tiempoAnillo = restante;
      progreso = rutina.duracionFase ? 1 - restante / rutina.duracionFase : 1;
      etiquetaAnillo = { descanso_series: "Descanso entre series", descanso_ejercicios: "Descanso entre ejercicios", tiempo: "Ejercicio en curso" }[rutina.fase];
    } else if (rutina.fase === "fin_listo") {
      tiempoAnillo = 0;
      progreso = 1;
      etiquetaAnillo = "¡Listo!";
    }
    // Durante el descanso entre ejercicios se anuncia el próximo, con su peso (o su duración si es por tiempo)
    const proximo = rutina.fase === "descanso_ejercicios" && !esUltimo ? rutina.pasos[rutina.indice + 1] : null;
    const sigue = proximo
      ? `Sigue: ${proximo.nombre} · ${proximo.tipo === "fuerza" ? formatearPeso(proximo.peso) : formatearTiempo(proximo.duracion)}`
      : rutina.fase === "descanso_series" ? `Próxima: serie ${rutina.serie + 1} de ${p.series}` : "";
    const circunferencia = 2 * Math.PI * 60;
    const completadosAhora = completados(rutina);

    return contenedor(
      <div>
        <p style={{ fontSize: 12, color: C.suave, margin: "0 0 6px" }}>Ejercicio {rutina.indice + 1} de {rutina.pasos.length} · {rutina.grupoNombre}</p>
        <h2 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 700 }}>{p.nombre}</h2>

        <div style={{ marginBottom: 14 }}>
          <ImagenEjercicio src={p.imagen} nombre={p.nombre} color={p.color} />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {p.tipo === "fuerza" ? (
            <>
              <Dato etiqueta="Peso" valor={formatearPeso(p.peso)} />
              <Dato etiqueta="Repeticiones" valor={`x${p.repeticiones}`} />
              <Dato etiqueta="Serie" valor={`${rutina.serie} de ${p.series}`} />
            </>
          ) : (
            <>
              <Dato etiqueta="Duración" valor={formatearTiempo(p.duracion)} />
              {p.detalle && <Dato etiqueta="Detalle" valor={p.detalle} />}
            </>
          )}
        </div>

        {mostrarAnillo ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto 8px" }}>
              <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="70" cy="70" r="60" fill="none" stroke={C.tarjeta} strokeWidth="10" />
                <circle cx="70" cy="70" r="60" fill="none" stroke={p.color} strokeWidth="10"
                  strokeDasharray={circunferencia} strokeDashoffset={circunferencia * (1 - progreso)}
                  strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.25s linear" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatearTiempo(tiempoAnillo)}</span>
              </div>
            </div>
            <p style={{ textAlign: "center", fontSize: 13, color: C.suave, margin: 0 }}>{etiquetaAnillo}</p>
            {sigue && <p style={{ textAlign: "center", fontSize: proximo ? 14 : 12, fontWeight: proximo ? 600 : 400, color: proximo ? C.texto : C.tenue, margin: "6px 0 0" }}>{sigue}</p>}
          </div>
        ) : (
          <div style={{ ...estiloTarjeta, textAlign: "center", marginBottom: 16, padding: "18px 12px" }}>
            <p style={{ margin: 0, fontSize: 14 }}>
              Haz la serie {rutina.serie} y pulsa <b>{finalizarAhora ? "Finalizar" : "Iniciar"}</b> al terminar.
            </p>
            {!finalizarAhora && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: C.tenue }}>
                Empezará el descanso {rutina.serie < p.series ? "entre series" : "entre ejercicios"} ({formatearTiempo(rutina.serie < p.series ? rutina.descansoSeries : rutina.descansoEjercicios)}).
              </p>
            )}
          </div>
        )}

        {confirmar === "siguiente" && (
          <ConfirmarInline
            mensaje={`¿Omitir "${p.nombre}"? Quedará guardado como Omitido.`} textoConfirmar="Sí, omitir"
            onConfirmar={() => aplicar(accionSiguiente(rutina))} onCancelar={() => setConfirmar(null)} />
        )}
        {confirmar === "terminar" && (
          <ConfirmarInline
            mensaje={completadosAhora > 0
              ? "¿Terminar ahora? Se guardará lo que hiciste y lo pendiente quedará como Omitido."
              : "¿Terminar ahora? Todavía no completaste ningún ejercicio, así que la sesión no se guardará."}
            textoConfirmar="Sí, terminar" onConfirmar={() => finalizar(rutina)} onCancelar={() => setConfirmar(null)} />
        )}
        {confirmar === "salir" && (
          <ConfirmarInline
            mensaje="¿Salir de la rutina? Se descartará sin guardar nada." textoConfirmar="Sí, salir"
            onConfirmar={() => { setRutina(null); setConfirmar(null); }} onCancelar={() => setConfirmar(null)} />
        )}

        <div style={{ marginBottom: 10 }}>
          <button onClick={pulsarPrincipal} disabled={!puedePrincipal} style={estiloBoton(p.color, !puedePrincipal)}>
            {finalizarAhora ? <Check size={16} strokeWidth={2.5} /> : <Play size={16} strokeWidth={2.5} />}
            {finalizarAhora ? "Finalizar" : "Iniciar"}
          </button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <button onClick={pulsarSiguiente} disabled={esUltimo} style={estiloBotonContorno(esUltimo)}>
            Siguiente ejercicio <SkipForward size={16} />
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 22 }}>
          <button onClick={() => setConfirmar("terminar")} style={{ background: "none", border: "none", color: C.suave, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Terminar ahora</button>
          <button onClick={() => setConfirmar("salir")} style={{ background: "none", border: "none", color: C.tenue, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Salir de la rutina</button>
        </div>
      </div>
    );
  }

  // ---- 4. Sin rutina: elegir el grupo ----
  const entradasValidas = grupoSel ? grupoSel.entradas.filter((en) => ejercicios.some((e) => e.id === en.ejercicioId)) : [];
  return contenedor(
    <div>
      <p style={estiloTitulo}>GRUPO DE ENTRENAMIENTO</p>
      {grupos.length === 0 ? (
        <p style={{ textAlign: "center", color: C.tenue, fontSize: 13, padding: "30px 0", lineHeight: 1.5 }}>
          Todavía no tienes grupos. Créalos en la pestaña Grupos, con los ejercicios de la pestaña Ejercicios.
        </p>
      ) : (
        <>
          <div ref={scrollGrupos.ref} onMouseDown={scrollGrupos.onMouseDown} onMouseMove={scrollGrupos.onMouseMove} onMouseUp={scrollGrupos.onMouseUp} onMouseLeave={scrollGrupos.onMouseLeave} onClickCapture={scrollGrupos.onClickCapture}
            style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16, scrollbarWidth: "none", ...scrollGrupos.style }}>
            {grupos.map((g) => (
              <button key={g.id} onClick={() => setGrupoId(g.id)} style={estiloChip(grupoSel && g.id === grupoSel.id, TEMAS[config.tema] || TEMAS.rojo)}>{g.nombre}</button>
            ))}
          </div>

          {entradasValidas.length === 0 ? (
            <p style={{ textAlign: "center", color: C.tenue, fontSize: 13, padding: "20px 0" }}>Este grupo no tiene ejercicios. Agrégalos en la pestaña Grupos.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
              {entradasValidas.map((en, i) => {
                const ej = ejercicios.find((e) => e.id === en.ejercicioId);
                const detalle = ej.tipo === "fuerza"
                  ? `${en.series} × ${en.repeticiones} · ${formatearPeso(pesoActual(ej))}`
                  : `${formatearTiempo(en.duracion)}${en.detalle ? ` · ${en.detalle}` : ""}`;
                return (
                  <div key={en.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "10px 12px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: ej.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{i + 1}. {ej.nombre}</span>
                    <span style={{ fontSize: 12, color: C.suave }}>{detalle}</span>
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={comenzar} disabled={entradasValidas.length === 0} style={estiloBoton(TEMAS[config.tema] || TEMAS.rojo, entradasValidas.length === 0)}>
            <Play size={16} strokeWidth={2.5} /> Comenzar
          </button>
        </>
      )}
    </div>
  );
}

// =====================================================================
// Pestaña Grupos: la semana y la configuración de cada grupo de entrenamiento
// =====================================================================

const COLOR_TONO = { falta: C.aviso, ok: C.ok, exceso: C.peligro, neutro: C.tenue };

function Grupos({ datos, setDatos, grupoEditId, setGrupoEditId, colorAcento }) {
  const { grupos, ejercicios, categorias, calendario } = datos;
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [errorNombre, setErrorNombre] = useState("");
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const scroll = useDragScroll();
  const hoy = indiceDiaHoy();

  const grupo = grupos.find((g) => g.id === grupoEditId) || grupos[0] || null;

  const actualizarGrupo = (id, fn) =>
    setDatos((d) => ({ ...d, grupos: d.grupos.map((g) => (g.id === id ? fn(g) : g)) }));

  const asignarDia = (indice, valor) =>
    setDatos((d) => ({ ...d, calendario: d.calendario.map((v, i) => (i === indice ? valor : v)) }));

  const crearGrupo = () => {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    if (grupos.some((g) => g.nombre.toLowerCase() === nombre.toLowerCase())) {
      setErrorNombre("Ya existe un grupo con ese nombre.");
      return;
    }
    const nuevo = { id: uid("grp"), nombre, descansoSeries: 60, descansoEjercicios: 90, objetivos: {}, entradas: [] };
    setDatos((d) => ({ ...d, grupos: [...d.grupos, nuevo] }));
    setGrupoEditId(nuevo.id);
    setNombreNuevo("");
    setErrorNombre("");
    setCreando(false);
  };

  // Al borrar un grupo, sus días del calendario quedan "sin asignar"; los ejercicios no se tocan
  const eliminarGrupo = () => {
    if (!grupo) return;
    const id = grupo.id;
    setDatos((d) => ({
      ...d,
      grupos: d.grupos.filter((g) => g.id !== id),
      calendario: d.calendario.map((v) => (v === id ? null : v)),
    }));
    setGrupoEditId(null);
    setConfirmarBorrado(false);
  };

  const agregarEntrada = (ej) => {
    const entrada = { id: uid("ent"), ejercicioId: ej.id, categoriaId: ej.categoriaId || null, series: 3, repeticiones: 10, duracion: 60, detalle: "" };
    actualizarGrupo(grupo.id, (g) => ({ ...g, entradas: [...g.entradas, entrada] }));
  };
  const actualizarEntrada = (entradaId, cambios) =>
    actualizarGrupo(grupo.id, (g) => ({ ...g, entradas: g.entradas.map((en) => (en.id === entradaId ? { ...en, ...cambios } : en)) }));
  const quitarEntrada = (entradaId) =>
    actualizarGrupo(grupo.id, (g) => ({ ...g, entradas: g.entradas.filter((en) => en.id !== entradaId) }));
  const moverEntrada = (indice, direccion) =>
    actualizarGrupo(grupo.id, (g) => {
      const destino = indice + direccion;
      if (destino < 0 || destino >= g.entradas.length) return g;
      const nuevas = [...g.entradas];
      [nuevas[indice], nuevas[destino]] = [nuevas[destino], nuevas[indice]];
      return { ...g, entradas: nuevas };
    });

  const fijarObjetivo = (categoriaId, cantidad) =>
    actualizarGrupo(grupo.id, (g) => ({ ...g, objetivos: { ...g.objetivos, [categoriaId]: cantidad } }));
  const quitarObjetivo = (categoriaId) =>
    actualizarGrupo(grupo.id, (g) => {
      const resto = { ...g.objetivos };
      delete resto[categoriaId];
      return { ...g, objetivos: resto };
    });

  const filasObjetivos = useMemo(() => (grupo ? contarObjetivos(grupo, categorias) : []), [grupo, categorias]);

  // Ejercicios para añadir, agrupados por categoría. Se pueden añadir varias veces el mismo.
  const paraAnadir = useMemo(() => {
    const bloques = [];
    categorias.forEach((c) => {
      const lista = ejercicios.filter((e) => e.categoriaId === c.id);
      if (lista.length) bloques.push({ nombre: c.nombre, lista });
    });
    const sinCategoria = ejercicios.filter((e) => !categorias.some((c) => c.id === e.categoriaId));
    if (sinCategoria.length) bloques.push({ nombre: "Sin categoría", lista: sinCategoria });
    return bloques;
  }, [categorias, ejercicios]);

  const categoriasSinObjetivo = grupo ? categorias.filter((c) => grupo.objetivos[c.id] === undefined) : [];

  return (
    <div>
      {/* ---- La semana ---- */}
      <p style={estiloTitulo}>SEMANA</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
        {DIAS_SEMANA.map((dia, i) => (
          <div key={dia} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px 7px 12px", borderRadius: 10, background: C.tarjeta, border: i === hoy ? `1.5px solid ${colorAcento}` : `1px solid ${C.borde}` }}>
            <span style={{ width: 92, fontSize: 13, fontWeight: i === hoy ? 700 : 600, color: i === hoy ? C.texto : C.suave }}>
              {dia}{i === hoy ? " · hoy" : ""}
            </span>
            <select aria-label={`Grupo del ${dia}`} value={calendario[i] === null || calendario[i] === undefined ? "" : calendario[i]}
              onChange={(e) => asignarDia(i, e.target.value === "" ? null : e.target.value)}
              style={{ ...estiloInput, flex: 1, padding: "7px 8px", fontSize: 13 }}>
              <option value="">Sin asignar</option>
              <option value="descanso">Descanso</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: C.tenue, margin: "0 0 26px" }}>El calendario es solo de consulta: en Rutina siempre eliges el grupo a mano.</p>

      {/* ---- Los grupos ---- */}
      <p style={estiloTitulo}>GRUPOS DE ENTRENAMIENTO</p>
      <div ref={scroll.ref} onMouseDown={scroll.onMouseDown} onMouseMove={scroll.onMouseMove} onMouseUp={scroll.onMouseUp} onMouseLeave={scroll.onMouseLeave} onClickCapture={scroll.onClickCapture}
        style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", ...scroll.style }}>
        {grupos.map((g) => (
          <button key={g.id} onClick={() => { setGrupoEditId(g.id); setConfirmarBorrado(false); }} style={estiloChip(grupo && g.id === grupo.id, colorAcento)}>{g.nombre}</button>
        ))}
        <button onClick={() => setCreando(!creando)} aria-label="Nuevo grupo"
          style={{ flexShrink: 0, width: 36, borderRadius: 999, border: `1.5px dashed ${C.borde}`, background: "transparent", color: C.suave, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={15} />
        </button>
      </div>

      {creando && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={nombreNuevo} onChange={(e) => { setNombreNuevo(e.target.value); setErrorNombre(""); }} placeholder="Ej. Pierna"
              onKeyDown={(e) => { if (e.key === "Enter") crearGrupo(); }}
              style={{ ...estiloInput, flex: 1, padding: "9px 12px", fontSize: 13 }} />
            <button onClick={crearGrupo} style={{ padding: "0 16px", borderRadius: 10, border: "none", background: colorAcento, color: "#1C1B19", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Crear</button>
          </div>
          {errorNombre && <p style={{ margin: "6px 0 0", fontSize: 11, color: C.peligro }}>{errorNombre}</p>}
        </div>
      )}

      {!grupo ? (
        <p style={{ textAlign: "center", color: C.tenue, fontSize: 13, padding: "24px 0", lineHeight: 1.5 }}>
          Aún no tienes grupos. Toca el botón + para crear el primero.
        </p>
      ) : (
        <div style={{ marginTop: 18 }}>
          {/* Nombre y borrado */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
            <NombreEditable valor={grupo.nombre} ariaLabel="Nombre del grupo"
              existentes={grupos.filter((g) => g.id !== grupo.id).map((g) => g.nombre)}
              onGuardar={(n) => actualizarGrupo(grupo.id, (g) => ({ ...g, nombre: n }))}
              estilo={{ fontWeight: 700, fontSize: 15 }} />
            <button onClick={() => setConfirmarBorrado(true)} aria-label="Eliminar grupo" style={{ ...estiloIcono(C.peligro), padding: 10 }}>
              <Trash2 size={17} />
            </button>
          </div>
          {confirmarBorrado && (
            <ConfirmarInline
              mensaje={`¿Eliminar el grupo "${grupo.nombre}"? Los días del calendario que lo usan quedarán sin asignar. Los ejercicios no se borran.`}
              textoConfirmar="Sí, eliminar" onConfirmar={eliminarGrupo} onCancelar={() => setConfirmarBorrado(false)} />
          )}

          {/* Descansos */}
          <p style={estiloTitulo}>TIEMPOS DE DESCANSO</p>
          <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <label style={estiloEtiqueta}>Entre series (seg)</label>
              <CampoNumero valor={tiempoValido(grupo.descansoSeries, 60)} min={5} max={3600} ariaLabel="Descanso entre series"
                onCambio={(v) => actualizarGrupo(grupo.id, (g) => ({ ...g, descansoSeries: v }))} estilo={{ fontSize: 16, fontWeight: 600, padding: "10px 12px" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={estiloEtiqueta}>Entre ejercicios (seg)</label>
              <CampoNumero valor={tiempoValido(grupo.descansoEjercicios, 90)} min={5} max={3600} ariaLabel="Descanso entre ejercicios"
                onCambio={(v) => actualizarGrupo(grupo.id, (g) => ({ ...g, descansoEjercicios: v }))} estilo={{ fontSize: 16, fontWeight: 600, padding: "10px 12px" }} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: C.tenue, margin: "0 0 22px" }}>Mínimo 5 segundos.</p>

          {/* Objetivos por categoría */}
          <p style={estiloTitulo}>OBJETIVOS POR CATEGORÍA</p>
          {filasObjetivos.length === 0 && (
            <p style={{ fontSize: 12, color: C.tenue, margin: "0 0 10px" }}>Sin objetivos. Añade una categoría para llevar la cuenta de cuántos ejercicios te faltan.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {filasObjetivos.map((f) => (
              <div key={f.categoriaId} style={{ background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "9px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{f.nombre}</span>
                  <span style={{ fontSize: 12, color: C.suave }}>Llevas {f.cuenta}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: COLOR_TONO[f.tono], minWidth: 92, textAlign: "right" }}>{f.estado}</span>
                </div>
                {f.objetivo !== undefined && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: C.tenue }}>Objetivo</span>
                    <button onClick={() => fijarObjetivo(f.categoriaId, Math.max(0, f.objetivo - 1))} aria-label={`Bajar objetivo de ${f.nombre}`}
                      style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.borde}`, background: "transparent", color: C.texto, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>−</button>
                    <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700, fontSize: 14 }}>{f.objetivo}</span>
                    <button onClick={() => fijarObjetivo(f.categoriaId, f.objetivo + 1)} aria-label={`Subir objetivo de ${f.nombre}`}
                      style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.borde}`, background: "transparent", color: C.texto, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>+</button>
                    <button onClick={() => quitarObjetivo(f.categoriaId)} aria-label={`Quitar objetivo de ${f.nombre}`} style={{ ...estiloIcono(), marginLeft: "auto" }}><X size={15} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {categoriasSinObjetivo.length > 0 && (
            <select aria-label="Añadir categoría al objetivo" value="" onChange={(e) => { if (e.target.value) fijarObjetivo(e.target.value, 1); }}
              style={{ ...estiloInput, fontSize: 13, marginBottom: 22 }}>
              <option value="">+ Añadir una categoría al objetivo</option>
              {categoriasSinObjetivo.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}

          {/* Orden de ejercicios */}
          <p style={estiloTitulo}>ORDEN DE EJERCICIOS</p>
          {grupo.entradas.length === 0 ? (
            <p style={{ textAlign: "center", color: C.tenue, fontSize: 13, padding: "10px 0 16px" }}>Este grupo todavía no tiene ejercicios. Añádelos desde la lista de abajo.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {grupo.entradas.map((en, i) => {
                const ej = ejercicios.find((e) => e.id === en.ejercicioId);
                if (!ej) return null;
                return (
                  <div key={en.id} style={{ background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: ej.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>{i + 1}. {ej.nombre}</span>
                      <button onClick={() => moverEntrada(i, -1)} disabled={i === 0} aria-label="Subir" style={estiloIcono(C.suave, i === 0)}><ChevronUp size={16} /></button>
                      <button onClick={() => moverEntrada(i, 1)} disabled={i === grupo.entradas.length - 1} aria-label="Bajar" style={estiloIcono(C.suave, i === grupo.entradas.length - 1)}><ChevronDown size={16} /></button>
                      <button onClick={() => quitarEntrada(en.id)} aria-label="Quitar del grupo" style={estiloIcono()}><X size={16} /></button>
                    </div>

                    {ej.tipo === "fuerza" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                        <CampoNumero valor={en.series} min={1} max={30} ariaLabel="Series" estilo={{ width: 52, textAlign: "center" }} onCambio={(v) => actualizarEntrada(en.id, { series: v })} />
                        <span style={{ fontSize: 12, color: C.tenue }}>series ×</span>
                        <CampoNumero valor={en.repeticiones} min={1} max={500} ariaLabel="Repeticiones" estilo={{ width: 52, textAlign: "center" }} onCambio={(v) => actualizarEntrada(en.id, { repeticiones: v })} />
                        <span style={{ fontSize: 12, color: C.tenue }}>reps</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: C.tenue }}>{formatearPeso(pesoActual(ej))}</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                        <CampoDuracion segundos={en.duracion} onCambio={(v) => actualizarEntrada(en.id, { duracion: v })} />
                        <input value={en.detalle || ""} onChange={(e) => actualizarEntrada(en.id, { detalle: e.target.value })} placeholder="Detalle (ej. 4 mph)" aria-label="Detalle"
                          style={{ ...estiloInput, flex: 1, minWidth: 120, padding: "8px 10px", fontSize: 13 }} />
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: C.tenue, flexShrink: 0 }}>Cuenta como</span>
                      <select aria-label="Categoría que cuenta" value={en.categoriaId || ""} onChange={(e) => actualizarEntrada(en.id, { categoriaId: e.target.value || null })}
                        style={{ ...estiloInput, padding: "6px 8px", fontSize: 12 }}>
                        <option value="">Sin categoría</option>
                        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Añadir ejercicios */}
          <p style={estiloTitulo}>AÑADIR EJERCICIOS</p>
          {paraAnadir.length === 0 ? (
            <p style={{ fontSize: 12, color: C.tenue }}>Aún no tienes ejercicios. Créalos en la pestaña Ejercicios.</p>
          ) : (
            <>
              <p style={{ fontSize: 11, color: C.tenue, margin: "0 0 10px" }}>Puedes añadir el mismo ejercicio más de una vez.</p>
              {paraAnadir.map((bloque) => (
                <div key={bloque.nombre} style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: C.tenue, margin: "0 0 6px" }}>{bloque.nombre}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {bloque.lista.map((ej) => {
                      const veces = grupo.entradas.filter((en) => en.ejercicioId === ej.id).length;
                      return (
                        <button key={ej.id} onClick={() => agregarEntrada(ej)}
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 999, border: `1px dashed ${C.borde}`, background: "transparent", color: C.suave, fontSize: 12, cursor: "pointer" }}>
                          <Plus size={12} /> {ej.nombre}{veces > 0 ? ` (${veces})` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Pestaña Ejercicios: categorías, ejercicios y su historial de pesos
// =====================================================================

// Editor de un ejercicio existente: datos básicos, peso actual e historial de pesos
function EditorEjercicio({ ej, datos, setDatos, colorAcento }) {
  const [pesoNuevo, setPesoNuevo] = useState(null);
  const [editandoPesoId, setEditandoPesoId] = useState(null);
  const [borradorPeso, setBorradorPeso] = useState(null);
  const [borradorFecha, setBorradorFecha] = useState("");
  const [confirmarPesoId, setConfirmarPesoId] = useState(null);

  const entradasEnGrupos = datos.grupos.reduce((total, g) => total + g.entradas.filter((en) => en.ejercicioId === ej.id).length, 0);
  const actualizar = (cambios) => setDatos((d) => ({ ...d, ejercicios: d.ejercicios.map((e) => (e.id === ej.id ? { ...e, ...cambios } : e)) }));
  const pesos = ordenarPesos(ej.pesos);
  const datosGrafica = pesos.map((p) => ({ fecha: formatearFecha(p.fecha, true), peso: p.peso }));

  const guardarPesoNuevo = () => {
    if (pesoNuevo === null) return;
    actualizar({ pesos: registrarPeso(ej.pesos, pesoNuevo, hoyISO()) });
    setPesoNuevo(null);
  };

  const guardarEdicion = () => {
    if (borradorPeso === null || !borradorFecha) return;
    actualizar({ pesos: editarEntradaPeso(ej.pesos, editandoPesoId, borradorPeso, borradorFecha) });
    setEditandoPesoId(null);
  };

  return (
    <div style={{ background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 10, padding: 12, marginTop: 8 }}>
      <label style={estiloEtiqueta}>Nombre</label>
      <div style={{ marginBottom: 12 }}>
        <NombreEditable valor={ej.nombre} ariaLabel="Nombre del ejercicio" onGuardar={(n) => actualizar({ nombre: n })} />
      </div>

      <label style={estiloEtiqueta}>Categoría principal</label>
      <select aria-label="Categoría principal" value={ej.categoriaId || ""} onChange={(e) => actualizar({ categoriaId: e.target.value || null })} style={{ ...estiloInput, marginBottom: 12 }}>
        <option value="">Sin categoría</option>
        {datos.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>

      <label style={estiloEtiqueta}>Tipo</label>
      <select aria-label="Tipo de ejercicio" value={ej.tipo} disabled={entradasEnGrupos > 0} onChange={(e) => actualizar({ tipo: e.target.value })}
        style={{ ...estiloInput, marginBottom: entradasEnGrupos > 0 ? 4 : 12, opacity: entradasEnGrupos > 0 ? 0.6 : 1 }}>
        <option value="fuerza">Fuerza (series, repeticiones y peso)</option>
        <option value="tiempo">Por tiempo (estiramientos, plancha, cardio)</option>
      </select>
      {entradasEnGrupos > 0 && (
        <p style={{ fontSize: 11, color: C.tenue, margin: "0 0 12px" }}>No se puede cambiar el tipo mientras el ejercicio esté en algún grupo.</p>
      )}

      <label style={estiloEtiqueta}>Imagen o GIF (ruta)</label>
      <input value={ej.imagen || ""} onChange={(e) => actualizar({ imagen: e.target.value.trim() || null })} placeholder="/ejercicios/sentadilla.webp" aria-label="Ruta de la imagen"
        style={{ ...estiloInput, marginBottom: 12 }} />

      <label style={estiloEtiqueta}>Color</label>
      <div style={{ marginBottom: ej.tipo === "fuerza" ? 16 : 4 }}>
        <SelectorColor valor={ej.color} onCambio={(c) => actualizar({ color: c })} />
      </div>

      {ej.tipo === "fuerza" && (
        <div>
          <p style={{ ...estiloTitulo, marginTop: 4 }}>PESO</p>
          <p style={{ margin: "0 0 10px", fontSize: 14 }}>
            Actual: <b>{formatearPeso(pesoActual(ej))}</b>
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <CampoNumero valor={pesoNuevo} decimales min={0} max={1000} permitirVacio placeholder="Nuevo peso (kg)" ariaLabel="Nuevo peso"
              onCambio={setPesoNuevo} estilo={{ flex: 1, padding: "10px 12px", fontSize: 14 }} />
            <button onClick={guardarPesoNuevo} disabled={pesoNuevo === null}
              style={{ padding: "0 14px", borderRadius: 10, border: "none", cursor: pesoNuevo === null ? "not-allowed" : "pointer", background: pesoNuevo === null ? C.activo : colorAcento, color: pesoNuevo === null ? C.tenue : "#1C1B19", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              Guardar peso
            </button>
          </div>

          {pesos.length >= 2 && (
            <div style={{ ...estiloTarjeta, padding: "12px 6px 4px", marginBottom: 12 }}>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={datosGrafica}>
                  <CartesianGrid stroke={C.borde} vertical={false} />
                  <XAxis dataKey="fecha" stroke={C.tenue} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={C.tenue} fontSize={11} tickLine={false} axisLine={false} width={30} />
                  <Tooltip contentStyle={{ background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="peso" stroke={ej.color} strokeWidth={2.5} dot={{ r: 3, fill: ej.color }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {pesos.length === 0 ? (
            <p style={{ fontSize: 12, color: C.tenue, margin: 0 }}>Sin peso registrado. Si es un ejercicio de peso corporal, puedes dejarlo así.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...pesos].reverse().map((p) => (
                <div key={p.id}>
                  {editandoPesoId === p.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "8px 10px", flexWrap: "wrap" }}>
                      <input type="date" value={borradorFecha} max={hoyISO()} onChange={(e) => setBorradorFecha(e.target.value)} aria-label="Fecha"
                        style={{ ...estiloInput, width: "auto", flex: 1, minWidth: 130, padding: "7px 8px", fontSize: 13 }} />
                      <CampoNumero valor={borradorPeso} decimales min={0} max={1000} ariaLabel="Peso" onCambio={setBorradorPeso} estilo={{ width: 70, textAlign: "center" }} />
                      <span style={{ fontSize: 12, color: C.tenue }}>kg</span>
                      <button onClick={guardarEdicion} aria-label="Guardar cambios" style={estiloIcono(colorAcento)}><Check size={17} /></button>
                      <button onClick={() => setEditandoPesoId(null)} aria-label="Cancelar" style={estiloIcono()}><X size={17} /></button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "8px 12px" }}>
                      <span style={{ flex: 1, fontSize: 12, color: C.suave }}>{formatearFecha(p.fecha)}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{formatearPeso(p.peso)}</span>
                      <button onClick={() => { setEditandoPesoId(p.id); setBorradorPeso(p.peso); setBorradorFecha(p.fecha); setConfirmarPesoId(null); }} aria-label="Editar entrada" style={estiloIcono()}><Pencil size={14} /></button>
                      <button onClick={() => setConfirmarPesoId(p.id)} aria-label="Borrar entrada" style={estiloIcono()}><Trash2 size={14} /></button>
                    </div>
                  )}
                  {confirmarPesoId === p.id && (
                    <div style={{ marginTop: 6 }}>
                      <ConfirmarInline mensaje={`¿Borrar el peso de ${formatearFecha(p.fecha)} (${formatearPeso(p.peso)})?`} textoConfirmar="Sí, borrar"
                        onConfirmar={() => { actualizar({ pesos: pesos.filter((x) => x.id !== p.id) }); setConfirmarPesoId(null); }} onCancelar={() => setConfirmarPesoId(null)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Ejercicios({ datos, setDatos, colorAcento }) {
  const { categorias, ejercicios, grupos } = datos;

  // Formulario de nuevo ejercicio
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("fuerza");
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [imagen, setImagen] = useState("");
  const [pesoInicial, setPesoInicial] = useState(null);
  const [color, setColor] = useState(PALETA_COLORES[0]);

  // Categorías
  const [verCategorias, setVerCategorias] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [errorCategoria, setErrorCategoria] = useState("");
  const [confirmarCatId, setConfirmarCatId] = useState(null);

  // Lista
  const [editandoId, setEditandoId] = useState(null);
  const [confirmarId, setConfirmarId] = useState(null);

  const crearEjercicio = () => {
    const n = nombre.trim();
    if (!n) return;
    const pesos = tipo === "fuerza" && pesoInicial !== null ? registrarPeso([], pesoInicial, hoyISO()) : [];
    const nuevo = { id: uid("ej"), nombre: n, tipo, categoriaId: categoriaNueva || null, imagen: imagen.trim() || null, color, pesos };
    setDatos((d) => ({ ...d, ejercicios: [...d.ejercicios, nuevo] }));
    setNombre("");
    setImagen("");
    setPesoInicial(null);
    setCategoriaNueva("");
    setColor(PALETA_COLORES[0]);
  };

  // Al borrar un ejercicio se quitan todas sus entradas de los grupos. Las sesiones guardadas no cambian.
  const eliminarEjercicio = (id) => {
    setDatos((d) => ({
      ...d,
      ejercicios: d.ejercicios.filter((e) => e.id !== id),
      grupos: d.grupos.map((g) => ({ ...g, entradas: g.entradas.filter((en) => en.ejercicioId !== id) })),
    }));
    setConfirmarId(null);
    if (editandoId === id) setEditandoId(null);
  };

  const crearCategoria = () => {
    const n = nuevaCategoria.trim();
    if (!n) return;
    if (categorias.some((c) => c.nombre.toLowerCase() === n.toLowerCase())) {
      setErrorCategoria("Ya existe una categoría con ese nombre.");
      return;
    }
    setDatos((d) => ({ ...d, categorias: [...d.categorias, { id: uid("cat"), nombre: n }] }));
    setNuevaCategoria("");
    setErrorCategoria("");
  };

  const renombrarCategoria = (id, n) =>
    setDatos((d) => ({ ...d, categorias: d.categorias.map((c) => (c.id === id ? { ...c, nombre: n } : c)) }));

  // Al borrar una categoría, sus ejercicios quedan "Sin categoría" y se quitan sus objetivos
  const eliminarCategoria = (id) => {
    setDatos((d) => ({
      ...d,
      categorias: d.categorias.filter((c) => c.id !== id),
      ejercicios: d.ejercicios.map((e) => (e.categoriaId === id ? { ...e, categoriaId: null } : e)),
      grupos: d.grupos.map((g) => {
        const objetivos = { ...g.objetivos };
        delete objetivos[id];
        return { ...g, objetivos, entradas: g.entradas.map((en) => (en.categoriaId === id ? { ...en, categoriaId: null } : en)) };
      }),
    }));
    setConfirmarCatId(null);
  };

  const bloques = useMemo(() => {
    const lista = categorias.map((c) => ({ nombre: c.nombre, items: ejercicios.filter((e) => e.categoriaId === c.id) })).filter((b) => b.items.length);
    const sin = ejercicios.filter((e) => !categorias.some((c) => c.id === e.categoriaId));
    if (sin.length) lista.push({ nombre: "Sin categoría", items: sin });
    return lista;
  }, [categorias, ejercicios]);

  const gruposQueUsan = (id) => grupos.filter((g) => g.entradas.some((en) => en.ejercicioId === id)).length;

  return (
    <div>
      {/* ---- Categorías ---- */}
      <button onClick={() => setVerCategorias(!verCategorias)} aria-expanded={verCategorias}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 12, padding: "12px 14px", color: C.texto, cursor: "pointer", marginBottom: verCategorias ? 10 : 24 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Categorías musculares ({categorias.length})</span>
        {verCategorias ? <ChevronUp size={16} color={C.suave} /> : <ChevronDown size={16} color={C.suave} />}
      </button>

      {verCategorias && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={nuevaCategoria} onChange={(e) => { setNuevaCategoria(e.target.value); setErrorCategoria(""); }} placeholder="Nueva categoría" aria-label="Nueva categoría"
              onKeyDown={(e) => { if (e.key === "Enter") crearCategoria(); }} style={{ ...estiloInput, flex: 1, padding: "9px 12px", fontSize: 13 }} />
            <button onClick={crearCategoria} style={{ padding: "0 16px", borderRadius: 10, border: "none", background: colorAcento, color: "#1C1B19", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Añadir</button>
          </div>
          {errorCategoria && <p style={{ margin: "6px 0 0", fontSize: 11, color: C.peligro }}>{errorCategoria}</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
            {categorias.map((c) => {
              const n = ejercicios.filter((e) => e.categoriaId === c.id).length;
              return (
                <div key={c.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "6px 8px 6px 6px" }}>
                    <NombreEditable valor={c.nombre} ariaLabel={`Nombre de ${c.nombre}`} existentes={categorias.filter((x) => x.id !== c.id).map((x) => x.nombre)}
                      onGuardar={(nuevo) => renombrarCategoria(c.id, nuevo)} estilo={{ background: "transparent", border: "1px solid transparent", fontSize: 13, fontWeight: 600, padding: "6px 8px" }} />
                    <span style={{ fontSize: 11, color: C.tenue, flexShrink: 0 }}>{n} {n === 1 ? "ejercicio" : "ejercicios"}</span>
                    <button onClick={() => setConfirmarCatId(c.id)} aria-label={`Eliminar ${c.nombre}`} style={estiloIcono()}><Trash2 size={15} /></button>
                  </div>
                  {confirmarCatId === c.id && (
                    <div style={{ marginTop: 6 }}>
                      <ConfirmarInline
                        mensaje={`¿Eliminar "${c.nombre}"? ${n > 0 ? `Sus ${n} ejercicios quedarán Sin categoría. ` : ""}También se quitarán sus objetivos de los grupos.`}
                        textoConfirmar="Sí, eliminar" onConfirmar={() => eliminarCategoria(c.id)} onCancelar={() => setConfirmarCatId(null)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Nuevo ejercicio ---- */}
      <p style={estiloTitulo}>NUEVO EJERCICIO</p>
      <div style={{ ...estiloTarjeta, marginBottom: 24 }}>
        <label style={estiloEtiqueta}>Nombre</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Sentadilla con barra" aria-label="Nombre del nuevo ejercicio"
          style={{ ...estiloInput, background: C.fondo, marginBottom: 12 }} />

        <label style={estiloEtiqueta}>Tipo</label>
        <div style={{ display: "flex", gap: 4, background: C.fondo, borderRadius: 10, padding: 4, marginBottom: 12 }}>
          {[{ id: "fuerza", etiqueta: "Fuerza" }, { id: "tiempo", etiqueta: "Por tiempo" }].map((t) => (
            <button key={t.id} onClick={() => setTipo(t.id)}
              style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "none", cursor: "pointer", background: tipo === t.id ? C.activo : "transparent", color: tipo === t.id ? C.texto : C.suave, fontSize: 13, fontWeight: 600 }}>
              {t.etiqueta}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: C.tenue, margin: "-6px 0 12px" }}>
          {tipo === "fuerza" ? "Se mide en series, repeticiones y peso." : "Se mide en duración: estiramientos, calentamiento, plancha o cardio."}
        </p>

        <label style={estiloEtiqueta}>Categoría principal</label>
        <select aria-label="Categoría del nuevo ejercicio" value={categoriaNueva} onChange={(e) => setCategoriaNueva(e.target.value)} style={{ ...estiloInput, background: C.fondo, marginBottom: 12 }}>
          <option value="">Sin categoría</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        <label style={estiloEtiqueta}>Imagen o GIF (opcional)</label>
        <input value={imagen} onChange={(e) => setImagen(e.target.value)} placeholder="/ejercicios/sentadilla.webp" aria-label="Ruta de la imagen del nuevo ejercicio"
          style={{ ...estiloInput, background: C.fondo, marginBottom: 4 }} />
        <p style={{ fontSize: 11, color: C.tenue, margin: "0 0 12px" }}>Ruta dentro de la carpeta "public" de tu proyecto, o una URL.</p>

        {tipo === "fuerza" && (
          <>
            <label style={estiloEtiqueta}>Peso inicial en kg (opcional)</label>
            <div style={{ marginBottom: 12 }}>
              <CampoNumero valor={pesoInicial} decimales min={0} max={1000} permitirVacio placeholder="Ej. 40 o 42.5" ariaLabel="Peso inicial" onCambio={setPesoInicial}
                estilo={{ background: C.fondo, padding: "10px 12px", fontSize: 14 }} />
            </div>
          </>
        )}

        <label style={estiloEtiqueta}>Color</label>
        <div style={{ marginBottom: 16 }}>
          <SelectorColor valor={color} onCambio={setColor} />
        </div>

        <button onClick={crearEjercicio} disabled={!nombre.trim()} style={estiloBoton(colorAcento, !nombre.trim())}>
          <Plus size={16} strokeWidth={2.5} /> Crear ejercicio
        </button>
      </div>

      {/* ---- Lista de ejercicios ---- */}
      <p style={estiloTitulo}>TUS EJERCICIOS</p>
      {bloques.length === 0 ? (
        <p style={{ textAlign: "center", color: C.tenue, fontSize: 13, padding: "20px 0" }}>Todavía no has creado ningún ejercicio.</p>
      ) : (
        bloques.map((b) => (
          <div key={b.nombre} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: C.tenue, margin: "0 0 6px" }}>{b.nombre}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {b.items.map((ej) => (
                <div key={ej.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "10px 10px 10px 12px" }}>
                    {ej.imagen ? (
                      <img src={ej.imagen} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain", background: "#FFFFFF", flexShrink: 0 }} />
                    ) : (
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: ej.color, flexShrink: 0 }} />
                    )}
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>{ej.nombre}</span>
                    <span style={{ fontSize: 11, color: C.tenue, flexShrink: 0 }}>{ej.tipo === "fuerza" ? formatearPeso(pesoActual(ej)) : "Por tiempo"}</span>
                    <button onClick={() => setEditandoId(editandoId === ej.id ? null : ej.id)} aria-label={`Editar ${ej.nombre}`} style={estiloIcono(editandoId === ej.id ? colorAcento : C.tenue)}><Pencil size={15} /></button>
                    <button onClick={() => setConfirmarId(ej.id)} aria-label={`Eliminar ${ej.nombre}`} style={estiloIcono()}><Trash2 size={15} /></button>
                  </div>
                  {confirmarId === ej.id && (
                    <div style={{ marginTop: 6 }}>
                      <ConfirmarInline
                        mensaje={`¿Eliminar "${ej.nombre}"? ${gruposQueUsan(ej.id) > 0 ? `Se usa en ${gruposQueUsan(ej.id)} ${gruposQueUsan(ej.id) === 1 ? "grupo" : "grupos"} y se quitará de ellos. ` : ""}Su historial de pesos se borrará; las sesiones ya guardadas no cambian.`}
                        textoConfirmar="Sí, eliminar" onConfirmar={() => eliminarEjercicio(ej.id)} onCancelar={() => setConfirmarId(null)} />
                    </div>
                  )}
                  {editandoId === ej.id && <EditorEjercicio ej={ej} datos={datos} setDatos={setDatos} colorAcento={colorAcento} />}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// =====================================================================
// Configuración: sonido, vibración, tema de color y sesiones anteriores
// =====================================================================

const TAMANO_MAXIMO_SONIDO = 700 * 1024; // el sonido propio se guarda en el dispositivo: debe ser liviano

function Configuracion({ config, setConfig, datos, setDatos, sesiones, setSesiones, colorAcento }) {
  const [errorSonido, setErrorSonido] = useState("");
  const [confirmarSesionId, setConfirmarSesionId] = useState(null);
  const [copiaPendiente, setCopiaPendiente] = useState(null); // copia leída, a la espera de confirmar
  const [mensajeCopia, setMensajeCopia] = useState(null); // { tipo: "ok" | "error", texto }
  const [verSesiones, setVerSesiones] = useState(false); // la lista de sesiones anteriores empieza plegada
  const entradaArchivo = useRef(null);
  const entradaCopia = useRef(null);

  const cambiar = (cambios) => setConfig((c) => ({ ...c, ...cambios }));

  const cargarSonido = (e) => {
    const archivo = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    if (!archivo.type.startsWith("audio/")) { setErrorSonido("Elige un archivo de audio."); return; }
    if (archivo.size > TAMANO_MAXIMO_SONIDO) { setErrorSonido("El archivo es muy pesado. Usa un sonido corto, de menos de 700 KB."); return; }
    const lector = new FileReader();
    lector.onload = () => { cambiar({ sonidoPropio: lector.result, nombreSonido: archivo.name }); setErrorSonido(""); };
    lector.onerror = () => setErrorSonido("No se pudo leer el archivo.");
    lector.readAsDataURL(archivo);
  };

  // Descarga un archivo con todos los datos de entrenamiento
  const exportarCopia = () => {
    const nombre = `rutina-copia-${hoyISO()}.json`;
    const json = JSON.stringify(construirCopia(datos, sesiones), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setCopiaPendiente(null);
    setMensajeCopia({ tipo: "ok", texto: `Copia descargada: ${nombre}` });
  };

  // Abre el menú de compartir del teléfono con la copia adjunta (WhatsApp, correo...).
  // Se envía como .txt porque los navegadores solo permiten compartir ciertos tipos de
  // archivo (texto sí); el importador acepta .txt y .json por igual.
  const puedeCompartir = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  const compartirCopia = async () => {
    const nombre = `rutina-copia-${hoyISO()}.txt`;
    const archivo = new File([JSON.stringify(construirCopia(datos, sesiones), null, 2)], nombre, { type: "text/plain" });
    if (!navigator.canShare({ files: [archivo] })) {
      setMensajeCopia({ tipo: "error", texto: "Este navegador no permite compartir archivos. Usa Exportar copia." });
      return;
    }
    setCopiaPendiente(null);
    try {
      await navigator.share({ files: [archivo], title: "Copia de Rutina" });
      setMensajeCopia(null);
    } catch (error) {
      if (error && error.name === "AbortError") return; // cerraste el menú sin enviar
      setMensajeCopia({ tipo: "error", texto: "No se pudo compartir la copia. Usa Exportar copia." });
    }
  };

  // Lee el archivo elegido y lo valida; todavía no cambia nada hasta que confirmes
  const elegirCopia = (e) => {
    const archivo = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    setCopiaPendiente(null);
    if (archivo.size > 4 * 1024 * 1024) {
      setMensajeCopia({ tipo: "error", texto: "El archivo es demasiado grande para ser una copia de esta app." });
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = validarCopia(String(lector.result));
      if (resultado.ok) { setCopiaPendiente(resultado); setMensajeCopia(null); }
      else setMensajeCopia({ tipo: "error", texto: resultado.error });
    };
    lector.onerror = () => setMensajeCopia({ tipo: "error", texto: "No se pudo leer el archivo." });
    lector.readAsText(archivo);
  };

  const confirmarImportacion = () => {
    if (!copiaPendiente) return;
    const { datos: nuevosDatos, sesiones: nuevasSesiones } = copiaPendiente;
    setDatos(nuevosDatos);
    setSesiones(nuevasSesiones);
    setMensajeCopia({ tipo: "ok", texto: `Copia importada: ${nuevosDatos.ejercicios.length} ejercicios, ${nuevosDatos.grupos.length} grupos y ${nuevasSesiones.length} sesiones.` });
    setCopiaPendiente(null);
  };

  const fila = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };

  return (
    <div>
      {/* Sonido */}
      <p style={estiloTitulo}>SONIDO</p>
      <div style={{ ...estiloTarjeta, marginBottom: 22 }}>
        <div style={fila}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Sonido al terminar un descanso</span>
          <Interruptor activo={config.sonido} onChange={(v) => cambiar({ sonido: v })} color={colorAcento} etiqueta="Sonido" />
        </div>
        <div style={{ marginTop: 14, opacity: config.sonido ? 1 : 0.5 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: C.suave }}>
            {config.sonidoPropio ? `Sonido propio: ${config.nombreSonido || "archivo cargado"}` : "Sonido predeterminado"}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => entradaArchivo.current && entradaArchivo.current.click()} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.borde}`, background: "transparent", color: C.texto, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Cargar mi sonido
            </button>
            {config.sonidoPropio && (
              <button onClick={() => cambiar({ sonidoPropio: null, nombreSonido: "" })} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.borde}`, background: "transparent", color: C.suave, fontSize: 12, cursor: "pointer" }}>
                Usar el predeterminado
              </button>
            )}
            <button onClick={() => alertar(config)} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: colorAcento, color: "#1C1B19", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Probar aviso
            </button>
          </div>
          <input ref={entradaArchivo} type="file" accept="audio/*" onChange={cargarSonido} style={{ display: "none" }} aria-label="Archivo de sonido" />
          {errorSonido && <p style={{ margin: "8px 0 0", fontSize: 11, color: C.peligro }}>{errorSonido}</p>}
          <p style={{ margin: "10px 0 0", fontSize: 11, color: C.tenue, lineHeight: 1.45 }}>
            Tu sonido se guarda solo en este dispositivo. Si bloqueas la pantalla o cambias de aplicación, el aviso puede no sonar; al volver, el temporizador se ajusta a la hora real.
          </p>
        </div>
      </div>

      {/* Vibración */}
      <p style={estiloTitulo}>VIBRACIÓN</p>
      <div style={{ ...estiloTarjeta, marginBottom: 22 }}>
        <div style={fila}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Vibrar al terminar un descanso</span>
          <Interruptor activo={config.vibracion} onChange={(v) => cambiar({ vibracion: v })} color={colorAcento} etiqueta="Vibración" />
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 11, color: C.tenue }}>Funciona en Android; en iPhone no está disponible.</p>
      </div>

      {/* Tema */}
      <p style={estiloTitulo}>TEMA DE COLOR</p>
      <div style={{ ...estiloTarjeta, marginBottom: 22, display: "flex", gap: 14 }}>
        {Object.entries(TEMAS).map(([nombre, color]) => (
          <button key={nombre} onClick={() => cambiar({ tema: nombre })} aria-label={`Tema ${nombre}`} aria-pressed={config.tema === nombre}
            style={{ width: 34, height: 34, borderRadius: "50%", background: color, cursor: "pointer", padding: 0, border: config.tema === nombre ? `2px solid ${C.texto}` : "2px solid transparent", boxShadow: config.tema === nombre ? `0 0 0 3px ${color}55` : "none" }} />
        ))}
      </div>

      {/* Copia de seguridad */}
      <p style={estiloTitulo}>COPIA DE SEGURIDAD</p>
      <div style={{ ...estiloTarjeta, marginBottom: 22 }}>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: C.suave, lineHeight: 1.45 }}>
          Guarda tus ejercicios, grupos, calendario, pesos y sesiones en un archivo, o pasa a este dispositivo los datos de otro. No incluye el sonido, la vibración ni el tema.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={exportarCopia} style={{ flex: 1, minWidth: 110, padding: "10px 0", borderRadius: 10, border: "none", background: colorAcento, color: "#1C1B19", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Exportar copia
          </button>
          {puedeCompartir && (
            <button onClick={compartirCopia} style={{ flex: 1, minWidth: 110, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${C.borde}`, background: "transparent", color: C.texto, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Compartir
            </button>
          )}
          <button onClick={() => entradaCopia.current && entradaCopia.current.click()} style={{ flex: 1, minWidth: 110, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${C.borde}`, background: "transparent", color: C.texto, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Importar copia
          </button>
        </div>
        <input ref={entradaCopia} type="file" accept=".json,.txt,application/json,text/plain" onChange={elegirCopia} style={{ display: "none" }} aria-label="Archivo de copia" />
        {mensajeCopia && (
          <p role="status" style={{ margin: "10px 0 0", fontSize: 12, color: mensajeCopia.tipo === "ok" ? C.ok : C.peligro, lineHeight: 1.45 }}>{mensajeCopia.texto}</p>
        )}
        {copiaPendiente && (
          <div style={{ marginTop: 12 }}>
            <ConfirmarInline
              mensaje={`Esto reemplazará TODO lo de este dispositivo por la copia${copiaPendiente.exportadoEn && fechaDeCopia(copiaPendiente.exportadoEn) ? ` del ${fechaDeCopia(copiaPendiente.exportadoEn)}` : ""}: ${copiaPendiente.datos.ejercicios.length} ejercicios, ${copiaPendiente.datos.grupos.length} grupos y ${copiaPendiente.sesiones.length} sesiones. Lo que tienes ahora se perderá y no se puede deshacer.`}
              textoConfirmar="Sí, reemplazar" onConfirmar={confirmarImportacion} onCancelar={() => setCopiaPendiente(null)} />
          </div>
        )}
      </div>

      {/* Sesiones anteriores */}
      <button onClick={() => setVerSesiones(!verSesiones)} aria-expanded={verSesiones}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 12, padding: "12px 14px", color: C.texto, cursor: "pointer", marginBottom: verSesiones ? 10 : 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Sesiones anteriores ({sesiones.length})</span>
        {verSesiones ? <ChevronUp size={16} color={C.suave} /> : <ChevronDown size={16} color={C.suave} />}
      </button>
      {!verSesiones ? null : sesiones.length === 0 ? (
        <p style={{ fontSize: 13, color: C.tenue, padding: "6px 0 20px" }}>Todavía no hay sesiones guardadas. Se guardan al terminar una rutina.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sesiones.map((s) => (
            <div key={s.id} style={estiloTarjeta}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{s.grupoNombre}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: C.suave }}>{formatearFecha(s.fecha)} · Duración {formatearDuracionLarga(s.duracion)}</p>
                </div>
                <button onClick={() => setConfirmarSesionId(s.id)} aria-label="Borrar sesión" style={estiloIcono()}><Trash2 size={16} /></button>
              </div>
              {confirmarSesionId === s.id && (
                <ConfirmarInline mensaje="¿Borrar esta sesión guardada? No se puede deshacer." textoConfirmar="Sí, borrar"
                  onConfirmar={() => { setSesiones((prev) => prev.filter((x) => x.id !== s.id)); setConfirmarSesionId(null); }} onCancelar={() => setConfirmarSesionId(null)} />
              )}
              <ResumenSesion sesion={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Componente principal
// =====================================================================

export default function GymTracker() {
  const [seccion, setSeccion] = useState("rutina"); // "rutina" | "grupos" | "ejercicios" | "config"
  const [datos, setDatos] = useEstadoPersistente("gymtracker2:datos", DATOS_INICIALES);
  const [sesiones, setSesiones] = useEstadoPersistente("gymtracker2:sesiones", []);
  const [configGuardada, setConfig] = useEstadoPersistente("gymtracker2:config", CONFIG_INICIAL);
  const [rutina, setRutina] = useEstadoPersistente("gymtracker2:rutina", null);
  const [grupoEditId, setGrupoEditId] = useState(null);

  const config = { ...CONFIG_INICIAL, ...configGuardada };
  const colorAcento = TEMAS[config.tema] || TEMAS.rojo;

  return (
    <div style={{ minHeight: "100vh", background: C.fondo, color: C.texto, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 20px 100px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: colorAcento, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Dumbbell size={20} color="#1C1B19" strokeWidth={2.5} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Rutina</h1>
              <p style={{ margin: 0, fontSize: 12, color: C.suave }}>¡Siempre fuerte, imparable!</p>
            </div>
          </div>
          <button onClick={() => setSeccion(seccion === "config" ? "rutina" : "config")} aria-label="Configuración" aria-pressed={seccion === "config"}
            style={{ width: 38, height: 38, borderRadius: 10, border: seccion === "config" ? `1.5px solid ${colorAcento}` : `1.5px solid ${C.borde}`, background: seccion === "config" ? `${colorAcento}22` : "transparent", color: seccion === "config" ? colorAcento : C.suave, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <Settings size={18} />
          </button>
        </header>

        {seccion === "config" && <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700 }}>Configuración</h2>}

        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: C.tarjeta, borderRadius: 10, padding: 4 }}>
          {[
            { id: "rutina", etiqueta: "Rutina" },
            { id: "grupos", etiqueta: "Grupos" },
            { id: "ejercicios", etiqueta: "Ejercicios" },
          ].map((s) => (
            <button key={s.id} onClick={() => setSeccion(s.id)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 7, border: "none", cursor: "pointer", background: seccion === s.id ? colorAcento : "transparent", color: seccion === s.id ? "#1C1B19" : C.suave, fontSize: 13, fontWeight: 700, position: "relative" }}>
              {s.etiqueta}
              {s.id === "rutina" && rutina && seccion !== "rutina" && (
                <span aria-label="Rutina en curso" style={{ position: "absolute", top: 7, right: 12, width: 7, height: 7, borderRadius: "50%", background: colorAcento }} />
              )}
            </button>
          ))}
        </div>

        {/* Rutina nunca se desmonta: así el temporizador y los avisos siguen aunque estés en otra pestaña */}
        <Rutina datos={datos} rutina={rutina} setRutina={setRutina} config={config} setSesiones={setSesiones} visible={seccion === "rutina"} />

        {seccion === "grupos" && <Grupos datos={datos} setDatos={setDatos} grupoEditId={grupoEditId} setGrupoEditId={setGrupoEditId} colorAcento={colorAcento} />}
        {seccion === "ejercicios" && <Ejercicios datos={datos} setDatos={setDatos} colorAcento={colorAcento} />}
        {seccion === "config" && <Configuracion config={config} setConfig={setConfig} datos={datos} setDatos={setDatos} sesiones={sesiones} setSesiones={setSesiones} colorAcento={colorAcento} />}
      </div>
    </div>
  );
}