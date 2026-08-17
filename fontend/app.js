/* ==========================================
   MEDIAFORGE
   Frontend JavaScript
========================================== */

const API_URL =
    "https://musicdownloader-api.onrender.com/api/convert";


/* ==========================================
   ELEMENTE
========================================== */

const urlInput = document.getElementById("urlInput");
const fileInput = document.getElementById("fileInput");
const pasteButton = document.getElementById("pasteButton");
const convertButton = document.getElementById("convertButton");

const formatSelect = document.getElementById("format");
const qualitySelect = document.getElementById("quality");
const audioQualitySelect = document.getElementById("audioQuality");

const qualityGroup = document.getElementById("qualityGroup");
const audioQualityGroup = document.getElementById("audioQualityGroup");

const extractAudio = document.getElementById("extractAudio");
const normalizeAudio = document.getElementById("normalizeAudio");
const removeMetadata = document.getElementById("removeMetadata");

const outputName = document.getElementById("outputName");

const progressCard = document.getElementById("progressCard");
const progressFill = document.getElementById("progressFill");
const progressPercent = document.getElementById("progressPercent");
const progressStatus = document.getElementById("progressStatus");
const progressSpeed = document.getElementById("progressSpeed");
const progressEta = document.getElementById("progressEta");

const resultCard = document.getElementById("resultCard");
const resultName = document.getElementById("resultName");
const resultSize = document.getElementById("resultSize");
const downloadButton = document.getElementById("downloadButton");

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");

const themeButton = document.getElementById("themeButton");

const fileList = document.getElementById("fileList");
const autoDownload = document.getElementById("autoDownload");
const notifications = document.getElementById("notifications");


/* ==========================================
   SICHERHEITSCHECK
========================================== */

if (!convertButton) {
    console.error("MediaForge: convertButton nicht gefunden.");
}

if (!urlInput) {
    console.error("MediaForge: urlInput nicht gefunden.");
}


/* ==========================================
   NAVIGATION
========================================== */

const navItems =
    document.querySelectorAll(".nav-item");

const pages = {
    converter:
        document.getElementById("converterPage"),

    files:
        document.getElementById("filesPage"),

    settings:
        document.getElementById("settingsPage")
};


navItems.forEach(button => {

    button.addEventListener("click", () => {

        navItems.forEach(item => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        Object.values(pages).forEach(page => {

            if (page) {
                page.classList.remove("active");
            }

        });

        const pageName =
            button.dataset.page;

        if (pages[pageName]) {
            pages[pageName].classList.add("active");
        }

    });

});


/* ==========================================
   TOAST
========================================== */

let toastTimer;

function showToast(message) {

    if (!toast || !toastMessage) {
        alert(message);
        return;
    }

    toastMessage.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);

}


/* ==========================================
   CLIPBOARD
========================================== */

if (pasteButton) {

    pasteButton.addEventListener("click", async () => {

        try {

            const text =
                await navigator.clipboard.readText();

            if (!text) {

                showToast(
                    "Zwischenablage ist leer."
                );

                return;
            }

            urlInput.value = text.trim();

            fileInput.value = "";

            outputName.value = "";

            showToast(
                "URL wurde eingefügt."
            );

        } catch (error) {

            console.error(error);

            showToast(
                "URL konnte nicht aus der Zwischenablage gelesen werden."
            );

        }

    });

}


/* ==========================================
   FORMAT
========================================== */

function updateFormatOptions() {

    const format =
        formatSelect.value;

    const audioFormats = [
        "mp3",
        "m4a",
        "wav",
        "flac",
        "aac",
        "ogg"
    ];

    const isAudio =
        audioFormats.includes(format);

    if (isAudio) {

        qualityGroup.classList.add("hidden");

        audioQualityGroup.classList.remove("hidden");

    } else {

        qualityGroup.classList.remove("hidden");

        audioQualityGroup.classList.add("hidden");

    }

}


formatSelect.addEventListener(
    "change",
    updateFormatOptions
);


extractAudio.addEventListener(
    "change",
    () => {

        if (extractAudio.checked) {

            formatSelect.value = "mp3";

        }

        updateFormatOptions();

    }
);


updateFormatOptions();


/* ==========================================
   DATEI AUSWÄHLEN
========================================== */

fileInput.addEventListener(
    "change",
    () => {

        const file =
            fileInput.files[0];

        if (!file) {
            return;
        }

        urlInput.value = "";

        outputName.value =
            removeExtension(file.name);

        showToast(
            `Datei ausgewählt: ${file.name}`
        );

    }
);


/* ==========================================
   DATEINAME
========================================== */

function removeExtension(filename) {

    return filename.replace(
        /\.[^/.]+$/,
        ""
    );

}


/* ==========================================
   URL PRÜFEN
========================================== */

function isValidUrl(value) {

    try {

        const url =
            new URL(value);

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );

    } catch {

        return false;

    }

}


