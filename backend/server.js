import express from "express";
import cors from "cors";
import multer from "multer";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const TMP_DIR = path.join(
    os.tmpdir(),
    "mediaforge"
);

const DOWNLOAD_DIR = path.join(
    TMP_DIR,
    "downloads"
);

fs.mkdirSync(
    TMP_DIR,
    { recursive: true }
);

fs.mkdirSync(
    DOWNLOAD_DIR,
    { recursive: true }
);

const upload = multer({
    dest: TMP_DIR
});


/* =====================================================
   TOOL TEST
===================================================== */

async function checkTool(
    command,
    args = ["--version"]
) {

    try {

        const result =
            await execFileAsync(
                command,
                args
            );

        return {
            available: true,
            exitCode: 0,
            output:
                (
                    result.stdout ||
                    result.stderr ||
                    ""
                ).trim()
        };

    } catch (error) {

        return {
            available: false,
            exitCode:
                error.code || 1,
            output:
                (
                    error.stdout ||
                    error.stderr ||
                    error.message ||
                    ""
                ).trim()
        };

    }

}


/* =====================================================
   PLATTFORM ERKENNEN
===================================================== */

function getPlatform(url) {

    try {

        const hostname =
            new URL(url)
                .hostname
                .toLowerCase();

        if (
            hostname === "youtube.com" ||
            hostname === "www.youtube.com" ||
            hostname === "m.youtube.com" ||
            hostname === "music.youtube.com" ||
            hostname === "youtu.be"
        ) {

            return "youtube";

        }

        if (
            hostname === "tiktok.com" ||
            hostname === "www.tiktok.com" ||
            hostname === "vm.tiktok.com" ||
            hostname === "vt.tiktok.com"
        ) {

            return "tiktok";

        }

        if (
            hostname === "instagram.com" ||
            hostname === "www.instagram.com"
        ) {

            return "instagram";

        }

        return "unknown";

    } catch {

        return "unknown";

    }

}


/* =====================================================
   URL PRÜFEN
===================================================== */

function isAllowedUrl(input) {

    try {

        const parsed =
            new URL(input);

        if (
            parsed.protocol !== "http:" &&
            parsed.protocol !== "https:"
        ) {

            return false;

        }

        return [
            "youtube",
            "tiktok",
            "instagram"
        ].includes(
            getPlatform(input)
        );

    } catch {

        return false;

    }

}


/* =====================================================
   DATEINAME
===================================================== */

function cleanFilename(
    filename
) {

    let name =
        String(
            filename ||
            "mediaforge-download"
        )
            .trim()
            .replace(
                /[<>:"/\\|?*\x00-\x1F]/g,
                ""
            )
            .replace(
                /\s+/g,
                "-"
            )
            .replace(
                /-+/g,
                "-"
            );

    if (!name) {

        name =
            "mediaforge-download";

    }

    return name.substring(
        0,
        100
    );

}


/* =====================================================
   FORMATE
===================================================== */

const allowedFormats = [
    "mp3",
    "mp4",
    "m4a",
    "wav",
    "flac",
    "aac",
    "ogg"
];


function getExtension(
    format
) {

    return allowedFormats.includes(
        format
    )
        ? format
        : "mp3";

}


/* =====================================================
   MIME TYPES
===================================================== */

function getContentType(
    extension
) {

    const types = {

        mp3:
            "audio/mpeg",

        mp4:
            "video/mp4",

        m4a:
            "audio/mp4",

        wav:
            "audio/wav",

        flac:
            "audio/flac",

        aac:
            "audio/aac",

        ogg:
            "audio/ogg"

    };

    return (
        types[extension] ||
        "application/octet-stream"
    );

}


/* =====================================================
   API START
===================================================== */

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            service:
                "MediaForge API",

            status:
                "online",

            ytDlp:
                true,

            ffmpeg:
                true,

            deno:
                true

        });

    }
);


/* =====================================================
   STATUS
===================================================== */

app.get(
    "/api/status",
    async (req, res) => {

        const ytDlp =
            await checkTool(
                "yt-dlp"
            );

        const ffmpeg =
            await checkTool(
                "ffmpeg",
                ["-version"]
            );

        const deno =
            await checkTool(
                "deno"
            );

        res.json({

            success: true,

            tools: {

                "yt-dlp":
                    ytDlp,

                ffmpeg:
                    ffmpeg,

                deno:
                    deno

            }

        });

    }
);


/* =====================================================
   DOWNLOAD / CONVERT
===================================================== */

