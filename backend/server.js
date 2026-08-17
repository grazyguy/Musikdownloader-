import express from "express";
import cors from "cors";
import multer from "multer";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const app = express();

const PORT = process.env.PORT || 10000;

const DOWNLOAD_DIR = path.resolve("downloads");

fs.mkdirSync(DOWNLOAD_DIR, {
    recursive: true
});


/* ==========================================
   CORS
========================================== */

app.use(
    cors({
        origin: true,
        methods: ["GET", "POST", "OPTIONS"]
    })
);

app.use(express.json());


/* ==========================================
   FILE UPLOAD
========================================== */

const storage = multer.diskStorage({

    destination: DOWNLOAD_DIR,

    filename: (req, file, callback) => {

        const id =
            crypto.randomBytes(16).toString("hex");

        const extension =
            path.extname(file.originalname);

        callback(
            null,
            `${id}${extension}`
        );

    }

});


const upload = multer({

    storage,

    limits: {
        fileSize: 500 * 1024 * 1024
    }

});


/* ==========================================
   HEALTH CHECK
========================================== */

app.get("/", (req, res) => {

    res.json({

        success: true,

        service:
            "MediaForge API",

        status:
            "online",

        ytDlp:
            "available",

        ffmpeg:
            "available"

    });

});


/* ==========================================
   DOWNLOADS
========================================== */

app.use(
    "/downloads",
    express.static(
        DOWNLOAD_DIR
    )
);


/* ==========================================
   CONVERT
========================================== */

app.post(
    "/api/convert",
    upload.single("file"),

    async (req, res) => {

        let inputFile = null;

        try {

            const url =
                String(
                    req.body.url || ""
                ).trim();


            const format =
                String(
                    req.body.format || "mp4"
                ).toLowerCase();


            const audioQuality =
                String(
                    req.body.audioQuality || "192"
                );


            const requestedName =
                String(
                    req.body.filename ||
                    "mediaforge-datei"
                );


            /* ==================================
               ERLAUBTE FORMATE
            ================================== */

            const allowedFormats = [

                "mp4",
                "mp3",
                "m4a",
                "wav",
                "flac",
                "aac",
                "ogg"

            ];


            if (
                !allowedFormats.includes(format)
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Dieses Format wird nicht unterstützt."

                });

            }


            /* ==================================
               DATEINAME SICHERN
            ================================== */

            const safeName =
                requestedName
                    .replace(
                        /[^a-zA-Z0-9äöüÄÖÜéèà._ -]/g,
                        ""
                    )
                    .trim()
                    .slice(0, 100)
                    ||
                    "mediaforge-datei";


            /* ==================================
               URL DOWNLOAD
            ================================== */

            if (url) {

                inputFile =
                    path.join(
                        DOWNLOAD_DIR,
                        `${crypto.randomBytes(16).toString("hex")}.source`
                    );


                console.log(
                    "Starte URL Download:",
                    url
                );


                await runYtDlp(
                    url,
                    inputFile
                );

            }


            /* ==================================
               LOKALE DATEI
            ================================== */

            else if (req.file) {

                inputFile =
                    req.file.path;

            }


            /* ==================================
               NICHTS ANGEGEBEN
            ================================== */

            else {

                return res.status(400).json({

                    success: false,

                    error:
                        "Bitte eine URL oder eine Datei auswählen."

                });

            }


            /* ==================================
               OUTPUT
            ================================== */

            const outputName =
                `${safeName}-${Date.now()}.${format}`;


            const outputFile =
                path.join(
                    DOWNLOAD_DIR,
                    outputName
                );


            /* ==================================
               FFMPEG ARGUMENTE
            ================================== */

            const ffmpegArgs = [

                "-y",

                "-i",
                inputFile

            ];


            /* ==================================
               MP3
            ================================== */

            if (format === "mp3") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "libmp3lame",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* ==================================
               M4A
            ================================== */

            else if (format === "m4a") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "aac",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* ==================================
               WAV
            ================================== */

            else if (format === "wav") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "pcm_s16le"

                );

            }


            /* ==================================
               FLAC
            ================================== */

            else if (format === "flac") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "flac"

                );

            }


            /* ==================================
               AAC
            ================================== */

            else if (format === "aac") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "aac",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* ==================================
               OGG
            ================================== */

            else if (format === "ogg") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "libvorbis",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* ==================================
               MP4
            ================================== */

            else if (format === "mp4") {

                ffmpegArgs.push(

                    "-c:v",
                    "libx264",

                    "-preset",
                    "veryfast",

                    "-crf",
                    "23",

                    "-c:a",
                    "aac",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* ==================================
               AUDIO NORMALISIEREN
            ================================== */

            if (
                req.body.normalizeAudio === "true"
            ) {

                ffmpegArgs.push(

                    "-af",
                    "loudnorm"

                );

            }


            /* ==================================
               METADATEN ENTFERNEN
            ================================== */

            if (
                req.body.removeMetadata === "true"
            ) {

                ffmpegArgs.push(

                    "-map_metadata",
                    "-1"

                );

            }


            ffmpegArgs.push(
                outputFile
            );


            console.log(
                "FFmpeg startet..."
            );


            await runFFmpeg(
                ffmpegArgs
            );


            /* ==================================
               DATEIGRÖSSE
            ================================== */

            const stats =
                fs.statSync(
                    outputFile
                );


            /* ==================================
               QUELLDATEI LÖSCHEN
            ================================== */

            removeFile(
                inputFile
            );


            /* ==================================
               DOWNLOAD URL
            ================================== */

            const downloadUrl =
                `${getBaseUrl(req)}/downloads/${encodeURIComponent(outputName)}`;


            /* ==================================
               OUTPUT NACH 30 MIN LÖSCHEN
            ================================== */

            setTimeout(
                () => {

                    removeFile(
                        outputFile
                    );

                },
                30 * 60 * 1000
            );


            /* ==================================
               RESPONSE
            ================================== */

            return res.json({

                success: true,

                filename:
                    outputName,

                size:
                    formatBytes(
                        stats.size
                    ),

                downloadUrl

            });


        } catch (error) {

            console.error(
                "MediaForge Fehler:",
                error
            );


            if (inputFile) {

                removeFile(
                    inputFile
                );

            }


            return res.status(500).json({

                success: false,

                error:
                    error.message ||
                    "Download oder Konvertierung fehlgeschlagen."

            });

        }

    }
);


