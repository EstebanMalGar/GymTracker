import React, { useState, useMemo, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Dumbbell, Plus, TrendingUp, X, Flame, Play, Pause, SkipForward, RotateCcw, ChevronUp, ChevronDown, Pencil, Check, Trash2 } from "lucide-react";

const MAX_SERIES = 4;

// Temas de color disponibles para el acento de la app (botones principales,
// selección activa, círculo del temporizador). Usa los mismos tonos que ya
// existían en los ejercicios, para que todo se sienta consistente.
const TEMAS = {
  rojo: "#E85D3D",
  azul: "#3D8BE8",
  verde: "#3DE87E",
};

// --- Datos de ejemplo ---
const EJERCICIOS = [
  { id: "press-banca", nombre: "Press de banca", grupo: "Pecho", color: "#E85D3D" },
  { id: "sentadilla", nombre: "Sentadilla", grupo: "Pierna", color: "#3D8BE8" },
  { id: "peso-muerto", nombre: "Peso muerto", grupo: "Espalda", color: "#3DE87E" },
  { id: "press-militar", nombre: "Press militar", grupo: "Hombro", color: "#E8D33D" },
  { id: "curl-biceps", nombre: "Curl de bíceps", grupo: "Brazo", color: "#B23DE8" },
  { id: "remo-barra", nombre: "Remo con barra", grupo: "Espalda", color: "#3DE87E" },
];

// Cada "día" es un plan con nombre propio y una lista ORDENADA de ids de ejercicios.
// Así puedes armar "Día de pierna", "Día de espalda", etc., cada uno con su propio orden.
const DIAS_INICIALES = [
  { id: "dia-pierna", nombre: "Pierna", ejerciciosIds: ["sentadilla", "peso-muerto"] },
  { id: "dia-espalda", nombre: "Espalda", ejerciciosIds: ["peso-muerto", "remo-barra"] },
  { id: "dia-empuje", nombre: "Empuje", ejerciciosIds: ["press-banca", "press-militar"] },
];

// Cada sesión guarda TODAS las series (no solo el máximo), y un "orden" (timestamp)
// que sirve para ordenar cronológicamente sin depender del texto de la fecha.
const HISTORICO_INICIAL = {
  "press-banca": [
    { fecha: "01 jul", orden: 1, series: [{ peso: 55, reps: 10 }, { peso: 60, reps: 8 }, { peso: 60, reps: 8 }, { peso: 62.5, reps: 6 }] },
    { fecha: "08 jul", orden: 2, series: [{ peso: 60, reps: 10 }, { peso: 62.5, reps: 8 }, { peso: 62.5, reps: 8 }] },
    { fecha: "15 jul", orden: 3, series: [{ peso: 62.5, reps: 10 }, { peso: 65, reps: 8 }, { peso: 65, reps: 6 }, { peso: 65, reps: 6 }] },
    { fecha: "22 jul", orden: 4, series: [{ peso: 62.5, reps: 10 }, { peso: 65, reps: 8 }, { peso: 65, reps: 8 }] },
  ],
  sentadilla: [
    { fecha: "02 jul", orden: 1, series: [{ peso: 70, reps: 10 }, { peso: 80, reps: 8 }, { peso: 80, reps: 8 }] },
    { fecha: "09 jul", orden: 2, series: [{ peso: 75, reps: 10 }, { peso: 85, reps: 8 }, { peso: 85, reps: 6 }] },
    { fecha: "16 jul", orden: 3, series: [{ peso: 80, reps: 10 }, { peso: 87.5, reps: 8 }, { peso: 87.5, reps: 6 }, { peso: 87.5, reps: 6 }] },
    { fecha: "23 jul", orden: 4, series: [{ peso: 80, reps: 10 }, { peso: 90, reps: 6 }, { peso: 90, reps: 6 }] },
  ],
};

// Ejercicios de calentamiento, cada uno con su duración en segundos.
// Es el valor INICIAL: el usuario podrá editar nombre, duración y orden desde la app.
const CALENTAMIENTO_INICIAL = [
  { id: "jumping-jacks", nombre: "Jumping jacks", duracion: 30 },
  { id: "rotacion-hombros", nombre: "Rotación de hombros", duracion: 20 },
  { id: "sentadillas-aire", nombre: "Sentadillas al aire", duracion: 30 },
  { id: "zancadas", nombre: "Zancadas dinámicas", duracion: 30 },
  { id: "plancha", nombre: "Plancha", duracion: 30 },
];