app.post(
    "/api/convert",
    upload.none(),
    async (req, res) => {

        const url =
            String(
                req.body.url ||
                ""
            ).trim();

        const format =
            String(
                req.body.format ||
                "mp3"
            ).toLowerCase();

        const quality =
            String(
                req.body.audioQuality ||
                req.body.quality ||
                "192"
            );

        const filename =
            cleanFilename(
                req.body.filename
            );


        /* -----------------------------------------------
           URL
        ----------------------------------------------- */

        if (!url) {

            return res.status(400).json({

                success: false,

                error:
                    "Bitte eine URL eingeben."

            });

        }


        if (!isAllowedUrl(url)) {

            return res.status(400).json({

                success: false,

                error:
                    "Bitte eine öffentliche YouTube-, TikTok- oder Instagram-URL verwenden."

            });

        }


        /* -----------------------------------------------
           FORMAT
        ----------------------------------------------- */

        if (
            !allowedFormats.includes(
                format
            )
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Dieses Format wird nicht unterstützt."

            });

        }


        const platform =
            getPlatform(url);

        const extension =
            getExtension(format);


        /* -----------------------------------------------
           TEMP ORDNER
        ----------------------------------------------- */

        const id =
            crypto.randomBytes(
                12
            ).toString("hex");

        const workDir =
            path.join(
                TMP_DIR,
                id
            );

        fs.mkdirSync(
            workDir,
            {
                recursive: true
            }
        );


        const outputBase =
            path.join(
                workDir,
                "mediaforge"
            );


        const finalFilename =
            `${filename}.${extension}`;


        const finalPath =
            path.join(
                workDir,
                finalFilename
            );


        try {

            /* -------------------------------------------
               YT-DLP
            ------------------------------------------- */

            const args = [

                "--no-playlist",

                "--no-warnings",

                "--restrict-filenames",

                "--output",

                `${outputBase}.%(ext)s`

            ];


            /* -------------------------------------------
               AUDIO
            ------------------------------------------- */

            if (
                format !== "mp4"
            ) {

                args.push(

                    "--extract-audio",

                    "--audio-format",

                    format

                );


                if (
                    format === "mp3" ||
                    format === "m4a" ||
                    format === "aac" ||
                    format === "ogg"
                ) {

                    args.push(

                        "--audio-quality",

                        `${quality}K`

                    );

                }

            }

            else {

                /* ---------------------------------------
                   VIDEO
                --------------------------------------- */

                args.push(

                    "--merge-output-format",

                    "mp4"

                );

            }


            args.push(
                url
            );


            /* -------------------------------------------
               DOWNLOAD
            ------------------------------------------- */

            await execFileAsync(

                "yt-dlp",

                args,

                {

                    cwd:
                        workDir,

                    maxBuffer:
                        20 *
                        1024 *
                        1024

                }

            );


            /* -------------------------------------------
               DATEI FINDEN
            ------------------------------------------- */

            const files =
                fs.readdirSync(
                    workDir
                );


            const mediaFile =
                files.find(
                    file =>
                        /\.(mp3|mp4|m4a|wav|flac|aac|ogg)$/i
                            .test(file)
                );


            if (!mediaFile) {

                throw new Error(
                    "Keine fertige Mediendatei gefunden."
                );

            }


            const generatedPath =
                path.join(
                    workDir,
                    mediaFile
                );


            /* -------------------------------------------
               DATEI UMBENENNEN
            ------------------------------------------- */

            fs.renameSync(

                generatedPath,

                finalPath

            );


            /* -------------------------------------------
               DATEIGRÖSSE
            ------------------------------------------- */

            const stats =
                fs.statSync(
                    finalPath
                );


            const sizeMB =
                (
                    stats.size /
                    1024 /
                    1024
                ).toFixed(2);


            /* -------------------------------------------
               DOWNLOAD ID
            ------------------------------------------- */

            const downloadId =
                crypto.randomBytes(
                    16
                ).toString("hex");


            const downloadPath =
                path.join(

                    DOWNLOAD_DIR,

                    `${downloadId}-${finalFilename}`

                );


            fs.copyFileSync(

                finalPath,

                downloadPath

            );


            /* -------------------------------------------
               DOWNLOAD URL
            ------------------------------------------- */

            const protocol =
                req.headers[
                    "x-forwarded-proto"
                ] ||
                req.protocol;


            const host =
                req.get(
                    "host"
                );


            const downloadUrl =
                `${protocol}://${host}/api/download/${encodeURIComponent(
                    downloadId
                )}/${encodeURIComponent(
                    finalFilename
                )}`;


            /* -------------------------------------------
               ERFOLG
            ------------------------------------------- */

            res.json({

                success: true,

                platform:
                    platform,

                filename:
                    finalFilename,

                format:
                    extension,

                size:
                    `${sizeMB} MB`,

                downloadUrl:
                    downloadUrl

            });


            /* -------------------------------------------
               TEMPORÄRE DATEI LÖSCHEN
            ------------------------------------------- */

            setTimeout(
                () => {

                    try {

                        fs.rmSync(
                            workDir,
                            {
                                recursive:
                                    true,
                                force:
                                    true
                            }
                        );

                    } catch {}

                },
                5000
            );


        } catch (error) {

            console.error(
                "MediaForge conversion error:",
                error
            );


            try {

                fs.rmSync(
                    workDir,
                    {
                        recursive:
                            true,
                        force:
                            true
                    }
                );

            } catch {}


            const stderr =
                String(
                    error.stderr ||
                    ""
                );


            const lowerError =
                stderr.toLowerCase();


            /* -------------------------------------------
               YOUTUBE BLOCK
            ------------------------------------------- */

            if (
                lowerError.includes(
                    "sign in to confirm"
                ) ||
                lowerError.includes(
                    "not a bot"
                ) ||
                lowerError.includes(
                    "confirm you're not a bot"
                ) ||
                lowerError.includes(
                    "cookies-from-browser"
                )
            ) {

                return res.status(
                    403
                ).json({

                    success:
                        false,

                    platform:
                        "youtube",

                    error:
                        "YouTube blockiert den Zugriff von diesem Server momentan. Es wurden keine persönlichen Cookies verwendet."

                });

            }


            /* -------------------------------------------
               INSTAGRAM
            ------------------------------------------- */

            if (
                platform ===
                "instagram"
            ) {

                if (
                    lowerError.includes(
                        "login"
                    ) ||
                    lowerError.includes(
                        "private"
                    ) ||
                    lowerError.includes(
                        "sign in"
                    )
                ) {

                    return res.status(
                        403
                    ).json({

                        success:
                            false,

                        platform:
                            "instagram",

                        error:
                            "Instagram verlangt für diesen Inhalt eine Anmeldung oder der Inhalt ist nicht öffentlich verfügbar."

                    });

                }

            }


            /* -------------------------------------------
               TIKTOK
            ------------------------------------------- */

            if (
                platform ===
                "tiktok"
            ) {

                if (
                    lowerError.includes(
                        "login"
                    ) ||
                    lowerError.includes(
                        "private"
                    ) ||
                    lowerError.includes(
                        "unavailable"
                    )
                ) {

                    return res.status(
                        403
                    ).json({

                        success:
                            false,

                        platform:
                            "tiktok",

                        error:
                            "Dieser TikTok-Inhalt ist momentan nicht öffentlich verfügbar."

                    });

                }

            }


            /* -------------------------------------------
               ALLGEMEINER FEHLER
            ------------------------------------------- */

            return res.status(
                500
            ).json({

                success:
                    false,

                platform:
                    platform,

                error:
                    "Der Download konnte nicht verarbeitet werden.",

                details:
                    stderr.trim() ||
                    error.message ||
                    "Unbekannter Fehler."

            });

        }

    }
);


