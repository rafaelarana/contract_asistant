export type Lang = "ca" | "es" | "en";

export interface ExamplePrompt {
  icon: string;
  text: string;
  short: string;
}

export interface Translations {
  title: string;
  subtitle: string;
  desc: string;
  welcome_title: string;
  welcome_desc: string;
  placeholder: string;
  send: string;
  new_chat: string;
  recent: string;
  none_yet: string;
  useful: string;
  improvable: string;
  thanks: string;
  toast_pos: string;
  toast_neg: string;
  modal_title: string;
  modal_desc: string;
  modal_placeholder: string;
  modal_cancel: string;
  modal_submit: string;
  tracing: string;
  powered: string;
  doc_sources: string;
  doc_loading: string;
  doc_error: string;
  doc_close: string;
  doc_open_tab: string;
  signed_in_as: string;
  examples: ExamplePrompt[];
}

const I18N: Record<Lang, Translations> = {
  ca: {
    title: "Assistent GEEC",
    subtitle: "Gestor d'Expedients Electrònics de Contractació",
    desc: "Assistent virtual per a la contractació pública de la Generalitat de Catalunya",
    welcome_title: "Benvingut a l'Assistent GEEC",
    welcome_desc:
      "Fes preguntes sobre procediments de contractació pública, normativa LCSP, gestió d'expedients i més.",
    placeholder: "Escriu la teva pregunta aquí...",
    send: "Enviar",
    new_chat: "+ Nova conversa",
    recent: "Converses recents",
    none_yet: "Cap conversa encara",
    useful: "Útil",
    improvable: "Millorable",
    thanks: "Gràcies pel teu feedback!",
    toast_pos: "Feedback registrat a MLflow Traces!",
    toast_neg: "Feedback amb comentari registrat a MLflow!",
    modal_title: "Deixa el teu comentari",
    modal_desc: "El teu feedback ajuda a millorar l'assistent (opcional)",
    modal_placeholder: "Què podríem millorar?...",
    modal_cancel: "Cancel·lar",
    modal_submit: "Enviar feedback",
    tracing: "Tracing actiu",
    powered: "Amb tecnologia Databricks",
    doc_sources: "Fonts",
    doc_loading: "Carregant document...",
    doc_error: "No s'ha pogut carregar el document",
    doc_close: "Tancar",
    doc_open_tab: "Obrir en una nova pestanya",
    signed_in_as: "Connectat com",
    examples: [
      { icon: "\u2696\ufe0f", text: "Què és la GEEC i per a què serveix?", short: "Què és GEEC?" },
      { icon: "\ud83d\udccb", text: "Com es tramita un contracte menor a la GEEC?", short: "Contracte menor" },
      { icon: "\ud83d\udd04", text: "Quines són les fases del procediment obert?", short: "Proc. obert" },
      { icon: "\ud83d\udd17", text: "Com funciona la integració amb GECAT?", short: "Integració GECAT" },
      { icon: "\ud83d\udcc5", text: "Explica el procés de pròrroga d'un contracte", short: "Pròrrogues" },
      { icon: "\ud83d\udd0d", text: "Què és el visor d'expedients?", short: "Visor expedients" },
    ],
  },
  es: {
    title: "Asistente GEEC",
    subtitle: "Gestor de Expedientes Electrónicos de Contratación",
    desc: "Asistente virtual para la contratación pública de la Generalitat de Catalunya",
    welcome_title: "Bienvenido al Asistente GEEC",
    welcome_desc:
      "Pregunta sobre procedimientos de contratación pública, normativa LCSP, gestión de expedientes y más.",
    placeholder: "Escribe tu pregunta aquí...",
    send: "Enviar",
    new_chat: "+ Nueva conversación",
    recent: "Conversaciones recientes",
    none_yet: "Ninguna conversación aún",
    useful: "Útil",
    improvable: "Mejorable",
    thanks: "Gracias por tu feedback!",
    toast_pos: "Feedback registrado en MLflow Traces!",
    toast_neg: "Feedback con comentario registrado en MLflow!",
    modal_title: "Deja tu comentario",
    modal_desc: "Tu feedback ayuda a mejorar el asistente (opcional)",
    modal_placeholder: "¿Qué podríamos mejorar?...",
    modal_cancel: "Cancelar",
    modal_submit: "Enviar feedback",
    tracing: "Tracing activo",
    powered: "Con tecnología Databricks",
    doc_sources: "Fuentes",
    doc_loading: "Cargando documento...",
    doc_error: "No se pudo cargar el documento",
    doc_close: "Cerrar",
    doc_open_tab: "Abrir en una nueva pestaña",
    signed_in_as: "Conectado como",
    examples: [
      { icon: "\u2696\ufe0f", text: "¿Qué es la GEEC y para qué sirve?", short: "Qué es GEEC?" },
      { icon: "\ud83d\udccb", text: "¿Cómo se tramita un contrato menor en la GEEC?", short: "Contrato menor" },
      { icon: "\ud83d\udd04", text: "¿Cuáles son las fases del procedimiento abierto?", short: "Proc. abierto" },
      { icon: "\ud83d\udd17", text: "¿Cómo funciona la integración con GECAT?", short: "Integración GECAT" },
      { icon: "\ud83d\udcc5", text: "Explica el proceso de prórroga de un contrato", short: "Prórrogas" },
      { icon: "\ud83d\udd0d", text: "¿Qué es el visor de expedientes?", short: "Visor expedientes" },
    ],
  },
  en: {
    title: "GEEC Assistant",
    subtitle: "Electronic Procurement File Manager",
    desc: "Virtual assistant for public procurement of the Generalitat de Catalunya",
    welcome_title: "Welcome to the GEEC Assistant",
    welcome_desc:
      "Ask about public procurement procedures, LCSP regulations, file management and more.",
    placeholder: "Type your question here...",
    send: "Send",
    new_chat: "+ New conversation",
    recent: "Recent conversations",
    none_yet: "No conversations yet",
    useful: "Useful",
    improvable: "Needs improvement",
    thanks: "Thanks for your feedback!",
    toast_pos: "Feedback logged to MLflow Traces!",
    toast_neg: "Feedback with comment logged to MLflow!",
    modal_title: "Leave a comment",
    modal_desc: "Your feedback helps improve the assistant (optional)",
    modal_placeholder: "What could we improve?...",
    modal_cancel: "Cancel",
    modal_submit: "Submit feedback",
    tracing: "Tracing active",
    powered: "Powered by Databricks",
    doc_sources: "Sources",
    doc_loading: "Loading document...",
    doc_error: "Could not load the document",
    doc_close: "Close",
    doc_open_tab: "Open in new tab",
    signed_in_as: "Signed in as",
    examples: [
      { icon: "\u2696\ufe0f", text: "What is GEEC and what is it for?", short: "What is GEEC?" },
      { icon: "\ud83d\udccb", text: "How do you process a minor contract in GEEC?", short: "Minor contract" },
      { icon: "\ud83d\udd04", text: "What are the phases of the open procedure?", short: "Open procedure" },
      { icon: "\ud83d\udd17", text: "How does GECAT integration work?", short: "GECAT integration" },
      { icon: "\ud83d\udcc5", text: "Explain the contract extension process", short: "Extensions" },
      { icon: "\ud83d\udd0d", text: "What is the file viewer?", short: "File viewer" },
    ],
  },
};

export const DEFAULT_LANG: Lang = "ca";

export function t<K extends keyof Translations>(key: K, lang?: Lang): Translations[K] {
  const l = lang || DEFAULT_LANG;
  return I18N[l]?.[key] ?? I18N[DEFAULT_LANG][key];
}
