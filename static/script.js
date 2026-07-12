// ================= VARIABLES GLOBALES =================
let conversacionActualId = null;
let archivoImagen = null;

// ================= INICIALIZACIÓN =================
document.addEventListener('DOMContentLoaded', function() {
    cargarHistorial();

    // Notificaciones
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Modo oscuro
    const btnModoOscuro = document.getElementById('btnModoOscuro');
    const temaGuardado = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', temaGuardado);
    actualizarIconoTema(temaGuardado);

    btnModoOscuro.addEventListener('click', function() {
        const actual = document.documentElement.getAttribute('data-theme');
        const nuevo = actual === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', nuevo);
        localStorage.setItem('theme', nuevo);
        actualizarIconoTema(nuevo);
    });

    // Botón nuevo chat
    const nuevoChatBtn = document.getElementById('btnNuevoChat');
    if (nuevoChatBtn) {
        nuevoChatBtn.addEventListener('click', function() {
            conversacionActualId = null;
            const chat = document.getElementById('chat');
            chat.innerHTML = `
                <div class="mensaje bienvenida">
                    <div class="avatar">
                        <i class="fa-solid fa-graduation-cap"></i>
                    </div>
                    <div class="burbuja bot">
                        <h3>¡Bienvenido!</h3>
                        <p>Soy <strong>Físicabot</strong>.</p>
                        <p>Estoy preparado para ayudarte con conceptos, ejercicios, fórmulas y problemas de Física.</p>
                        <p>Utilizo como fuente principal el libro <strong>Física Universitaria Vol. 1</strong> y complemento mis respuestas con inteligencia artificial cuando es necesario.</p>
                    </div>
                </div>
            `;
            chat.scrollTop = chat.scrollHeight;
            cargarHistorial();
        });
    }

    // Refrescar historial
    const refreshBtn = document.getElementById('btnRefrescarHistorial');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            cargarHistorial();
        });
    }

    // Menú lateral
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const accion = this.dataset.accion;
            if (accion === 'guia') {
                mostrarGuia();
            } else if (accion === 'acerca') {
                mostrarAcerca();
            }
            menuItems.forEach(m => m.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Menú hamburguesa
    const btnMenu = document.getElementById('btnMenuHamburguesa');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('overlaySidebar');

    btnMenu.addEventListener('click', function() {
        sidebar.classList.toggle('abierta');
        overlay.classList.toggle('visible');
    });

    overlay.addEventListener('click', function() {
        sidebar.classList.remove('abierta');
        overlay.classList.remove('visible');
    });

    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('abierta');
            overlay.classList.remove('visible');
        }
    });
});

// ================= FUNCIONES DEL MENÚ =================
function mostrarGuia() {
    const chat = document.getElementById('chat');
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    chat.innerHTML += `
        <div class="mensaje">
            <div class="avatar">
                <i class="fa-solid fa-graduation-cap"></i>
            </div>
            <div class="burbuja bot">
                <h3>📖 Guía de uso</h3>
                <p><strong>Físicabot</strong> es un asistente inteligente para resolver dudas de física universitaria.</p>
                <p><strong>¿Cómo funciona?</strong></p>
                <ul>
                    <li>Escribe tu pregunta en el campo de texto y presiona Enter o el botón enviar.</li>
                    <li>El bot buscará información en el libro cargado (por defecto <em>Física Universitaria Vol. 1</em>).</li>
                    <li>Si no encuentra la respuesta, usará su conocimiento general de física.</li>
                    <li>Puedes subir tu propio PDF (opcional) para que el bot responda basándose en ese material.</li>
                    <li>También puedes cambiar la clave API de Gemini si lo deseas.</li>
                    <li>Adjunta imágenes para que el bot analice gráficos, problemas o fórmulas escritas a mano.</li>
                </ul>
                <p><strong>Consejos:</strong></p>
                <ul>
                    <li>Formula preguntas claras y específicas.</li>
                    <li>Para fórmulas, pregunta directamente por la fórmula o su significado.</li>
                    <li>Usa el botón "Nueva conversación" para reiniciar el chat.</li>
                </ul>
                <span>${hora}</span>
            </div>
        </div>
    `;
    chat.scrollTop = chat.scrollHeight;
}

function mostrarAcerca() {
    const chat = document.getElementById('chat');
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    chat.innerHTML += `
        <div class="mensaje">
            <div class="avatar">
                <i class="fa-solid fa-graduation-cap"></i>
            </div>
            <div class="burbuja bot">
                <h3>ℹ️ Acerca de Físicabot</h3>
                <p><strong>Versión:</strong> 2.0</p>
                <p><strong>Desarrollado con:</strong></p>
                <ul>
                    <li>Python + Flask (backend)</li>
                    <li>Gemini 2.5 Flash (modelo de IA)</li>
                    <li>PyMuPDF (extracción de texto de PDF)</li>
                    <li>BM25 (búsqueda por relevancia)</li>
                    <li>MathJax (renderizado de fórmulas LaTeX)</li>
                    <li>HTML, CSS, JavaScript (frontend)</li>
                </ul>
                <p><strong>Propósito:</strong> Ayudar a estudiantes de física a comprender conceptos, resolver problemas y practicar con ejercicios, utilizando como referencia principal el libro <em>Física Universitaria Vol. 1</em>.</p>
                <p><strong>Contacto:</strong> Si tienes sugerencias o reportas errores, por favor contacta al desarrollador.</p>
                <span>${hora}</span>
            </div>
        </div>
    `;
    chat.scrollTop = chat.scrollHeight;
}

