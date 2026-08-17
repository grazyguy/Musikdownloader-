import express from "express";
import cors from "cors";
import multer from "multer";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const app = express();

const PORT = process.env.PORT || 3000;

const DOWNLOAD_DIR = path.resolve("downloads");
const TEMP_DIR = path.resolve("temp");

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });


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

    destination: TEMP_DIR,

    filename: (req, file, callback) => {

        const id =
            crypto.randomBytes(16).toString("hex");

        const extension =
            path.extname(file.originalname) || ".bin";

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
   CONVERT
========================================== */

app.post(
    "/api/convert",
    upload.single("file"),

    async (req, res) => {

        let inputFile = null;

        let downloadedFromUrl = false;

        let outputFile = null;

        try {

            const url =
                String(
                    req.body.url || ""
                ).trim();


            /*
             * ======================================
             * FORMAT
             * ======================================
             */

            const format =
                String(
                    req.body.format || "mp4"
                ).toLowerCase();


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
                        "Dieses Ausgabeformat wird nicht unterstützt."

                });

            }


            /*
             * ======================================
             * DATEINAME
             * ======================================
             */

            const requestedName =
                String(
                    req.body.filename ||
                    "mediaforge-download"
                );


            const safeName =
                requestedName
                    .replace(
                        /[^a-zA-Z0-9äöüÄÖÜéèà._ -]/g,
                        ""
                    )
                    .trim()
                    .slice(0, 100) ||
                "mediaforge-download";


            /*
             * ======================================
             * URL ODER DATEI
             * ======================================
             */

            if (url) {

                if (!isHttpUrl(url)) {

                    return res.status(400).json({

                        success: false,

                        error:
                            "Ungültige URL."

                    });

                }


                if (!isSupportedPlatform(url)) {

                    return res.status(400).json({

                        success: false,

                        error:
                            "Diese Plattform wird nicht unterstützt. Unterstützt werden YouTube, TikTok und Instagram."

                    });

                }


                console.log(
                    "URL Download:",
                    url
                );


                /*
                 * Temporärer Dateiname
                 */

                const tempId =
                    crypto
                        .randomBytes(16)
                        .toString("hex");


                const template =
                    path.join(
                        TEMP_DIR,
                        `${tempId}.%(ext)s`
                    );


                /*
                 * yt-dlp
                 *
                 * Kein Login / keine Cookies.
                 * Nur öffentlich erreichbare Inhalte.
                 */

                await runCommand(
                    "yt-dlp",
                    [

                        "--no-playlist",

                        "--no-warnings",

                        "--restrict-filenames",

                        "-f",
                        "bestvideo+bestaudio/best",

                        "--merge-output-format",
                        "mp4",

                        "-o",
                        template,

                        url

                    ]
                );


                /*
                 * Herausfinden, welche Datei
                 * yt-dlp erzeugt hat.
                 */

                const files =
                    fs.readdirSync(
                        TEMP_DIR
                    );


                const downloaded =
                    files.find(
                        filename =>
                            filename.startsWith(
                                tempId
                            )
                    );


                if (!downloaded) {

                    throw new Error(
                        "yt-dlp hat keine Datei erzeugt."
                    );

                }


                inputFile =
                    path.join(
                        TEMP_DIR,
                        downloaded
                    );


                downloadedFromUrl =
                    true;

            } else {

                /*
                 * Lokale Datei
                 */

                if (!req.file) {

                    return res.status(400).json({

                        success: false,

                        error:
                            "Bitte eine URL oder eine Datei auswählen."

                    });

                }


                inputFile =
                    req.file.path;

            }


            /*
             * ======================================
             * OUTPUT
             * ======================================
             */

            const outputName =
                `${safeName}-${Date.now()}.${format}`;


            outputFile =
                path.join(
                    DOWNLOAD_DIR,
                    outputName
                );


            /*
             * ======================================
             * AUDIO QUALITÄT
             * ======================================
             */

            const audioQuality =
                String(
                    req.body.audioQuality || "192"
                );


            const allowedAudioQualities = [

                "128",
                "192",
                "256",
                "320"

            ];


            const safeAudioQuality =
                allowedAudioQualities.includes(
                    audioQuality
                )
                ? audioQuality
                : "192";


            /*
             * ======================================
             * FFMPEG
             * ======================================
             */

            const ffmpegArgs = [

                "-y",

                "-i",
                inputFile

            ];


            /*
             * MP3
             */

            if (format === "mp3") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "libmp3lame",

                    "-b:a",
                    `${safeAudioQuality}k`

                );

            }


            /*
             * M4A
             */

            else if (format === "m4a") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "aac",

                    "-b:a",
                    `${safeAudioQuality}k`

                );

            }


            /*
             * WAV
             */

            else if (format === "wav") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "pcm_s16le"

                );

            }


            /*
             * FLAC
             */

            else if (format === "flac") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "flac"

                );

            }


            /*
             * AAC
             */

            else if (format === "aac") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "aac",

                    "-b:a",
                    `${safeAudioQuality}k`

                );

            }


            /*
             * OGG
             */

            else if (format === "ogg") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "libvorbis",

                    "-b:a",
                    `${safeAudioQuality}k`

                );

            }


            /*
             * MP4
             */

            else if (format === "mp4") {

                ffmpegArgs.push(

                    "-map",
                    "0:v:0?",

                    "-map",
                    "0:a:0?",

                    "-c:v",
                    "libx264",

                    "-preset",
                    "veryfast",

                    "-crf",
                    "23",

                    "-c:a",
                    "aac",

                    "-b:a",
                    `${safeAudioQuality}k`

                );

            }


            /*
             * ======================================
             * AUDIO NORMALISIEREN
             * ======================================
             */

            if (
                req.body.normalizeAudio === "true"
            ) {

                ffmpegArgs.push(

                    "-af",
                    "loudnorm"

                );

            }


            /*
             * ======================================
             * METADATEN ENTFERNEN
             * ======================================
             */

            if (
                req.body.removeMetadata === "true"
            ) {

                ffmpegArgs.push(

                    "-map_metadata",
                    "-1"

                );

            }


            /*
             * OUTPUT
             */

            ffmpegArgs.push(
                outputFile
            );


            console.log(
                "FFmpeg startet:",
                ffmpegArgs.join(" ")
            );


            await runCommand(
                "ffmpeg",
                ffmpegArgs
            );


            /*
             * ======================================
             * DATEI PRÜFEN
             * ======================================
             */

            if (
                !fs.existsSync(
                    outputFile
                )
            ) {

                throw new Error(
                    "FFmpeg hat keine Ausgabedatei erzeugt."
                );

            }


            const stats =
                fs.statSync(
                    outputFile
                );


            /*
             * ======================================
             * TEMP DATEI LÖSCHEN
             * ======================================
             */

            if (inputFile) {

                removeFile(
                    inputFile
                );

            }


            /*
             * ======================================
             * DOWNLOAD URL
             * ======================================
             */

            const downloadUrl =
                `${getBaseUrl(req)}/downloads/${encodeURIComponent(outputName)}`;


            console.log(
                "Konvertierung erfolgreich:",
                outputName
            );


            /*
             * ======================================
             * ANTWORT
             * ======================================
             */

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


            if (
                outputFile &&
                fs.existsSync(outputFile)
            ) {

                removeFile(
                    outputFile
                );

            }


            return res.status(500).json({

                success: false,

                error:
                    getFriendlyError(
                        error
                    )

            });

        }

    }

);


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
   URL PRÜFUNG