/* =====================================================
   DOWNLOAD DATEI
===================================================== */

app.get(
    "/api/download/:id/:filename",
    (req, res) => {

        const id =
            String(
                req.params.id
            );


        const filename =
            cleanFilename(
                decodeURIComponent(
                    req.params.filename
                )
            );


        const files =
            fs.readdirSync(
                DOWNLOAD_DIR
            );


        const matchingFile =
            files.find(
                file =>
                    file.startsWith(
                        id + "-"
                    )
            );


        if (!matchingFile) {

            return res.status(
                404
            ).send(
                "Datei nicht mehr verfügbar."
            );

        }


        const filePath =
            path.join(
                DOWNLOAD_DIR,
                matchingFile
            );


        const extension =
            path.extname(
                filename
            )
                .replace(
                    ".",
                    ""
                )
                .toLowerCase();


        /* -------------------------------------------
           SAFARI / IPHONE
        ------------------------------------------- */

        res.setHeader(
            "Content-Type",
            getContentType(
                extension
            )
        );


        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );


        res.setHeader(
            "Content-Length",
            fs.statSync(
                filePath
            ).size
        );


        res.setHeader(
            "Cache-Control",
            "no-store"
        );


        res.setHeader(
            "X-Content-Type-Options",
            "nosniff"
        );


        res.sendFile(
            path.resolve(
                filePath
            ),
            error => {

                if (error) {

                    console.error(
                        "Download error:",
                        error
                    );

                }

            }
        );


        /* -------------------------------------------
           DATEI NACH 10 MINUTEN LÖSCHEN
        ------------------------------------------- */

        setTimeout(
            () => {

                try {

                    if (
                        fs.existsSync(
                            filePath
                        )
                    ) {

                        fs.unlinkSync(
                            filePath
                        );

                    }

                } catch {}

            },
            10 * 60 * 1000
        );

    }
);


/* =====================================================
   SERVER START
===================================================== */

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