function formatearTiempo(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Hook reutilizable: permite hacer scroll horizontal arrastrando con clic y mouse,
// no solo con la rueda/trackpad. Se lo damos a cualquier contenedor con overflow-x.
function useDragScroll() {
  const ref = useRef(null);
  const estado = useRef({ arrastrando: false, movido: false, inicioX: 0, scrollInicio: 0 });

  const onMouseDown = (e) => {
    if (!ref.current) return;
    estado.current.arrastrando = true;
    estado.current.movido = false;
    estado.current.inicioX = e.pageX;
    estado.current.scrollInicio = ref.current.scrollLeft;
  };

  const onMouseMove = (e) => {
    if (!estado.current.arrastrando || !ref.current) return;
    const delta = e.pageX - estado.current.inicioX;
    if (Math.abs(delta) > 4) estado.current.movido = true; // umbral para distinguir "clic" de "arrastre"
    ref.current.scrollLeft = estado.current.scrollInicio - delta;
  };

  const detener = () => { estado.current.arrastrando = false; };

  // Si el usuario arrastró (no solo hizo clic), cancelamos el click que dispararía
  // el botón debajo del mouse, para que arrastrar no seleccione un ejercicio sin querer.
  const onClickCapture = (e) => {
    if (estado.current.movido) { e.preventDefault(); e.stopPropagation(); }
  };

  return {
    ref,
    onMouseDown,
    onMouseMove,
    onMouseUp: detener,
    onMouseLeave: detener,
    onClickCapture,
    style: { cursor: "grab", userSelect: "none" },
  };
}

// --- Pestaña de calentamiento ---
// "lista" y "setLista" llegan como props desde GymTracker, para que la edición
// (nombre, duración, orden) no se pierda al cambiar de pestaña.
function Calentamiento({ lista, setLista, colorAcento }) {
  const [indice, setIndice] = useState(0);
  const [modoEdicion, setModoEdicion] = useState(false);
  const ejercicio = lista[indice] || lista[0];
  const [segundos, setSegundos] = useState(ejercicio.duracion);
  const [corriendo, setCorriendo] = useState(false);
  const intervaloRef = useRef(null);

  useEffect(() => {
    if (corriendo) {
      intervaloRef.current = setInterval(() => {
        setSegundos((prev) => {
          if (prev <= 1) { setCorriendo(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervaloRef.current);
  }, [corriendo]);

  // Si el índice queda fuera de rango (por ejemplo, borraste el último ejercicio
  // de la lista), lo ajustamos para que no apunte a algo que ya no existe.
  useEffect(() => {
    if (indice >= lista.length) setIndice(Math.max(0, lista.length - 1));
  }, [lista, indice]);

  const iniciar = () => setCorriendo(true);
  const detener = () => setCorriendo(false);
  const reiniciar = () => { setCorriendo(false); setSegundos(ejercicio.duracion); };
  const siguiente = () => {
    setCorriendo(false);
    const siguienteIndice = (indice + 1) % lista.length;
    setIndice(siguienteIndice);
    setSegundos(lista[siguienteIndice].duracion);
  };

  // --- Funciones de edición ---
  const actualizarNombre = (i, valor) => {
    setLista((prev) => prev.map((ej, idx) => idx === i ? { ...ej, nombre: valor } : ej));
  };

  const actualizarDuracion = (i, valor) => {
    const numero = Math.max(5, Number(valor) || 5); // mínimo 5 segundos, evita 0 o negativos
    setLista((prev) => prev.map((ej, idx) => idx === i ? { ...ej, duracion: numero } : ej));
    if (i === indice && !corriendo) setSegundos(numero); // si es el que se está viendo, refleja el cambio ya
  };

  const moverEjercicio = (i, direccion) => {
    const destino = i + direccion;
    if (destino < 0 || destino >= lista.length) return;
    setLista((prev) => {
      const nuevos = [...prev];
      [nuevos[i], nuevos[destino]] = [nuevos[destino], nuevos[i]];
      return nuevos;
    });
    // Si estabas viendo el que se movió, seguimos viéndolo en su nueva posición
    if (i === indice) setIndice(destino);
    else if (destino === indice) setIndice(i);
  };

  const eliminarEjercicio = (i) => {
    if (lista.length <= 1) return; // siempre debe quedar al menos uno
    setLista((prev) => prev.filter((_, idx) => idx !== i));
  };

  const agregarEjercicio = () => {
    setLista((prev) => [...prev, { id: `calentamiento-${Date.now()}`, nombre: "Nuevo ejercicio", duracion: 30 }]);
  };

  const progreso = ((ejercicio.duracion - segundos) / ejercicio.duracion) * 100;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <p style={{ fontSize: 12, color: "#9A968C", margin: 0 }}>Ejercicio {indice + 1} de {lista.length}</p>
        <button onClick={() => setModoEdicion(!modoEdicion)} style={{ background: "none", border: "none", cursor: "pointer", color: modoEdicion ? colorAcento : "#9A968C", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}>
          {modoEdicion ? <><Check size={14} /> Listo</> : <><Pencil size={14} /> Editar</>}
        </button>
      </div>

      {modoEdicion ? (
        // --- Modo edición: nombre, duración y orden de cada ejercicio ---
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {lista.map((ej, i) => (
              <div key={ej.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#26241F", border: "1px solid #33312D", borderRadius: 10, padding: "8px 10px" }}>
                <input
                  value={ej.nombre}
                  onChange={(e) => actualizarNombre(i, e.target.value)}
                  style={{ flex: 1, minWidth: 0, background: "#1C1B19", border: "1px solid #33312D", borderRadius: 8, padding: "7px 8px", color: "#F2EFE9", fontSize: 13 }}
                />
                <input
                  type="number"
                  value={ej.duracion}
                  onChange={(e) => actualizarDuracion(i, e.target.value)}
                  style={{ width: 56, background: "#1C1B19", border: "1px solid #33312D", borderRadius: 8, padding: "7px 6px", color: "#F2EFE9", fontSize: 13, textAlign: "center" }}
                />
                <span style={{ fontSize: 11, color: "#6B675F" }}>seg</span>
                <button onClick={() => moverEjercicio(i, -1)} disabled={i === 0}
                  style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#3A3833" : "#9A968C" }} aria-label="Subir">
                  <ChevronUp size={16} />
                </button>
                <button onClick={() => moverEjercicio(i, 1)} disabled={i === lista.length - 1}
                  style={{ background: "none", border: "none", cursor: i === lista.length - 1 ? "default" : "pointer", color: i === lista.length - 1 ? "#3A3833" : "#9A968C" }} aria-label="Bajar">
                  <ChevronDown size={16} />
                </button>
                <button onClick={() => eliminarEjercicio(i)} disabled={lista.length <= 1}
                  style={{ background: "none", border: "none", cursor: lista.length <= 1 ? "default" : "pointer", color: lista.length <= 1 ? "#3A3833" : "#6B675F" }} aria-label="Eliminar">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <button onClick={agregarEjercicio} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "1.5px dashed #33312D", background: "transparent", color: "#9A968C", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={14} /> Añadir ejercicio de calentamiento
          </button>
        </div>
      ) : (
        // --- Modo normal: el temporizador ---
        <>
          <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 700 }}>{ejercicio.nombre}</h2>

          {/* Recuadro de video/imagen del ejercicio */}
          <div style={{
            width: "100%", height: 160, borderRadius: 12, marginBottom: 20,
            background: `linear-gradient(135deg, ${colorAcento}33, #26241F)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${colorAcento}55`,
          }}>
            <Flame size={30} color={colorAcento} />
            <span style={{ marginLeft: 8, fontSize: 12, color: "#9A968C" }}>Aquí va el video/imagen del ejercicio</span>
          </div>

          <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto 20px" }}>
            <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="70" cy="70" r="60" fill="none" stroke="#26241F" strokeWidth="10" />
              <circle cx="70" cy="70" r="60" fill="none" stroke={colorAcento} strokeWidth="10"
                strokeDasharray={2 * Math.PI * 60}
                strokeDashoffset={2 * Math.PI * 60 * (1 - progreso / 100)}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              <span style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatearTiempo(segundos)}</span>
              <span style={{ fontSize: 11, color: "#9A968C" }}>{corriendo ? "en curso" : segundos === 0 ? "listo" : "pausado"}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {!corriendo ? (
              <button onClick={iniciar} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer", background: colorAcento, color: "#1C1B19", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Play size={16} strokeWidth={2.5} /> Iniciar
              </button>
            ) : (
              <button onClick={detener} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer", background: "#3A3833", color: "#F2EFE9", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Pause size={16} strokeWidth={2.5} /> Detener
              </button>
            )}
            <button onClick={reiniciar} style={{ width: 48, borderRadius: 10, border: "1px solid #33312D", background: "transparent", color: "#9A968C", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Reiniciar">
              <RotateCcw size={16} />
            </button>
          </div>

          <button onClick={siguiente} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1.5px solid #33312D", background: "transparent", color: "#F2EFE9", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            Siguiente ejercicio <SkipForward size={16} />
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 24 }}>
            {lista.map((ej, i) => (
              <div key={ej.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: i === indice ? `${colorAcento}22` : "#26241F", border: i === indice ? `1px solid ${colorAcento}` : "1px solid #33312D" }}>
                <span style={{ fontSize: 13, color: i === indice ? "#F2EFE9" : "#9A968C", fontWeight: i === indice ? 700 : 400 }}>{ej.nombre}</span>
                <span style={{ fontSize: 12, color: "#6B675F" }}>{ej.duracion}s</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Pestaña de rutina (registrar + historial por ejercicio) ---
// "dias", "diaActivoId" e "historico" ahora llegan como props desde el componente
// padre (GymTracker), para que NO se pierdan cuando cambias a la pestaña de
// Calentamiento y vuelves — solo se destruiría si viviera dentro de este componente.
function Rutina({ dias, setDias, diaActivoId, setDiaActivoId, historico, setHistorico, colorAcento }) {
  const [vista, setVista] = useState("registrar");
  const [ejercicioActivo, setEjercicioActivo] = useState(EJERCICIOS[0]);
  const [series, setSeries] = useState([]);
  const [peso, setPeso] = useState(20);
  const [reps, setReps] = useState(10);

  // --- Días de entrenamiento (pierna, espalda, etc.) ---
  const [modoEdicion, setModoEdicion] = useState(false);
  const [creandoDia, setCreandoDia] = useState(false);
  const [nombreNuevoDia, setNombreNuevoDia] = useState("");
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  // Scroll horizontal arrastrable para la fila de días y la fila de ejercicios
  const scrollDias = useDragScroll();
  const scrollEjercicios = useDragScroll();

  const diaActivo = dias.find((d) => d.id === diaActivoId) || dias[0];
  const ejerciciosDelDia = diaActivo.ejerciciosIds
    .map((id) => EJERCICIOS.find((e) => e.id === id))
    .filter(Boolean);

  // Si el ejercicio activo ya no pertenece al día seleccionado (cambiaste de día,
  // o lo quitaste en modo edición), pasamos automáticamente al primero del día.
  useEffect(() => {
    if (ejerciciosDelDia.length === 0) return;
    if (!ejerciciosDelDia.find((e) => e.id === ejercicioActivo.id)) {
      setEjercicioActivo(ejerciciosDelDia[0]);
      setSeries([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaActivoId, dias]);

  const seleccionarDia = (id) => { setDiaActivoId(id); setSeries([]); setConfirmandoEliminar(false); };

  const moverEjercicio = (index, direccion) => {
    setDias((prev) => prev.map((d) => {
      if (d.id !== diaActivoId) return d;
      const nuevos = [...d.ejerciciosIds];
      const destino = index + direccion;
      if (destino < 0 || destino >= nuevos.length) return d;
      [nuevos[index], nuevos[destino]] = [nuevos[destino], nuevos[index]];
      return { ...d, ejerciciosIds: nuevos };
    }));
  };

  const quitarDelDia = (id) => {
    setDias((prev) => prev.map((d) => d.id === diaActivoId
      ? { ...d, ejerciciosIds: d.ejerciciosIds.filter((eid) => eid !== id) }
      : d));
  };

  const agregarAlDia = (id) => {
    setDias((prev) => prev.map((d) => d.id === diaActivoId && !d.ejerciciosIds.includes(id)
      ? { ...d, ejerciciosIds: [...d.ejerciciosIds, id] }
      : d));
  };

  const crearDia = () => {
    if (!nombreNuevoDia.trim()) return;
    const nuevo = { id: `dia-${Date.now()}`, nombre: nombreNuevoDia.trim(), ejerciciosIds: [] };
    setDias((prev) => [...prev, nuevo]);
    setDiaActivoId(nuevo.id);
    setNombreNuevoDia("");
    setCreandoDia(false);
    setModoEdicion(true);
  };

  // Elimina el día actualmente seleccionado (no borra el historial de los ejercicios,
  // solo el "día" y el orden que le habías dado). La confirmación es un segundo clic
  // dentro de la propia app, no un window.confirm (algunos navegadores bloquean esos diálogos).
  const eliminarDia = () => {
    if (dias.length <= 1) return;
    const restantes = dias.filter((d) => d.id !== diaActivoId);
    setDias(restantes);
    setDiaActivoId(restantes[0].id);
    setSeries([]);
    setConfirmandoEliminar(false);
  };

  // Ejercicios que todavía no están en el día activo, agrupados por grupo muscular
  const disponiblesPorGrupo = useMemo(() => {
    const disponibles = EJERCICIOS.filter((e) => !diaActivo.ejerciciosIds.includes(e.id));
    const grupos = {};
    disponibles.forEach((e) => {
      if (!grupos[e.grupo]) grupos[e.grupo] = [];
      grupos[e.grupo].push(e);
    });
    return grupos;
  }, [diaActivo]);

  const limiteAlcanzado = series.length >= MAX_SERIES;

  const agregarSerie = () => {
    if (limiteAlcanzado) return;
    setSeries([...series, { id: Date.now(), peso, reps }]);
  };
  const quitarSerie = (id) => setSeries(series.filter((s) => s.id !== id));

  const guardarSesion = () => {
    if (series.length === 0) return;
    const hoy = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
    const nuevaSesion = {
      fecha: hoy,
      orden: Date.now(),
      series: series.map((s) => ({ peso: s.peso, reps: s.reps })),
    };
    setHistorico((prev) => {
      const anterior = prev[ejercicioActivo.id] || [];
      return { ...prev, [ejercicioActivo.id]: [...anterior, nuevaSesion] };
    });
    setSeries([]);
    setVista("historial");
  };

  const sesiones = historico[ejercicioActivo.id] || [];
  // Para la gráfica usamos el peso máximo de cada sesión
  const datosGrafica = sesiones.map((s) => ({ fecha: s.fecha, peso: Math.max(...s.series.map((x) => x.peso)) }));
  const progreso = useMemo(() => {
    if (datosGrafica.length < 2) return null;
    return datosGrafica[datosGrafica.length - 1].peso - datosGrafica[0].peso;
  }, [datosGrafica]);

  return (
    <div>
      {/* Selector de día de entrenamiento */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#9A968C", fontWeight: 700, letterSpacing: "0.02em" }}>DÍA DE ENTRENAMIENTO</p>
          <button onClick={() => setModoEdicion(!modoEdicion)} style={{ background: "none", border: "none", cursor: "pointer", color: modoEdicion ? colorAcento : "#9A968C", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}>
            {modoEdicion ? <><Check size={14} /> Listo</> : <><Pencil size={14} /> Editar</>}
          </button>
        </div>

        <div ref={scrollDias.ref} onMouseDown={scrollDias.onMouseDown} onMouseMove={scrollDias.onMouseMove} onMouseUp={scrollDias.onMouseUp} onMouseLeave={scrollDias.onMouseLeave} onClickCapture={scrollDias.onClickCapture}
          style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", ...scrollDias.style }}>
          {dias.map((d) => (
            <button key={d.id} onClick={() => seleccionarDia(d.id)}
              style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 999, border: d.id === diaActivoId ? `1.5px solid ${colorAcento}` : "1.5px solid #33312D", background: d.id === diaActivoId ? `${colorAcento}22` : "transparent", color: d.id === diaActivoId ? "#F2EFE9" : "#9A968C", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {d.nombre}
            </button>
          ))}
          <button onClick={() => setCreandoDia(!creandoDia)} aria-label="Nuevo día"
            style={{ flexShrink: 0, width: 36, borderRadius: 999, border: "1.5px dashed #33312D", background: "transparent", color: "#9A968C", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Plus size={15} />
          </button>
        </div>

        {creandoDia && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input value={nombreNuevoDia} onChange={(e) => setNombreNuevoDia(e.target.value)} placeholder="Ej. Día de brazo"
              style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid #33312D", background: "#26241F", color: "#F2EFE9", fontSize: 13 }} />
            <button onClick={crearDia} style={{ padding: "0 16px", borderRadius: 10, border: "none", background: colorAcento, color: "#1C1B19", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Crear</button>
          </div>
        )}
      </div>

      {modoEdicion ? (
        // --- Modo edición: reordenar, quitar y añadir ejercicios a este día ---
        <div style={{ marginBottom: 20 }}>
          {dias.length > 1 && (
            confirmandoEliminar ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#2A1D1A", border: "1px solid #99392F", borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
                <span style={{ flex: 1, fontSize: 12, color: "#F2EFE9" }}>¿Eliminar "{diaActivo.nombre}"? El historial de sus ejercicios no se borra.</span>
                <button onClick={eliminarDia} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#E85D3D", color: "#1C1B19", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  Sí, eliminar
                </button>
                <button onClick={() => setConfirmandoEliminar(false)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #33312D", background: "transparent", color: "#9A968C", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmandoEliminar(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #99392F", borderRadius: 10, padding: "8px 12px", color: "#E85D3D", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>
                <Trash2 size={14} /> Eliminar día "{diaActivo.nombre}"
              </button>
            )
          )}
          {ejerciciosDelDia.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6B675F", fontSize: 13, padding: "12px 0" }}>Este día todavía no tiene ejercicios. Agrégalos desde la lista de abajo.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
              {ejerciciosDelDia.map((ej, i) => (
                <div key={ej.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#26241F", border: "1px solid #33312D", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: ej.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{i + 1}. {ej.nombre}</span>
                  <button onClick={() => moverEjercicio(i, -1)} disabled={i === 0}
                    style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#3A3833" : "#9A968C" }} aria-label="Subir">
                    <ChevronUp size={16} />
                  </button>
                  <button onClick={() => moverEjercicio(i, 1)} disabled={i === ejerciciosDelDia.length - 1}
                    style={{ background: "none", border: "none", cursor: i === ejerciciosDelDia.length - 1 ? "default" : "pointer", color: i === ejerciciosDelDia.length - 1 ? "#3A3833" : "#9A968C" }} aria-label="Bajar">
                    <ChevronDown size={16} />
                  </button>
                  <button onClick={() => quitarDelDia(ej.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B675F" }} aria-label="Quitar">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: 11, color: "#9A968C", fontWeight: 700, marginBottom: 8, letterSpacing: "0.02em" }}>AÑADIR EJERCICIOS</p>
          {Object.keys(disponiblesPorGrupo).length === 0 ? (
            <p style={{ fontSize: 12, color: "#6B675F" }}>Ya agregaste todos los ejercicios disponibles a este día.</p>
          ) : (
            Object.entries(disponiblesPorGrupo).map(([grupo, ejs]) => (
              <div key={grupo} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: "#6B675F", margin: "0 0 6px" }}>{grupo}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ejs.map((ej) => (
                    <button key={ej.id} onClick={() => agregarAlDia(ej.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 999, border: "1px dashed #33312D", background: "transparent", color: "#9A968C", fontSize: 12, cursor: "pointer" }}>
                      <Plus size={12} /> {ej.nombre}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        // --- Modo normal: elegir sobre cuál ejercicio del día registrar ---
        <div ref={scrollEjercicios.ref} onMouseDown={scrollEjercicios.onMouseDown} onMouseMove={scrollEjercicios.onMouseMove} onMouseUp={scrollEjercicios.onMouseUp} onMouseLeave={scrollEjercicios.onMouseLeave} onClickCapture={scrollEjercicios.onClickCapture}
          style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 20, scrollbarWidth: "none", ...scrollEjercicios.style }}>
          {ejerciciosDelDia.length === 0 ? (
            <p style={{ fontSize: 13, color: "#6B675F" }}>Este día no tiene ejercicios todavía. Dale a "Editar" para agregar.</p>
          ) : (
            ejerciciosDelDia.map((ej) => (
              <button key={ej.id} onClick={() => { setEjercicioActivo(ej); setSeries([]); }}
                style={{ flexShrink: 0, padding: "10px 16px", borderRadius: 999, border: ej.id === ejercicioActivo.id ? `1.5px solid ${ej.color}` : "1.5px solid #33312D", background: ej.id === ejercicioActivo.id ? `${ej.color}22` : "transparent", color: ej.id === ejercicioActivo.id ? "#F2EFE9" : "#9A968C", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                {ej.nombre}
              </button>
            ))
          )}
        </div>
      )}

      {ejerciciosDelDia.length === 0 ? null : (
      <>
      <div style={{ background: "#26241F", borderRadius: 16, padding: 20, marginBottom: 20, border: "1px solid #33312D" }}>
        <div style={{ width: "100%", height: 140, borderRadius: 12, marginBottom: 16, background: `linear-gradient(135deg, ${ejercicioActivo.color}33, #26241F)`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${ejercicioActivo.color}55` }}>
          <Flame size={36} color={ejercicioActivo.color} />
          <span style={{ marginLeft: 8, fontSize: 12, color: "#9A968C" }}>Aquí va el video/imagen del ejercicio</span>
        </div>
        <h2 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 700 }}>{ejercicioActivo.nombre}</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#9A968C" }}>Grupo muscular: {ejercicioActivo.grupo}</p>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#26241F", borderRadius: 10, padding: 4 }}>
        {[{ id: "registrar", label: "Registrar" }, { id: "historial", label: "Historial" }].map((t) => (
          <button key={t.id} onClick={() => setVista(t.id)} style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: "none", cursor: "pointer", background: vista === t.id ? "#3A3833" : "transparent", color: vista === t.id ? "#F2EFE9" : "#9A968C", fontSize: 13, fontWeight: 600 }}>
            {t.label}
          </button>
        ))}
      </div>

      {vista === "registrar" ? (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#9A968C", fontWeight: 600 }}>PESO (KG)</label>
              <input type="number" value={peso} onChange={(e) => setPeso(Number(e.target.value))}
                style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #33312D", background: "#26241F", color: "#F2EFE9", fontSize: 16, fontWeight: 600 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#9A968C", fontWeight: 600 }}>REPETICIONES</label>
              <input type="number" value={reps} onChange={(e) => setReps(Number(e.target.value))}
                style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #33312D", background: "#26241F", color: "#F2EFE9", fontSize: 16, fontWeight: 600 }} />
            </div>
          </div>

          <button onClick={agregarSerie} disabled={limiteAlcanzado}
            style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", cursor: limiteAlcanzado ? "not-allowed" : "pointer", background: limiteAlcanzado ? "#3A3833" : ejercicioActivo.color, color: limiteAlcanzado ? "#6B675F" : "#1C1B19", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
            <Plus size={16} strokeWidth={2.5} /> {limiteAlcanzado ? "Límite de 4 series alcanzado" : "Añadir serie"}
          </button>
          <p style={{ textAlign: "center", fontSize: 12, color: "#6B675F", marginBottom: 20 }}>{series.length} / {MAX_SERIES} series</p>

          {series.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6B675F", fontSize: 13, padding: "20px 0" }}>Aún no has registrado series en esta sesión</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {series.map((s, i) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#26241F", borderRadius: 10, padding: "10px 14px", border: "1px solid #33312D" }}>
                  <span style={{ fontSize: 13, color: "#9A968C", fontWeight: 600 }}>Serie {i + 1}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{s.peso} kg × {s.reps} reps</span>
                  <button onClick={() => quitarSerie(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B675F" }}><X size={16} /></button>
                </div>
              ))}
            </div>
          )}

          {series.length > 0 && (
            <button onClick={guardarSesion} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1.5px solid #33312D", background: "transparent", color: "#F2EFE9", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Guardar sesión
            </button>
          )}
        </div>
      ) : (
        <div>
          {sesiones.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6B675F", fontSize: 13, padding: "30px 0" }}>Todavía no hay historial para {ejercicioActivo.nombre.toLowerCase()}</p>
          ) : (
            <>
              <div style={{ background: "#26241F", borderRadius: 16, padding: "16px 8px 8px", marginBottom: 16, border: "1px solid #33312D" }}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={datosGrafica}>
                    <CartesianGrid stroke="#33312D" vertical={false} />
                    <XAxis dataKey="fecha" stroke="#6B675F" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B675F" fontSize={11} tickLine={false} axisLine={false} width={30} />
                    <Tooltip contentStyle={{ background: "#1C1B19", border: "1px solid #33312D", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="peso" stroke={ejercicioActivo.color} strokeWidth={2.5} dot={{ r: 3, fill: ejercicioActivo.color }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {progreso !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#26241F", borderRadius: 10, padding: "12px 14px", marginBottom: 16, border: "1px solid #33312D" }}>
                  <TrendingUp size={18} color={progreso >= 0 ? "#3DE87E" : "#E85D3D"} />
                  <span style={{ fontSize: 13, color: "#9A968C" }}>
                    {progreso >= 0 ? "Has subido" : "Has bajado"} <b style={{ color: "#F2EFE9" }}>{Math.abs(progreso)} kg</b> desde tu primer registro
                  </span>
                </div>
              )}

              {/* Detalle serie por serie de cada sesión pasada */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...sesiones].reverse().map((s, i) => (
                  <div key={i} style={{ background: "#26241F", borderRadius: 10, border: "1px solid #33312D", padding: "10px 14px" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9A968C", fontWeight: 600 }}>{s.fecha}</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {s.series.map((serie, j) => (
                        <span key={j} style={{ fontSize: 12, background: "#1C1B19", border: "1px solid #33312D", borderRadius: 999, padding: "4px 10px" }}>
                          S{j + 1}: {serie.peso}kg × {serie.reps}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}

// --- Componente principal ---
export default function GymTracker() {
  const [seccion, setSeccion] = useState("calentamiento");

  // Estos tres viven aquí (en el padre, que nunca se destruye) para que no se
  // pierdan al cambiar entre las pestañas "Calentar" y "Rutina".
  const [dias, setDias] = useState(DIAS_INICIALES);
  const [diaActivoId, setDiaActivoId] = useState(DIAS_INICIALES[0].id);
  const [historico, setHistorico] = useState(HISTORICO_INICIAL);
  const [calentamiento, setCalentamiento] = useState(CALENTAMIENTO_INICIAL);
  const [tema, setTema] = useState("rojo");
  const colorAcento = TEMAS[tema];

  return (
    <div style={{ minHeight: "100vh", background: "#1C1B19", color: "#F2EFE9", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 20px 100px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: colorAcento, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Dumbbell size={20} color="#1C1B19" strokeWidth={2.5} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Rutina</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#9A968C" }}>¡Siempre fuerte, imparable!</p>
            </div>
          </div>

          {/* Selector de tema: círculos de color, el activo tiene un anillo */}
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(TEMAS).map(([nombre, color]) => (
              <button key={nombre} onClick={() => setTema(nombre)} aria-label={`Tema ${nombre}`}
                style={{
                  width: 22, height: 22, borderRadius: "50%", background: color, cursor: "pointer",
                  border: tema === nombre ? "2px solid #F2EFE9" : "2px solid transparent",
                  boxShadow: tema === nombre ? `0 0 0 2px ${color}55` : "none",
                  padding: 0,
                }}
              />
            ))}
          </div>
        </header>

        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#26241F", borderRadius: 10, padding: 4 }}>
          {[
            { id: "calentamiento", label: "Calentar" },
            { id: "rutina", label: "Rutina" },
          ].map((s) => (
            <button key={s.id} onClick={() => setSeccion(s.id)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 7, border: "none", cursor: "pointer", background: seccion === s.id ? colorAcento : "transparent", color: seccion === s.id ? "#1C1B19" : "#9A968C", fontSize: 13, fontWeight: 700 }}>
              {s.label}
            </button>
          ))}
        </div>

        {seccion === "calentamiento" && <Calentamiento lista={calentamiento} setLista={setCalentamiento} colorAcento={colorAcento} />}
        {seccion === "rutina" && (
          <Rutina
            dias={dias}
            setDias={setDias}
            diaActivoId={diaActivoId}
            setDiaActivoId={setDiaActivoId}
            historico={historico}
            setHistorico={setHistorico}
            colorAcento={colorAcento}
          />
        )}
      </div>
    </div>
  );
}