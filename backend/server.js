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
const TEMP_DIR = path.resolve("temp");

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

app.use(
    cors({
        origin: true,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type"]
    })
);

app.use(express.json());

/* =========================================================
   UPLOAD
========================================================= */

const storage = multer.diskStorage({
    destination: TEMP_DIR,

    filename: (req, file, callback) => {
        const id = crypto.randomBytes(16).toString("hex");

        const extension =
            path.extname(file.originalname) || ".bin";

        callback(null, `${id}${extension}`);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: 500 * 1024 * 1024
    }
});

/* =========================================================
   HOME
========================================================= */

app.get("/", async (req, res) => {

    res.json({
        success: true,
        service: "MediaForge API",
        status: "online",

        ytDlp: await commandAvailable("yt-dlp"),

        ffmpeg: await commandAvailable("ffmpeg"),

        deno: await commandAvailable("deno")
    });
});

/* =========================================================
   STATUS
========================================================= */

app.get("/api/status", async (req, res) => {

    res.json({
        success: true,

        status: "online",

        ytDlp:
            await commandAvailable("yt-dlp"),

        ffmpeg:
            await commandAvailable("ffmpeg"),

        deno:
            await commandAvailable("deno")
    });
});

/* =========================================================
   TOOLS
========================================================= */

app.get("/api/tools", async (req, res) => {

    res.json({

        success: true,

        tools: {

            "yt-dlp":
                await commandDetails("yt-dlp"),

            "ffmpeg":
                await commandDetails("ffmpeg"),

            "deno":
                await commandDetails("deno")

        }

    });
});

/* =========================================================
   CONVERT
========================================================= */

app.post(
    "/api/convert",
    upload.single("file"),
    async (req, res) => {

        let inputFile = null;
        let outputFile = null;

        try {

            const url =
                String(
                    req.body.url || ""
                ).trim();

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

            /* =================================================
               DATEINAME
            ================================================= */

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

            /* =================================================
               AUDIO QUALITÄT
            ================================================= */

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

            /* =================================================
               URL DOWNLOAD
            ================================================= */

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
                            "Diese Plattform wird nicht unterstützt."

                    });
                }

                console.log(
                    "======================================"
                );

                console.log(
                    "URL DOWNLOAD"
                );

                console.log(url);

                console.log(
                    "======================================"
                );

                const ytDlpAvailable =
                    await commandAvailable("yt-dlp");

                if (!ytDlpAvailable) {

                    throw new Error(
                        "yt-dlp ist auf dem Server nicht verfügbar."
                    );
                }

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
                 * WICHTIG:
                 *
                 * Wir laden zunächst das beste
                 * verfügbare Format herunter.
                 *
                 * Danach übernimmt FFmpeg
                 * die Konvertierung.
                 */

                const ytDlpArgs = [

                    "--no-playlist",

                    "--no-warnings",

                    "--restrict-filenames",

                    "--no-part",

                    "--remote-components",
                    "ejs:github",

                    "-f",
                    "bv*+ba/b",

                    "--merge-output-format",
                    "mp4",

                    "--retries",
                    "5",

                    "--fragment-retries",
                    "5",

                    "--retry-sleep",
                    "2",

                    "--socket-timeout",
                    "30",

                    "-o",
                    template,

                    url

                ];

                console.log(
                    "yt-dlp startet..."
                );

                const result =
                    await runCommand(
                        "yt-dlp",
                        ytDlpArgs
                    );

                console.log(
                    "yt-dlp beendet."
                );

                console.log(
                    result.stdout
                );

                console.log(
                    result.stderr
                );

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

                console.log(
                    "Download gefunden:",
                    inputFile
                );
            }

            /* =================================================
               DATEI-UPLOAD
            ================================================= */

            else {

                if (!req.file) {

                    return res.status(400).json({

                        success: false,

                        error:
                            "Bitte eine URL oder Datei auswählen."

                    });
                }

                inputFile =
                    req.file.path;
            }

            /* =================================================
               INPUT PRÜFEN
            ================================================= */

            if (
                !inputFile ||
                !fs.existsSync(inputFile)
            ) {

                throw new Error(
                    "Eingabedatei wurde nicht gefunden."
                );
            }

            /* =================================================
               FFMPEG PRÜFEN
            ================================================= */

            const ffmpegAvailable =
                await commandAvailable("ffmpeg");

            if (!ffmpegAvailable) {

                throw new Error(
                    "FFmpeg ist nicht verfügbar."
                );
            }

            /* =================================================
               OUTPUT
            ================================================= */

            const outputName =
                `${safeName}-${Date.now()}.${format}`;

            outputFile =
                path.join(
                    DOWNLOAD_DIR,
                    outputName
                );

            /* =================================================
               FFMPEG
            ================================================= */

            const ffmpegArgs = [

                "-y",

                "-i",
                inputFile

            ];

            /* =================================================
               MP3
            ================================================= */

            if (format === "mp3") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "libmp3lame",

                    "-b:a",
                    `${safeAudioQuality}k`

                );
            }

            /* =================================================
               M4A
            ================================================= */

            else if (format === "m4a") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "aac",

                    "-b:a",
                    `${safeAudioQuality}k`

                );
            }

            /* =================================================
               WAV
            ================================================= */

            else if (format === "wav") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "pcm_s16le"

                );
            }

            /* =================================================
               FLAC
            ================================================= */

            else if (format === "flac") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "flac"

                );
            }

            /* =================================================
               AAC
            ================================================= */

            else if (format === "aac") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "aac",

                    "-b:a",
                    `${safeAudioQuality}k`

                );
            }

            /* =================================================
               OGG
            ================================================= */

            else if (format === "ogg") {

                ffmpegArgs.push(

                    "-vn",

                    "-codec:a",
                    "libvorbis",

                    "-b:a",
                    `${safeAudioQuality}k`

                );
            }

            /* =================================================
               MP4
            ================================================= */

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

            /* =================================================
               NORMALIZE
            ================================================= */

            if (
                req.body.normalizeAudio === "true"
            ) {

                ffmpegArgs.push(

                    "-af",
                    "loudnorm"

                );
            }

            /* =================================================
               METADATEN
            ================================================= */

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

            await runCommand(
                "ffmpeg",
                ffmpegArgs
            );

            /* =================================================
               OUTPUT PRÜFEN
            ================================================= */

            if (
                !fs.existsSync(outputFile)
            ) {

                throw new Error(
                    "FFmpeg hat keine Ausgabedatei erzeugt."
                );
            }

            const stats =
                fs.statSync(
                    outputFile
                );

            /* =================================================
               INPUT LÖSCHEN
            ================================================= */

            removeFile(
                inputFile
            );

            inputFile = null;

            /* =================================================
               DOWNLOAD URL
            ================================================= */

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
                "MEDIAFORGE FEHLER:",
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

