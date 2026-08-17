/* ==========================================
   MEDIAFORGE
   Frontend JavaScript
========================================== */


/*
   Später wird hier dein Backend eingetragen.

   Beispiel:

   const API_URL =
       "https://deine-domain.ch/api/convert";

   Für lokale Entwicklung:

   const API_URL =
       "http://localhost:3000/api/convert";
*/

const API_URL = "https://DEIN-SERVER.onrender.com/api/convert";



/* ==========================================
   ELEMENTE
========================================== */

const urlInput =
    document.getElementById("urlInput");


const fileInput =
    document.getElementById("fileInput");


const pasteButton =
    document.getElementById("pasteButton");


const convertButton =
    document.getElementById("convertButton");


const formatSelect =
    document.getElementById("format");


const qualitySelect =
    document.getElementById("quality");


const audioQualitySelect =
    document.getElementById("audioQuality");


const qualityGroup =
    document.getElementById("qualityGroup");


const audioQualityGroup =
    document.getElementById("audioQualityGroup");


const extractAudio =
    document.getElementById("extractAudio");


const normalizeAudio =
    document.getElementById("normalizeAudio");


const removeMetadata =
    document.getElementById("removeMetadata");


const outputName =
    document.getElementById("outputName");


const progressCard =
    document.getElementById("progressCard");


const progressFill =
    document.getElementById("progressFill");


const progressPercent =
    document.getElementById("progressPercent");


const progressStatus =
    document.getElementById("progressStatus");


const progressSpeed =
    document.getElementById("progressSpeed");


const progressEta =
    document.getElementById("progressEta");


const resultCard =
    document.getElementById("resultCard");


const resultName =
    document.getElementById("resultName");


const resultSize =
    document.getElementById("resultSize");


const downloadButton =
    document.getElementById("downloadButton");


const toast =
    document.getElementById("toast");


const toastMessage =
    document.getElementById("toastMessage");


const themeButton =
    document.getElementById("themeButton");


const fileList =
    document.getElementById("fileList");


const autoDownload =
    document.getElementById("autoDownload");


const notifications =
    document.getElementById("notifications");



/* ==========================================
   NAVIGATION
========================================== */

const navItems =
    document.querySelectorAll(".nav-item");


const pages = {

    converter:
        document.getElementById(
            "converterPage"
        ),

    files:
        document.getElementById(
            "filesPage"
        ),

    settings:
        document.getElementById(
            "settingsPage"
        )

};


navItems.forEach(button => {


    button.addEventListener(
        "click",
        () => {


            navItems.forEach(item => {

                item.classList.remove(
                    "active"
                );

            });


            button.classList.add(
                "active"
            );


            Object.values(pages).forEach(
                page => {

                    page.classList.remove(
                        "active"
                    );

                }
            );


            const pageName =
                button.dataset.page;


            if (pages[pageName]) {

                pages[pageName]
                    .classList
                    .add("active");

            }

        }
    );

});



/* ==========================================
   CLIPBOARD
========================================== */

pasteButton.addEventListener(
    "click",
    async () => {


        try {


            const text =
                await navigator
                    .clipboard
                    .readText();


            if (!text) {

                showToast(
                    "Zwischenablage ist leer."
                );

                return;

            }


            urlInput.value =
                text.trim();


            showToast(
                "URL wurde eingefügt."
            );


        } catch (error) {


            showToast(
                "Zwischenablage konnte nicht gelesen werden."
            );

        }

    }
);



/* ==========================================
   FORMAT
========================================== */

function updateFormatOptions() {


    const format =
        formatSelect.value;


    const isAudio =
        [
            "mp3",
            "m4a",
            "wav",
            "flac"
        ].includes(format);


    if (isAudio) {


        qualityGroup
            .classList
            .add("hidden");


        audioQualityGroup
            .classList
            .remove("hidden");


    } else {


        qualityGroup
            .classList
            .remove("hidden");


        audioQualityGroup
            .classList
            .add("hidden");

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

            formatSelect.value =
                "mp3";

        }


        updateFormatOptions();

    }
);


updateFormatOptions();



/* ==========================================
   FILE AUSWÄHLEN
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
            removeExtension(
                file.name
            );


        showToast(
            `Datei ausgewählt: ${file.name}`
        );

    }
);



/* ==========================================
   DATEINAME
========================================== */

function removeExtension(
    filename
) {


    return filename.replace(
        /\.[^/.]+$/,
        ""
    );

}