/* ==========================================
   KONVERTIERUNG
========================================== */

convertButton.addEventListener(
    "click",
    startConversion
);


async function startConversion() {

    const url =
        urlInput.value.trim();

    const file =
        fileInput.files[0];

    if (!url && !file) {

        showToast(
            "Bitte zuerst eine URL eingeben oder eine Datei auswählen."
        );

        return;
    }


    if (url && !isValidUrl(url)) {

        showToast(
            "Bitte eine gültige http:// oder https:// URL eingeben."
        );

        return;

    }


    const format =
        formatSelect.value;

    const quality =
        qualitySelect.value;

    const audioQuality =
        audioQualitySelect.value;

    let filename =
        outputName.value.trim();

    if (!filename) {

        filename =
            url
                ? "mediaforge-download"
                : removeExtension(file.name);

    }


    const formData =
        new FormData();


    /* URL */

    if (url) {

        formData.append(
            "url",
            url
        );

    }


    /* Datei */

    if (file) {

        formData.append(
            "file",
            file
        );

    }


    /* Optionen */

    formData.append(
        "format",
        format
    );

    formData.append(
        "quality",
        quality
    );

    formData.append(
        "audioQuality",
        audioQuality
    );

    formData.append(
        "extractAudio",
        String(extractAudio.checked)
    );

    formData.append(
        "normalizeAudio",
        String(normalizeAudio.checked)
    );

    formData.append(
        "removeMetadata",
        String(removeMetadata.checked)
    );

    formData.append(
        "filename",
        filename
    );


    console.log(
        "MediaForge: Anfrage wird gesendet",
        {
            url,
            file: file ? file.name : null,
            format
        }
    );


    setLoading(true);

    showProgress();


    try {

        const response =
            await fetch(
                API_URL,
                {
                    method: "POST",
                    body: formData
                }
            );


        console.log(
            "MediaForge HTTP Status:",
            response.status
        );


        const contentType =
            response.headers.get(
                "content-type"
            ) || "";


        let data;


        if (
            contentType.includes(
                "application/json"
            )
        ) {

            data =
                await response.json();

        } else {

            const text =
                await response.text();

            console.error(
                "Server antwortete nicht mit JSON:",
                text
            );

            throw new Error(
                "Der Server hat keine gültige JSON-Antwort zurückgegeben."
            );

        }


        console.log(
            "MediaForge Serverantwort:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.error ||
                `Serverfehler (${response.status})`
            );

        }


        if (!data.success) {

            throw new Error(
                data.error ||
                "Konvertierung fehlgeschlagen."
            );

        }


        if (!data.downloadUrl) {

            throw new Error(
                "Konvertierung abgeschlossen, aber der Server hat keinen Download-Link zurückgegeben."
            );

        }


        finishProgress(data);


    } catch (error) {

        console.error(
            "MediaForge Konvertierungsfehler:",
            error
        );

        hideProgress();

        showToast(
            error.message ||
            "Konvertierung fehlgeschlagen."
        );


    } finally {

        setLoading(false);

    }

}


/* ==========================================
   LOADING
========================================== */

function setLoading(loading) {

    convertButton.disabled =
        loading;

    if (loading) {

        convertButton.innerHTML =
            "⏳ Verarbeitung läuft...";

    } else {

        convertButton.innerHTML =
            "<span>⇩</span> Konvertierung starten";

    }

}


/* ==========================================
   PROGRESS
========================================== */

function showProgress() {

    progressCard.classList.remove(
        "hidden"
    );

    resultCard.classList.add(
        "hidden"
    );

    progressFill.style.width =
        "5%";

    progressPercent.textContent =
        "5%";

    progressStatus.textContent =
        "Server wird kontaktiert...";

    progressSpeed.textContent =
        "Wird verarbeitet";

    progressEta.textContent =
        "Bitte warten";

}


function updateProgress(
    percent,
    status,
    speed,
    eta
) {

    progressFill.style.width =
        `${percent}%`;

    progressPercent.textContent =
        `${Math.round(percent)}%`;

    progressStatus.textContent =
        status || "Verarbeitung...";

    progressSpeed.textContent =
        speed || "—";

    progressEta.textContent =
        eta || "—";

}


function hideProgress() {

    progressCard.classList.add(
        "hidden"
    );

}


/* ==========================================
   FERTIG
========================================== */