/* =========================================================
   DOWNLOADS
========================================================= */

app.use(
    "/downloads",
    express.static(
        DOWNLOAD_DIR
    )
);

/* =========================================================
   URL
========================================================= */

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

/* =========================================================
   PLATTFORM
========================================================= */

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

            hostname.endsWith(".youtube.com") ||

            hostname === "youtu.be" ||

            hostname === "tiktok.com" ||

            hostname.endsWith(".tiktok.com") ||

            hostname === "instagram.com" ||

            hostname.endsWith(".instagram.com")

        );

    } catch {

        return false;
    }
}

/* =========================================================
   COMMAND
========================================================= */

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

                    const text =
                        data.toString();

                    stdout += text;

                    console.log(
                        `[${command}]`,
                        text.trim()
                    );
                }
            );

            child.stderr.on(
                "data",
                data => {

                    const text =
                        data.toString();

                    stderr += text;

                    console.log(
                        `[${command}]`,
                        text.trim()
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

                        const details =
                            getCommandError(
                                stderr
                            );

                        reject(

                            new Error(

                                `${command} wurde mit Code ${code} beendet. ${details}`

                            )

                        );
                    }
                }
            );
        }
    );
}

/* =========================================================
   COMMAND VERFÜGBAR
========================================================= */

function commandAvailable(
    command
) {

    return new Promise(
        resolve => {

            const child =
                spawn(
                    command,
                    ["--version"],
                    {
                        env: process.env
                    }
                );

            let output = "";

            child.stdout.on(
                "data",
                data => {

                    output +=
                        data.toString();

                }
            );

            child.stderr.on(
                "data",
                data => {

                    output +=
                        data.toString();

                }
            );

            child.on(
                "error",
                () => {

                    resolve(false);

                }
            );

            child.on(
                "close",
                code => {

                    /*
                     * FFmpeg kann auf diesem Container
                     * Versioninformationen ausgeben,
                     * obwohl der Prozess einen anderen
                     * Exit-Code zurückgibt.
                     *
                     * Deshalb prüfen wir auch den Text.
                     */

                    if (
                        output
                            .toLowerCase()
                            .includes(
                                command.toLowerCase()
                            )
                    ) {

                        resolve(true);

                    } else {

                        resolve(
                            code === 0
                        );

                    }
                }
            );
        }
    );
}

/* =========================================================
   COMMAND DIAGNOSE
========================================================= */

function commandDetails(
    command
) {

    return new Promise(
        resolve => {

            const child =
                spawn(
                    command,
                    ["--version"],
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

                }
            );

            child.on(
                "error",
                error => {

                    resolve({

                        available: false,

                        exitCode: null,

                        output: "",

                        error:
                            error.message

                    });

                }
            );

            child.on(
                "close",
                code => {

                    const output =
                        (
                            stdout ||
                            stderr
                        ).slice(
                            0,
                            2000
                        );

                    resolve({

                        available:
                            output
                                .toLowerCase()
                                .includes(
                                    command.toLowerCase()
                                ) ||
                            code === 0,

                        exitCode:
                            code,

                        output

                    });

                }
            );
        }
    );
}

/* =========================================================
   FEHLER
========================================================= */

function getCommandError(
    stderr
) {

    if (!stderr) {

        return (
            "Keine detaillierte Fehlermeldung verfügbar."
        );
    }

    return stderr
        .split("\n")
        .map(
            line =>
                line.trim()
        )
        .filter(Boolean)
        .slice(-15)
        .join(" ");
}

/* =========================================================
   BASE URL
========================================================= */

function getBaseUrl(
    req
) {

    const forwardedProto =
        req.headers["x-forwarded-proto"];

    const protocol =
        forwardedProto ||
        req.protocol;

    return (
        `${protocol}://${req.get("host")}`
    );
}

/* =========================================================
   DELETE
========================================================= */

function removeFile(
    file
) {

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

/* =========================================================
   SIZE
========================================================= */

function formatBytes(
    bytes
) {

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

/* =========================================================
   FRIENDLY ERROR
========================================================= */

function getFriendlyError(
    error
) {

    const message =
        String(
            error?.message ||
            error
        );

    console.error(
        "DETAILLIERTER FEHLER:",
        message
    );

    return (
        message.slice(
            0,
            2000
        ) ||
        "Unbekannter Serverfehler."
    );
}

/* =========================================================
   START
========================================================= */

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