========================================== */

function isHttpUrl(value) {

    try {

        const parsed =
            new URL(value);

        return (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        );

    } catch {

        return false;

    }

}


/* ==========================================
   UNTERSTÜTZTE PLATTFORMEN
========================================== */

function isSupportedPlatform(value) {

    try {

        const hostname =
            new URL(value)
                .hostname
                .toLowerCase()
                .replace(
                    /^www\./,
                    ""
                );


        return (

            hostname === "youtube.com" ||

            hostname.endsWith(
                ".youtube.com"
            ) ||

            hostname === "youtu.be" ||

            hostname === "tiktok.com" ||

            hostname.endsWith(
                ".tiktok.com"
            ) ||

            hostname === "instagram.com" ||

            hostname.endsWith(
                ".instagram.com"
            )

        );

    } catch {

        return false;

    }

}


/* ==========================================
   COMMAND AUSFÜHREN
========================================== */

function runCommand(
    command,
    args
) {

    return new Promise(
        (resolve, reject) => {

            const child =
                spawn(
                    command,
                    args,
                    {
                        env: process.env
                    }
                );


            let stdout = "";
            let stderr = "";


            child.stdout.on(
                "data",
                data => {

                    stdout +=
                        data.toString();

                }
            );


            child.stderr.on(
                "data",
                data => {

                    stderr +=
                        data.toString();

                    console.log(
                        `[${command}]`,
                        data.toString().trim()
                    );

                }
            );


            child.on(
                "error",
                error => {

                    reject(error);

                }
            );


            child.on(
                "close",
                code => {

                    if (code === 0) {

                        resolve({
                            stdout,
                            stderr
                        });

                    } else {

                        reject(
                            new Error(
                                `${command} wurde mit Code ${code} beendet. ${getCommandError(stderr)}`
                            )
                        );

                    }

                }
            );

        }
    );

}


/* ==========================================
   FEHLER AUS COMMAND
========================================== */

function getCommandError(
    stderr
) {

    if (!stderr) {

        return "";

    }


    const lines =
        stderr
            .split("\n")
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    return lines
        .slice(-5)
        .join(" ");

}


/* ==========================================
   BASE URL
========================================== */

function getBaseUrl(req) {

    const forwardedProto =
        req.headers["x-forwarded-proto"];


    const protocol =
        forwardedProto ||
        req.protocol;


    return `${protocol}://${req.get("host")}`;

}


/* ==========================================
   DATEI LÖSCHEN
========================================== */

function removeFile(file) {

    try {

        if (
            file &&
            fs.existsSync(file)
        ) {

            fs.unlinkSync(file);

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

function formatBytes(bytes) {

    if (!bytes) {

        return "0 Bytes";

    }


    const units = [

        "Bytes",
        "KB",
        "MB",
        "GB"

    ];


    const index =
        Math.min(
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            ),
            units.length - 1
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
   BENUTZERFREUNDLICHE FEHLER
========================================== */

function getFriendlyError(
    error
) {

    const message =
        String(
            error?.message || error
        );


    if (
        message.includes(
            "yt-dlp"
        )
    ) {

        return (
            "Die URL konnte nicht verarbeitet werden. " +
            "Prüfe, ob der Inhalt öffentlich erreichbar ist."
        );

    }


    if (
        message.includes(
            "FFmpeg"
        ) ||
        message.includes(
            "ffmpeg"
        )
    ) {

        return (
            "Die Datei konnte mit FFmpeg nicht konvertiert werden."
        );

    }


    return (
        message.slice(
            0,
            500
        ) ||
        "Unbekannter Serverfehler."
    );

}


/* ==========================================
   START
========================================== */

app.listen(
    PORT,
    () => {

        console.log(
            `MediaForge API läuft auf Port ${PORT}`
        );

        console.log(
            `Port: ${PORT}`
        );

    }
);