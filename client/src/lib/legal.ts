/**
 * Textos legales (Política de Privacidad, Términos y Política de Cookies).
 *
 * IMPORTANTE: rellena LEGAL_OWNER con los datos reales del titular antes de publicar.
 * Lo que va entre corchetes se resalta en pantalla para que no pase desapercibido.
 * Estos textos son una base clara para una app española (RGPD, LOPDGDD y LSSI-CE);
 * conviene que los revise un profesional antes del lanzamiento.
 */

export const LEGAL_OWNER = {
  name: "[Nombre o razón social del titular]",
  taxId: "[NIF/CIF]",
  address: "[Dirección postal completa]",
  email: "[email de contacto para privacidad]",
};

export const LEGAL_UPDATED = "25 de noviembre de 2026";

export type LegalBlock = string | { list: string[] } | { table: { head: string[]; rows: string[][] } };
export type LegalSection = { heading: string; blocks: LegalBlock[] };
export type LegalDoc = { slug: LegalSlug; path: string; title: string; short: string; summary: string; sections: LegalSection[] };
export type LegalSlug = "privacidad" | "terminos" | "cookies";

const owner = `${LEGAL_OWNER.name}, con ${LEGAL_OWNER.taxId} y domicilio en ${LEGAL_OWNER.address}`;

const privacy: LegalDoc = {
  slug: "privacidad",
  path: "/privacidad",
  title: "Política de Privacidad",
  short: "Privacidad",
  summary: "Qué datos guardamos, para qué y cómo controlarlos.",
  sections: [
    {
      heading: "Quién es responsable",
      blocks: [`El responsable de tus datos es ${owner}. Para cualquier cuestión de privacidad, escríbenos a ${LEGAL_OWNER.email}.`],
    },
    {
      heading: "Qué datos tratamos",
      blocks: [
        {
          list: [
            "Cuenta: tu email, que usamos para enviarte el código de acceso.",
            "Perfil: nombre, nombre de usuario, biografía, foto, usuarios de Instagram y TikTok y web, si decides añadirlos.",
            "Contenido: tus scrapbooks, fotos, textos y la ubicación que asignes a cada viaje.",
            "Pegatinas: las pegatinas NFC/QR vinculadas a tu cuenta y el scrapbook que abren.",
            "Recompensas: el enlace a las publicaciones que envías para conseguir una recompensa y su estado.",
            "Preferencias: tus ajustes de privacidad, de comunicaciones y de cookies.",
            "Datos técnicos: la información mínima para mantener tu sesión abierta y segura.",
          ],
        },
      ],
    },
    {
      heading: "Para qué y con qué base",
      blocks: [
        {
          list: [
            "Darte el servicio (cuenta, scrapbooks, pegatinas, colaboración): ejecución del contrato (art. 6.1.b RGPD).",
            "Gestionar recompensas UGC: ejecución del contrato, al participar tú voluntariamente.",
            "Enviarte novedades por email: tu consentimiento (art. 6.1.a RGPD), que puedes retirar cuando quieras desde Perfil.",
            "Proteger la app frente a abusos y fraudes: nuestro interés legítimo (art. 6.1.f RGPD).",
            "Cumplir obligaciones legales, como las fiscales en las compras: obligación legal (art. 6.1.c RGPD).",
          ],
        },
        "No vendemos tus datos ni los usamos para publicidad personalizada.",
      ],
    },
    {
      heading: "Cuánto tiempo los guardamos",
      blocks: [
        "Mientras tu cuenta exista. Si la eliminas, borramos tu perfil, tus scrapbooks, tus fotos y tus solicitudes. Solo conservamos, bloqueado, lo que la ley nos obligue a guardar (por ejemplo, facturas durante el plazo legal).",
      ],
    },
    {
      heading: "Quién más los trata",
      blocks: [
        "Proveedores que nos ayudan a prestar el servicio, con contrato de encargo de tratamiento:",
        {
          list: [
            "Supabase: base de datos, autenticación y almacenamiento de fotos, alojados en la Unión Europea (Irlanda).",
            "Vercel: alojamiento de la web. Puede tratar datos técnicos fuera de la UE con las garantías del Marco de Privacidad de Datos UE-EE. UU. o cláusulas contractuales tipo.",
            "OpenStreetMap: al abrir el mapa, tu navegador descarga las teselas de sus servidores, que reciben tu dirección IP.",
            "Servicios de tipografías web: al cargar la app, tu navegador descarga las fuentes, lo que expone tu dirección IP a ese proveedor.",
          ],
        },
        "Los scrapbooks que marques como públicos y tu perfil (si no es privado) pueden verlos otras personas. Tu email nunca se muestra.",
      ],
    },
    {
      heading: "Tus derechos",
      blocks: [
        "Puedes acceder, rectificar, suprimir, oponerte, limitar el tratamiento, pedir la portabilidad de tus datos y retirar tu consentimiento en cualquier momento.",
        {
          list: [
            "Desde Perfil puedes editar tus datos, descargar una copia y eliminar tu cuenta.",
            `Para todo lo demás, escribe a ${LEGAL_OWNER.email}. Respondemos en un máximo de un mes.`,
            "Si crees que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).",
          ],
        },
      ],
    },
    {
      heading: "Menores",
      blocks: ["Necesitas tener al menos 14 años para crear una cuenta. Si eres menor, tus padres o tutores deben autorizarlo."],
    },
    {
      heading: "Seguridad",
      blocks: ["Aplicamos medidas técnicas y organizativas razonables: conexiones cifradas, acceso sin contraseña con código de un solo uso y reglas de acceso por usuario en la base de datos."],
    },
    {
      heading: "Cambios",
      blocks: ["Si cambiamos esta política de forma relevante, te avisaremos en la app antes de que el cambio se aplique."],
    },
  ],
};