// ================= ENVIAR PREGUNTA =================
async function enviarPregunta() {
    const input = document.getElementById("pregunta");
    const chat = document.getElementById("chat");
    const pregunta = input.value.trim();
    const tieneImagen = archivoImagen !== null;

    if (!pregunta && !tieneImagen) return;

    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Mensaje del usuario
    let textoUsuario = pregunta;
    if (tieneImagen) {
        textoUsuario += (textoUsuario ? ' ' : '') + '📎 [Imagen adjunta]';
    }
    chat.innerHTML += `
        <div class="mensaje usuario">
            <div class="burbuja usuario-burbuja">
                <p>${textoUsuario}</p>
                <span>${hora}</span>
            </div>
        </div>
    `;
    input.value = "";
    chat.scrollTop = chat.scrollHeight;

    // Guardar imagen antes de limpiar
    const imagenParaEnviar = archivoImagen;
    if (tieneImagen) {
        quitarImagen();
    }

    // Indicador de carga
    chat.innerHTML += `
        <div class="mensaje bot" id="esperando">
            <div class="avatar">
                <i class="fa-solid fa-graduation-cap"></i>
            </div>
            <div class="burbuja bot">
                <div class="typing">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    chat.scrollTop = chat.scrollHeight;

    try {
        let response;
        let data;

        if (tieneImagen && imagenParaEnviar) {
            const formData = new FormData();
            formData.append('pregunta', pregunta);
            formData.append('imagen', imagenParaEnviar, imagenParaEnviar.name);
            if (conversacionActualId) {
                formData.append('conversacion_id', conversacionActualId);
            }
            response = await fetch('/preguntar_con_imagen', {
                method: 'POST',
                body: formData
            });
        } else {
            const payload = { pregunta };
            if (conversacionActualId) {
                payload.conversacion_id = conversacionActualId;
            }
            response = await fetch('/preguntar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.respuesta || 'Error del servidor');
        }

        data = await response.json();
        if (data.conversacion_id) {
            conversacionActualId = data.conversacion_id;
        }

        document.getElementById('esperando').remove();

        // Mostrar respuesta en texto plano (con saltos de línea)
        chat.innerHTML += `
            <div class="mensaje">
                <div class="avatar">
                    <i class="fa-solid fa-graduation-cap"></i>
                </div>
                <div class="burbuja bot mathjax">
                    <p style="white-space: pre-wrap;">${data.respuesta}</p>
                    <span>${hora}</span>
                </div>
            </div>
        `;
        chat.scrollTop = chat.scrollHeight;

        // Renderizar fórmulas con MathJax
        if (window.MathJax && MathJax.typesetPromise) {
            try {
                await MathJax.typesetPromise();
            } catch (e) {
                console.warn('Error en MathJax:', e);
            }
        }

        // Notificación de escritorio
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Físicabot', {
                body: 'Tu respuesta está lista',
                icon: '/static/icono.png'
            });
        }

        cargarHistorial();

    } catch (error) {
        document.getElementById('esperando').remove();
        chat.innerHTML += `
            <div class="mensaje">
                <div class="avatar">
                    <i class="fa-solid fa-graduation-cap"></i>
                </div>
                <div class="burbuja bot" style="background:#ffe6e6;">
                    <p>⚠️ ${error.message}</p>
                    <span>${hora}</span>
                </div>
            </div>
        `;
        chat.scrollTop = chat.scrollHeight;
    }
}

// ================= HISTORIAL =================
async function cargarHistorial() {
    const contenedor = document.getElementById('listaHistorial');
    try {
        const response = await fetch('/conversaciones');
        if (!response.ok) throw new Error('Error al cargar historial');
        const conversaciones = await response.json();

        if (conversaciones.length === 0) {
            contenedor.innerHTML = '<p class="sin-conversaciones">No hay conversaciones guardadas.</p>';
            return;
        }

        let html = '';
        conversaciones.forEach(conv => {
            html += `
                <div class="item-historial" data-id="${conv.id}">
                    <div class="historial-titulo" onclick="cargarConversacion('${conv.id}')">
                        <i class="fa-solid fa-message"></i>
                        <span>${conv.titulo}</span>
                    </div>
                    <div class="historial-meta">
                        <span>${conv.fecha}</span>
                        <button class="btn-eliminar" onclick="eliminarConversacion('${conv.id}')" title="Eliminar">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        contenedor.innerHTML = html;
    } catch (error) {
        contenedor.innerHTML = `<p class="sin-conversaciones">Error al cargar historial: ${error.message}</p>`;
    }
}