/* ==========================================
   KONVERTIERUNG STARTEN
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
            "Bitte URL oder Datei auswählen."
        );


        return;

    }


    const format =
        formatSelect.value;


    const quality =
        qualitySelect.value;


    const audioQuality =
        audioQualitySelect.value;


    const filename =
        outputName.value.trim();


    const formData =
        new FormData();



    /*
       URL an Backend
    */

    if (url) {

        formData.append(
            "url",
            url
        );

    }



    /*
       Lokale Datei
    */

    if (file) {

        formData.append(
            "file",
            file
        );

    }



    /*
       Optionen
    */

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
        extractAudio.checked
    );


    formData.append(
        "normalizeAudio",
        normalizeAudio.checked
    );


    formData.append(
        "removeMetadata",
        removeMetadata.checked
    );


    formData.append(
        "filename",
        filename
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


        if (!response.ok) {


            throw new Error(
                await getServerError(
                    response
                )
            );

        }


        const data =
            await response.json();


        if (!data.success) {


            throw new Error(
                data.error ||
                "Konvertierung fehlgeschlagen."
            );

        }


        finishProgress(
            data
        );


    } catch (error) {


        hideProgress();


        showToast(
            error.message ||
            "Unbekannter Fehler."
        );


    } finally {


        setLoading(false);

    }

}



/* ==========================================
   SERVER FEHLER
========================================== */

async function getServerError(
    response
) {


    try {


        const data =
            await response.json();


        return (
            data.error ||
            "Serverfehler."
        );


    } catch {


        return "Serverfehler.";

    }

}



/* ==========================================
   LOADING
========================================== */

function setLoading(
    loading
) {


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


    progressCard
        .classList
        .remove("hidden");


    resultCard
        .classList
        .add("hidden");


    progressFill.style.width =
        "0%";


    progressPercent.textContent =
        "0%";


    progressStatus.textContent =
        "Vorbereitung";


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
        status ||
        "Verarbeitung...";


    progressSpeed.textContent =
        speed ||
        "—";


    progressEta.textContent =
        eta ||
        "—";

}


function hideProgress() {


    progressCard
        .classList
        .add("hidden");

}



/* ==========================================
   FERTIG
========================================== */

function finishProgress(
    data
) {


    updateProgress(
        100,
        "Fertig",
        "Abgeschlossen",
        "0 Sekunden"
    );


    resultCard
        .classList
        .remove("hidden");


    resultName.textContent =
        data.filename ||
        "Datei fertig";


    resultSize.textContent =
        data.size ||
        "Fertig";


    downloadButton.href =
        data.downloadUrl ||
        "#";


    downloadButton.download =
        data.filename ||
        "";


    showToast(
        "Konvertierung abgeschlossen."
    );



    /*
       Datei in Verlauf speichern
    */

    saveFileToHistory(
        data
    );



    /*
       Browser-Benachrichtigung
    */

    if (
        notifications.checked
    ) {


        if (
            "Notification" in window &&
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



    /*
       Automatischer Download
    */

    if (
        autoDownload.checked &&
        data.downloadUrl
    ) {


        setTimeout(
            () => {

                downloadButton.click();

            },
            500
        );

    }

}



/* ==========================================
   TOAST
========================================== */

let toastTimer;


function showToast(
    message
) {


    toastMessage.textContent =
        message;


    toast
        .classList
        .add("show");


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast
                    .classList
                    .remove("show");

            },
            3000
        );

}



/* ==========================================
   THEME
========================================== */

themeButton.addEventListener(
    "click",
    () => {


        document.body
            .classList
            .toggle("light");


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


                await Notification
                    .requestPermission();


            } catch {


                // Browser unterstützt
                // keine Benachrichtigungen

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


uploadBox.addEventListener(
    "dragover",
    event => {


        event.preventDefault();


        uploadBox
            .classList
            .add("dragging");

    }
);


uploadBox.addEventListener(
    "dragleave",
    () => {


        uploadBox
            .classList
            .remove("dragging");

    }
);


uploadBox.addEventListener(
    "drop",
    event => {


        event.preventDefault();


        uploadBox
            .classList
            .remove("dragging");


        const file =
            event
                .dataTransfer
                .files[0];


        if (!file) {

            return;

        }


        const valid =
            file.type.startsWith(
                "video/"
            ) ||
            file.type.startsWith(
                "audio/"
            );


        if (!valid) {


            showToast(
                "Diese Datei wird nicht unterstützt."
            );


            return;

        }


        const dataTransfer =
            new DataTransfer();


        dataTransfer.items.add(
            file
        );


        fileInput.files =
            dataTransfer.files;


        outputName.value =
            removeExtension(
                file.name
            );


        showToast(
            `Datei hinzugefügt: ${file.name}`
        );

    }
);



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


function saveFileToHistory(
    data
) {


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


    const limited =
        history.slice(0, 20);


    localStorage.setItem(
        "mediaforge_history",
        JSON.stringify(
            limited
        )
    );


    renderHistory();

}


function renderHistory() {


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
        history.map(
            file => `

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
                            download
                        >
                            Öffnen
                        </a>
                        `
                        :
                        ""
                    }

                </div>

            `
        )
        .join("");

}


function escapeHTML(
    value
) {


    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


function escapeAttribute(
    value
) {


    return escapeHTML(
        value
    );

}


renderHistory();



/* ==========================================
   LOCAL SETTINGS
========================================== */

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
