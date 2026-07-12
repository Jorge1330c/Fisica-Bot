from flask import Flask, render_template, request, jsonify
from chatbot import (
    obtener_respuesta,
    obtener_respuesta_con_imagen,
    inicializar_cliente,
    cargar_y_procesar_pdf,
    set_api_key,
    actualizar_pdf,
)
import threading
import os
import json
from datetime import datetime
from werkzeug.utils import secure_filename
import uuid
import base64

app = Flask(__name__)

# Configuración de carpetas
UPLOAD_FOLDER = 'uploads'
CONVERSACIONES_FOLDER = 'conversaciones'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONVERSACIONES_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB

# ================ INICIALIZACIÓN ================
def iniciar_background():
    if inicializar_cliente():
        threading.Thread(target=cargar_y_procesar_pdf, daemon=True).start()
    else:
        print("❌ No se pudo inicializar Gemini.")

iniciar_background()

# ================ FUNCIONES PARA CONVERSACIONES ================

def guardar_mensaje(conv_id, rol, contenido):
    """Guarda un mensaje en el archivo de la conversación."""
    ruta = os.path.join(CONVERSACIONES_FOLDER, f"{conv_id}.json")
    mensaje = {
        "rol": rol,
        "contenido": contenido,
        "timestamp": datetime.now().isoformat()
    }
    if os.path.exists(ruta):
        with open(ruta, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = {"id": conv_id, "mensajes": []}
    data["mensajes"].append(mensaje)
    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def crear_nueva_conversacion():
    return str(uuid.uuid4())

def obtener_lista_conversaciones():
    conversaciones = []
    for archivo in os.listdir(CONVERSACIONES_FOLDER):
        if archivo.endswith('.json'):
            ruta = os.path.join(CONVERSACIONES_FOLDER, archivo)
            with open(ruta, 'r', encoding='utf-8') as f:
                data = json.load(f)
                mensajes = data.get("mensajes", [])
                if mensajes:
                    primer_mensaje = mensajes[0]["contenido"]
                    titulo = primer_mensaje[:50] + "..." if len(primer_mensaje) > 50 else primer_mensaje
                    fecha = datetime.fromisoformat(mensajes[0]["timestamp"]).strftime("%d/%m/%Y %H:%M")
                else:
                    titulo = "Conversación vacía"
                    fecha = "Sin fecha"
                conversaciones.append({
                    "id": data["id"],
                    "titulo": titulo,
                    "fecha": fecha,
                    "cantidad": len(mensajes)
                })
    conversaciones.sort(key=lambda x: x["fecha"], reverse=True)
    return conversaciones

def cargar_conversacion(conv_id):
    ruta = os.path.join(CONVERSACIONES_FOLDER, f"{conv_id}.json")
    if not os.path.exists(ruta):
        return None
    with open(ruta, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get("mensajes", [])

def eliminar_conversacion(conv_id):
    ruta = os.path.join(CONVERSACIONES_FOLDER, f"{conv_id}.json")
    if os.path.exists(ruta):
        os.remove(ruta)
        return True
    return False

# ================ RUTAS ================

@app.route("/")
def inicio():
    return render_template("index.html")

@app.route("/preguntar", methods=["POST"])
def preguntar():
    try:
        datos = request.get_json()
        pregunta = datos.get("pregunta", "")
        conv_id = datos.get("conversacion_id", None)

        if not conv_id:
            conv_id = crear_nueva_conversacion()

        guardar_mensaje(conv_id, "usuario", pregunta)
        respuesta = obtener_respuesta(pregunta)
        guardar_mensaje(conv_id, "asistente", respuesta)

        return jsonify({
            "respuesta": respuesta,
            "conversacion_id": conv_id
        })
    except Exception as e:
        return jsonify({"respuesta": f"Error: {str(e)}"}), 500

@app.route("/preguntar_con_imagen", methods=["POST"])
def preguntar_con_imagen():
    try:
        pregunta = request.form.get("pregunta", "")
        conv_id = request.form.get("conversacion_id", None)
        archivo_imagen = request.files.get("imagen")

        if not archivo_imagen:
            return jsonify({"respuesta": "No se envió ninguna imagen"}), 400

        imagen_bytes = archivo_imagen.read()
        imagen_base64 = base64.b64encode(imagen_bytes).decode('utf-8')
        mime_type = archivo_imagen.mimetype

        if not conv_id:
            conv_id = crear_nueva_conversacion()

        texto_usuario = pregunta if pregunta else "Adjuntó una imagen (sin texto)"
        guardar_mensaje(conv_id, "usuario", f"{texto_usuario} [Imagen adjunta]")

        respuesta = obtener_respuesta_con_imagen(pregunta, imagen_base64, mime_type)
        guardar_mensaje(conv_id, "asistente", respuesta)

        return jsonify({
            "respuesta": respuesta,
            "conversacion_id": conv_id
        })
    except Exception as e:
        return jsonify({"respuesta": f"Error al procesar imagen: {str(e)}"}), 500

@app.route("/cargar_pdf", methods=["POST"])
def cargar_pdf():
    if 'pdf' not in request.files:
        return jsonify({"error": "No se envió archivo"}), 400
    file = request.files['pdf']
    if file.filename == '':
        return jsonify({"error": "Nombre de archivo vacío"}), 400
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Solo se permiten archivos PDF"}), 400

    filename = secure_filename(file.filename)
    ruta = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(ruta)

    exito = actualizar_pdf(ruta)
    if exito:
        return jsonify({"mensaje": f"PDF '{filename}' cargado correctamente"}), 200
    else:
        return jsonify({"error": "Error al procesar el PDF"}), 500

@app.route("/configurar_api", methods=["POST"])
def configurar_api():
    data = request.get_json()
    api_key = data.get("api_key", "").strip()
    if not api_key:
        return jsonify({"error": "Clave API no proporcionada"}), 400

    exito = set_api_key(api_key)
    if exito:
        return jsonify({"mensaje": "Clave API actualizada correctamente"}), 200
    else:
        return jsonify({"error": "Error al configurar la clave API"}), 500

@app.route("/conversaciones", methods=["GET"])
def listar_conversaciones():
    conversaciones = obtener_lista_conversaciones()
    return jsonify(conversaciones)

@app.route("/conversacion/<conv_id>", methods=["GET"])
def obtener_conversacion(conv_id):
    mensajes = cargar_conversacion(conv_id)
    if mensajes is None:
        return jsonify({"error": "Conversación no encontrada"}), 404
    return jsonify(mensajes)

@app.route("/conversacion/<conv_id>", methods=["DELETE"])
def eliminar_conversacion_route(conv_id):
    if eliminar_conversacion(conv_id):
        return jsonify({"mensaje": "Conversación eliminada"}), 200
    else:
        return jsonify({"error": "No se pudo eliminar"}), 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))