async function cargarConversacion(convId) {
    try {
        const response = await fetch(`/conversacion/${convId}`);
        if (!response.ok) throw new Error('No se pudo cargar la conversación');
        const mensajes = await response.json();

        const chat = document.getElementById('chat');
        chat.innerHTML = '';

        mensajes.forEach(msg => {
            const hora = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (msg.rol === 'usuario') {
                chat.innerHTML += `
                    <div class="mensaje usuario">
                        <div class="burbuja usuario-burbuja">
                            <p>${msg.contenido}</p>
                            <span>${hora}</span>
                        </div>
                    </div>
                `;
            } else {
                chat.innerHTML += `
                    <div class="mensaje">
                        <div class="avatar">
                            <i class="fa-solid fa-graduation-cap"></i>
                        </div>
                        <div class="burbuja bot mathjax">
                            <p style="white-space: pre-wrap;">${msg.contenido}</p>
                            <span>${hora}</span>
                        </div>
                    </div>
                `;
            }
        });

        chat.scrollTop = chat.scrollHeight;
        conversacionActualId = convId;

        if (window.MathJax && MathJax.typesetPromise) {
            try {
                await MathJax.typesetPromise();
            } catch (e) {
                console.warn('Error en MathJax:', e);
            }
        }

        document.querySelectorAll('.item-historial').forEach(el => {
            el.classList.remove('activo');
            if (el.dataset.id === convId) {
                el.classList.add('activo');
            }
        });

    } catch (error) {
        alert('Error al cargar conversación: ' + error.message);
    }
}

async function eliminarConversacion(convId) {
    if (!confirm('¿Eliminar esta conversación?')) return;
    try {
        const response = await fetch(`/conversacion/${convId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Error al eliminar');
        if (conversacionActualId === convId) {
            conversacionActualId = null;
            const chat = document.getElementById('chat');
            chat.innerHTML = `
                <div class="mensaje bienvenida">
                    <div class="avatar">
                        <i class="fa-solid fa-graduation-cap"></i>
                    </div>
                    <div class="burbuja bot">
                        <h3>¡Bienvenido!</h3>
                        <p>Soy <strong>Físicabot</strong>.</p>
                        <p>Estoy preparado para ayudarte con conceptos, ejercicios, fórmulas y problemas de Física.</p>
                        <p>Utilizo como fuente principal el libro <strong>Física Universitaria Vol. 1</strong> y complemento mis respuestas con inteligencia artificial cuando es necesario.</p>
                    </div>
                </div>
            `;
        }
        cargarHistorial();
    } catch (error) {
        alert('Error al eliminar: ' + error.message);
    }
}

// ================= MANEJO DE IMAGEN =================
document.getElementById('inputImagen').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona una imagen válida.');
        this.value = '';
        return;
    }

    archivoImagen = file;

    const preview = document.getElementById('previewImagen');
    const img = document.getElementById('imgPreview');
    const reader = new FileReader();
    reader.onload = function(ev) {
        img.src = ev.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
});

function quitarImagen() {
    archivoImagen = null;
    document.getElementById('inputImagen').value = '';
    document.getElementById('previewImagen').style.display = 'none';
}

// ================= SUBIR PDF =================
async function cargarPDF() {
    const input = document.getElementById('pdfFile');
    const estado = document.getElementById('estadoPDF');
    const file = input.files[0];
    if (!file) {
        estado.innerText = '⚠️ Selecciona un archivo';
        return;
    }

    const formData = new FormData();
    formData.append('pdf', file);

    try {
        estado.innerText = '⏳ Subiendo...';
        const response = await fetch('/cargar_pdf', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (response.ok) {
            estado.innerText = '✅ ' + data.mensaje;
        } else {
            estado.innerText = '❌ ' + (data.error || 'Error al subir');
        }
    } catch (error) {
        estado.innerText = '❌ Error de conexión';
    }
}

// ================= GUARDAR API KEY =================
async function guardarAPIKey() {
    const input = document.getElementById('apiKeyInput');
    const estado = document.getElementById('estadoAPI');
    const key = input.value.trim();
    if (!key) {
        estado.innerText = '⚠️ Ingresa una clave';
        return;
    }

    try {
        estado.innerText = '⏳ Guardando...';
        const response = await fetch('/configurar_api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: key })
        });
        const data = await response.json();
        if (response.ok) {
            estado.innerText = '✅ ' + data.mensaje;
            input.value = '';
        } else {
            estado.innerText = '❌ ' + (data.error || 'Error al guardar');
        }
    } catch (error) {
        estado.innerText = '❌ Error de conexión';
    }
}

// ================= FUNCIONES AUXILIARES =================
function actualizarIconoTema(tema) {
    const btn = document.getElementById('btnModoOscuro');
    if (tema === 'dark') {
        btn.innerHTML = '<i class="fa-solid fa-sun"></i> Modo claro';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-moon"></i> Modo oscuro';
    }
}

// ================= ENTER PARA ENVIAR =================
document.getElementById("pregunta").addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
        enviarPregunta();
    }
});
