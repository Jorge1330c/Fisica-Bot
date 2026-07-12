import os
import re
import base64
import fitz
from google import genai
from google.genai import types
from rank_bm25 import BM25Okapi

# ================= CONFIGURACIÓN =================
NOMBRE_PDF = "FISICA.pdf"
MAX_CARACTERES_TOTAL = 60000
TAMANO_CHUNK = 8000
client = None
texto_completo_referencia = ""

# ================= EXTRACCIÓN PDF =================
def extraer_texto_pdf_avanzado(ruta_pdf=None):
    if ruta_pdf is None:
        ruta_pdf = NOMBRE_PDF
    if not os.path.exists(ruta_pdf):
        return ""

    texto_completo = ""
    try:
        doc = fitz.open(ruta_pdf)
        total_paginas = len(doc)
        print(f"📄 Leyendo {total_paginas} páginas desde {ruta_pdf}...")

        for num_pag in range(total_paginas):
            pagina = doc[num_pag]
            texto_pagina = pagina.get_text("text")
            
            super_map = str.maketrans({
                '²': '^2', '³': '^3', '⁴': '^4', '⁵': '^5',
                '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9', '⁰': '^0'
            })
            texto_pagina = texto_pagina.translate(super_map)
            sub_map = str.maketrans({
                '₂': '_2', '₃': '_3', '₄': '_4', '₅': '_5',
                '₆': '_6', '₇': '_7', '₈': '_8', '₉': '_9', '₀': '_0'
            })
            texto_pagina = texto_pagina.translate(sub_map)
            
            texto_pagina = texto_pagina.replace('·', '*')
            texto_pagina = texto_pagina.replace('×', '*')
            texto_pagina = texto_pagina.replace('π', 'pi')
            texto_pagina = texto_pagina.replace('∑', 'sumatoria')
            texto_pagina = texto_pagina.replace('∫', 'integral')
            texto_pagina = texto_pagina.replace('Δ', 'delta')
            texto_pagina = texto_pagina.replace('√', 'raiz_cuadrada')
            texto_pagina = texto_pagina.replace('∞', 'infinito')
            
            texto_pagina = re.sub(r'\s+', ' ', texto_pagina).strip()
            
            texto_completo += f"\n[Página {num_pag+1}]\n" + texto_pagina

            if len(texto_completo) > MAX_CARACTERES_TOTAL:
                print(f"⚠️ Límite alcanzado. Truncando.")
                texto_completo = texto_completo[:MAX_CARACTERES_TOTAL]
                break

        doc.close()
        print("✅ Extracción completada.")
        return texto_completo
    except Exception as e:
        print(f"❌ Error al leer PDF: {e}")
        return ""

# ================= DIVISIÓN EN CHUNKS =================
def dividir_en_chunks(texto, tamano=TAMANO_CHUNK):
    chunks = []
    for i in range(0, len(texto), tamano):
        chunk = texto[i:i+tamano]
        if chunk:
            chunks.append(chunk)
    return chunks

# ================= LIMPIEZA DE RESPUESTA =================
def limpiar_respuesta(texto):
    texto = re.sub(r'```.*?```', '', texto, flags=re.DOTALL)
    texto = re.sub(r'\*\*(.*?)\*\*', r'\1', texto)
    texto = re.sub(r'\*(.*?)\*', r'\1', texto)
    texto = re.sub(r'__(.*?)__', r'\1', texto)
    texto = re.sub(r'_(.*?)_', r'\1', texto)
    texto = re.sub(r'~~(.*?)~~', r'\1', texto)
    texto = re.sub(r'#+\s*', '', texto)
    texto = re.sub(r'\n{3,}', '\n\n', texto)
    return texto.strip()

# ================= BM25 =================
def tokenizar(texto):
    return re.sub(r'[^a-zA-Záéíóúñ0-9/^_]', ' ', texto.lower()).split()

def encontrar_chunks_relevantes(texto_completo, pregunta, num_chunks=4):
    chunks = dividir_en_chunks(texto_completo)
    if not chunks:
        return []
    corpus = [tokenizar(chunk) for chunk in chunks]
    bm25 = BM25Okapi(corpus)
    tokens_pregunta = tokenizar(pregunta)
    puntuaciones = bm25.get_scores(tokens_pregunta)
    mejores = sorted(range(len(puntuaciones)), key=lambda i: puntuaciones[i], reverse=True)[:num_chunks]
    seleccionados = [chunks[i] for i in mejores if puntuaciones[i] > 0]
    return seleccionados if seleccionados else chunks[:num_chunks]

