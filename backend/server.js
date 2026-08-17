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


/* =========================
   CORS
========================= */

app.use(
    cors({
        origin: true,
        methods: ["GET", "POST", "OPTIONS"]
    })
);

app.use(express.json());


/* =========================
   FILE UPLOAD
========================= */

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

        fileSize:
            500 * 1024 * 1024

    }

});


/* =========================
   TEST
========================= */

app.get("/", (req, res) => {

    res.json({

        success: true,

        service:
            "MediaForge API",

        status:
            "online",

        ffmpeg:
            "available"

    });

});


/* =========================
   CONVERT
========================= */

app.post(
    "/api/convert",
    upload.single("file"),

    async (req, res) => {

        let inputFile = null;

        try {

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Bitte eine Datei hochladen."

                });

            }


            inputFile =
                req.file.path;


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
                        "Dieses Format wird nicht unterstützt."

                });

            }


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
                    .trim() ||
                "mediaforge-datei";


            const outputName =
                `${safeName}-${Date.now()}.${format}`;


            const outputFile =
                path.join(
                    DOWNLOAD_DIR,
                    outputName
                );


            const audioQuality =
                String(
                    req.body.audioQuality || "192"
                );


            const ffmpegArgs = [

                "-y",

                "-i",
                inputFile

            ];


            /* =========================
               MP3
            ========================= */

            if (format === "mp3") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "libmp3lame",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* =========================
               M4A
            ========================= */

            else if (format === "m4a") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "aac",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* =========================
               WAV
            ========================= */

            else if (format === "wav") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "pcm_s16le"

                );

            }


            /* =========================
               FLAC
            ========================= */

            else if (format === "flac") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "flac"

                );

            }


            /* =========================
               AAC
            ========================= */

            else if (format === "aac") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "aac",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* =========================
               OGG
            ========================= */

            else if (format === "ogg") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "libvorbis",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* =========================
               MP4
            ========================= */

            else if (format === "mp4") {

                ffmpegArgs.push(

                    "-codec:v",
                    "libx264",

                    "-preset",
                    "medium",

                    "-crf",
                    "23",

                    "-codec:a",
                    "aac",

                    "-b:a",
                    `${audioQuality}k`

                );

            }


            /* =========================
               NORMALIZE
            ========================= */

            if (
                req.body.normalizeAudio === "true"
            ) {

                ffmpegArgs.push(

                    "-af",
                    "loudnorm"

                );

            }


            /* =========================
               REMOVE METADATA
            ========================= */

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


            /* =========================
               FFmpeg
            ========================= */

            await runFFmpeg(
                ffmpegArgs
            );


            const stats =
                fs.statSync(
                    outputFile
                );


            removeFile(
                inputFile
            );


            const downloadUrl =
                `${getBaseUrl(req)}/downloads/${encodeURIComponent(outputName)}`;


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
                "FFmpeg error:",
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
                    "Die Datei konnte nicht konvertiert werden."

            });

        }

    }

);


/* =========================
   DOWNLOAD
========================= */

app.use(
    "/downloads",
    express.static(
        DOWNLOAD_DIR
    )
);


/* =========================
   FFmpeg
========================= */

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
                            stderr
                        );

                        reject(
                            new Error(
                                `FFmpeg Fehler: ${code}`
                            )
                        );

                    }

                }
            );

        }
    );

}


/* =========================
   URL
========================= */

function getBaseUrl(req) {

    return `${req.protocol}://${req.get("host")}`;

}


/* =========================
   FILE DELETE
========================= */

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


/* =========================
   FILE SIZE
========================= */

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


/* =========================
   START
========================= */

app.listen(
    PORT,
    () => {

        console.log(
            `MediaForge API läuft auf Port ${PORT}`
        );

    }
);