/* ==========================================
   YT-DLP
========================================== */

function runYtDlp(
    url,
    outputFile
) {

    return new Promise(
        (resolve, reject) => {

            const args = [

                "--no-playlist",

                "--no-warnings",

                "--restrict-filenames",

                "-o",
                outputFile,

                url

            ];


            const process =
                spawn(
                    "yt-dlp",
                    args
                );


            let stderr = "";


            process.stdout.on(
                "data",
                data => {

                    console.log(
                        "yt-dlp:",
                        data.toString()
                    );

                }
            );


            process.stderr.on(
                "data",
                data => {

                    stderr +=
                        data.toString();

                }
            );


            process.on(
                "error",
                error => {

                    reject(error);

                }
            );


            process.on(
                "close",
                code => {

                    if (code === 0) {

                        resolve();

                    } else {

                        console.error(
                            "yt-dlp Fehler:",
                            stderr
                        );


                        reject(
                            new Error(
                                "Der Link konnte nicht heruntergeladen werden."
                            )
                        );

                    }

                }
            );

        }
    );

}


/* ==========================================
   FFMPEG
========================================== */

function runFFmpeg(
    args
) {

    return new Promise(
        (resolve, reject) => {

            const process =
                spawn(
                    "ffmpeg",
                    args
                );


            let stderr = "";


            process.stderr.on(
                "data",
                data => {

                    stderr +=
                        data.toString();

                }
            );


            process.on(
                "error",
                error => {

                    reject(error);

                }
            );


            process.on(
                "close",
                code => {

                    if (code === 0) {

                        resolve();

                    } else {

                        console.error(
                            "FFmpeg Fehler:",
                            stderr
                        );


                        reject(
                            new Error(
                                "FFmpeg konnte die Datei nicht konvertieren."
                            )
                        );

                    }

                }
            );

        }
    );

}


/* ==========================================
   BASE URL
========================================== */

function getBaseUrl(
    req
) {

    return `${req.protocol}://${req.get("host")}`;

}


/* ==========================================
   DATEI LÖSCHEN
========================================== */

function removeFile(
    file
) {

    try {

        if (
            file &&
            fs.existsSync(file)
        ) {

            fs.unlinkSync(
                file
            );

        }

    } catch (error) {

        console.error(
            "Datei konnte nicht gelöscht werden:",
            error
        );

    }

}


/* ==========================================
   DATEIGRÖSSE
========================================== */

function formatBytes(
    bytes
) {

    if (
        bytes === 0
    ) {

        return "0 Bytes";

    }


    const units = [

        "Bytes",
        "KB",
        "MB",
        "GB"

    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return `${(
        bytes /
        Math.pow(
            1024,
            index
        )
    ).toFixed(2)} ${units[index]}`;

}


/* ==========================================
   SERVER START
========================================== */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `MediaForge API läuft auf Port ${PORT}`
        );

        console.log(
            `Port: ${PORT}`
        );

    }
);