# ================= CONFIGURACIÓN DE GEMINI =================
def inicializar_cliente(api_key=None):
    global client
    if api_key is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            api_key = "AQ.Ab8RN6KJqfBa9ypXdP8NuhuMLPpU8xuL02hjmNq7Fl2BXv4T_w"
            print("⚠️ Usando clave API hardcodeada (no segura).")
    try:
        client = genai.Client(api_key=api_key)
        return True
    except Exception as e:
        print(f"Error Gemini: {e}")
        return False

def set_api_key(nueva_key):
    return inicializar_cliente(nueva_key)

# ================= PROCESAMIENTO DEL PDF =================
def cargar_y_procesar_pdf(ruta_pdf=None):
    global texto_completo_referencia, NOMBRE_PDF
    if ruta_pdf is not None:
        NOMBRE_PDF = ruta_pdf
    print("📚 Cargando y procesando el libro completo ...")
    texto_extraido = extraer_texto_pdf_avanzado(NOMBRE_PDF)
    if not texto_extraido:
        print("❌ No se pudo extraer el texto del PDF.")
        return False
    texto_completo_referencia = texto_extraido
    print(f"✅ Libro cargado. {len(texto_completo_referencia)} caracteres.")
    print("-" * 50 + "\n")
    return True

def actualizar_pdf(ruta_pdf):
    return cargar_y_procesar_pdf(ruta_pdf)

# ================= FUNCIÓN DE RESPUESTA (TEXTO) =================
def obtener_respuesta(pregunta):
    global texto_completo_referencia, client
    if not client:
        return "Cliente Gemini no disponible."

    if texto_completo_referencia:
        chunks = encontrar_chunks_relevantes(texto_completo_referencia, pregunta)
        contexto = "\n\n---\n\n".join(chunks) if chunks else "No se encontraron fragmentos relevantes."
    else:
        contexto = "No hay libro cargado."

    prompt = f"""
Eres Físicabot, un asistente experto en Física Universitaria. Proporciona respuestas precisas, verificables y bien fundamentadas.

**Fuente principal:** {contexto}

**Pregunta del estudiante:** {pregunta}

---

**REGLAS OBLIGATORIAS:**
1. Si la información está en el libro, cita la página [Página X].
2. Si NO está en el libro, indícalo claramente y luego complementa con tu conocimiento general.
3. Usa LaTeX para todas las fórmulas: \(...\) para inline y \[...\] para ecuaciones en bloque.
4. No uses Markdown (excepto listas). No uses negritas ni cursivas.
5. Estructura: TÍTULO, Definición, Fórmula, Variables, Explicación, Ejemplo, Conclusión.
6. Si no estás seguro, dilo.

**Recuerda:** No inventes datos.
"""
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.9,
                max_output_tokens=2000
            )
        )
        respuesta = limpiar_respuesta(response.text) if response.text else "No obtuve respuesta."
        return respuesta
    except Exception as e:
        return f"Error al generar respuesta: {e}"

# ================= FUNCIÓN DE RESPUESTA CON IMAGEN =================
def obtener_respuesta_con_imagen(pregunta, imagen_base64, mime_type):
    global texto_completo_referencia, client
    if not client:
        return "Cliente Gemini no disponible."

    if texto_completo_referencia:
        chunks = encontrar_chunks_relevantes(texto_completo_referencia, pregunta)
        contexto = "\n\n---\n\n".join(chunks) if chunks else "No se encontraron fragmentos relevantes."
    else:
        contexto = "No hay libro cargado."

    prompt = f"""
Eres Físicabot, un asistente experto en Física Universitaria. Analiza la imagen adjunta y responde con precisión.

**Fuente principal:** {contexto}

**Pregunta del estudiante:** {pregunta if pregunta else "No hay pregunta, solo se adjuntó una imagen."}

**Instrucción:** La imagen puede contener un problema, gráfico o fórmula. Descifra su contenido y responde según la pregunta.

**REGLAS:**
- Si la información está en el libro, cita la página.
- Si no, indícalo y complementa con tu conocimiento.
- Usa LaTeX para fórmulas (\(...\) y \[...\]).
- No uses Markdown.
- Estructura: TÍTULO, Definición, Fórmula, Variables, Explicación, Ejemplo, Conclusión.
"""

    try:
        # Construir contenido: imagen + texto
        image_part = types.Part.from_bytes(
            data=base64.b64decode(imagen_base64),
            mime_type=mime_type
        )
        text_part = types.Part.from_text(text=prompt)

        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=[image_part, text_part],
            config=types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.9,
                max_output_tokens=2000
            )
        )
        respuesta = limpiar_respuesta(response.text) if response.text else "No se pudo interpretar la imagen."
        return respuesta
    except Exception as e:
        return f"Error al generar respuesta con imagen: {e}"