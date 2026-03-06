const SUPABASE_URL = "https://hptdyehzqfpgtrpuydny.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdGR5ZWh6cWZwZ3RycHV5ZG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MzYyODIsImV4cCI6MjA4ODQxMjI4Mn0.apesTxMiG-WJbhtfpxorLPagiDAnFH826wR0CuZ4y_g";

const authFetch = async (path, options = {}, token = null) => {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${token || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "",
      ...options.headers,
    },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error_description || data.message || data.msg || "Error");
  return data;
};

// AUTH
export const signUp = (email, password) =>
  authFetch("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password }) });

export const signIn = (email, password) =>
  authFetch("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });

export const resetPassword = (email) =>
  authFetch("/auth/v1/recover", { method: "POST", body: JSON.stringify({ email }) });

// DB
const db = async (path, options = {}, token = null) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${token || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.method === "POST" ? "return=representation" : "",
      ...options.headers,
    },
    ...options,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : [];
};

export const getPublicaciones = (filtros = {}, token) => {
  let q = "publicaciones?order=created_at.desc";
  if (filtros.tipo) q += `&tipo=eq.${filtros.tipo}`;
  if (filtros.materia) q += `&materia=eq.${encodeURIComponent(filtros.materia)}`;
  return db(q, {}, token);
};

export const insertPublicacion = (data, token) =>
  db("publicaciones", { method: "POST", body: JSON.stringify(data) }, token);

export const getReseñas = (pubId, token) =>
  db(`rese%C3%B1as?publicacion_id=eq.${pubId}&order=created_at.desc`, {}, token);

export const insertReseña = (data, token) =>
  db("rese%C3%B1as", { method: "POST", body: JSON.stringify(data) }, token);

export const getMensajes = (pubId, token) =>
  db(`mensajes?publicacion_id=eq.${pubId}&order=created_at.asc`, {}, token);

export const insertMensaje = (data, token) =>
  db("mensajes", { method: "POST", body: JSON.stringify(data) }, token);