function finishProgress(data) {

    updateProgress(
        100,
        "Fertig",
        "Abgeschlossen",
        "0 Sekunden"
    );


    resultCard.classList.remove(
        "hidden"
    );


    resultName.textContent =
        data.filename ||
        "Datei fertig";


    resultSize.textContent =
        data.size ||
        "Fertig";


    downloadButton.href =
        data.downloadUrl;


    downloadButton.download =
        data.filename ||
        "";


    downloadButton.target =
        "_blank";


    showToast(
        "Konvertierung abgeschlossen."
    );


    saveFileToHistory(data);


    /* Benachrichtigung */

    if (
        notifications &&
        notifications.checked &&
        "Notification" in window
    ) {

        if (
            Notification.permission ===
            "granted"
        ) {

            new Notification(
                "MediaForge",
                {
                    body:
                        "Deine Datei ist fertig."
                }
            );

        }

    }


    /* Automatischer Download */

    if (
        autoDownload &&
        autoDownload.checked
    ) {

        setTimeout(() => {

            window.location.href =
                data.downloadUrl;

        }, 700);

    }

}


/* ==========================================
   THEME
========================================== */

themeButton.addEventListener(
    "click",
    () => {

        document.body.classList.toggle(
            "light"
        );

        showToast(
            "Darstellung geändert."
        );

    }
);


/* ==========================================
   NOTIFICATIONS
========================================== */

notifications.addEventListener(
    "change",
    async () => {

        if (
            notifications.checked &&
            "Notification" in window &&
            Notification.permission ===
            "default"
        ) {

            try {

                await Notification.requestPermission();

            } catch (error) {

                console.error(error);

            }

        }

    }
);


/* ==========================================
   DRAG & DROP
========================================== */

const uploadBox =
    document.querySelector(
        ".upload-box"
    );


if (uploadBox) {

    uploadBox.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

            uploadBox.classList.add(
                "dragging"
            );

        }
    );


    uploadBox.addEventListener(
        "dragleave",
        () => {

            uploadBox.classList.remove(
                "dragging"
            );

        }
    );


    uploadBox.addEventListener(
        "drop",
        event => {

            event.preventDefault();

            uploadBox.classList.remove(
                "dragging"
            );


            const file =
                event.dataTransfer.files[0];


            if (!file) {
                return;
            }


            const valid =
                file.type.startsWith("video/") ||
                file.type.startsWith("audio/");


            if (!valid) {

                showToast(
                    "Diese Datei wird nicht unterstützt."
                );

                return;

            }


            const dataTransfer =
                new DataTransfer();

            dataTransfer.items.add(file);

            fileInput.files =
                dataTransfer.files;


            urlInput.value = "";

            outputName.value =
                removeExtension(file.name);


            showToast(
                `Datei hinzugefügt: ${file.name}`
            );

        }
    );

}


/* ==========================================
   DATEI-HISTORIE
========================================== */

function getHistory() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "mediaforge_history"
            )
        ) || [];

    } catch {

        return [];

    }

}


function saveFileToHistory(data) {

    const history =
        getHistory();


    history.unshift({

        filename:
            data.filename ||
            "Unbekannte Datei",

        size:
            data.size ||
            "",

        downloadUrl:
            data.downloadUrl ||
            "",

        date:
            new Date().toLocaleString(
                "de-CH"
            )

    });


    localStorage.setItem(
        "mediaforge_history",
        JSON.stringify(
            history.slice(0, 20)
        )
    );


    renderHistory();

}


function renderHistory() {

    if (!fileList) {
        return;
    }


    const history =
        getHistory();


    if (!history.length) {

        fileList.innerHTML = `
            <div class="empty-state">
                Noch keine Dateien vorhanden.
            </div>
        `;

        return;

    }


    fileList.innerHTML =
        history.map(file => `

            <div class="result-card">

                <div class="result-icon">
                    ✓
                </div>

                <div class="result-info">

                    <strong>
                        ${escapeHTML(
                            file.filename
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(
                            file.size
                        )}
                        ·
                        ${escapeHTML(
                            file.date
                        )}
                    </span>

                </div>

                ${
                    file.downloadUrl
                    ?
                    `
                    <a
                        class="download-button"
                        href="${escapeAttribute(
                            file.downloadUrl
                        )}"
                        target="_blank"
                        rel="noopener"
                    >
                        Öffnen
                    </a>
                    `
                    :
                    ""
                }

            </div>

        `).join("");

}


function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function escapeAttribute(value) {

    return escapeHTML(value);

}


renderHistory();


/* ==========================================
   LOCAL SETTINGS
========================================== */

if (autoDownload) {

    autoDownload.checked =
        localStorage.getItem(
            "mediaforge_auto_download"
        ) === "true";


    autoDownload.addEventListener(
        "change",
        () => {

            localStorage.setItem(
                "mediaforge_auto_download",
                autoDownload.checked
            );

        }
    );

}


if (notifications) {

    notifications.checked =
        localStorage.getItem(
            "mediaforge_notifications"
        ) !== "false";


    notifications.addEventListener(
        "change",
        () => {

            localStorage.setItem(
                "mediaforge_notifications",
                notifications.checked
            );

        }
    );

}


/* ==========================================
   START
========================================== */

console.log(
    "MediaForge Frontend geladen."
);

console.log(
    "API:",
    API_URL
);