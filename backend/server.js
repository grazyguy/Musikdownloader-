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

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });


/* ==========================================
   CORS
========================================== */

app.use(
    cors({
        origin: [
            "https://grazyguy.github.io",
            "http://localhost:3000",
            "http://localhost:5173"
        ],
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type"]
    })
);

app.use(express.json());


/* ==========================================
   UPLOAD
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

        service: "MediaForge API",

        status: "online",

        ffmpeg: "available"

    });

});


/* ==========================================
   FFMPEG VERSION TEST
========================================== */

app.get("/api/ffmpeg", async (req, res) => {

    try {

        const version =
            await runFFmpegVersion();

        res.json({

            success: true,

            ffmpeg: version

        });

    } catch (error) {

        res.status(500).json({

            success: false,

            error: error.message

        });

    }

});


/* ==========================================
   CONVERT
========================================== */

app.post(
    "/api/convert",
    upload.single("file"),

    async (req, res) => {

        let inputFile = null;
        let outputFile = null;

        try {

            /* ==========================
               DATEI PRÜFEN
            ========================== */

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Keine Datei empfangen. Bitte zuerst eine Audio- oder Videodatei auswählen."

                });

            }


            inputFile =
                req.file.path;


            /* ==========================
               FORMAT
            ========================== */

            const format =
                String(
                    req.body.format || "mp3"
                ).toLowerCase();


            const allowedFormats = [

                "mp3",
                "wav",
                "m4a",
                "flac",
                "aac",
                "ogg",
                "mp4"

            ];


            if (
                !allowedFormats.includes(format)
            ) {

                removeFile(inputFile);

                return res.status(400).json({

                    success: false,

                    error:
                        `Format "${format}" wird nicht unterstützt.`

                });

            }


            /* ==========================
               DATEINAME
            ========================== */

            const requestedName =
                String(
                    req.body.filename ||
                    "mediaforge-datei"
                );


            const safeName =
                requestedName
                    .replace(
                        /[^a-zA-Z0-9äöüÄÖÜéèà._ -]/g,
                        ""
                    )
                    .trim()
                    .slice(0, 100) ||
                "mediaforge-datei";


            const outputName =
                `${safeName}-${Date.now()}.${format}`;


            outputFile =
                path.join(
                    DOWNLOAD_DIR,
                    outputName
                );


            /* ==========================
               AUDIO QUALITÄT
            ========================== */

            const allowedAudioQualities = [
                "96",
                "128",
                "160",
                "192",
                "256",
                "320"
            ];


            let audioQuality =
                String(
                    req.body.audioQuality || "192"
                );


            if (
                !allowedAudioQualities.includes(
                    audioQuality
                )
            ) {

                audioQuality = "192";

            }


            /* ==========================
               FFMPEG ARGUMENTE
            ========================== */

            const ffmpegArgs = [

                "-y",

                "-i",
                inputFile

            ];


            /* ==========================
               MP3
            ========================== */

            if (format === "mp3") {

                ffmpegArgs.push(

                    "-vn",

                    "-c:a",
                    "libmp3lame",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* ==========================
               M4A
            ========================== */

            else if (format === "m4a") {

                ffmpegArgs.push(

                    "-vn",

                    "-c:a",
                    "aac",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* ==========================
               WAV
            ========================== */

            else if (format === "wav") {

                ffmpegArgs.push(

                    "-vn",

                    "-c:a",
                    "pcm_s16le"

                );

            }


            /* ==========================
               FLAC
            ========================== */

            else if (format === "flac") {

                ffmpegArgs.push(

                    "-vn",

                    "-c:a",
                    "flac"

                );

            }


            /* ==========================
               AAC
            ========================== */

            else if (format === "aac") {

                ffmpegArgs.push(

                    "-vn",

                    "-c:a",
                    "aac",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* ==========================
               OGG
            ========================== */

            else if (format === "ogg") {

                ffmpegArgs.push(

                    "-vn",

                    "-c:a",
                    "libvorbis",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* ==========================
               MP4
            ========================== */

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
                    `${audioQuality}k`,

                    "-movflags",
                    "+faststart"

                );

            }


            /* ==========================
               AUDIO NORMALISIEREN
            ========================== */

            if (
                req.body.normalizeAudio === "true"
            ) {

                ffmpegArgs.push(

                    "-af",
                    "loudnorm"

                );

            }


            /* ==========================
               METADATEN ENTFERNEN
            ========================== */

            if (
                req.body.removeMetadata === "true"
            ) {

                ffmpegArgs.push(

                    "-map_metadata",
                    "-1"

                );

            }


            /* ==========================
               OUTPUT
            ========================== */

            ffmpegArgs.push(
                outputFile
            );


            console.log(
                "Starte FFmpeg:"
            );

            console.log(
                ffmpegArgs.join(" ")
            );


            /* ==========================
               FFMPEG AUSFÜHREN
            ========================== */

            const ffmpegResult =
                await runFFmpeg(
                    ffmpegArgs
                );


            console.log(
                "FFmpeg erfolgreich beendet."
            );


            /* ==========================
               OUTPUT PRÜFEN
            ========================== */

            if (
                !fs.existsSync(outputFile)
            ) {

                throw new Error(
                    "FFmpeg wurde beendet, aber die Ausgabedatei wurde nicht erstellt."
                );

            }


            const stats =
                fs.statSync(
                    outputFile
                );


            if (stats.size === 0) {

                throw new Error(
                    "Die erzeugte Datei ist leer."
                );

            }


            /* ==========================
               INPUT LÖSCHEN
            ========================== */

            removeFile(
                inputFile
            );


            /* ==========================
               DOWNLOAD URL
            ========================== */

            const downloadUrl =
                `${req.protocol}://${req.get("host")}/downloads/${encodeURIComponent(outputName)}`;


            console.log(
                "Download:",
                downloadUrl
            );


            /* ==========================
               RESPONSE
            ========================== */

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
                "================================"
            );

            console.error(
                "KONVERTIERUNGSFEHLER"
            );

            console.error(
                error
            );

            console.error(
                "================================"
            );


            if (inputFile) {

                removeFile(
                    inputFile
                );

            }


            if (outputFile) {

                removeFile(
                    outputFile
                );

            }


            return res.status(500).json({

                success: false,

                error:
                    error.message ||
                    "Die Datei konnte nicht konvertiert werden."

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
   FFMPEG
========================================== */

function runFFmpeg(args) {

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


            process.stdout.on(
                "data",
                data => {

                    console.log(
                        data.toString()
                    );

                }
            );


            process.on(
                "error",
                error => {

                    reject(
                        new Error(
                            `FFmpeg konnte nicht gestartet werden: ${error.message}`
                        )
                    );

                }
            );


            process.on(
                "close",
                code => {

                    if (code === 0) {

                        resolve({
                            success: true
                        });

                    } else {

                        const lastError =
                            stderr
                                .slice(-3000)
                                .trim();


                        reject(
                            new Error(
                                `FFmpeg Fehler (Code ${code}): ${lastError}`
                            )
                        );

                    }

                }
            );

        }
    );

}


/* ==========================================
   FFMPEG VERSION
========================================== */

function runFFmpegVersion() {

    return new Promise(
        (resolve, reject) => {

            const process =
                spawn(
                    "ffmpeg",
                    [
                        "-version"
                    ]
                );


            let output = "";


            process.stdout.on(
                "data",
                data => {

                    output +=
                        data.toString();

                }
            );


            process.on(
                "error",
                error => {

                    reject(
                        error
                    );

                }
            );


            process.on(
                "close",
                code => {

                    if (code === 0) {

                        resolve(
                            output
                                .split("\n")[0]
                        );

                    } else {

                        reject(
                            new Error(
                                "FFmpeg ist nicht verfügbar."
                            )
                        );

                    }

                }
            );

        }
    );

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

function formatBytes(bytes) {

    if (bytes === 0) {

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