const terms: LegalDoc = {
  slug: "terminos",
  path: "/terminos",
  title: "Términos y Condiciones",
  short: "Términos",
  summary: "Las reglas de uso de Memento Mundi.",
  sections: [
    {
      heading: "Quiénes somos",
      blocks: [`Memento Mundi es un servicio de ${owner}. Al crear una cuenta aceptas estos términos.`],
    },
    {
      heading: "Tu cuenta",
      blocks: [
        {
          list: [
            "Debes tener al menos 14 años.",
            "Entras con un código que enviamos a tu email: mantén ese email seguro.",
            "Eres responsable de lo que se haga desde tu cuenta.",
            "Puedes eliminar tu cuenta en cualquier momento desde Perfil.",
          ],
        },
      ],
    },
    {
      heading: "Tu contenido",
      blocks: [
        "Tus fotos y textos siguen siendo tuyos. Nos das permiso para alojarlos, procesarlos (por ejemplo, redimensionar fotos) y mostrarlos a quien tú decidas: tú, tus colaboradores o cualquiera si el scrapbook es público. El permiso termina cuando borras el contenido o tu cuenta.",
        "Solo subas contenido sobre el que tengas derechos. Si aparecen otras personas, asegúrate de que están de acuerdo.",
      ],
    },
    {
      heading: "Normas de uso",
      blocks: [
        {
          list: [
            "Nada ilegal, violento, de odio o que vulnere derechos de terceros.",
            "No intentes acceder a cuentas o datos ajenos ni sobrecargar el servicio.",
            "No uses la app para enviar publicidad no solicitada.",
          ],
        },
        "Podemos retirar contenido o suspender cuentas que incumplan estas normas, explicándote el motivo.",
      ],
    },
    {
      heading: "Pegatinas y productos",
      blocks: [
        "Cada pegatina NFC/QR abre el scrapbook al que la vincules. Si la pierdes o se daña, el scrapbook sigue disponible en tu cuenta.",
        "Las compras en la tienda se rigen por sus condiciones de venta. Como consumidor tienes 14 días naturales para desistir de la compra de productos no personalizados.",
      ],
    },
    {
      heading: "Recompensas UGC",
      blocks: [
        {
          list: [
            "Publica en tu cuenta pública de Instagram o TikTok contenido propio sobre Memento Mundi y envíanos el enlace desde Perfil.",
            "Revisamos cada solicitud a mano. Una publicación da derecho a una sola recompensa.",
            "Podemos rechazar publicaciones copiadas, borradas, privadas o engañosas.",
            "Las recompensas y los puntos no tienen valor económico, no se cambian por dinero y dependen de la disponibilidad.",
            "Si queremos compartir tu publicación en nuestros canales, te pediremos permiso antes.",
          ],
        },
      ],
    },
    {
      heading: "Disponibilidad y responsabilidad",
      blocks: [
        "Trabajamos para que el servicio esté siempre disponible y tus datos a salvo, pero puede haber interrupciones por mantenimiento o causas ajenas. Te recomendamos descargar de vez en cuando una copia de tus datos desde Perfil.",
        "Nada de lo anterior limita los derechos que te reconoce la normativa de consumidores.",
      ],
    },
    {
      heading: "Cambios y ley aplicable",
      blocks: [
        "Si cambiamos estos términos de forma relevante te avisaremos con antelación. Se rigen por la ley española; si eres consumidor, puedes acudir a los tribunales de tu domicilio.",
      ],
    },
  ],
};

const cookies: LegalDoc = {
  slug: "cookies",
  path: "/cookies",
  title: "Política de Cookies",
  short: "Cookies",
  summary: "Qué guardamos en tu navegador y cómo cambiarlo.",
  sections: [
    {
      heading: "Qué son",
      blocks: ["Las cookies y el almacenamiento local son pequeños datos que una web guarda en tu navegador para recordar información entre visitas."],
    },
    {
      heading: "Qué usamos",
      blocks: [
        "Hoy solo usamos almacenamiento técnico, necesario para que la app funcione. No necesita tu consentimiento, pero te lo contamos:",
        {
          table: {
            head: ["Nombre", "Para qué", "Duración"],
            rows: [
              ["memento-mundi:supabase-session", "Mantener tu sesión iniciada", "Hasta que cierres sesión"],
              ["memento-mundi:cookie-consent", "Recordar tu elección de cookies", "24 meses"],
              ["memento-mundi:preferences", "Recordar tus preferencias de la app", "Hasta que lo borres"],
              ["memento-mundi:scrapbook:*", "Copia de seguridad de tus scrapbooks en este dispositivo", "Hasta que lo borres"],
            ],
          },
        },
        "No usamos cookies de analítica ni de publicidad. Si en el futuro las añadimos, solo se activarán si das tu permiso en el panel de cookies.",
      ],
    },
    {
      heading: "Servicios de terceros",
      blocks: ["El mapa (OpenStreetMap) y las tipografías se descargan de servidores externos. No instalan cookies a través de nuestra app, pero reciben tu dirección IP al servir el contenido."],
    },
    {
      heading: "Cómo gestionarlas",
      blocks: [
        "Puedes cambiar tu elección cuando quieras desde el botón «Configurar cookies» de esta página o desde Perfil › Legal.",
        "También puedes borrar los datos guardados desde los ajustes de tu navegador. Si lo haces, se cerrará tu sesión.",
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalSlug, LegalDoc> = { privacidad: privacy, terminos: terms, cookies };
export const LEGAL_LIST: LegalDoc[] = [privacy, terms, cookies];
